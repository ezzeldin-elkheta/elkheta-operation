import { useState, useCallback } from 'react';
import { UploadProgress } from '../lib/upload/upload-operations';

export function useUploadProgress() {
  const [progress, setProgress] = useState<UploadProgress>({
    totalFiles: 0,
    uploadedFiles: 0,
    currentFile: '',
    currentProgress: 0,
    totalSize: 0,
    uploadedSize: 0,
    status: 'idle',
    error: null
  });

  const updateProgress = useCallback((newProgress: Partial<UploadProgress>) => {
    setProgress(prev => ({ ...prev, ...newProgress }));
  }, []);

  const resetProgress = useCallback(() => {
    setProgress({
      totalFiles: 0,
      uploadedFiles: 0,
      currentFile: '',
      currentProgress: 0,
      totalSize: 0,
      uploadedSize: 0,
      status: 'idle',
      error: null
    });
  }, []);

  return { progress, updateProgress, resetProgress };
} 