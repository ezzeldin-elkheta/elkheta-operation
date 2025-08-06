import { QueueItem, UploadGroup, UploadResult, UploadSettings, UploadStatus } from "./upload/types"; // Import UploadStatus
import { QueueManager } from "./upload/queue-manager";
import { LibraryMatcher } from "./upload/library-matcher";
import { UploadOperations } from "./upload/upload-operations";
import { SheetUpdater } from "./upload/sheet-updater";
import { parseFilename, determineLibrary, determineCollection } from "./filename-parser";
import type { Year } from "../types/common";
import { showToast } from "../hooks/use-toast";
import { bunnyService } from "./bunny/service";
import { cache } from "./cache"; // Add cache import
import { type SheetConfig } from "./sheet-config/sheet-config-manager"; // Add sheet config import

// Define an interface for the upload operations callback
interface UploadOperationsInterface {
  getUploadResults: () => any[];
  setUploadResults: (results: any[]) => void;
}

// Helper function to extract video duration from file
const extractVideoDurationFromFile = (file: File): Promise<number | undefined> => {
  return new Promise((resolve) => {
    if (!file.type.startsWith('video/')) {
      resolve(undefined);
      return;
    }

    const video = document.createElement('video');
    video.preload = 'metadata';
    
    const cleanup = () => {
      if (video.src) {
        URL.revokeObjectURL(video.src);
      }
    };
    
    // Set timeout to avoid hanging
    const timeout = setTimeout(() => {
      console.warn(`[FILE] Timeout loading video metadata for "${file.name}"`);
      cleanup();
      resolve(undefined);
    }, 10000); // 10 second timeout
    
    video.onloadedmetadata = () => {
      clearTimeout(timeout);
      const duration = video.duration;
      cleanup();
      if (isFinite(duration) && duration > 0) {
        console.log(`[FILE] Extracted duration for "${file.name}": ${Math.round(duration)}s (${Math.round(duration/60)}m)`);
        resolve(Math.round(duration));
      } else {
        console.warn(`[FILE] Could not extract valid duration for "${file.name}"`);
        resolve(undefined);
      }
    };
    
    video.onerror = () => {
      clearTimeout(timeout);
      console.warn(`[FILE] Error loading video metadata for "${file.name}"`);
      cleanup();
      resolve(undefined);
    };
    
    try {
      video.src = URL.createObjectURL(file);
    } catch (error) {
      clearTimeout(timeout);
      console.warn(`[FILE] Error creating object URL for "${file.name}":`, error);
      resolve(undefined);
    }
  });
};

export class UploadManager {
  private queueManager: QueueManager;
  private libraryMatcher: LibraryMatcher;
  private uploadOperations: UploadOperations;
  private sheetUpdater: SheetUpdater;
  private onVideoUploaded?: (videoTitle: string, videoGuid: string, libraryId: string) => void;
  private completionCallback: ((results: UploadResult[]) => void) | null = null;
  private totalFiles: number = 0;
  private successfulUploadsCount: number = 0; // Track successful uploads for sheet update counting
  private currentSheetConfig: SheetConfig | null = null; // Add sheet config tracking
  private uploadSettings: UploadSettings = {
    chunkSize: 20 * 1024 * 1024, // 20 MB
    maxConcurrentUploads: 4,
    useStreaming: true,
    retryAttempts: 3,
    useTusThresholdMB: 100,
    timeoutMs: 30000,
    retryDelays: [1000, 2000, 4000],
    enableResumableSessions: true,
    sessionExpiryHours: 24,
    enableAutoRetry: true,
    enableConnectionCheck: true
  };
  private isProcessing = false;

