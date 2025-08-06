import React from "react";
import { ScrollArea } from "./ui/scroll-area";
import { Button } from "./ui/button";
import { X, AlertTriangle } from "lucide-react";

interface SelectedFilesPreviewProps {
  files: File[];
  onRemove: (index: number) => void;
  className?: string;
}

const SelectedFilesPreview: React.FC<SelectedFilesPreviewProps> = ({
  files,
  onRemove,
  className = "",
}) => {
  if (!files.length) return null;

  // Check for large files (warning threshold at 500MB)
  const isLargeFile = (size: number) => size > 500 * 1024 * 1024;
  
  return (
    <div className={`border rounded-md p-3 ${className}`}>
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-sm font-medium">Selected Files ({files.length})</h3>
        
        {/* Add a "Clear All" button for better UX */}
        {files.length > 1 && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-red-500 hover:text-red-700"
            onClick={() => {
              // Clear all files by calling onRemove for each index in reverse order
              for (let i = files.length - 1; i >= 0; i--) {
                onRemove(i);
              }
            }}
          >
            Clear All
          </Button>
        )}
      </div>
      
      <ScrollArea className="h-[150px]">
        <div className="space-y-1">
          {files.map((file, index) => (
            <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded text-sm">
              <div className="flex items-center gap-2 truncate flex-1">
                {isLargeFile(file.size) && (
                  <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0" />
                )}
                <span className="truncate">{file.name}</span>
                <span className="text-gray-500 text-xs whitespace-nowrap">
                  ({(file.size / (1024 * 1024)).toFixed(1)} MB)
                </span>
              </div>
              <Button 
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 ml-2" 
                onClick={() => onRemove(index)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
};

export default SelectedFilesPreview;
