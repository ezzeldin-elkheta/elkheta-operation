import { useState, useCallback } from 'react';
import { toast } from "../components/ui/use-toast"; // إضافة الاستيراد المناسب

/**
 * Hook for managing file selection state
 * Provides utilities for selecting and handling files for different use cases
 */
export function useFileSelection() {
  // State for manually selected files
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  
  // State for auto-upload files
  const [autoUploadFiles, setAutoUploadFiles] = useState<File[]>([]);
  
  // State for tracking upload status
  const [uploadInProgress, setUploadInProgress] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isAutoUploading, setIsAutoUploading] = useState(false);
  const [showUploadReport, setShowUploadReport] = useState(false);
  const [uploadResults, setUploadResults] = useState<any[]>([]);
  const [uploadDuration, setUploadDuration] = useState(0);
  
  // Handler for file selection for manual upload
  const handleFileSelect = useCallback((files: FileList | null) => {
    if (!files) return;

    setSelectedFiles(prev => {
      const fileArray = Array.from(files);
      // منع الملفات المكررة بناءً على الاسم والحجم معًا
      const existingFileKeys = new Set(prev.map(f => `${f.name}_${f.size}`));
      const newFiles = fileArray.filter(file => !existingFileKeys.has(`${file.name}_${file.size}`));

      if (newFiles.length > 0) {
        toast({
          title: "تمت الإضافة",
          description: `تمت إضافة ${newFiles.length} ملف جديد للقائمة. الإجمالي: ${prev.length + newFiles.length}`,
          variant: "success",
        });
        console.log(`[FileSelection] إضافة ${newFiles.length} ملف جديد للقائمة الحالية`);
        return [...prev, ...newFiles];
      } else if (fileArray.length > 0) {
        toast({
          title: "ملفات مكررة",
          description: "جميع الملفات المحددة موجودة بالفعل في القائمة",
          variant: "warning",
        });
        console.log('[FileSelection] لم تتم إضافة ملفات جديدة (جميع الملفات المحددة موجودة بالفعل)');
      }

      return prev;
    });
  }, []);

  // Handler for auto-upload file selection
  const handleAutoUploadSelect = useCallback((files: FileList | null) => {
    if (!files) return;

    setAutoUploadFiles(prev => {
      const fileArray = Array.from(files);
      // منع الملفات المكررة بناءً على الاسم والحجم معًا
      const existingFileKeys = new Set(prev.map(f => `${f.name}_${f.size}`));
      const newFiles = fileArray.filter(file => !existingFileKeys.has(`${file.name}_${file.size}`));

      if (newFiles.length > 0) {
        toast({
          title: "تمت الإضافة",
          description: `تمت إضافة ${newFiles.length} ملف جديد للرفع التلقائي. الإجمالي: ${prev.length + newFiles.length}`,
          variant: "success",
        });
        console.log(`[AutoUpload] إضافة ${newFiles.length} ملف جديد للقائمة الحالية`);
        return [...prev, ...newFiles];
      } else if (fileArray.length > 0) {
        toast({
          title: "ملفات مكررة",
          description: "جميع الملفات المحددة موجودة بالفعل في قائمة الرفع التلقائي",
          variant: "warning",
        });
        console.log('[AutoUpload] لم تتم إضافة ملفات جديدة (جميع الملفات المحددة موجودة بالفعل)');
      }

      return prev;
    });
  }, []);
  
  // Handler for manual selection
  const handleManualUploadSelect = useCallback((files: FileList | null) => {
    handleFileSelect(files);
  }, [handleFileSelect]);
  
  // Remove file from selected files
  const removeSelectedFile = useCallback((fileName: string) => {
    setSelectedFiles(prev => prev.filter(file => file.name !== fileName));
  }, []);
  
  // Remove file from auto upload files
  const removeAutoUploadFile = useCallback((fileName: string) => {
    setAutoUploadFiles(prev => prev.filter(file => file.name !== fileName));
  }, []);
  
  // Start auto upload process
  const startAutoUpload = useCallback((uploadManagerRef: any, selectedLibrary: string, selectedCollection: string, selectedYear: string) => {
    if (autoUploadFiles.length === 0 || !uploadManagerRef.current) return;
    
    setIsAutoUploading(true);
    setUploadInProgress(true);
    
    const startTime = Date.now();
    
    uploadManagerRef.current.startUpload(
      autoUploadFiles,
      selectedYear,
      (results) => {
        // Handle completion
        setUploadResults(results);
        setShowUploadReport(true);
        setUploadDuration((Date.now() - startTime) / 1000);
        setIsAutoUploading(false);
        setUploadInProgress(false);
        setAutoUploadFiles([]);
      }
    );
  }, [autoUploadFiles]);
  
  // Start manual upload process
  const startManualUpload = useCallback((uploadManagerRef: any, selectedLibrary: string, selectedCollection: string, selectedYear: string) => {
    if (selectedFiles.length === 0 || !uploadManagerRef.current) return;
    
    setIsUploading(true);
    setUploadInProgress(true);
    
    const startTime = Date.now();
    
    uploadManagerRef.current.startManualUpload(
      selectedFiles,
      selectedLibrary,
      selectedCollection,
      selectedYear,
      (results) => {
        // Handle completion
        setUploadResults(results);
        setShowUploadReport(true);
        setUploadDuration((Date.now() - startTime) / 1000);
        setIsUploading(false);
        setUploadInProgress(false);
        setSelectedFiles([]);
      }
    );
  }, [selectedFiles]);
  
  return {
    // State
    selectedFiles,
    setSelectedFiles,
    autoUploadFiles,
    setAutoUploadFiles,
    uploadInProgress,
    isUploading,
    isAutoUploading,
    showUploadReport,
    uploadResults,
    uploadDuration,
    
    // Handlers
    handleFileSelect,
    handleAutoUploadSelect,
    handleManualUploadSelect,
    removeSelectedFile,
    removeAutoUploadFile,
    startAutoUpload,
    startManualUpload,
    setShowUploadReport
  };
}
