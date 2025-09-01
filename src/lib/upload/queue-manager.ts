import { QueueItem, UploadGroup } from "./types";
import { parseFilename, determineLibrary, determineCollection } from "../filename-parser";
import { showToast } from "../../hooks/use-toast";
import type { Year } from "../../types/common";

export class QueueManager {
  private queue: QueueItem[] = [];
  private failedItems: QueueItem[] = [];
  private onQueueUpdate: (groups: UploadGroup[]) => void;
  private processingCount = 0;
  private maxConcurrent = 4;
  private nextItemToProcess = 0;
  private isGloballyPaused = false;

  constructor(onQueueUpdate: (groups: UploadGroup[]) => void) {
    this.onQueueUpdate = onQueueUpdate;
  }

  /**
   * تعيين الحد الأقصى لعمليات الرفع المتزامنة
   */
  setMaxConcurrent(maxConcurrent: number): void {
    if (maxConcurrent >= 1) {
      this.maxConcurrent = maxConcurrent;
      console.log(`Max concurrent uploads set to ${this.maxConcurrent}`);
    }
  }

  /**
   * إعداد معاينة الملفات قبل الرفع
   */
  previewFiles(files: File[], selectedYear: string, appendToExisting: boolean = false): void {
    // Only clear failed items if not appending
    if (!appendToExisting) {
      this.failedItems = [];
    }
    
    for (const file of files) {
      let queueItem: QueueItem;
      try {
        const parseResult = parseFilename(file.name, selectedYear);
        // Always try to determine library name and collection, even if parsing is partial
        const suggestedLibraryName = determineLibrary(parseResult || { type: 'FULL', academicYear: selectedYear });
        const collectionResult = determineCollection(parseResult || { type: 'FULL', academicYear: selectedYear }, selectedYear);

        if (!parseResult) {
          // Handle cases where even basic parsing fails, though determineLibrary/Collection have fallbacks
          console.warn(`[QueueManager] Basic parsing failed for ${file.name}, using fallbacks.`);
        }

        queueItem = {
          id: `${Date.now()}-${Math.random().toString(36).substring(2)}`,
          file,
          filename: file.name,
          status: "pending",
          progress: 0,
          isPaused: false,
          metadata: {
            library: "", // Initially empty
            collection: "", // Initially empty
            year: selectedYear,
            needsManualSelection: true, // Default to true until matched
            suggestedCollection: collectionResult.name,
            reason: collectionResult.reason,
            suggestedLibraryName: suggestedLibraryName, // Store the determined name
          }
        };
        
        this.failedItems.push(queueItem);
      } catch (error) {
        // Catch errors during parsing/determining
        console.error(`Error processing file ${file.name} for preview:`, error);
        const fallbackCollection = determineCollection({ type: 'FULL', academicYear: selectedYear });
        queueItem = {
          id: `${Date.now()}-${Math.random().toString(36).substring(2)}`,
          file,
          filename: file.name,
          status: "pending",
          progress: 0,
          isPaused: false,
          metadata: {
            library: "",
            collection: "",
            year: selectedYear,
            needsManualSelection: true,
            suggestedCollection: fallbackCollection.name, // Fallback collection
            reason: fallbackCollection.reason,
            suggestedLibraryName: "Unknown Library" // Fallback library name
          }
        };
        this.failedItems.push(queueItem);
        
        showToast({
          title: "File Processing Error",
          description: `Could not fully process ${file.name}. It needs manual selection.`,
          variant: "warning"
        });
      }
    }
    // Note: Library matching happens after this in UploadManager.previewFiles
    // We update groups here initially, and again after matching.
    this.updateGroups();
  }

