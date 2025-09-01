import React, { useCallback, useState, useMemo, useEffect } from "react"; // Added useEffect
import { ScrollArea } from "./ui/scroll-area";
import { Progress } from "./ui/progress";
import { Button } from "./ui/button";
import { AlertDialog, AlertDialogContent, AlertDialogAction, AlertDialogCancel, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "./ui/alert-dialog";
import { Pause, Play, XCircle, AlertTriangle, Check, ChevronsUpDown, CheckCircle2, AlertOctagon, Clock, Loader2, RotateCcw } from "lucide-react"; // Added Check, ChevronsUpDown, CheckCircle2, AlertOctagon, Clock, Loader2, RotateCcw
import { formatBytes, formatUploadSpeed, formatTimeRemaining } from "../lib/utils";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem, SelectGroup, SelectLabel } from "./ui/select"; // Use shadcn Select
import { useToast } from "../hooks/use-toast"; // Added toast import
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip";
import { QueueItem, UploadGroup } from "../lib/upload/types";
import { Badge } from "./ui/badge";
import { 
  AlertCircle,
  FileVideo,
  Upload,
  Zap,
  Timer
} from "lucide-react";

interface Library {
  id: string;
  name: string;
}

// interface QueueItem { ... } - REMOVED

// interface UploadGroup { ... } - REMOVED

interface ProcessingQueueProps {
  groups: UploadGroup[];
  libraries: Library[];
  onUpdateMetadata: (fileId: string, libraryId: string, libraryName: string) => void; // Updated signature
  onPauseUpload: (fileId: string) => void;
  onResumeUpload: (fileId: string) => void;
  onCancelUpload: (fileId: string) => void;
  onGlobalPauseToggle: () => void;
  isGloballyPaused: boolean;
}

