import React from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../src/components/ui/dialog";
import { Button } from "../src/components/ui/button";
import { ScrollArea } from "../src/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../src/components/ui/tabs";
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

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'updated':
      return <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />;
    case 'notFound':
      return <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0" />;
    case 'skipped':
      return <AlertCircle className="w-5 h-5 text-blue-500 flex-shrink-0" />;
    case 'error':
      return <XCircle className="w-5 h-5 text-red-500 flex-shrink-0" />;
    default:
      return <AlertCircle className="w-5 h-5 text-gray-500 flex-shrink-0" />;
  }
};

const getStatusColor = (status: string) => {
  switch (status) {
    case 'updated': return 'text-green-600';
    case 'notFound': return 'text-amber-600';
    case 'skipped': return 'text-blue-600';
    case 'error': return 'text-red-600';
    default: return 'text-gray-600';
  }
};

export const SheetUpdateReport: React.FC<SheetUpdateReportProps> = ({
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
    } catch (err) {
      console.error('Failed to copy report:', err);
    }
  };

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

          {['all', 'updated', 'notFound', 'skipped', 'error'].map(tab => (
            <TabsContent key={tab} value={tab}>
              <ScrollArea className="h-[300px] mt-2">
                {results
                  .filter(r => tab === 'all' || r.status === tab)
                  .map((result, idx) => (
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
                  ))}
              </ScrollArea>
            </TabsContent>
          ))}
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

const StatCard = ({ label, value, status }: { label: string; value: number; status: string }) => (
  <div className={`border rounded-lg p-3 text-center ${value > 0 ? `bg-${status === 'updated' ? 'green' : status === 'notFound' ? 'amber' : status === 'skipped' ? 'blue' : 'red'}-50` : ''}`}>
    <div className={`text-2xl font-bold ${getStatusColor(status)}`}>{value}</div>
    <div className="text-xs text-gray-600">{label}</div>
  </div>
);

export default SheetUpdateReport;
