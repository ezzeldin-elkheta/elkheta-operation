import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog";
import { Button } from "./ui/button";
import { ScrollArea } from "./ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { CheckCircle, XCircle, AlertCircle, AlertTriangle, Copy, Clock } from "lucide-react"; // Added Clock

interface UpdateResult {
  videoName: string;
  status: 'updated' | 'notFound' | 'skipped' | 'error' | 'pending';
  details?: string;
  embedCode?: string;
}

interface SheetUpdateOnlyReportProps {
  open: boolean;
  onClose: () => void;
  results: UpdateResult[];
  stats: {
    updated: number;
    notFound: number;
    skipped: number;
    error: number;
    pending: number;
  };
  message: string;
}

const getStatusIcon = (status: 'updated' | 'notFound' | 'skipped' | 'error' | 'pending') => {
  switch (status) {
    case 'updated':
      return <CheckCircle className="w-5 h-5 text-green-500 mr-3 flex-shrink-0" />;
    case 'notFound':
      return <AlertTriangle className="w-5 h-5 text-orange-500 mr-3 flex-shrink-0" />;
    case 'skipped':
      return <AlertCircle className="w-5 h-5 text-blue-500 mr-3 flex-shrink-0" />;
    case 'error':
      return <XCircle className="w-5 h-5 text-red-500 mr-3 flex-shrink-0" />;
    case 'pending':
      return <Clock className="w-5 h-5 text-gray-500 mr-3 flex-shrink-0 animate-pulse" />;
    default:
      return <AlertCircle className="w-5 h-5 text-gray-500 mr-3 flex-shrink-0" />;
  }
};

const getStatusColor = (status: string) => {
  switch (status) {
    case 'updated': return 'text-green-600';
    case 'notFound': return 'text-orange-600'; // Changed from amber
    case 'skipped': return 'text-blue-600';
    case 'error': return 'text-red-600';
    case 'pending': return 'text-gray-500';
    default: return 'text-gray-600';
  }
};