const ProcessingQueue: React.FC<ProcessingQueueProps> = ({
  groups,
  libraries, // Full list of libraries
  onUpdateMetadata,
  onPauseUpload,
  onResumeUpload,
  onCancelUpload,
  onGlobalPauseToggle,
  isGloballyPaused
}) => {
  const { toast } = useToast();
  const [prevTotalFiles, setPrevTotalFiles] = useState(0);
  const [prevCompletedFiles, setPrevCompletedFiles] = useState(0);

  const totalFiles = groups.reduce((acc, group) => acc + group.items.length, 0);
  const completedFiles = groups.reduce((acc, group) =>
    acc + group.items.filter(item => item.status === "completed").length, 0);
  const failedFiles = groups.reduce((acc, group) =>
    acc + group.items.filter(item => item.status === "error").length, 0);
  const processingFiles = groups.reduce((acc, group) =>
    acc + group.items.filter(item => item.status === "processing" || item.status === "paused").length, 0);
  const pendingFiles = totalFiles - completedFiles - failedFiles - processingFiles;

  // Monitor upload completion
  useEffect(() => {
    // Only proceed if we have files and the total hasn't changed (to avoid premature notifications)
    if (totalFiles > 0 && totalFiles === prevTotalFiles) {
      // Check if all files are either completed or failed (no pending or processing)
      if (pendingFiles === 0 && processingFiles === 0) {
        // Show completion toast
        toast({
          title: "Upload Complete",
          description: `Successfully uploaded ${completedFiles} files${failedFiles > 0 ? `, ${failedFiles} failed` : ''}`,
          variant: failedFiles > 0 ? "destructive" : "default",
        });
      }
    }
    
    // Update previous values for next comparison
    setPrevTotalFiles(totalFiles);
    setPrevCompletedFiles(completedFiles);
  }, [totalFiles, completedFiles, failedFiles, pendingFiles, processingFiles]);

  const totalProgress = totalFiles > 0
    ? Math.round((completedFiles / totalFiles) * 100)
    : 0;

  const sortItems = useCallback((items: QueueItem[]) => {
    return [...items].sort((a, b) => {
      const baseNameA = a.filename.split(/Q\d+/)[0];
      const baseNameB = b.filename.split(/Q\d+/)[0];

      if (baseNameA !== baseNameB) {
        return baseNameA.localeCompare(baseNameB);
      }

      const qNumA = parseInt(a.filename.match(/Q(\d+)/)?.[1] || "0");
      const qNumB = parseInt(b.filename.match(/Q(\d+)/)?.[1] || "0");
      return qNumA - qNumB;
    });
  }, []);

  const sortedGroups = groups.map(group => ({
    ...group,
    items: sortItems(group.items)
  }));

  const libraryOptions = useMemo(() => libraries.sort((a, b) => a.name.localeCompare(b.name)), [libraries]);

  const getLibraryName = useCallback((id: string) => {
      return libraries.find(lib => lib.id === id)?.name || id;
  }, [libraries]);

  const handleGroupLibrarySelect = (groupItems: QueueItem[], libraryId: string) => {
    const selectedLib = libraryOptions.find(lib => lib.id === libraryId);
    if (selectedLib) {
      groupItems.forEach(item => {
        if (item.metadata.needsManualSelection) {
          onUpdateMetadata(item.id, selectedLib.id, selectedLib.name);
        }
      });
    }
  };

  // Add helper function to strip file extension
  const getDisplayName = (filename: string): string => {
    return filename.replace(/\.[^/.]+$/, '');
  };

  // Update the getStatusIcon function
  const getStatusIcon = (status: string, attempts: number = 0) => {
    switch (status) {
      case 'completed':
        return (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              </TooltipTrigger>
              <TooltipContent>Upload completed successfully</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        );
      case 'error':
        return attempts >= 3 ? (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <AlertOctagon className="h-4 w-4 text-red-500" />
              </TooltipTrigger>
              <TooltipContent>Upload failed after multiple attempts</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <AlertTriangle className="h-4 w-4 text-yellow-500" />
              </TooltipTrigger>
              <TooltipContent>Upload error - will retry</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        );
      case 'processing':
        return (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />
              </TooltipTrigger>
              <TooltipContent>Currently uploading</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        );
      case 'pending':
        return (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <Clock className="h-4 w-4 text-gray-400" />
              </TooltipTrigger>
              <TooltipContent>Waiting to upload</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        );
      default:
        return null;
    }
  };

  // Calculate total size and current upload speed
  const totalSize = useMemo(() => {
    return groups.reduce((acc, group) => 
      acc + group.items.reduce((groupAcc, item) => 
        groupAcc + (item.totalSize || item.file?.size || 0), 0), 0);
  }, [groups]);

  const totalUploadedSize = useMemo(() => {
    return groups.reduce((acc, group) => 
      acc + group.items.reduce((groupAcc, item) => 
        groupAcc + (item.uploadedSize || 0), 0), 0);
  }, [groups]);

  const totalUploadSpeed = useMemo(() => {
    return groups.reduce((acc, group) => 
      acc + group.items.reduce((groupAcc, item) => 
        groupAcc + (item.uploadSpeed || 0), 0), 0);
  }, [groups]);

  return (
    <div className="space-y-4">
      <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
        <div className="flex justify-between items-center mb-2">
          <div className="flex gap-6 flex-wrap">
            <div>
              <span className="text-gray-500 text-sm">Total:</span>
              <span className="font-medium ml-1">{totalFiles}</span>
            </div>
            <div>
              <span className="text-green-500 text-sm">Completed:</span>
              <span className="font-medium ml-1">{completedFiles}</span>
            </div>
            <div>
              <span className="text-blue-500 text-sm">Processing:</span>
              <span className="font-medium ml-1">{processingFiles}</span>
            </div>
            <div>
              <span className="text-yellow-500 text-sm">Pending:</span>
              <span className="font-medium ml-1">{pendingFiles}</span>
            </div>
            {failedFiles > 0 && (
              <div className="flex items-center">
                <AlertTriangle className="h-4 w-4 text-red-500 mr-1" />
                <span className="text-red-500 text-sm">Failed:</span>
                <span className="font-medium ml-1">{failedFiles}</span>
              </div>
            )}
          </div>

          <Button
            variant={isGloballyPaused ? "default" : "outline"}
            size="sm"
            onClick={onGlobalPauseToggle}
            className="flex-shrink-0"
          >
            {isGloballyPaused ? (
              <>
                <Play className="h-4 w-4 mr-2" />
                Resume All
              </>
            ) : (
              <>
                <Pause className="h-4 w-4 mr-2" />
                Pause All
              </>
            )}
          </Button>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <div className="flex items-center gap-4">
              <span className="font-semibold text-gray-700">Overall Progress</span>
              <div className="flex items-center gap-1 bg-gray-100 px-3 py-1 rounded-full">
                <span className="font-mono font-medium text-blue-600">
                  {formatBytes(totalUploadedSize, 1)}
                </span>
                <span className="text-gray-400">/</span>
                <span className="font-mono font-medium text-gray-700">
                  {formatBytes(totalSize, 1)}
                </span>
              </div>
              {/* Upload speed and time estimation */}
              {processingFiles > 0 && (
                <div className="flex items-center gap-1 bg-green-100 px-3 py-1 rounded-full">
                  <span className="text-green-600">↑</span>
                  <span className="font-mono font-medium text-green-700">
                    {formatUploadSpeed(totalUploadSpeed)}
                  </span>
                </div>
              )}
              {/* Overall completion time estimate */}
              {totalUploadSpeed > 0 && totalSize > totalUploadedSize && (
                <div className="flex items-center gap-1 bg-blue-100 px-3 py-1 rounded-full">
                  <span className="text-blue-600">⏱</span>
                  <span className="font-mono font-medium text-blue-700">
                    {formatTimeRemaining((totalSize - totalUploadedSize) / totalUploadSpeed)}
                  </span>
                  <span className="text-blue-600 text-xs">remaining</span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold text-blue-600">{totalProgress}%</span>
              {processingFiles > 0 && (
                <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
              )}
            </div>
          </div>
          <div className="relative">
            <Progress value={totalProgress} className="h-4" />
            {/* Progress percentage overlay on the global progress bar */}
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-sm font-medium text-white drop-shadow-sm">
                {totalProgress}% ({completedFiles}/{totalFiles} files)
              </span>
            </div>
          </div>
          
          {/* Enhanced statistics row */}
          <div className="flex justify-between items-center text-xs text-gray-600 bg-gray-50 px-3 py-2 rounded-lg">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span>Completed: <strong>{completedFiles}</strong></span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <span>Processing: <strong>{processingFiles}</strong></span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                <span>Pending: <strong>{pendingFiles}</strong></span>
              </div>
              {failedFiles > 0 && (
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                  <span>Failed: <strong>{failedFiles}</strong></span>
                </div>
              )}
            </div>
            
            {/* Data transfer statistics */}
            <div className="flex items-center gap-3 text-xs">
              {totalSize > 0 && (
                <span>
                  Total Size: <strong>{((totalSize) / (1024 * 1024 * 1024)).toFixed(2)} GB</strong>
                </span>
              )}
              {processingFiles > 0 && (
                <span>
                  Avg Speed: <strong>
                    {(() => {
                      // Get only processing files with valid upload speeds
                      const activeUploads = groups.flatMap(group => 
                        group.items.filter(item => 
                          item.status === 'processing' && 
                          item.uploadSpeed && 
                          item.uploadSpeed > 0
                        )
                      );
                      
                      if (activeUploads.length === 0) {
                        return 'Starting...';
                      }
                      
                      const totalActiveSpeed = activeUploads.reduce((sum, item) => sum + (item.uploadSpeed || 0), 0);
                      const avgSpeed = totalActiveSpeed / activeUploads.length;
                      
                      return `${formatBytes(avgSpeed, 1)}/s per file (${activeUploads.length} active)`;
                    })()}
                  </strong>
                </span>
              )}
              {/* Show upload progress ratio */}
              {totalSize > 0 && totalUploadedSize > 0 && (
                <span>
                  Progress: <strong>{((totalUploadedSize / totalSize) * 100).toFixed(1)}%</strong>
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <ScrollArea className="h-[300px] rounded-md border">
        <div className="p-4 space-y-4">
          {sortedGroups.map((group) => {
            const firstItemSuggestions = group.items[0]?.metadata?.suggestedLibraries || [];
            const suggestedOptions = firstItemSuggestions;
            const otherOptions = libraryOptions.filter(lib => !suggestedOptions.some(s => s.id === lib.id));

            return (
              <div key={`${group.library}-${group.collection}-${group.suggestedLibraryName || ''}`} className={`border rounded-lg p-4 ${group.needsManualSelection ? 'border-orange-300 bg-orange-50' : ''}`}>
                <div className="mb-4 flex justify-between items-center">
                  <div>
                    {group.needsManualSelection ? (
                      <h3 className="font-semibold text-orange-700 flex items-center gap-2">
                        <AlertTriangle className="inline-block h-5 w-5 flex-shrink-0" />
                        <span>
                          Manual Library Selection Needed
                          <div className="text-sm font-normal text-gray-600">
                            Suggested Library: <span className="font-medium">{group.suggestedLibraryName || 'N/A'}</span>
                          </div>
                          <div className="text-sm font-normal text-gray-600">
                            Target Collection: <span className="font-medium">{group.collection}</span>
                            {group.items[0]?.metadata?.reason && <span className="text-xs"> ({group.items[0].metadata.reason})</span>}
                          </div>
                        </span>
                      </h3>
                    ) : (
                      <h3 className="font-semibold">
                        {group.library}
                        {group.collection && ` → ${group.collection}`}
                      </h3>
                    )}
                  </div>
                  {group.needsManualSelection && (
                    <Select
                      onValueChange={(value) => handleGroupLibrarySelect(group.items, value)}
                    >
                      <SelectTrigger className="w-[280px] ml-4 flex-shrink-0 border-orange-500 text-orange-600">
                        <SelectValue placeholder="Select Library for Group..." />
                      </SelectTrigger>
                      <SelectContent>
                        {suggestedOptions.length > 0 && (
                          <SelectGroup>
                            <SelectLabel>Suggested</SelectLabel>
                            {suggestedOptions.map(lib => (
                              <SelectItem key={lib.id} value={lib.id}>
                                {lib.name} {lib.score !== undefined ? `(${lib.score.toFixed(0)}%)` : ''}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        )}
                        {otherOptions.length > 0 && (
                          <SelectGroup>
                            <SelectLabel>Other Libraries</SelectLabel>
                            {otherOptions.map(lib => (
                              <SelectItem key={lib.id} value={lib.id}>
                                {lib.name}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        )}
                      </SelectContent>
                    </Select>
                  )}
                </div>

                <div className="space-y-3">
                  {group.items.map((item) => (
                    <div key={item.id} className="flex flex-col gap-2 py-2 border-b last:border-b-0">
                      <div className="flex items-center gap-2">
                        <div className="flex-shrink-0">
                          {getStatusIcon(item.status, (item as any).attempts || 0)}
                        </div>
                        <div className="flex-1 min-w-0 flex items-center gap-2">
                          <span className="truncate font-medium text-gray-900">
                            {getDisplayName(item.filename)}
                          </span>
                          {/* Real-time upload percentage next to filename */}
                          {(item.status === 'processing' || item.status === 'paused') && (
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <span className="text-sm font-semibold text-blue-600 bg-blue-50 px-2 py-1 rounded-full">
                                {Math.round(item.progress || 0)}%
                              </span>
                              {item.status === 'processing' && (
                                <div className="w-3 h-3 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                              )}
                              {item.status === 'paused' && (
                                <div className="w-3 h-3 bg-yellow-500 rounded-full flex items-center justify-center">
                                  <div className="w-1 h-1 bg-white rounded-full"></div>
                                </div>
                              )}
                            </div>
                          )}
                          {item.status === 'completed' && (
                            <span className="text-sm font-semibold text-green-600 bg-green-50 px-2 py-1 rounded-full">
                              100%
                            </span>
                          )}
                          {item.status === 'error' && (
                            <span className="text-sm font-semibold text-red-600 bg-red-50 px-2 py-1 rounded-full">
                              Failed
                            </span>
                          )}
                        </div>
                        <div className="flex items-center flex-shrink-0">
                          {(item.status === 'processing' || item.status === 'pending' || item.status === 'paused') && !item.metadata.needsManualSelection && (
                            <>
                              {item.status === 'processing' && (
                                <Button variant="ghost" size="icon" onClick={() => onPauseUpload(item.id)} title="Pause Upload">
                                  <Pause className="h-4 w-4" />
                                </Button>
                              )}
                              {item.status === 'paused' && (
                                <Button variant="ghost" size="icon" onClick={() => onResumeUpload(item.id)} title="Resume Upload">
                                  <Play className="h-4 w-4" />
                                </Button>
                              )}
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-700" title="Cancel Upload">
                                    <XCircle className="h-4 w-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Cancel Upload?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      This will stop the upload for "{item.filename}". Partially uploaded data might remain on the server and require manual deletion. Are you sure?
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>No, Keep Uploading</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => onCancelUpload(item.id)} className="bg-red-500 hover:bg-red-600">Yes, Cancel</AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Enhanced Progress Bar Section with Better Megabyte Counter */}
                      {(item.status === 'processing' || item.status === 'paused') && !item.metadata.needsManualSelection && (
                        <div className="flex flex-col gap-2 w-full">
                          {/* Enhanced progress info with better formatting */}
                          <div className="flex justify-between items-center text-xs text-gray-600">
                            <div className="flex items-center gap-3">
                              {/* Enhanced MB counter with real-time updates */}
                              <div className="flex items-center gap-1 bg-gray-50 px-2 py-1 rounded">
                                <span className="font-mono font-medium text-blue-600">
                                  {formatBytes(item.uploadedSize || 0, 1)}
                                </span>
                                <span className="text-gray-400">/</span>
                                <span className="font-mono font-medium">
                                  {formatBytes(item.totalSize || item.file?.size || 0, 1)}
                                </span>
                              </div>
                              
                              {/* Upload speed with better formatting - always show if processing */}
                              {item.status === 'processing' && (
                                <div className="flex items-center gap-1 bg-green-50 px-2 py-1 rounded">
                                  <span className="text-green-600">↑</span>
                                  <span className="font-mono font-medium text-green-700">
                                    {formatUploadSpeed(item.uploadSpeed)}
                                  </span>
                                </div>
                              )}
                              
                              {/* Upload speed for paused state */}
                              {item.status === 'paused' && item.uploadSpeed && item.uploadSpeed > 0 && (
                                <div className="flex items-center gap-1 bg-yellow-50 px-2 py-1 rounded">
                                  <span className="text-yellow-600">⏸</span>
                                  <span className="font-mono font-medium text-yellow-700">
                                    {formatUploadSpeed(item.uploadSpeed)}
                                  </span>
                                </div>
                              )}
                              
                              {/* File size info */}
                              <div className="text-gray-500">
                                {(item.totalSize || item.file?.size) && (
                                  <span className="text-xs">
                                    ({(((item.totalSize || item.file?.size || 0)) / (1024 * 1024)).toFixed(1)} MB total)
                                  </span>
                                )}
                              </div>
                            </div>
                            
                            {/* Time remaining with better formatting */}
                            {item.timeRemaining !== undefined && item.timeRemaining > 0 && (
                              <div className="flex items-center gap-1 bg-blue-50 px-2 py-1 rounded">
                                <span className="text-blue-600">⏱</span>
                                <span className="font-mono text-blue-700">
                                  {formatTimeRemaining(item.timeRemaining)}
                                </span>
                                <span className="text-blue-600 text-xs">remaining</span>
                              </div>
                            )}
                          </div>
                          
                          {/* Progress bar with enhanced styling */}
                          <div className="relative">
                            <Progress value={item.progress} className="h-3 w-full" />
                            {/* Progress percentage overlay */}
                            <div className="absolute inset-0 flex items-center justify-center">
                              <span className="text-xs font-medium text-white drop-shadow-sm">
                                {Math.round(item.progress || 0)}%
                              </span>
                            </div>
                          </div>
                          
                          {/* Upload status indicator */}
                          <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2">
                              {item.status === 'processing' && (
                                <span className="flex items-center gap-1 text-blue-600">
                                  <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse"></div>
                                  Uploading...
                                </span>
                              )}
                              {item.status === 'paused' && (
                                <span className="flex items-center gap-1 text-yellow-600">
                                  <div className="w-2 h-2 bg-yellow-600 rounded-full"></div>
                                  Paused
                                </span>
                              )}
                            </div>
                            
                            {/* Data transfer rate indicator */}
                            {item.uploadSpeed !== undefined && item.uploadSpeed > 0 && (item.totalSize || item.file?.size) && (
                              <div className="text-gray-500">
                                <span className="text-xs">
                                  ETA: {formatTimeRemaining(((item.totalSize || item.file?.size || 0) - (item.uploadedSize || 0)) / item.uploadSpeed)}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {item.errorMessage && (
                        <div className="flex items-center gap-2 p-2 bg-red-50 border border-red-200 rounded text-red-700">
                          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                          <p className="text-xs">{item.errorMessage}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
};

export default ProcessingQueue;
