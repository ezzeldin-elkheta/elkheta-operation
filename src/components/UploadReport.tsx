import React, { useState, useMemo, useEffect } from "react";
import { ScrollArea } from "./ui/scroll-area";
import { 
  CheckCircle, 
  XCircle, 
  FileWarning, 
  AlertCircle, 
  File, 
  Copy, 
  Info, 
  Download, 
  Upload, 
  FileCheck,
  AlertTriangle,
  Clock,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  Play
} from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { Button } from "./ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip";
import { formatBytes, formatDuration } from "../lib/utils";
import { Badge } from "@/components/ui/badge";
import { type VariantProps } from "class-variance-authority";

type BadgeVariant = VariantProps<typeof Badge>["variant"];

interface UploadResult {
  id: string;
  filename: string;
  status: string;
  message?: string;
  library?: string;
  collection?: string;
  details?: {
    uploadStatus: "success" | "error" | "skipped" | "duplicate";
    sheetStatus?: "updated" | "error" | "not-found" | "skipped";
    embedCode?: string;
    duration?: number;
    size?: number;
    errorDetails?: string;
    uploadSpeed?: number;
    timeRemaining?: number;
    uploadDuration?: number;
    videoGuid?: string;
    sheetUpdateTime?: number;
    embedUrl?: string;
    directPlayUrl?: string;
    sheetUpdateDetails?: {
      status: 'updated' | 'notFound' | 'skipped' | 'error' | 'pending';
      message?: string;
      embedCode?: string;
      updateTime?: number;
    };
  };
}

interface UploadReportProps {
  open: boolean;
  onClose: () => void;
  results: UploadResult[];
  duration?: string;
  totalSize?: number;
  totalUploadedSize?: number;
  totalUploadSpeed?: number;
  waitForSheetUpdates?: boolean;
}

