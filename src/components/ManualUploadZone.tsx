import React, { useState, useCallback } from "react";
import { Button } from "./ui/button";
import { Loader2, Upload, Video } from "lucide-react";

interface ManualUploadZoneProps {
  onFileSelect: (files: FileList) => void;
  disabled?: boolean;
  files: File[];
  onStartUpload: () => void;
  isUploading: boolean;
}

const ManualUploadZone: React.FC<ManualUploadZoneProps> = ({
  onFileSelect,
  disabled,
  files,
  onStartUpload,
  isUploading
}) => {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [dragCounter, setDragCounter] = useState(0);
  const [hasVideoFiles, setHasVideoFiles] = useState(false);

  // Video file extensions
  const videoExtensions = ['.mp4', '.avi', '.mov', '.wmv', '.flv', '.webm', '.mkv', '.m4v', '.3gp', '.ogv'];
  
  const isVideoFile = (file: File) => {
    const extension = '.' + file.name.split('.').pop()?.toLowerCase();
    return videoExtensions.includes(extension) || file.type.startsWith('video/');
  };

  const checkForVideoFiles = useCallback((files: FileList) => {
    const hasVideos = Array.from(files).some(file => isVideoFile(file));
    setHasVideoFiles(hasVideos);
    return hasVideos;
  }, []);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    setDragCounter(prev => prev + 1);
    
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      const hasVideos = Array.from(e.dataTransfer.items).some(item => {
        if (item.kind === 'file') {
          const file = item.getAsFile();
          return file && isVideoFile(file);
        }
        return false;
      });
      setHasVideoFiles(hasVideos);
      setIsDragOver(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    setDragCounter(prev => {
      const newCounter = prev - 1;
      if (newCounter === 0) {
        setIsDragOver(false);
        setHasVideoFiles(false);
      }
      return newCounter;
    });
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  // Recursively extract File objects from DataTransferItemList (supports nested folders)
  const getFilesFromItems = async (items: DataTransferItemList): Promise<File[]> => {
    const traverse = (entry: any): Promise<File[]> =>
      new Promise((resolve) => {
        if (!entry) return resolve([]);

        if (entry.isFile) {
          entry.file((file: File) => resolve([file]));
        } else if (entry.isDirectory) {
          const reader = entry.createReader();
          reader.readEntries(async (entries: any[]) => {
            const nested = (await Promise.all(entries.map((ent) => traverse(ent)))).flat();
            resolve(nested);
          });
        } else {
          resolve([]);
        }
      });

    const promises = Array.from(items)
      .filter((item) => item.kind === 'file' && (item as any).webkitGetAsEntry)
      .map((item) => traverse((item as any).webkitGetAsEntry()));

    return (await Promise.all(promises)).flat();
  };

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    setDragCounter(0);
    setIsDragOver(false);
    setHasVideoFiles(false);

    if (disabled) return;

    let collected: File[] = [];

    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      collected = await getFilesFromItems(e.dataTransfer.items);
      console.log('[ManualUploadZone] Extracted files from dropped items:', collected);
      if (collected.length === 0) {
        // Check if any item is a directory (for debugging)
        const hasDir = Array.from(e.dataTransfer.items).some(item => {
          const entry = (item as any).webkitGetAsEntry?.();
          return entry && entry.isDirectory;
        });
        if (hasDir) {
          console.warn('[ManualUploadZone] Directory detected in drop, but no files extracted. webkitGetAsEntry may not be supported in this browser or context.');
        }
      }
    }

    if (collected.length === 0 && e.dataTransfer.files) {
      collected = Array.from(e.dataTransfer.files);
    }

    if (collected.length > 0) {
      const dt = new DataTransfer();
      collected.forEach((f) => dt.items.add(f));
      checkForVideoFiles(dt.files);
      onFileSelect(dt.files);
    }
  }, [disabled, onFileSelect, checkForVideoFiles]);

  const getDropZoneClasses = () => {
    const baseClasses = "border-2 border-dashed rounded-lg p-6 text-center transition-all duration-300 ease-in-out";
    
    if (disabled) {
      return `${baseClasses} opacity-50 cursor-not-allowed border-gray-300`;
    }
    
    if (isDragOver) {
      if (hasVideoFiles) {
        return `${baseClasses} border-green-400 bg-green-50 shadow-lg scale-105`;
      } else {
        return `${baseClasses} border-blue-400 bg-blue-50 shadow-lg scale-105`;
      }
    }
    
    return `${baseClasses} border-gray-300 hover:border-primary hover:bg-gray-50`;
  };

  const getDropZoneContent = () => {
    if (isDragOver && hasVideoFiles) {
      return (
        <>
          <Video className="mx-auto h-8 w-8 text-green-500 animate-pulse mb-2" />
          <p className="text-green-600 font-medium">Drop video files for manual upload</p>
          <p className="text-sm text-green-500">Video files detected!</p>
        </>
      );
    }
    
    if (isDragOver) {
      return (
        <>
          <Upload className="mx-auto h-8 w-8 text-blue-500 animate-bounce mb-2" />
          <p className="text-blue-600 font-medium">Drop files for manual upload</p>
          <p className="text-sm text-blue-500">Release to upload</p>
        </>
      );
    }
    
    return (
      <>
        <Upload className="mx-auto h-8 w-8 text-gray-400 mb-2" />
        <p className="text-gray-600">Drop files here for manual upload</p>
        <p className="text-sm text-gray-500">Or click the button below</p>
      </>
    );
  };

  return (
    <div className="space-y-4">
      {/* Drag and Drop Zone */}
      <div
        className={getDropZoneClasses()}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        {getDropZoneContent()}
      </div>

      <input
        type="file"
        multiple
        accept="video/*,audio/*,.mp4,.avi,.mov,.wmv,.flv,.webm,.mkv,.m4v,.3gp,.ogv"
        className="hidden"
        ref={inputRef}
        onChange={(e) => {
          if (e.target.files) {
            checkForVideoFiles(e.target.files);
            onFileSelect(e.target.files);
          }
        }}
      />
      <Button
        onClick={() => inputRef.current?.click()}
        disabled={disabled}
        variant="outline"
        className="w-full"
      >
        Select Files for Manual Upload
      </Button>
      
      {files.length > 0 && (
        <div className="space-y-2">
          <div className="text-sm text-gray-600">
            Selected files: {files.length} • 
            Videos: {files.filter(file => isVideoFile(file)).length}
          </div>
          <Button
            onClick={onStartUpload}
            disabled={isUploading}
            className="w-full"
          >
            {isUploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Upload {files.length} {files.length === 1 ? 'File' : 'Files'} Manually
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
};

export default ManualUploadZone;