  constructor(
    onQueueUpdate: (groups: UploadGroup[]) => void,
    onVideoUploaded?: (videoTitle: string, videoGuid: string, libraryId: string) => void
  ) {
    this.queueManager = new QueueManager(onQueueUpdate);
    this.libraryMatcher = new LibraryMatcher();
    this.uploadOperations = new UploadOperations();

    // Create an adapter for the UploadOperationsInterface
    const uploadOperationsAdapter: UploadOperationsInterface = {
      getUploadResults: () => this.uploadOperations.getUploadResults(),
      setUploadResults: (results) => this.uploadOperations.setUploadResults(results)
    };

    this.sheetUpdater = new SheetUpdater(uploadOperationsAdapter, () => this.onAllSheetsUpdated());
    this.onVideoUploaded = this.onVideoUploadedHandler.bind(this);

    // Apply initial settings
    this.uploadOperations.setSettings({
      chunkSize: this.uploadSettings.chunkSize,
      maxConcurrentUploads: this.uploadSettings.maxConcurrentUploads,
      useStreaming: this.uploadSettings.useStreaming,
      retryAttempts: this.uploadSettings.retryAttempts,
      useTusThresholdMB: this.uploadSettings.useTusThresholdMB,
      timeoutMs: this.uploadSettings.timeoutMs,
      retryDelays: this.uploadSettings.retryDelays,
      enableResumableSessions: this.uploadSettings.enableResumableSessions,
      sessionExpiryHours: this.uploadSettings.sessionExpiryHours,
      enableAutoRetry: this.uploadSettings.enableAutoRetry,
      enableConnectionCheck: this.uploadSettings.enableConnectionCheck
    });
    this.queueManager.setMaxConcurrent(this.uploadSettings.maxConcurrentUploads);
  }

  async previewFiles(files: File[], selectedYear: string, appendToExisting: boolean = false): Promise<void> {
    // Only clear queue if not appending
    if (!appendToExisting) {
      this.queueManager.clearQueue();
      this.queueManager.setProcessingCount(0);
      this.isProcessing = false;
    }

    console.log(`📹 [UploadManager] Starting preview for ${files.length} files (extracting video durations)...`);

    // Process files sequentially to extract durations properly
    const newItems: QueueItem[] = [];
    for (const file of files) {
      try {
        const queueItem = await this.createQueueItem(file, selectedYear);
        newItems.push(queueItem);
      } catch (error) {
        console.error(`Error creating queue item for ${file.name}:`, error);
        // Create a fallback item without duration
        const fallbackItem: QueueItem = {
          id: `${Date.now()}-${Math.random().toString(36).substring(2)}`,
          file,
          filename: file.name,
          status: "pending",
          progress: 0,
          errorMessage: undefined,
          controller: new AbortController(),
          isPaused: false,
          metadata: {
            library: "",
            collection: "",
            year: selectedYear,
            needsManualSelection: true,
            suggestedCollection: "",
            reason: "Error during file processing",
            libraryName: "",
            confidence: 0,
            suggestedLibraries: [],
            videoDurationSeconds: undefined
          }
        };
        newItems.push(fallbackItem);
      }
    }

    // Add all items to failed queue for library matching
    newItems.forEach(item => this.queueManager.addToFailedItems(item));

    console.log(`📹 [UploadManager] Preview complete for ${newItems.length} files`);

    const itemsToMatch = [...this.queueManager.getFailedItems()];

    const matchingPromises = itemsToMatch.map(item =>
      this.libraryMatcher.tryMatchLibrary(
        item,
        this.queueManager.getFailedItems(),
        this.queueManager.getQueue()
      ).then(() => {
        if (!item.metadata.needsManualSelection) {
          console.log(`Moving matched item ${item.filename} from failed to queue.`);
          this.queueManager.moveItemFromFailedToQueue(item.id);
        }
      }).catch(error => {
        console.error(`Error matching library for ${item.filename}:`, error);
        if (!this.queueManager.getFailedItems().some(f => f.id === item.id) && !this.queueManager.getQueue().some(q => q.id === item.id)) {
          this.queueManager.addToFailedItems(item);
        }
        item.metadata.needsManualSelection = true;
      })
    );

    Promise.all(matchingPromises).then(() => {
      console.log("Library matching phase complete. Sorting queue and updating groups.");
      this.queueManager.sortQueue();
      this.queueManager.updateGroups();
    }).catch(error => {
      console.error("Error during library matching phase:", error);
      showToast({
        title: "❌ Error During File Preview",
        description: "An unexpected error occurred while matching libraries for preview.",
        variant: "destructive"
      });
      this.queueManager.sortQueue();
      this.queueManager.updateGroups();
    });
  }