const SheetUpdateOnlyReport: React.FC<SheetUpdateOnlyReportProps> = ({
  open,
  onClose,
  results,
  stats,
  message
}) => {
  const [copySuccess, setCopySuccess] = useState<boolean>(false);
  
  const copyToClipboard = async () => {
    const text = `Sheet Update Report:
Total Videos Processed: ${results.length}
Updated: ${stats.updated}
Not Found: ${stats.notFound}
Skipped: ${stats.skipped}
Errors: ${stats.error}
Pending: ${stats.pending}

Detailed Results:
${results.map(r => `${r.videoName}: ${r.status}${r.details ? ` - ${r.details}` : ''}`).join('\n')}`;

    try {
      await navigator.clipboard.writeText(text);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      console.error('Failed to copy report:', err);
    }
  };

  // Filter results by status for each tab
  const updatedVideos = results.filter(r => r.status === 'updated');
  const notFoundVideos = results.filter(r => r.status === 'notFound'); // Changed 'not-found' to 'notFound'
  const skippedVideos = results.filter(r => r.status === 'skipped');
  const errorVideos = results.filter(r => r.status === 'error');
  const pendingVideos = results.filter(r => r.status === 'pending');

  // No need for useEffect polling here, parent hook handles it

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>تقرير تحديث جوجل شيت</DialogTitle>
          <DialogDescription>{message}</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-5 gap-2 mb-4">
          <StatCard label="تم التحديث" value={stats.updated} status="updated" />
          <StatCard label="غير موجود" value={stats.notFound} status="notFound" />
          <StatCard label="تم تخطيه" value={stats.skipped} status="skipped" />
          <StatCard label="أخطاء" value={stats.error} status="error" />
          <StatCard label="قيد الانتظار" value={stats.pending} status="pending" />
        </div>

        <Tabs defaultValue="all">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="all">الكل ({results.length})</TabsTrigger>
            <TabsTrigger value="updated">تم التحديث ({stats.updated})</TabsTrigger>
            <TabsTrigger value="notFound">غير موجود ({stats.notFound})</TabsTrigger>
            <TabsTrigger value="skipped">تم تخطيه ({stats.skipped})</TabsTrigger>
            <TabsTrigger value="error">أخطاء ({stats.error})</TabsTrigger>
            <TabsTrigger value="pending">قيد الانتظار ({stats.pending})</TabsTrigger>
          </TabsList>

          <TabsContent value="all">
            <ScrollArea className="h-[300px] mt-2">
              {results.length === 0 ? (
                 <div className="text-center py-8 text-gray-500">لا توجد نتائج لعرضها</div>
              ) : (
                results.map((result, idx) => (
                  <div key={idx} className="flex items-start gap-2 border-b py-2">
                    {getStatusIcon(result.status)}
                    <div>
                      <p className="text-sm font-medium">{result.videoName}</p>
                      {result.details && (
                        <p className={`text-xs ${getStatusColor(result.status)}`}>
                          {result.details}
                        </p>
                      )}
                    </div>
                  </div>
                ))
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="updated">
            <ScrollArea className="h-[300px] mt-2">
              {updatedVideos.length > 0 ? (
                updatedVideos.map((result, idx) => (
                  <div key={idx} className="flex items-start gap-2 border-b py-2">
                    {getStatusIcon(result.status)}
                    <div>
                      <p className="text-sm font-medium">{result.videoName}</p>
                      {result.details && <p className="text-xs text-green-600">{result.details}</p>}
                      {result.embedCode && (
                        <div className="mt-1">
                          <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => {
                            navigator.clipboard.writeText(result.embedCode || '');
                            setCopySuccess(true);
                            setTimeout(() => setCopySuccess(false), 2000);
                          }}>
                            <Copy className="w-3 h-3 mr-1" /> نسخ كود التضمين
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-gray-500">لا توجد فيديوهات تم تحديثها</div>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="notFound">
            <ScrollArea className="h-[300px] mt-2">
              {notFoundVideos.length > 0 ? (
                notFoundVideos.map((result, idx) => (
                  <div key={idx} className="flex items-start gap-2 border-b py-2">
                    {getStatusIcon(result.status)}
                    <div>
                      <p className="text-sm font-medium">{result.videoName}</p>
                      {result.details && <p className="text-xs text-orange-600">{result.details}</p>}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-gray-500">لا توجد فيديوهات غير موجودة</div>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="skipped">
            <ScrollArea className="h-[300px] mt-2">
              {skippedVideos.length > 0 ? (
                skippedVideos.map((result, idx) => (
                  <div key={idx} className="flex items-start gap-2 border-b py-2">
                    {getStatusIcon(result.status)}
                    <div>
                      <p className="text-sm font-medium">{result.videoName}</p>
                      {result.details && <p className="text-xs text-blue-600">{result.details}</p>}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-gray-500">لا توجد فيديوهات تم تخطيها</div>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="error">
            <ScrollArea className="h-[300px] mt-2">
              {errorVideos.length > 0 ? (
                errorVideos.map((result, idx) => (
                  <div key={idx} className="flex items-start gap-2 border-b py-2">
                    {getStatusIcon(result.status)}
                    <div>
                      <p className="text-sm font-medium">{result.videoName}</p>
                      {result.details && <p className="text-xs text-red-600">{result.details}</p>}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-gray-500">لا توجد أخطاء</div>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="pending">
            <ScrollArea className="h-[300px] mt-2">
              {pendingVideos.length > 0 ? (
                pendingVideos.map((result, idx) => (
                  <div key={idx} className="flex items-start gap-2 border-b py-2">
                    {getStatusIcon(result.status)}
                    <div>
                      <p className="text-sm font-medium">{result.videoName}</p>
                      {result.details && <p className="text-xs text-gray-500">{result.details}</p>}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-gray-500">لا توجد فيديوهات قيد الانتظار</div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-2 mt-4">
          {copySuccess && (
            <div className="mr-auto px-3 py-1 bg-green-50 text-green-700 text-sm rounded-md">
              تم نسخ التقرير!
            </div>
          )}
          <Button variant="outline" onClick={copyToClipboard}>
            <Copy className="w-4 h-4 mr-2" />
            نسخ التقرير
          </Button>
          <Button onClick={onClose}>إغلاق</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

const StatCard = ({ label, value, status }: { 
  label: string; 
  value: number; 
  status: 'updated' | 'notFound' | 'skipped' | 'error' | 'pending' 
}) => {
  const bgColor = status === 'updated' ? 'bg-green-50' : 
                 status === 'notFound' ? 'bg-orange-50' : // Changed from amber
                 status === 'skipped' ? 'bg-blue-50' : 
                 status === 'error' ? 'bg-red-50' : 'bg-gray-50';
  
  return (
    <div className={`border rounded-lg p-2 text-center ${bgColor}`}>
      <div className={`text-xl font-bold ${getStatusColor(status)}`}>{value}</div>
      <div className="text-xs text-gray-600">{label}</div>
    </div>
  );
};

export default SheetUpdateOnlyReport;