const UploadReport: React.FC<UploadReportProps> = ({ 
  open, 
  onClose, 
  results, 
  duration,
  totalSize = 0,
  totalUploadedSize = 0,
  totalUploadSpeed = 0,
  waitForSheetUpdates = false // Changed default to false
}): JSX.Element => {
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [showEmbedCode, setShowEmbedCode] = useState<Set<string>>(new Set());
  const [processingUpdates, setProcessingUpdates] = useState(false);
  const [copySuccess, setCopySuccess] = useState<string | null>(null);
  
  // Local state to track sheet updates independently
  const [localResults, setLocalResults] = useState<UploadResult[]>(results);

  // Update local results when incoming results change
  useEffect(() => {
    setLocalResults(results);
  }, [results]);

  // Check for any pending sheet updates but don't block the UI
  useEffect(() => {
    if (!open) return;
    
    const hasPendingSheetUpdates = localResults.some(r => 
      r.details?.sheetUpdateDetails?.status === 'pending'
    );
    
    // We now set this to false to avoid blocking the report display
    setProcessingUpdates(false);
    
    // Optional: Set up periodic check for sheet updates to refresh the report data
    const checkInterval = setInterval(() => {
      // For each result with pending sheet updates, we could check their status
      // This is where you might integrate with your sheet update checking logic
      console.log("Checking for sheet update status changes...");
    }, 5000);
    
    return () => clearInterval(checkInterval);
  }, [open, localResults]);

  // Categorize results
  const successful = localResults.filter(r => r.details?.uploadStatus === 'success');
  const failed = localResults.filter(r => r.details?.uploadStatus === 'error');  const sheetUpdated = localResults.filter(r => 
    r.details?.sheetUpdateDetails?.status === 'updated'
  );
  const notFound = localResults.filter(r => 
    r.details?.sheetUpdateDetails?.status === 'notFound'
  );
  const sheetProcessing = localResults.filter(r =>
    r.details?.sheetUpdateDetails?.status === 'pending'
  );
  const skipped = localResults.filter(r => 
    r.details?.uploadStatus === 'skipped' || 
    r.details?.sheetUpdateDetails?.status === 'skipped'
  );
  
  // Calculate statistics
  const totalFiles = localResults.length;
  const successRate = totalFiles > 0 ? Math.round((successful.length / totalFiles) * 100) : 0;
  
  // Calculate total size and duration
  const totalVideoSize = useMemo(() => {
    return localResults.reduce((acc, r) => acc + (r.details?.size || 0), 0);
  }, [localResults]);
  
  const totalDuration = useMemo(() => {
    return localResults.reduce((acc, r) => acc + (r.details?.duration || 0), 0);
  }, [localResults]);
  
  // Handle report copy to clipboard
  const copyReportToClipboard = async () => {
    const text = `Upload Report:
Total Files: ${totalFiles}
Successful: ${successful.length}
Failed: ${failed.length}
Sheet Updated: ${sheetUpdated.length}
Not Found in Sheet: ${notFound.length}
Skipped: ${skipped.length}

Detailed Results:
${localResults.map(r => {
  let status = r.details?.uploadStatus || 'unknown';
  let sheetStatus = r.details?.sheetUpdateDetails?.status || 'unknown';
  return `${r.filename}: Upload: ${status}, Sheet: ${sheetStatus}${r.message ? ` - ${r.message}` : ''}`;
}).join('\n')}`;

    try {
      await navigator.clipboard.writeText(text);
      setCopySuccess('Report copied to clipboard!');
      setTimeout(() => setCopySuccess(null), 2000);
    } catch (err) {
      console.error('Failed to copy report:', err);
    }
  };
  
  const toggleExpand = (id: string) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedItems(newExpanded);
  };

  const toggleEmbedCode = (id: string) => {
    const newShowEmbed = new Set(showEmbedCode);
    if (newShowEmbed.has(id)) {
      newShowEmbed.delete(id);
    } else {
      newShowEmbed.add(id);
    }
    setShowEmbedCode(newShowEmbed);
  };

  const copyEmbedCode = async (embedCode: string, id: string) => {
    try {
      await navigator.clipboard.writeText(embedCode);
      setCopySuccess(`Embed code for ${id} copied!`);
      setTimeout(() => setCopySuccess(null), 2000);
    } catch (err) {
      console.error('Failed to copy embed code:', err);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
      case 'updated':
        return <CheckCircle className="w-5 h-5 text-green-500 mr-3 flex-shrink-0" />;
      case 'error':
        return <XCircle className="w-5 h-5 text-red-500 mr-3 flex-shrink-0" />;
      case 'skipped':
      case 'duplicate':
        return <AlertCircle className="w-5 h-5 text-blue-500 mr-3 flex-shrink-0" />;
      case 'notFound':
        return <AlertTriangle className="w-5 h-5 text-orange-500 mr-3 flex-shrink-0" />;
      case 'pending':
        return <Clock className="w-5 h-5 text-gray-500 mr-3 flex-shrink-0 animate-pulse" />;
      default:
        return <AlertCircle className="w-5 h-5 text-gray-500 mr-3 flex-shrink-0" />;
    }
  };

  const renderVideoItem = (result: UploadResult) => {
    const sheetStatus = result.details?.sheetUpdateDetails?.status || 'unknown';
    const uploadStatus = result.details?.uploadStatus || 'unknown';
    const embedCode = result.details?.embedCode || result.details?.sheetUpdateDetails?.embedCode;

    return (
      <React.Fragment key={result.id}>
        <div className="border rounded-lg mb-2 bg-white overflow-hidden">
          <div 
            className="flex items-center p-3 cursor-pointer hover:bg-gray-50"
            onClick={() => toggleExpand(result.id)}
          >
            {expandedItems.has(result.id) ? 
              <ChevronDown className="h-4 w-4 mr-2 text-gray-500" /> : 
              <ChevronRight className="h-4 w-4 mr-2 text-gray-500" />
            }
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-medium">{result.filename || "Untitled Video"}</span>
                {result.details?.directPlayUrl && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs"
                    onClick={(e) => {
                      e.stopPropagation();
                      window.open(result.details.directPlayUrl, '_blank');
                    }}
                  >
                    <Play className="w-3 h-3 mr-1" />
                    Play Video
                  </Button>
                )}
              </div>
              
              <div className="flex flex-wrap gap-1 mt-1">
                {uploadStatus === 'duplicate' && (
                  <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded">
                    Video already exists
                  </span>
                )}
                {sheetStatus === 'skipped' && (
                  <span className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                    Embed code already in sheet
                  </span>
                )}
                {sheetStatus === 'notFound' && (
                  <span className="text-xs text-orange-600 bg-orange-50 px-2 py-0.5 rounded">
                    Video not found in sheet
                  </span>
                )}
                {sheetStatus === 'pending' && (
                  <span className="text-xs text-gray-600 bg-gray-50 px-2 py-0.5 rounded animate-pulse">
                    Sheet update in progress...
                  </span>
                )}
                {sheetStatus === 'updated' && (
                  <span className="text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded">
                    Sheet updated successfully
                  </span>
                )}
              </div>
            </div>
            
            <div className="flex gap-2 ml-4">
              <div title={`Upload: ${uploadStatus}`}>
                {getStatusIcon(uploadStatus)}
              </div>
              <div title={`Sheet: ${sheetStatus}`}>
                {getStatusIcon(sheetStatus)}
              </div>
            </div>
          </div>

          {expandedItems.has(result.id) && (
            <div className="px-9 pb-3 border-t">
              {(result.message || result.details?.errorDetails) && (
                <div className="bg-red-50 border border-red-100 rounded p-2 mt-3 mb-3 text-xs text-red-600">
                  {result.message || result.details?.errorDetails}
                </div>
              )}
              
              <div className="grid grid-cols-2 gap-4 mt-3">
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold text-gray-700">Upload Details</h4>
                  {result.details?.size && (
                    <div className="flex items-center gap-2 text-gray-600 text-xs">
                      <span className="font-medium">Size:</span>
                      {formatBytes(result.details.size)}
                    </div>
                  )}
                  {result.details?.duration && (
                    <div className="flex items-center gap-2 text-gray-600 text-xs">
                      <span className="font-medium">Duration:</span>
                      {formatDuration(result.details.duration)}
                    </div>
                  )}
                  {result.details?.uploadSpeed && (
                    <div className="flex items-center gap-2 text-gray-600 text-xs">
                      <span className="font-medium">Upload Speed:</span>
                      {formatBytes(result.details.uploadSpeed)}/s
                    </div>
                  )}
                  {result.details?.uploadDuration && (
                    <div className="flex items-center gap-2 text-gray-600 text-xs">
                      <span className="font-medium">Upload Time:</span>
                      {formatDuration(result.details.uploadDuration)}
                    </div>
                  )}
                  {result.details?.videoGuid && (
                    <div className="flex items-center gap-2 text-gray-600 text-xs">
                      <span className="font-medium">GUID:</span>
                      <code className="text-xs bg-gray-100 px-1 rounded">{result.details.videoGuid}</code>
                    </div>
                  )}
                </div>
                
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold text-gray-700">Sheet Update Details</h4>
                  
                  <div className={`flex items-center gap-2 text-xs ${getStatusTextColor(sheetStatus)}`}>
                    <span className="font-medium">Status:</span>
                    {sheetStatus === 'pending' ? (
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3 animate-spin" /> Processing...
                      </span>
                    ) : sheetStatus}
                  </div>
                  
                  {result.details?.sheetUpdateDetails?.message && (
                    <div className="flex items-center gap-2 text-gray-600 text-xs">
                      <span className="font-medium">Message:</span>
                      {result.details.sheetUpdateDetails.message}
                    </div>
                  )}
                  
                  {result.details?.sheetUpdateDetails?.updateTime && (
                    <div className="flex items-center gap-2 text-gray-600 text-xs">
                      <span className="font-medium">Update Time:</span>
                      {formatDuration(result.details.sheetUpdateDetails.updateTime)}
                    </div>
                  )}
                </div>
              </div>

              {embedCode && (
                <div className="mt-4 space-y-2">
                  <h4 className="text-sm font-semibold text-gray-700">Embed Code</h4>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => toggleEmbedCode(result.id)}
                    >
                      {showEmbedCode.has(result.id) ? 'Hide' : 'Show'} Embed Code
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => copyEmbedCode(embedCode, result.filename)}
                    >
                      <Copy className="w-3 h-3 mr-1" />
                      Copy Code
                    </Button>
                  </div>
                  {showEmbedCode.has(result.id) && (
                    <pre className="bg-gray-50 p-2 rounded text-xs overflow-x-auto whitespace-pre-wrap">
                      {embedCode}
                    </pre>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </React.Fragment>
    );
  };

  if (processingUpdates) {
    return (
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Processing Sheet Updates</DialogTitle>
            <DialogDescription>
              Please wait while we update the Google Sheets with the video information...
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center justify-center py-8">
            <div className="flex items-center justify-center h-16 w-16 rounded-full bg-blue-50 mb-4">
              <FileCheck className="h-8 w-8 text-blue-500 animate-pulse" />
            </div>
            <p className="text-sm text-center text-gray-600">
              We're updating the sheet with video embed codes.
              <br/>This may take a few moments.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <div className="flex justify-between items-center">
            <DialogTitle className="text-xl font-bold">Upload Report</DialogTitle>
          </div>
          <DialogDescription>
            Completed in: {duration || 'N/A'}
          </DialogDescription>
        </DialogHeader>

        {/* Stats Grid */}
        <div className="grid grid-cols-5 gap-4 mb-6">
          <StatCard
            title="Successful"
            value={successful.length}
            icon={<CheckCircle className="h-5 w-5" />}
            variant="success"
          />
          <StatCard
            title="Failed"
            value={failed.length}
            icon={<XCircle className="h-5 w-5" />}
            variant="error"
          />
          <StatCard
            title="Sheet Updated"
            value={sheetUpdated.length}
            icon={<FileCheck className="h-5 w-5" />}
            variant="info"
          />
          <StatCard
            title="Not Found"
            value={notFound.length}
            icon={<AlertTriangle className="h-5 w-5" />}
            variant="warning"
          />
          <StatCard
            title="Skipped"
            value={skipped.length}
            icon={<Clock className="h-5 w-5" />}
            variant="secondary"
          />
        </div>

        {/* Progress Summary */}
        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <div className="grid grid-cols-4 gap-4 text-sm">
            <div>
              <div className="text-gray-500">Success Rate</div>
              <div className="text-xl font-bold">{successRate}%</div>
            </div>
            <div>
              <div className="text-gray-500">Total Size</div>
              <div className="text-xl font-bold">{formatBytes(totalSize || totalVideoSize)}</div>
            </div>
            <div>
              <div className="text-gray-500">Upload Speed</div>
              <div className="text-xl font-bold">{totalUploadSpeed > 0 ? `${formatBytes(totalUploadSpeed)}/s` : 'N/A'}</div>
            </div>
            <div>
              <div className="text-gray-500">Total Duration</div>
              <div className="text-xl font-bold">{totalDuration > 0 ? formatDuration(totalDuration) : 'N/A'}</div>
            </div>
          </div>
        </div>

        {/* Video List */}
        <Tabs defaultValue="all" className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="all">All ({totalFiles})</TabsTrigger>
            <TabsTrigger value="successful">Successful ({successful.length})</TabsTrigger>
            <TabsTrigger value="failed">Failed ({failed.length})</TabsTrigger>
            <TabsTrigger value="sheet-updated">Sheet Updated ({sheetUpdated.length})</TabsTrigger>
            <TabsTrigger value="not-found">Not Found ({notFound.length})</TabsTrigger>
          </TabsList>

          <ScrollArea className="h-[400px] mt-4">
            <TabsContent value="all" className="m-0 space-y-2">
              {localResults.map((result, index) => (
                <React.Fragment key={`${result.filename}-${index}`}>
                  {renderVideoItem(result)}
                </React.Fragment>
              ))}
            </TabsContent>

            <TabsContent value="successful" className="m-0 space-y-2">
              {successful.map((result, index) => (
                <React.Fragment key={`${result.filename}-${index}`}>
                  {renderVideoItem(result)}
                </React.Fragment>
              ))}
            </TabsContent>

            <TabsContent value="failed" className="m-0 space-y-2">
              {failed.map((result, index) => (
                <React.Fragment key={`${result.filename}-${index}`}>
                  {renderVideoItem(result)}
                </React.Fragment>
              ))}
            </TabsContent>

            <TabsContent value="sheet-updated" className="m-0 space-y-2">
              {sheetUpdated.map((result, index) => (
                <React.Fragment key={`${result.filename}-${index}`}>
                  {renderVideoItem(result)}
                </React.Fragment>
              ))}
            </TabsContent>

            <TabsContent value="not-found" className="m-0 space-y-2">
              {notFound.map((result, index) => (
                <React.Fragment key={`${result.filename}-${index}`}>
                  {renderVideoItem(result)}
                </React.Fragment>
              ))}
            </TabsContent>
          </ScrollArea>
        </Tabs>

        <div className="flex justify-end gap-2 mt-4">
          {copySuccess && (
            <div className="mr-auto px-3 py-1 bg-green-50 text-green-700 text-sm rounded-md">
              {copySuccess}
            </div>
          )}
          <Button variant="outline" onClick={copyReportToClipboard}>
            <Copy className="w-4 h-4 mr-2" />
            Copy Report
          </Button>
          <Button onClick={onClose}>Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

const StatCard = ({ title, value, icon, variant }: {
  title: string;
  value: number;
  icon: React.ReactNode;
  variant: 'success' | 'error' | 'info' | 'warning' | 'secondary';
}) => {
  const variantStyles = {
    success: 'bg-green-50 border-green-100 text-green-700',
    error: 'bg-red-50 border-red-100 text-red-700',
    info: 'bg-blue-50 border-blue-100 text-blue-700',
    warning: 'bg-yellow-50 border-yellow-100 text-yellow-700',
    secondary: 'bg-gray-50 border-gray-100 text-gray-700',
  };

  return (
    <div className={`border rounded-lg p-4 ${variantStyles[variant]}`}>
      <div className="flex items-center justify-between mb-2">
        {icon}
        <span className="text-2xl font-bold">{value}</span>
      </div>
      <div className="text-sm">{title}</div>
    </div>
  );
};

const getStatusTextColor = (status: string) => {
  switch (status) {
    case 'updated':
      return 'text-green-600';
    case 'notFound':
      return 'text-orange-600';
    case 'skipped':
      return 'text-blue-600';
    case 'error':
      return 'text-red-600';
    case 'pending':
      return 'text-gray-600';
    default:
      return 'text-gray-600';
  }
};

export default UploadReport;