  async startUpload(
    files: File[],
    selectedYear: Year,
    onComplete?: (results: UploadResult[]) => void
  ): Promise<void> {
    console.log("Starting automatic upload process...");
    this.uploadOperations.clearUploadResults();
    this.completionCallback = onComplete || null;
    this.totalFiles = files.length;
    this.successfulUploadsCount = 0; // Reset successful uploads counter
    
    // Reset sheet updater for new batch
    this.sheetUpdater.reset();
    // Expected count will be set dynamically as uploads succeed

    if (this.queueManager.getQueue().length === 0 && this.queueManager.getFailedItems().length === 0) {
      await this.previewFiles(files, selectedYear);
      await new Promise(resolve => setTimeout(resolve, 100));
    } else {
      this.queueManager.updateGroups();
    }

    console.log(`Starting processing loop. Items in queue: ${this.queueManager.getQueue().length}, Items needing selection: ${this.queueManager.getFailedItems().length}`);
    if (!this.queueManager.getGlobalPauseStatus()) {
      this.processNextItemLoop();
    } else {
      console.log("Upload start requested, but globally paused.");
      showToast({ title: "⏸️ Uploads Paused", description: "Cannot start uploads while paused.", variant: "warning" });
    }
  }

  async startManualUpload(
    files: File[],
    libraryId: string,
    collectionId: string, // Expecting GUID here now
    selectedYear: string,
    onComplete?: (results: UploadResult[]) => void
  ): Promise<void> {
    console.log("Starting manual upload process...");
    this.clearQueue();
    this.uploadOperations.clearUploadResults();
    this.completionCallback = onComplete || null;
    this.totalFiles = files.length;
    this.successfulUploadsCount = 0; // Reset successful uploads counter
    this.queueManager.setProcessingCount(0);

    // Fetch library name for display/metadata
    let libraryName = libraryId; // Default to ID
    try {
      const lib = await bunnyService.getLibrary(libraryId);
      if (lib) libraryName = lib.name;
    } catch (e) {
      console.warn(`Could not fetch library name for ${libraryId}`);
    }

    // Fetch collection name if GUID is provided
    let collectionName = collectionId; // Default to ID/GUID
    if (collectionId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(collectionId)) {
      try {
        const collections = await bunnyService.getCollections(libraryId);
        const coll = collections.find(c => c.guid === collectionId);
        if (coll) collectionName = coll.name;
      } catch (e) {
        console.warn(`Could not fetch collection name for GUID ${collectionId}`);
      }
    }

    console.log(`📹 [UploadManager] Starting manual upload for ${files.length} files (extracting video durations)...`);

    // Create queue items with duration extraction
    const manualItems: QueueItem[] = [];
    for (const file of files) {
      try {
        const queueItem = await this.createQueueItem(file, selectedYear);
        // Override metadata for manual upload
        queueItem.metadata.library = libraryId;
        queueItem.metadata.collection = collectionName;
        queueItem.metadata.needsManualSelection = false;
        queueItem.metadata.suggestedCollection = collectionName;
        queueItem.metadata.libraryName = libraryName;
        queueItem.metadata.confidence = 100;
        queueItem.metadata.suggestedLibraries = [];
        
        manualItems.push(queueItem);
      } catch (error) {
        console.error(`Error creating queue item for ${file.name}:`, error);
        // Create fallback item without duration
        const fallbackItem: QueueItem = {
          id: `${Date.now()}-${Math.random().toString(36).substring(2)}`,
          file,
          filename: file.name,
          status: "pending" as const,
          progress: 0,
          errorMessage: undefined,
          controller: undefined,
          isPaused: false,
          metadata: {
            library: libraryId,
            collection: collectionName,
            year: selectedYear,
            needsManualSelection: false,
            suggestedCollection: collectionName,
            libraryName: libraryName,
            confidence: 100,
            suggestedLibraries: [],
            videoDurationSeconds: undefined
          }
        };
        manualItems.push(fallbackItem);
      }
    }

    console.log(`📹 [UploadManager] Manual upload setup complete for ${manualItems.length} files`);

    manualItems.forEach(item => this.queueManager.addToQueue(item));

    this.queueManager.sortQueue();
    this.queueManager.updateGroups();

    this.processNextItemLoop();
  }

