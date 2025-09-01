import { useState, useCallback, useRef, useEffect } from 'react';
import { useToast } from './use-toast'; // Import useToast hook
import { dataStorage } from '../lib/data-storage'; // Import dataStorage
import { bunnyService } from '../lib/bunny-service'; // Import bunnyService
import { UploadResult } from '../lib/upload/types'; // Import UploadResult

export function useFileUploader(uploadManagerRef, selectedLibrary, selectedCollection, selectedYear) { // Removed toast from args
  const { toast } = useToast(); // Use the hook internally
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [autoUploadFiles, setAutoUploadFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false); // For manual upload button state
  const [isAutoUploading, setIsAutoUploading] = useState(false); // For auto upload button state
  const [uploadInProgress, setUploadInProgress] = useState(false); // General flag for any active upload
  const [showUploadReport, setShowUploadReport] = useState(false);
  const [uploadResults, setUploadResults] = useState<UploadResult[]>([]);
  const [uploadDuration, setUploadDuration] = useState<string>(""); // Keep as string for formatted output
  const uploadStartTimeRef = useRef<number | null>(null);

  // Add a console log listener for completion message
  useEffect(() => {
    // Create custom console.log wrapper to detect completion message
    const originalConsoleLog = console.log;
    console.log = function(...args) {
      originalConsoleLog.apply(console, args);
      
      // Check if any argument contains our completion marker
      if (args.some(arg => typeof arg === 'string' && arg.includes('===UPLOAD_COMPLETE==='))) {
        console.log("[useFileUploader] Detected upload completion message");
        
        // Get final results
        if (uploadManagerRef.current) {
          const results = uploadManagerRef.current.uploadOperations.getUploadResults();
          if (results && results.length > 0) {
            setUploadResults(results);
            setShowUploadReport(true);
          }
        }
        
        // Reset all upload states
        setIsAutoUploading(false);
        setIsUploading(false);
        setUploadInProgress(false);
        
        // Calculate upload duration
        if (uploadStartTimeRef.current) {
          const endTime = Date.now();
          setUploadDuration(formatDuration(uploadStartTimeRef.current, endTime));
        }
      }
    };
    
    return () => {
      console.log = originalConsoleLog; // Restore original console.log on cleanup
    };
  }, [uploadManagerRef]);

  // Format duration for display
  const formatDuration = (startTime: number, endTime: number): string => {
    const durationMs = endTime - startTime;
    const totalSeconds = Math.floor(durationMs / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    let durationString = "";
    if (hours > 0) durationString += `${hours}h `;
    if (minutes > 0 || hours > 0) durationString += `${minutes}m `;
    durationString += `${seconds}s`;

    return durationString.trim();
  };

  // Unified notification function using useToast
  const showNotification = (
    type: 'success' | 'error' | 'warning' | 'default',
    title: string,
    description: string,
    duration: number = 5000
  ) => {
    toast({
      title,
      description,
      variant: type === 'error' ? 'destructive' : type === 'default' ? 'default' : type, // Map 'error' to 'destructive'
      duration,
    });
  };

  // Handle file selection common logic (called by specific handlers)
  const handleFileSelection = useCallback((files: FileList, targetStateSetter: React.Dispatch<React.SetStateAction<File[]>>, operationType: 'Auto' | 'Manual' | 'Drag & Drop' | 'Manual Selection') => {
    // لم يعد هناك منع إضافة الملفات عند وجود رفع نشط

    // Clear the *other* upload type's files when selecting for one type
    if (operationType === 'Auto') {
        setSelectedFiles([]);
    } else {
        setAutoUploadFiles([]);
    }
    
    // Don't clear the queue every time, allow appending files
    // uploadManagerRef.current?.clearQueue();  // This line is causing the issue

    const fileArray = Array.from(files);
    
    // Append new files instead of replacing them
    targetStateSetter(prevFiles => [...prevFiles, ...fileArray]);

    if (uploadManagerRef.current) {
      // Preview files immediately after selection with append flag
      uploadManagerRef.current.previewFiles(fileArray, selectedYear, true);
      showNotification(
        'success',
        'تمت إضافة الملفات للمعاينة',
        `تمت إضافة ${fileArray.length} ملفًا. بدأ مطابقة المكتبة...`,
        3000
      );
    }
  }, [uploadManagerRef, selectedYear, showNotification]); // Add dependencies


  // Specific handler for automatic upload file selection
  const handleAutoUploadSelect = useCallback((files: FileList | null) => {
    if (!files) return;
    handleFileSelection(files, setAutoUploadFiles, 'Auto');
  }, [handleFileSelection]);

  // Specific handler for manual upload file selection
  const handleManualUploadSelect = useCallback((files: FileList | null) => {
    if (!files) return;
    if (uploadInProgress) {
      showNotification(
        'info',
        'إضافة ملفات أثناء الرفع',
        'تمت إضافة الملفات للقائمة. ستنتظر الملفات الجديدة حتى انتهاء العملية الحالية.',
        4000
      );
      // لا يوجد return هنا، نسمح بالإضافة
    }
    if (!selectedLibrary || !selectedCollection) {
      showNotification(
        'warning',
        'اختيار مفقود',
        'تمت إضافة الملفات. يرجى تحديد مكتبة ومجموعة قبل بدء الرفع.',
        4000
      );
      // لا يوجد return هنا أيضاً
    }
    handleFileSelection(files, setSelectedFiles, 'Manual Selection');
  }, [handleFileSelection, selectedLibrary, selectedCollection, uploadInProgress, showNotification]);


  // Remove a file from selected files (Manual Upload) by index
  const removeSelectedFile = useCallback((index: number) => {
    setSelectedFiles(prevFiles => {
      const newFiles = [...prevFiles];
      const removedFile = newFiles.splice(index, 1)[0];
      // Also remove from upload manager's preview/queue if it exists
      if (removedFile && uploadManagerRef.current) {
        uploadManagerRef.current.removeFileFromQueue(removedFile.name);
      }
      return newFiles;
    });
  }, [uploadManagerRef]);

  // Remove a file from auto upload files by index
  const removeAutoUploadFile = useCallback((index: number) => {
    setAutoUploadFiles(prevFiles => {
      const newFiles = [...prevFiles];
      const removedFile = newFiles.splice(index, 1)[0];
      // Also remove from upload manager's preview/queue if it exists
      if (removedFile && uploadManagerRef.current) {
        uploadManagerRef.current.removeFileFromQueue(removedFile.name);
      }
      return newFiles;
    });
  }, [uploadManagerRef]);


  // Completion handler for both upload types
  const handleUploadComplete = useCallback((results: UploadResult[]) => {
    console.log("[useFileUploader] Upload complete, results:", results);
    const endTime = Date.now();
    
    // Always show upload report immediately after completion
    setUploadResults(results);
    setShowUploadReport(true);
    
    if (uploadStartTimeRef.current) {
      setUploadDuration(formatDuration(uploadStartTimeRef.current, endTime));
    }
    
    // Reset all upload states
    setIsAutoUploading(false);
    setIsUploading(false);
    setUploadInProgress(false);
    setSelectedFiles([]);
    setAutoUploadFiles([]);
    
    // Force immediate UI update
    setTimeout(() => {
      if (uploadManagerRef.current) {
        uploadManagerRef.current.queueManager.updateGroups();
      }
    }, 0);
    
    // Log completion for debugging
    console.log("[useFileUploader] States reset, report should show:", { 
      showReport: true, 
      resultsCount: results.length 
    });
    
  }, [setUploadResults, setShowUploadReport, setUploadDuration, 
      setIsAutoUploading, setIsUploading, setUploadInProgress,
      setSelectedFiles, setAutoUploadFiles]);


  // Start automatic upload process
  const startAutoUpload = useCallback(async () => {
    if (!autoUploadFiles.length) {
      showNotification('error', 'لم يتم تحديد ملفات', 'يرجى تحديد ملفات للتحميل التلقائي أولاً.');
      return;
    }
    if (!uploadManagerRef.current) {
        showNotification('error', 'خطأ في التحميل', 'لم يتم تهيئة مدير التحميل.');
        return;
    }
    if (uploadInProgress) {
        showNotification('warning', 'تحميل قيد التقدم', 'عملية تحميل أخرى قيد التشغيل بالفعل.');
        return;
    }

    // Check if library data exists, if not prompt user to refresh manually
    const libraryData = await dataStorage.getLibraryData();
    if (!libraryData || !libraryData.libraries || libraryData.libraries.length === 0) {
      showNotification(
        'warning',
        'بيانات المكتبة غير متوفرة',
        'لم يتم العثور على بيانات المكتبة أو أنها فارغة. يرجى تحديث بيانات المكتبة يدويًا قبل التحميل.'
      );
      setIsAutoUploading(false);
      setUploadInProgress(false);
      return; // Stop upload if library data is crucial and not available
    }

    setIsAutoUploading(true);
    setUploadInProgress(true);
    uploadStartTimeRef.current = Date.now();

    try {
      showNotification('default', 'جارٍ بدء التحميل...', 'عملية التحميل التلقائي قد بدأت.');
      // The previewFiles step should have already happened on selection.
      // Now, just call startUpload which handles matching and processing.
      await uploadManagerRef.current.startUpload(
        autoUploadFiles,
        selectedYear,
        handleUploadComplete // Pass the unified completion handler
      );
    } catch (error) {
      console.error("Error starting auto upload:", error);
      showNotification(
        'error',
        'فشل بدء التحميل',
        `حدث خطأ: ${error instanceof Error ? error.message : 'خطأ غير معروف'}`
      );
      setIsAutoUploading(false);
      setIsUploading(false);
      setUploadInProgress(false);
      uploadStartTimeRef.current = null;
    }
  }, [autoUploadFiles, uploadManagerRef, selectedYear, handleUploadComplete, showNotification, uploadInProgress]);


  // Start manual upload process
  const startManualUpload = useCallback(async () => {
    if (!selectedFiles.length) {
      showNotification('error', 'لم يتم تحديد ملفات', 'يرجى تحديد ملفات للتحميل اليدوي أولاً.');
      return;
    }
     if (!selectedLibrary || !selectedCollection) {
       showNotification('error', 'اختيار مفقود', 'يرجى تحديد مكتبة ومجموعة للتحميل اليدوي.');
       return;
     }
    if (!uploadManagerRef.current) {
        showNotification('error', 'خطأ في التحميل', 'لم يتم تهيئة مدير التحميل.');
        return;
    }
     if (uploadInProgress) {
         showNotification('warning', 'تحميل قيد التقدم', 'عملية تحميل أخرى قيد التشغيل بالفعل.');
         return;
     }

    setIsUploading(true);
    setUploadInProgress(true);
    uploadStartTimeRef.current = Date.now();

    try {
      showNotification('default', 'جارٍ بدء التحميل...', 'عملية التحميل اليدوي قد بدأت.');
      // Call startManualUpload which adds items directly to the queue
      await uploadManagerRef.current.startManualUpload(
        selectedFiles,
        selectedLibrary,
        selectedCollection,
        selectedYear,
        handleUploadComplete // Pass the unified completion handler
      );
    } catch (error) {
      console.error("Error starting manual upload:", error);
      showNotification(
        'error',
        'فشل بدء التحميل',
        `حدث خطأ: ${error instanceof Error ? error.message : 'خطأ غير معروف'}`
      );
      setIsUploading(false);
      setUploadInProgress(false);
      uploadStartTimeRef.current = null;
    }
  }, [selectedFiles, selectedLibrary, selectedCollection, selectedYear, uploadManagerRef, handleUploadComplete, showNotification, uploadInProgress]);


  return {
    // State
    selectedFiles,
    setSelectedFiles,
    autoUploadFiles,
    setAutoUploadFiles,
    isUploading, // Manual upload button state
    isAutoUploading, // Auto upload button state
    uploadInProgress, // General upload activity flag
    showUploadReport,
    setShowUploadReport,
    uploadResults,
    uploadDuration,

    // Handlers
    handleAutoUploadSelect,
    handleManualUploadSelect,
    removeSelectedFile, // Use index-based removal
    removeAutoUploadFile, // Use index-based removal
    startAutoUpload,
    startManualUpload
  };
}