  /**
   * تحديث ميتاداتا الملف يدويًا
   */
  updateFileMetadata(fileId: string, libraryId: string, libraryName: string): void { // Accept libraryName too
    const item = this.findFile(fileId);
    if (item) {
      // Check if it was previously needing manual selection
      const wasManual = item.metadata.needsManualSelection;

      item.metadata.library = libraryId;
      item.metadata.libraryName = libraryName; // Store library name
      // Use the suggested collection if the main collection isn't set yet
      // Correctly use parseFilename result
      const parseResult = parseFilename(item.filename);
      item.metadata.collection = item.metadata.collection || item.metadata.suggestedCollection || determineCollection(parseResult || { type: 'FULL', academicYear: item.metadata.year }).name;
      item.metadata.needsManualSelection = false; // Mark as resolved
      item.metadata.confidence = 100; // Manual selection implies 100% confidence

      // نقل من قائمة الفاشلة إلى قائمة الانتظار إذا كان موجوداً فيها
      const failedIndex = this.failedItems.findIndex(i => i.id === fileId);
      if (failedIndex !== -1) {
        const [movedItem] = this.failedItems.splice(failedIndex, 1);
        // Ensure status is pending if it wasn't already processing/paused
        if (movedItem.status !== 'processing' && movedItem.status !== 'paused') {
            movedItem.status = 'pending';
        }
        this.queue.push(movedItem); // Add to the main queue
        this.sortQueue(); // Re-sort the main queue
      }

      this.updateGroups();

      // Show toast only if it was previously needing manual selection
      if (wasManual) {
         showToast({
           title: "✅ File Info Updated",
           description: `Library "${libraryName}" assigned to file "${item.filename}". Ready for upload.`,
           variant: "success",
           duration: 3000
         });
      }
    }
  }

  /**
   * تحديث مجموعات العرض
   */
  updateGroups(): void {
    const groups: UploadGroup[] = [];
    const groupMap = new Map<string, UploadGroup>();

    // Group files needing manual selection by suggested library and collection
    const manualSelectionGroups = new Map<string, { items: QueueItem[], suggestedLibraryName: string, suggestedCollection: string }>();
    this.failedItems.forEach(item => {
        // Use determined library name and collection name for grouping key
        const key = `${item.metadata.suggestedLibraryName || 'Unknown Library'}|${item.metadata.suggestedCollection || 'Unknown Collection'}`;
        if (!manualSelectionGroups.has(key)) {
            manualSelectionGroups.set(key, {
                items: [],
                suggestedLibraryName: item.metadata.suggestedLibraryName || 'Unknown Library',
                suggestedCollection: item.metadata.suggestedCollection || 'Unknown Collection'
            });
        }
        manualSelectionGroups.get(key)?.items.push(item);
    });

    manualSelectionGroups.forEach((groupData) => {
        groups.push({
            library: "Needs Manual Selection", // Group type identifier
            collection: groupData.suggestedCollection, // Display suggested collection
            items: groupData.items,
            needsManualSelection: true,
            suggestedLibraryName: groupData.suggestedLibraryName // Store suggested library name for the header
        });
    });


    // إضافة باقي المجموعات (الملفات الجاهزة للرفع أو قيد الرفع)
    for (const item of this.queue) {
       // Use libraryName if available, otherwise library ID
       const libraryIdentifier = item.metadata.libraryName || item.metadata.library || 'Unknown Library'; // Added fallback
       const collectionIdentifier = item.metadata.collection || item.metadata.suggestedCollection || 'Unknown Collection'; // Added fallback
       const key = `${libraryIdentifier}|${collectionIdentifier}`;

      if (!groupMap.has(key)) {
        groupMap.set(key, {
          library: libraryIdentifier,
          collection: collectionIdentifier,
          items: [],
          needsManualSelection: false // These items are ready or processing
        });
      }
      groupMap.get(key)?.items.push(item);
    }

    groups.push(...Array.from(groupMap.values()));

     // Sort groups: Manual selection first, then alphabetically by library/collection
     groups.sort((a, b) => {
       if (a.needsManualSelection && !b.needsManualSelection) return -1;
       if (!a.needsManualSelection && b.needsManualSelection) return 1;
       // If both need manual selection, sort by suggested library then collection
       if (a.needsManualSelection && b.needsManualSelection) {
           const libComp = (a.suggestedLibraryName || '').localeCompare(b.suggestedLibraryName || '');
           if (libComp !== 0) return libComp;
           return (a.collection || '').localeCompare(b.collection || '');
       }
       // Otherwise, sort by actual library/collection
       const keyA = `${a.library}|${a.collection}`;
       const keyB = `${b.library}|${b.collection}`;
       return keyA.localeCompare(keyB);
     });


    this.onQueueUpdate(groups);
  }