  selectLibraryManually(fileId: string, libraryId: string, libraryName: string): void {
    const item = this.queueManager.findFile(fileId);
    if (item && item.metadata.needsManualSelection) {
      console.log(`Manually selecting library ${libraryName} (${libraryId}) for ${item.filename}`);
      this.queueManager.updateFileMetadata(fileId, libraryId, libraryName);

      this.libraryMatcher.learnFromManualSelection(item.filename, libraryId, libraryName);

      this.processNextItemLoop();
    } else if (item && !item.metadata.needsManualSelection) {
      console.warn(`Attempted to manually select library for ${item.filename}, but it doesn't need manual selection.`);
      showToast({
        title: "ℹ️ معلومة",
        description: `تم تعيين المكتبة بالفعل للملف "${item.filename}".`,
        variant: "default",
        duration: 3000
      });
    } else {
      console.error(`Could not find item with ID ${fileId} to select library manually.`);
      showToast({
        title: "❌ خطأ",
        description: `تعذر العثور على الملف لإجراء التحديد اليدوي.`,
        variant: "destructive",
        duration: 3000
      });
    }
  }

  pauseUpload(fileId: string): void {
    this.queueManager.pauseUpload(fileId);
  }

  async resumeUpload(fileId: string): Promise<void> {
    const item = this.queueManager.findFile(fileId);
    if (item && item.status === "paused" && this.queueManager.getQueue().some(q => q.id === fileId)) {
      console.log(`Resuming upload for ${item.filename}`);
      item.isPaused = false;
      item.status = "pending";
      this.queueManager.updateGroups();
      this.processNextItemLoop();
    } else {
      console.warn(`Cannot resume item ${fileId}. Status: ${item?.status}, In Queue: ${this.queueManager.getQueue().some(q => q.id === fileId)}`);
    }
  }

  cancelUpload(fileId: string): void {
    this.queueManager.cancelUpload(fileId);
  }

  toggleGlobalPause(): void {
    const isPausedNow = this.queueManager.toggleGlobalPause();
    if (!isPausedNow) {
      this.processNextItemLoop();
    }
  }

  hasActiveUploads(): boolean {
    const queue = this.queueManager.getQueue();
    const failedItems = this.queueManager.getFailedItems();
    const pendingItems = queue.filter(item => item.status === 'pending' || item.status === 'processing');
    
    return this.isProcessing || 
           pendingItems.length > 0 || 
           failedItems.length > 0 || 
           this.queueManager.getProcessingCount() > 0;
  }

  /**
   * Get the current global pause status of the underlying queue manager.
   */
  getGlobalPauseStatus(): boolean {
    return this.queueManager.getGlobalPauseStatus();
  }

  /**
   * Expose the SheetUpdater instance for external monitoring & reports.
   */
  getSheetUpdater(): SheetUpdater {
    return this.sheetUpdater;
  }

  removeFileFromQueue(filename: string): void {
    this.queueManager.removeFileFromQueue(filename);
  }

  clearQueue(): void {
    [...this.queueManager.getQueue(), ...this.queueManager.getFailedItems()].forEach(item => {
      if (item.status === 'processing' || item.status === 'paused') {
        item.controller?.abort('clear_queue');
      }
    });
    this.queueManager.clearQueue();
    this.queueManager.setProcessingCount(0);
    this.isProcessing = false;
    this.successfulUploadsCount = 0; // Reset successful uploads counter
    console.log("Upload queue cleared.");
  }

