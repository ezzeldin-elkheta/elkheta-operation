import React from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog";
import { Button } from "./ui/button";
import { ScrollArea } from "./ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { CheckCircle, XCircle, AlertCircle, AlertTriangle } from "lucide-react";

interface UpdateResult {
  videoName: string;
  status: 'updated' | 'notFound' | 'skipped' | 'error';
  details?: string;
}

interface SheetUpdateReportProps {
  open: boolean;
  onClose: () => void;
  results: UpdateResult[];
  stats: {
    updated: number;
    notFound: number;
    skipped: number;
    error: number;
  };
  message: string;
}

const getStatusIcon = (status: 'updated' | 'notFound' | 'skipped' | 'error') => {
  switch (status) {
    case 'updated':
      return <CheckCircle className="w-5 h-5 text-green-500 mr-3 flex-shrink-0" />;
    case 'notFound':
      return <AlertTriangle className="w-5 h-5 text-orange-500 mr-3 flex-shrink-0" />;
    case 'skipped':
      return <AlertCircle className="w-5 h-5 text-yellow-500 mr-3 flex-shrink-0" />;
    case 'error':
      return <XCircle className="w-5 h-5 text-red-500 mr-3 flex-shrink-0" />;
    default:
      return <AlertCircle className="w-5 h-5 text-gray-500 mr-3 flex-shrink-0" />;
  }
};

const getStatusColor = (status: 'updated' | 'notFound' | 'skipped' | 'error') => {
  switch (status) {
    case 'updated':
      return 'text-green-600 bg-green-50 border-green-100';
    case 'notFound':
      return 'text-orange-600 bg-orange-50 border-orange-100';
    case 'skipped':
      return 'text-yellow-600 bg-yellow-50 border-yellow-100';
    case 'error':
      return 'text-red-600 bg-red-50 border-red-100';
    default:
      return 'text-gray-600 bg-gray-50 border-gray-100';
  }
};

const SheetUpdateReport: React.FC<SheetUpdateReportProps> = ({
  open,
  onClose,
  results,
  stats,
  message
}) => {
  const copyToClipboard = async () => {
    const text = `Sheet Update Report:
Total Videos: ${results.length}
Updated: ${stats.updated}
Not Found: ${stats.notFound}
Skipped: ${stats.skipped}
Errors: ${stats.error}

Detailed Results:
${results.map(r => `${r.videoName}: ${r.status}${r.details ? ` - ${r.details}` : ''}`).join('\n')}`;

    try {
      await navigator.clipboard.writeText(text);
      console.log('Report copied to clipboard');
    } catch (err) {
      console.error('Failed to copy report:', err);
    }
  };

  // Filter results by status for each tab
  const updatedVideos = results.filter(r => r.status === 'updated');
  const notFoundVideos = results.filter(r => r.status === 'notFound');
  const skippedVideos = results.filter(r => r.status === 'skipped');
  const errorVideos = results.filter(r => r.status === 'error');

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>تقرير تحديث جوجل شيت</DialogTitle>
          <DialogDescription>{message}</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-4 gap-2 mb-4">
          <StatCard label="تم التحديث" value={stats.updated} status="updated" />
          <StatCard label="غير موجود" value={stats.notFound} status="notFound" />
          <StatCard label="تم تخطيه" value={stats.skipped} status="skipped" />
          <StatCard label="أخطاء" value={stats.error} status="error" />
        </div>

        <Tabs defaultValue="all">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="all">الكل ({results.length})</TabsTrigger>
            <TabsTrigger value="updated">تم التحديث ({stats.updated})</TabsTrigger>
            <TabsTrigger value="notFound">غير موجود ({stats.notFound})</TabsTrigger>
            <TabsTrigger value="skipped">تم تخطيه ({stats.skipped})</TabsTrigger>
            <TabsTrigger value="error">أخطاء ({stats.error})</TabsTrigger>
          </TabsList>

          <TabsContent value="all">
            <ScrollArea className="h-[300px] mt-2">
              {results.map((result, idx) => (
                <div key={idx} className="flex items-start gap-2 border-b py-2">
                  {getStatusIcon(result.status)}
                  <div>
                    <p className="text-sm font-medium">{result.videoName}</p>
                    {result.details && (
                      <p className={`text-xs ${result.status === 'updated' ? 'text-green-600' : 
                                             result.status === 'notFound' ? 'text-orange-600' : 
                                             result.status === 'skipped' ? 'text-yellow-600' : 'text-red-600'}`}>
                        {result.details}
                      </p>
                    )}
                  </div>
                </div>
              ))}
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
                      {result.details && <p className="text-xs text-yellow-600">{result.details}</p>}
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
        </Tabs>

        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={copyToClipboard}>
            نسخ التقرير
          </Button>
          <Button onClick={onClose}>إغلاق</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

const StatCard = ({ label, value, status }: { label: string; value: number; status: 'updated' | 'notFound' | 'skipped' | 'error' }) => (
  <div className={`border rounded-lg p-3 text-center ${getStatusColor(status)}`}>
    <div className="text-2xl font-bold">{value}</div>
    <div className="text-xs text-gray-700">{label}</div>
  </div>
);

export default SheetUpdateReport;
