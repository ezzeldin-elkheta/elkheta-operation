import React, { useState, useCallback } from 'react';
import { Upload, Loader2, Video } from 'lucide-react';
import { Button } from './ui/button';

interface UploadZoneProps {
  onFileSelect: (files: FileList) => void;
  disabled: boolean;
  files: File[];
  onStartUpload: () => Promise<void>;
  isUploading: boolean;
}

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

const UploadZone: React.FC<UploadZoneProps> = ({
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

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    setDragCounter(0);
    setIsDragOver(false);
    setHasVideoFiles(false);

    if (disabled) return;

    let collected: File[] = [];

    // Try extracting via entries (supports folders)
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      collected = await getFilesFromItems(e.dataTransfer.items);
      console.log('[UploadZone] Extracted files from dropped items:', collected);
      if (collected.length === 0) {
        // Check if any item is a directory (for debugging)
        const hasDir = Array.from(e.dataTransfer.items).some(item => {
          const entry = (item as any).webkitGetAsEntry?.();
          return entry && entry.isDirectory;
        });
        if (hasDir) {
          console.warn('[UploadZone] Directory detected in drop, but no files extracted. webkitGetAsEntry may not be supported in this browser or context.');
        }
      }
    }

    // Fallback to plain files array
    if (collected.length === 0 && e.dataTransfer.files) {
      collected = Array.from(e.dataTransfer.files);
    }

    if (collected.length > 0) {
      const dt = new DataTransfer();
      collected.forEach((file) => dt.items.add(file));
      checkForVideoFiles(dt.files);
      onFileSelect(dt.files);
    }
  }, [disabled, onFileSelect, checkForVideoFiles]);

  const getDropZoneClasses = () => {
    const baseClasses = "border-2 border-dashed rounded-lg p-8 text-center transition-all duration-300 ease-in-out";
    
    if (disabled) {
      return `${baseClasses} opacity-50 cursor-not-allowed border-gray-300`;
    }
    
    if (isDragOver) {
      if (hasVideoFiles) {
        return `${baseClasses} border-green-400 bg-green-50 shadow-lg scale-105 cursor-pointer`;
      } else {
        return `${baseClasses} border-blue-400 bg-blue-50 shadow-lg scale-105 cursor-pointer`;
      }
    }
    
    return `${baseClasses} border-gray-300 hover:border-primary hover:bg-gray-50 cursor-pointer`;
  };

  const getIconAndText = () => {
    if (isDragOver && hasVideoFiles) {
      return {
        icon: <Video className="mx-auto h-12 w-12 text-green-500 animate-pulse" />,
        text: "Drop video files here",
        subText: "Video files detected!"
      };
    }
    
    if (isDragOver) {
      return {
        icon: <Upload className="mx-auto h-12 w-12 text-blue-500 animate-bounce" />,
        text: "Drop files here",
        subText: "Release to upload"
      };
    }
    
    return {
      icon: <Upload className="mx-auto h-12 w-12 text-gray-400" />,
      text: "Drag and drop files here or click to select",
      subText: "Supports video files: MP4, AVI, MOV, WMV, and more"
    };
  };

  const { icon, text, subText } = getIconAndText();

  return (
    <div className="space-y-4">
      <div
        className={getDropZoneClasses()}
        onClick={() => !disabled && inputRef.current?.click()}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <input
          type="file"
          multiple
          accept="video/*,audio/*,.mp4,.avi,.mov,.wmv,.flv,.webm,.mkv,.m4v,.3gp,.ogv"
          className="hidden"
          ref={inputRef}
          aria-label="Choose video files to upload"
          title="Choose video files to upload"
          onChange={(e) => {
            if (e.target.files) {
              checkForVideoFiles(e.target.files);
              onFileSelect(e.target.files);
            }
          }}
          disabled={disabled}
        />
        {icon}
        <p className={`mt-2 font-medium ${isDragOver ? 'text-lg' : ''} transition-all duration-200`}>
          {text}
        </p>
        <p className="text-sm text-gray-500 mt-1">{subText}</p>
      </div>

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
                Upload {files.length} {files.length === 1 ? 'File' : 'Files'}
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
};

export default UploadZone;