  setUploadSettings(settings: Partial<UploadSettings>): void {
    // Update local settings
    this.uploadSettings = {
      ...this.uploadSettings,
      ...settings,
      // Map aliases to their canonical names
      maxConcurrentUploads: settings.maxConcurrent ?? settings.maxConcurrentUploads ?? this.uploadSettings.maxConcurrentUploads,
      useStreaming: settings.useStreamingUpload ?? settings.useStreaming ?? this.uploadSettings.useStreaming
    };

    // Apply to upload operations
    this.uploadOperations.setSettings({
      chunkSize: this.uploadSettings.chunkSize,
      maxConcurrentUploads: this.uploadSettings.maxConcurrentUploads,
      useStreaming: this.uploadSettings.useStreaming
    });

    // Apply to queue manager
    this.queueManager.setMaxConcurrent(this.uploadSettings.maxConcurrentUploads);

    showToast({ title: "⚙️ Settings Updated", description: "Upload settings have been applied.", variant: 'default' });
  }

  // إعداد الشيت المخصص
  updateSheetConfig(config: SheetConfig | null): void {
    this.currentSheetConfig = config;
    if (this.sheetUpdater) {
      this.sheetUpdater.setSheetConfig(config);
      console.log(`[UploadManager] ✅ Sheet config updated in SheetUpdater`);
    } else {
      console.warn(`[UploadManager] SheetUpdater not initialized yet`);
    }
    
    if (config) {
      console.log(`[UploadManager] 📊 Updated sheet config to: "${config.name}" (ID: ${config.spreadsheetId})`);
      console.log(`[UploadManager] 📋 Columns - Names: ${config.videoNameColumn}, Embed: ${config.embedCodeColumn}, Minutes: ${config.finalMinutesColumn}`);
    } else {
      console.log(`[UploadManager] 🔄 Cleared sheet config - will use environment defaults`);
    }
  }

  getCurrentSheetConfig(): SheetConfig | null {
    return this.currentSheetConfig;
  }

  private async createQueueItem(file: File, selectedYear: string): Promise<QueueItem> {
    let collectionName = "";
    let collectionReason = "";
    let parsedResult: ReturnType<typeof parseFilename> | null = null;

    try {
      // Pass the selectedYear to ensure correct collection naming
      parsedResult = parseFilename(file.name, selectedYear);
      const collectionResult = determineCollection(parsedResult || { type: 'FULL', academicYear: selectedYear }, selectedYear);
      collectionName = collectionResult.name;
      collectionReason = collectionResult.reason;
    } catch (err) {
      console.warn(`Error parsing filename for collection: ${file.name}`, err);
      const fallbackCollection = determineCollection({ type: 'FULL', academicYear: selectedYear }, selectedYear);
      collectionName = fallbackCollection.name;
      collectionReason = fallbackCollection.reason;
    }

    // Extract video duration synchronously (wait for it to complete)
    let videoDurationSeconds: number | undefined = undefined;
    if (file.type.startsWith('video/')) {
      try {
        videoDurationSeconds = await extractVideoDurationFromFile(file);
        if (videoDurationSeconds !== undefined) {
          console.log(`📝 [QUEUE] Stored duration for "${file.name}": ${videoDurationSeconds}s (${Math.round(videoDurationSeconds/60)}m)`);
        } else {
          console.warn(`[QUEUE] Could not extract duration for "${file.name}"`);
        }
      } catch (error) {
                  console.warn(`[QUEUE] Failed to extract duration for "${file.name}":`, error);
      }
    }

    const queueItem: QueueItem = {
      id: `${Date.now()}-${Math.random().toString(36).substring(2)}`,
      file,
      filename: file.name,
      status: "pending",
      progress: 0,
      errorMessage: undefined,
      controller: new AbortController(),
      isPaused: false,
      metadata: {
        library: "",
        collection: "",
        year: selectedYear,
        needsManualSelection: true,
        suggestedCollection: collectionName,
        reason: collectionReason,
        libraryName: "",
        confidence: 0,
        suggestedLibraries: [],
        videoDurationSeconds: videoDurationSeconds // Store extracted duration
      }
    };

    return queueItem;
  }