  /**
   * إيقاف الرفع مؤقتًا
   */
  pauseUpload(fileId: string): void {
    const item = this.findFile(fileId);
    if (item) {
      // إيقاف الطلب الحالي
      if (item.controller) {
        item.controller.abort('pause');
      }
      
      // تعيين حالة الإيقاف المؤقت
      item.isPaused = true;
      item.status = "paused";
      
      // حفظ موقع التوقف الحالي
      item.pausedAt = item.lastBytesLoaded;
      
      this.updateGroups();
    }
  }

  /**
   * استئناف الرفع
   */
  resumeUpload(fileId: string): void {
    const item = this.findFile(fileId);
    if (item && item.isPaused) {
      // إعادة تعيين حالة الملف
      item.isPaused = false;
      item.status = "processing";
      item.controller = new AbortController();
      
      this.updateGroups();
    }
  }

  /**
   * إلغاء الرفع
   */
  cancelUpload(fileId: string): void {
    const item = this.findFile(fileId);
    if (item && item.controller) {
      item.controller.abort('cancel');
      // Remove from both queues
      this.queue = this.queue.filter(i => i.id !== fileId);
      this.failedItems = this.failedItems.filter(i => i.id !== fileId); // Also remove from failed
      
      // عرض رسالة تحذير حول الحاجة إلى التنظيف اليدوي
      showToast({
        title: "Upload Cancelled",
        description: `Upload for "${item.filename}" cancelled. Note: You might need to manually delete partially uploaded data from Bunny.net.`,
        variant: "warning",
        duration: 7000 // Longer duration for important note
      });
      
      // Manually decrement count if it was processing
      if (item.status === 'processing') {
         this.setProcessingCount(this.getProcessingCount() - 1);
      }
      this.updateGroups();
    } else if (item) { // Handle cancellation of pending items not yet processing
        this.queue = this.queue.filter(i => i.id !== fileId);
        this.failedItems = this.failedItems.filter(i => i.id !== fileId);
         showToast({
            title: "Upload Removed",
            description: `Upload for "${item.filename}" removed from queue.`,
            variant: "default",
            duration: 3000
         });
        this.updateGroups();
    }
  }

  /**
   * تبديل حالة الإيقاف المؤقت العامة
   */
  toggleGlobalPause(): boolean {
    this.isGloballyPaused = !this.isGloballyPaused;
    
    if (this.isGloballyPaused) {
      // إيقاف جميع عمليات الرفع النشطة
      this.queue.forEach(item => {
        if (item.status === "processing") {
          item.controller?.abort('pause');
          item.isPaused = true;
          item.status = "paused";
        }
      });
    }
    
    this.updateGroups();
    return this.isGloballyPaused;
  }

  /**
   * فرز قائمة الانتظار
   */
  sortQueue(): void {
    this.queue.sort((a, b) => {
      // إزالة الامتدادات والمقارنة
      const nameA = a.filename.split('.')[0];
      const nameB = b.filename.split('.')[0];

      // أولاً التقسيم حسب رقم السؤال Q
      const baseNameA = nameA.split(/Q\d+/)[0];
      const baseNameB = nameB.split(/Q\d+/)[0];

      if (baseNameA !== baseNameB) {
        return baseNameA.localeCompare(baseNameA);
      }

      // ثم الفرز حسب رقم السؤال
      const qNumA = parseInt(nameA.match(/Q(\d+)/)?.[1] || "0");
      const qNumB = parseInt(nameB.match(/Q(\d+)/)?.[1] || "0");
      return qNumA - qNumB;
    });
  }

