import React from "react";
import { Progress } from "./ui/progress";
import { Badge } from "./ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./ui/tooltip";
import { CheckCircle2, AlertCircle, Clock, XCircle, Upload, Pause } from "lucide-react";
import { formatBytes, formatUploadSpeed, formatTimeRemaining } from "../lib/utils";

type ProcessingStatus = "pending" | "processing" | "completed" | "error" | "paused";

interface FileProgressRowProps {
  filename?: string;
  status?: ProcessingStatus;
  progress?: number;
  errorMessage?: string;
  uploadSpeed?: number;
  uploadedSize?: number;
  totalSize?: number;
  timeRemaining?: number;
  metadata?: {
    library?: string;
    collection?: string;
    year?: string;
  };
}

const FileProgressRow = ({
  filename = "example-video-2024.mp4",
  status = "pending",
  progress = 0,
  errorMessage = "",
  uploadSpeed = 0,
  uploadedSize = 0,
  totalSize = 0,
  timeRemaining = 0,
  metadata = {
    library: "Main Library",
    collection: "Science",
    year: "2024",
  },
}: FileProgressRowProps) => {
  const statusConfig = {
    pending: {
      icon: <Clock className="h-5 w-5 text-yellow-500" />,
      label: "Pending",
      color: "bg-yellow-100 text-yellow-800",
    },
    processing: {
      icon: <Upload className="h-5 w-5 text-blue-500 animate-pulse" />,
      label: "Processing",
      color: "bg-blue-100 text-blue-800",
    },
    completed: {
      icon: <CheckCircle2 className="h-5 w-5 text-green-500" />,
      label: "Completed",
      color: "bg-green-100 text-green-800",
    },
    error: {
      icon: <XCircle className="h-5 w-5 text-red-500" />,
      label: "Error",
      color: "bg-red-100 text-red-800",
    },
    paused: {
      icon: <Upload className="h-5 w-5 text-yellow-500" />,
      label: "Paused",
      color: "bg-yellow-100 text-yellow-800",
    },
  };

  const currentStatus = statusConfig[status];

  return (
    <div className="w-full p-4 bg-white border rounded-lg shadow-sm">
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-3">
            {currentStatus.icon}
            <div className="flex items-center gap-2 flex-1">
              <span className="font-medium truncate text-gray-900">{filename}</span>
              {/* Real-time upload percentage next to filename */}
              {status === 'processing' && (
                <div className="flex items-center gap-1 flex-shrink-0">
                  <span className="text-sm font-semibold text-blue-600 bg-blue-50 px-2 py-1 rounded-full">
                    {Math.round(progress)}%
                  </span>
                  <div className="w-3 h-3 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                </div>
              )}
              {status === 'completed' && (
                <span className="text-sm font-semibold text-green-600 bg-green-50 px-2 py-1 rounded-full">
                  100%
                </span>
              )}
              {status === 'error' && (
                <span className="text-sm font-semibold text-red-600 bg-red-50 px-2 py-1 rounded-full">
                  Failed
                </span>
              )}
            </div>
            <Badge variant="secondary" className={currentStatus.color}>
              {currentStatus.label}
            </Badge>
          </div>

          {/* Enhanced progress section for processing files */}
          {status === 'processing' && (
            <div className="space-y-2 mb-3">
              {/* Enhanced megabyte counter and upload stats */}
              <div className="flex justify-between items-center text-xs text-gray-600">
                <div className="flex items-center gap-3">
                  {/* Enhanced MB counter */}
                  <div className="flex items-center gap-1 bg-gray-50 px-2 py-1 rounded">
                    <span className="font-mono font-medium text-blue-600">
                      {formatBytes(uploadedSize || 0, 1)}
                    </span>
                    <span className="text-gray-400">/</span>
                    <span className="font-mono font-medium">
                      {formatBytes(totalSize || 0, 1)}
                    </span>
                  </div>
                  
                  {/* Upload speed - show for processing status */}
                  <div className="flex items-center gap-1 bg-green-50 px-2 py-1 rounded">
                    <span className="text-green-600">↑</span>
                    <span className="font-mono font-medium text-green-700">
                      {formatUploadSpeed(uploadSpeed)}
                    </span>
                  </div>
                </div>
                
                {/* Time remaining */}
                {timeRemaining > 0 && (
                  <div className="flex items-center gap-1 bg-blue-50 px-2 py-1 rounded">
                    <span className="text-blue-600">⏱</span>
                    <span className="font-mono text-blue-700">
                      {formatTimeRemaining(timeRemaining)}
                    </span>
                    <span className="text-blue-600 text-xs">remaining</span>
                  </div>
                )}
              </div>
              
              {/* Progress bar with percentage overlay */}
              <div className="relative">
                <Progress value={progress} className="h-3" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-xs font-medium text-white drop-shadow-sm">
                    {Math.round(progress)}%
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Enhanced progress section for paused files */}
          {status === 'paused' && (
            <div className="space-y-2 mb-3">
              {/* Enhanced megabyte counter and upload stats */}
              <div className="flex justify-between items-center text-xs text-gray-600">
                <div className="flex items-center gap-3">
                  {/* Enhanced MB counter */}
                  <div className="flex items-center gap-1 bg-gray-50 px-2 py-1 rounded">
                    <span className="font-mono font-medium text-blue-600">
                      {formatBytes(uploadedSize || 0, 1)}
                    </span>
                    <span className="text-gray-400">/</span>
                    <span className="font-mono font-medium">
                      {formatBytes(totalSize || 0, 1)}
                    </span>
                  </div>
                  
                  {/* Upload speed for paused state */}
                  {uploadSpeed && uploadSpeed > 0 && (
                    <div className="flex items-center gap-1 bg-yellow-50 px-2 py-1 rounded">
                      <span className="text-yellow-600">⏸</span>
                      <span className="font-mono font-medium text-yellow-700">
                        {formatUploadSpeed(uploadSpeed)}
                      </span>
                    </div>
                  )}
                </div>
                
                {/* Time remaining */}
                {timeRemaining > 0 && (
                  <div className="flex items-center gap-1 bg-blue-50 px-2 py-1 rounded">
                    <span className="text-blue-600">⏱</span>
                    <span className="font-mono text-blue-700">
                      {formatTimeRemaining(timeRemaining)}
                    </span>
                    <span className="text-blue-600 text-xs">remaining</span>
                  </div>
                )}
              </div>
              
              {/* Progress bar with percentage overlay */}
              <div className="relative">
                <Progress value={progress} className="h-3" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-xs font-medium text-white drop-shadow-sm">
                    {Math.round(progress)}%
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Standard progress bar for non-processing status */}
          {status !== 'processing' && (
            <div className="flex items-center gap-4 mb-3">
              <div className="flex-1">
                <Progress value={progress} className="h-2" />
              </div>
              <span className="text-sm text-gray-500 w-12">{progress}%</span>
            </div>
          )}

          {status === "error" && errorMessage && (
            <div className="flex items-center gap-2 p-2 bg-red-50 border border-red-200 rounded text-red-700">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <span className="text-sm">{errorMessage}</span>
            </div>
          )}
        </div>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>
              <div className="text-right">
                <div className="text-sm font-medium">{metadata.library}</div>
                <div className="text-sm text-gray-500">
                  {metadata.collection} - {metadata.year}
                </div>
                {totalSize > 0 && (
                  <div className="text-xs text-gray-400">
                    {((totalSize) / (1024 * 1024)).toFixed(1)} MB
                  </div>
                )}
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>Library: {metadata.library}</p>
              <p>Collection: {metadata.collection}</p>
              <p>Year: {metadata.year}</p>
              {totalSize > 0 && <p>Size: {formatBytes(totalSize)}</p>}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  );
};

export default FileProgressRow;