  private processNextItemLoop(): void {
    if (this.isProcessing || this.queueManager.getGlobalPauseStatus()) {
      return;
    }

    this.isProcessing = true;

    let processedInLoop = 0;
    let checkedItems = 0;
    const maxChecks = 50; // Prevent infinite loops
    
    while (this.queueManager.getProcessingCount() < this.uploadSettings.maxConcurrentUploads && checkedItems < maxChecks) {
      const nextItem = this.queueManager.getNextPendingItem();

      if (!nextItem) {
        break;
      }
      
      checkedItems++;

      if (nextItem.metadata.needsManualSelection) {
        console.log(`Skipping ${nextItem.filename}, needs manual selection.`);
        this.queueManager.moveItemFromFailedToQueue(nextItem.id);
        continue; // Continue looking for other items instead of breaking
      }

      console.log(`Processing item: ${nextItem.filename}`);
      this.queueManager.setProcessingCount(this.queueManager.getProcessingCount() + 1);
      nextItem.status = "processing";
      nextItem.controller = new AbortController();
      this.queueManager.updateGroups();
      processedInLoop++;

      this.uploadFile(nextItem);
    }

    this.isProcessing = false;

    this.checkCompletion();
  }

  private async uploadFile(item: QueueItem): Promise<void> {
    if (this.queueManager.getGlobalPauseStatus()) {
      item.status = "paused";
      item.isPaused = true;
      this.queueManager.updateGroups();
      this.queueManager.setProcessingCount(this.queueManager.getProcessingCount() - 1);
      this.isProcessing = false;
      this.processNextItemLoop();
      return;
    }

    try {
      // Only log start for significant files or first upload
      if (item.file.size > 50 * 1024 * 1024 || this.successfulUploadsCount === 0) {
        console.log(`[UploadManager] Starting upload: ${item.filename} (${(item.file.size / 1024 / 1024).toFixed(1)}MB)`);
      }

      // Call UploadOperations to handle the actual upload logic
      await this.uploadOperations.uploadFile(
        item,
        () => this.queueManager.updateGroups(), // Progress callback
        this.onVideoUploaded // Completion callback (bound in constructor)
      );

      // If we get here without throwing, the upload was successful
      // Status is set within UploadOperations

    } catch (error) {
      // Error handling is now mostly within UploadOperations, but catch here for manager state
      if (!(error instanceof DOMException && error.name === 'AbortError')) {
        console.error(`[UploadManager] Upload failed: ${item.filename} - ${error instanceof Error ? error.message : String(error)}`);
      }

      // Update item status based on error type if not already set by UploadOperations
      if (item.status === 'processing') { // Check if status wasn't updated by UploadOperations
        if (error instanceof DOMException && error.name === 'AbortError') {
          const reason = item.controller?.signal.reason;
          // Set to paused unless explicitly cancelled/removed
          if (reason === 'cancel' || reason === 'removed' || reason === 'clear_queue') {
            // Status might already be set by cancelUpload/clearQueue, but ensure it's not 'processing'
            if (item.status === 'processing') item.status = 'cancelled';
          } else {
            item.status = "paused";
            item.isPaused = true;
          }
        } else {
          item.status = "error";
          item.errorMessage = error instanceof Error ? error.message : String(error);
          // Avoid duplicate toasts if UploadOperations already showed one
          if (!item.errorMessage?.includes('streaming not configured')) {
            showToast({
              title: `❌ Upload Error: ${item.filename}`,
              description: item.errorMessage || 'Unknown upload error',
              variant: "destructive"
            });
          }
        }
      }
    } finally {
      // Decrement processing count only if the item is no longer processing
      if (item.status !== 'processing') {
        this.queueManager.setProcessingCount(this.queueManager.getProcessingCount() - 1);
      }
      this.isProcessing = false; // Allow next loop check
      
      // Process next item immediately without waiting for sheet updates
      this.processNextItemLoop(); 
      
      // Check completion separately
      this.checkCompletion();
    }
  }