  /**
   * مسح قائمة الانتظار
   */
  clearQueue(): void {
    this.queue = [];
    this.failedItems = [];
    this.updateGroups();
  }

  /**
   * التحقق مما إذا كانت هناك عمليات رفع نشطة
   */
  hasActiveUploads(): boolean {
    return this.queue.some(item => 
      item.status === "processing" || item.status === "pending"
    );
  }

  /**
   * إزالة ملف من قائمة الانتظار
   */
  removeFileFromQueue(filename: string): void {
    // إزالة من قائمة الانتظار الرئيسية
    this.queue = this.queue.filter(item => item.filename !== filename);
    
    // إزالة من العناصر الفاشلة
    this.failedItems = this.failedItems.filter(item => item.filename !== filename);
    
    // تحديث المجموعات بعد الإزالة
    this.updateGroups();
  }

  /**
   * العثور على ملف بواسطة المعرف
   */
  findFile(fileId: string): QueueItem | undefined {
    return [...this.queue, ...this.failedItems].find(item => item.id === fileId);
  }

  /**
   * الحصول على العنصر التالي من قائمة الانتظار
   */
  getNextPendingItem(): QueueItem | undefined {
    return this.queue.find(item => item.status === "pending");
  }

  /**
   * إظافة ملف إلى قائمة الانتظار
   */
  addToQueue(queueItem: QueueItem): void {
    this.queue.push(queueItem);
    this.updateGroups();
  }

  /**
   * إضافة ملف إلى العناصر التي فشلت
   */
  addToFailedItems(queueItem: QueueItem): void {
    this.failedItems.push(queueItem);
    this.updateGroups();
  }

  /**
   * تحديث حالة عنصر
   */
  updateItemStatus(fileId: string, status: "pending" | "processing" | "completed" | "error" | "paused"): void {
    const item = this.findFile(fileId);
    if (item) {
      item.status = status;
      this.updateGroups();
    }
  }

  /**
   * الحصول على القائمة الكاملة
   */
  getQueue(): QueueItem[] {
    return [...this.queue];
  }

  /**
   * الحصول على العناصر الفاشلة
   */
  getFailedItems(): QueueItem[] {
    return [...this.failedItems];
  }

  /**
   * تعيين قيمة عداد المعالجة
   */
  setProcessingCount(count: number): void {
    this.processingCount = Math.max(0, count); // Ensure count doesn't go below 0
  }

  /**
   * الحصول على عداد المعالجة
   */
  getProcessingCount(): number {
    return this.processingCount;
  }

  /**
   * زيادة عداد المعالجة
   */
  incrementProcessingCount(): void {
     this.processingCount++;
  }

  /**
   * إنقاص عداد المعالجة
   */
  decrementProcessingCount(): void {
     this.processingCount = Math.max(0, this.processingCount - 1);
  }

  /**
   * نقل عنصر من قائمة الفشل إلى قائمة الانتظار الرئيسية
   */
  moveItemFromFailedToQueue(fileId: string): void {
    const index = this.failedItems.findIndex(item => item.id === fileId);
    if (index !== -1) {
      const [movedItem] = this.failedItems.splice(index, 1);
      // Ensure status is appropriate (e.g., pending if it needs processing again)
      if (movedItem.status !== 'processing' && movedItem.status !== 'paused') {
          movedItem.status = 'pending';
      }
      this.queue.push(movedItem);
      this.sortQueue(); // Re-sort the main queue
      this.updateGroups();
    }
  }

   /**
    * الحصول على حالة الإيقاف المؤقت العامة
    */
   getGlobalPauseStatus(): boolean {
     return this.isGloballyPaused;
   }

  /**
   * Clear any remaining loading states from the queue
   */
  clearLoadingStates(): void {
    this.queue.forEach(item => {
      if (item.status === "processing" || item.status === "pending") {
        // Only update items that are still in a loading state
        item.status = item.progress === 100 ? "completed" : "error";
      }
    });
    this.updateGroups();
  }

} // End of QueueManager class