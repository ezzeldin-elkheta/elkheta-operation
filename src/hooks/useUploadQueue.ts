import { useState, useCallback, useEffect } from 'react';
import { useToast } from './use-toast';
import { UploadGroup } from '@/lib/upload/types';

export function useUploadQueue(uploadManagerRef: React.MutableRefObject<any>) {
  const { toast } = useToast();
  const [uploadGroups, setUploadGroups] = useState<UploadGroup[]>([]);
  const [isGloballyPaused, setIsGloballyPaused] = useState(false);
  
  // Set up the queue listener when the component mounts
  useEffect(() => {
    if (uploadManagerRef.current) {
      // Get initial global pause state
      setIsGloballyPaused(uploadManagerRef.current.getGlobalPauseStatus());
    }
  }, [uploadManagerRef]);
  
  // Handler for manually updating a file's metadata
  const handleMetadataUpdate = useCallback((fileId: string, libraryId: string, libraryName: string) => {
    try {
      if (!uploadManagerRef.current) {
        throw new Error("Upload manager not initialized");
      }
      
      // Have the upload manager handle the selection
      uploadManagerRef.current.selectLibraryManually(fileId, libraryId, libraryName);
      
      // No need to update state here, the manager will call its onQueueUpdate
      // which will update the uploadGroups state
    } catch (error) {
      console.error("Error updating file metadata:", error);
      toast({
        title: "Error Updating File",
        description: error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive"
      });
    }
  }, [uploadManagerRef, toast]);
  
  // Handler for pausing an upload
  const handlePauseUpload = useCallback((fileId: string) => {
    try {
      if (!uploadManagerRef.current) {
        throw new Error("Upload manager not initialized");
      }
      
      uploadManagerRef.current.pauseUpload(fileId);
      
      toast({
        title: "Upload Paused",
        description: "You can resume the upload when ready.",
        variant: "default"
      });
    } catch (error) {
      console.error("Error pausing upload:", error);
      toast({
        title: "Error Pausing Upload",
        description: error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive"
      });
    }
  }, [uploadManagerRef, toast]);
  
  // Handler for resuming an upload
  const handleResumeUpload = useCallback((fileId: string) => {
    try {
      if (!uploadManagerRef.current) {
        throw new Error("Upload manager not initialized");
      }
      
      uploadManagerRef.current.resumeUpload(fileId);
      
      toast({
        title: "Upload Resumed",
        description: "Upload has been resumed.",
        variant: "default"
      });
    } catch (error) {
      console.error("Error resuming upload:", error);
      toast({
        title: "Error Resuming Upload",
        description: error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive"
      });
    }
  }, [uploadManagerRef, toast]);
  
  // Handler for cancelling an upload
  const handleCancelUpload = useCallback((fileId: string) => {
    try {
      if (!uploadManagerRef.current) {
        throw new Error("Upload manager not initialized");
      }
      
      uploadManagerRef.current.cancelUpload(fileId);
      
      toast({
        title: "Upload Cancelled",
        description: "Upload has been cancelled.",
        variant: "default"
      });
    } catch (error) {
      console.error("Error cancelling upload:", error);
      toast({
        title: "Error Cancelling Upload",
        description: error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive"
      });
    }
  }, [uploadManagerRef, toast]);
  
  // Handler for toggling global pause state
  const handleGlobalPauseToggle = useCallback(() => {
    try {
      if (!uploadManagerRef.current) {
        throw new Error("Upload manager not initialized");
      }
      
      const isPaused = uploadManagerRef.current.toggleGlobalPause();
      setIsGloballyPaused(isPaused);
      
      toast({
        title: isPaused ? "Uploads Paused" : "Uploads Resumed",
        description: isPaused 
          ? "All uploads have been paused." 
          : "All uploads have been resumed.",
        variant: "default"
      });
    } catch (error) {
      console.error("Error toggling global pause:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive"
      });
    }
  }, [uploadManagerRef, toast]);
  
  return {
    uploadGroups,
    setUploadGroups,
    isGloballyPaused,
    handleMetadataUpdate,
    handlePauseUpload,
    handleResumeUpload,
    handleCancelUpload,
    handleGlobalPauseToggle
  };
}