  // This method is called by UploadOperations upon successful upload
  private onVideoUploadedHandler(videoTitle: string, videoGuid: string, libraryId: string): void {
    try {
      console.log(`[UploadManager] Video uploaded: ${videoTitle}, GUID: ${videoGuid}, Library: ${libraryId}`);
      
      // Increment successful uploads count
      this.successfulUploadsCount++;
      
      // Update the expected count for sheet updater to match successful uploads
      this.sheetUpdater.setTotalExpectedUpdates(this.successfulUploadsCount);
      console.log(`[UploadManager] Updated expected sheet updates to ${this.successfulUploadsCount} (total successful uploads so far)`);
      
      // Find the queue item to get the extracted video duration
      let videoDurationSeconds: number | undefined = undefined;
      const queueItems = [...this.queueManager.getQueue(), ...this.queueManager.getFailedItems()];
      const matchingItem = queueItems.find(item => item.filename === videoTitle);
      
      if (matchingItem?.metadata.videoDurationSeconds) {
        videoDurationSeconds = matchingItem.metadata.videoDurationSeconds;
        console.log(`📋 [UploadManager] Found pre-extracted duration for "${videoTitle}": ${videoDurationSeconds}s`);
      } else {
        console.log(`[UploadManager] No pre-extracted duration found for "${videoTitle}"`);
      }
      
      // Trigger background sheet update with duration - don't await this
      this.sheetUpdater.updateSheetInBackground(videoTitle, videoGuid, libraryId, videoDurationSeconds);
      
    } catch (error) {
      console.error(`[UploadManager] Error in post-upload handler for ${videoTitle}:`, error);
    }
  }

  private onAllSheetsUpdated(): void {
    console.log("[UploadManager] All sheet updates completed!");
    console.log("===UPLOAD_COMPLETE=== Upload and sheet updates completed successfully.");
    
    showToast({
      title: "✅ Upload Complete",
      description: "All videos have been uploaded and sheets have been updated.",
      variant: "success",
      duration: 5000
    });

    // Reset processing state
    this.isProcessing = false;
    
    // Clear any remaining loading states
    this.queueManager.clearLoadingStates();

    // Get final results and call completion callback
    const results = this.uploadOperations.getUploadResults();
    if (this.completionCallback) {
      console.log("[UploadManager] Calling completion callback with results:", results.length);
      this.completionCallback(results);
      this.completionCallback = null;
    }

    // Update UI one final time
    this.queueManager.updateGroups();
  }

  private checkCompletion(): void {
    const queue = this.queueManager.getQueue();
    const failedItems = this.queueManager.getFailedItems();
    const processingCount = this.queueManager.getProcessingCount();

    // Count items that are still actively uploading (not completed)
    const pendingItems = queue.filter(item => item.status === 'pending');
    const processingItems = queue.filter(item => item.status === 'processing');
    const completedItems = queue.filter(item => item.status === 'completed');
    
    const totalItemsInSystem = pendingItems.length + processingItems.length + failedItems.length + processingCount;
    const itemsNeedingManualSelection = failedItems.filter(item => item.metadata.needsManualSelection).length;
    
    // Only complete if:
    // 1. No pending or processing items AND
    // 2. No failed items OR only failed items that need manual selection (which we can't auto-process)
    if (pendingItems.length === 0 && processingItems.length === 0 && processingCount === 0 && 
        (failedItems.length === 0 || failedItems.length === itemsNeedingManualSelection)) {
      
      console.log("[UploadManager] ✅ All uploads finished, updating sheets...");
      
      // Signal sheet updater that uploads are complete
      this.sheetUpdater.setUploadsComplete();
      
      // Get results - sheet updates may still be in progress
      const results = this.uploadOperations.getUploadResults();
      
      // Print completion message that can be detected by hooks
      console.log("===UPLOAD_COMPLETE=== Upload process completed successfully. Sheet updates may still be in progress.");
      
      // Note: We don't call completion callback here anymore - 
      // it will be called by onAllSheetsUpdated when sheet updates complete
    } else if (pendingItems.length > 0 || processingItems.length > 0) {
      // Only log if there's significant activity
      if (processingItems.length > 0) {
        console.log(`[UploadManager] 📤 Processing ${processingItems.length} files...`);
      }
    }
  }
}