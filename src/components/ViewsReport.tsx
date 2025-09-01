import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Eye, Calendar, Library, TrendingUp, X } from "lucide-react";
import { formatNumber } from "../lib/utils";

interface LibraryViews {
  id: string;
  name: string;
  totalViews: number;
  videoCount: number;
  averageViews: number;
  topVideo?: {
    title: string;
    views: number;
  };
}

interface ViewsReportData {
  selectedMonth: string;
  totalViews: number;
  libraries: LibraryViews[];
  generatedAt: string;
}

interface ViewsReportProps {
  open: boolean;
  onClose: () => void;
  data: ViewsReportData | null;
  isLoading: boolean;
}

export const ViewsReport: React.FC<ViewsReportProps> = ({
  open,
  onClose,
  data,
  isLoading
}) => {
  const [selectedLibrary, setSelectedLibrary] = useState<string | 'all'>('all');

  const filteredLibraries = selectedLibrary === 'all' 
    ? data?.libraries || []
    : data?.libraries.filter(lib => lib.id === selectedLibrary) || [];

  const totalFilteredViews = filteredLibraries.reduce((sum, lib) => sum + lib.totalViews, 0);
  const totalFilteredVideos = filteredLibraries.reduce((sum, lib) => sum + lib.videoCount, 0);
  const averageViewsPerVideo = totalFilteredVideos > 0 ? Math.round(totalFilteredViews / totalFilteredVideos) : 0;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="w-5 h-5 text-blue-500" />
            تقرير المشاهدات
          </DialogTitle>
          <DialogDescription>
            إحصائيات مفصلة لمشاهدات الفيديوهات
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="flex flex-col items-center gap-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
              <p className="text-sm text-muted-foreground">جاري تحميل البيانات...</p>
            </div>
          </div>
        ) : data ? (
          <div className="space-y-6">
            {/* Header Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Calendar className="w-4 h-4 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">الشهر المحدد</p>
                    <p className="font-semibold">{data.selectedMonth}</p>
                  </div>
                </div>
              </Card>

              <Card className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <Eye className="w-4 h-4 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">إجمالي المشاهدات</p>
                    <p className="font-semibold text-lg">{formatNumber(totalFilteredViews)}</p>
                  </div>
                </div>
              </Card>

              <Card className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <Library className="w-4 h-4 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">عدد الفيديوهات</p>
                    <p className="font-semibold">{formatNumber(totalFilteredVideos)}</p>
                  </div>
                </div>
              </Card>

              <Card className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-orange-100 rounded-lg">
                    <TrendingUp className="w-4 h-4 text-orange-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">متوسط المشاهدات</p>
                    <p className="font-semibold">{formatNumber(averageViewsPerVideo)}</p>
                  </div>
                </div>
              </Card>
            </div>

            {/* Library Filter */}
            <div className="flex items-center gap-4">
              <p className="text-sm font-medium">تصفية حسب المكتبة:</p>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant={selectedLibrary === 'all' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedLibrary('all')}
                >
                  جميع المكتبات
                </Button>
                {data.libraries.map(library => (
                  <Button
                    key={library.id}
                    variant={selectedLibrary === library.id ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedLibrary(library.id)}
                  >
                    {library.name}
                  </Button>
                ))}
              </div>
            </div>

            {/* Libraries List */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">تفاصيل المكتبات</h3>
              
              {filteredLibraries.length === 0 ? (
                <Card className="p-8 text-center">
                  <p className="text-muted-foreground">لا توجد بيانات للمكتبة المحددة</p>
                </Card>
              ) : (
                filteredLibraries.map((library) => (
                  <Card key={library.id} className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h4 className="text-lg font-semibold flex items-center gap-2">
                          <Library className="w-4 h-4" />
                          {library.name}
                        </h4>
                        <p className="text-sm text-muted-foreground">المكتبة ID: {library.id}</p>
                      </div>
                      <Badge variant="secondary">
                        {formatNumber(library.totalViews)} مشاهدة
                      </Badge>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="bg-muted/50 p-3 rounded-lg">
                        <p className="text-sm text-muted-foreground">عدد الفيديوهات</p>
                        <p className="text-xl font-bold">{formatNumber(library.videoCount)}</p>
                      </div>

                      <div className="bg-muted/50 p-3 rounded-lg">
                        <p className="text-sm text-muted-foreground">متوسط المشاهدات</p>
                        <p className="text-xl font-bold">{formatNumber(library.averageViews)}</p>
                      </div>

                      <div className="bg-muted/50 p-3 rounded-lg">
                        <p className="text-sm text-muted-foreground">نسبة المشاهدات</p>
                        <p className="text-xl font-bold">
                          {data.totalViews > 0 ? Math.round((library.totalViews / data.totalViews) * 100) : 0}%
                        </p>
                      </div>
                    </div>

                    {library.topVideo && (
                      <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                        <p className="text-sm font-medium text-blue-800">الفيديو الأكثر مشاهدة:</p>
                        <p className="text-sm text-blue-600">
                          {library.topVideo.title} - {formatNumber(library.topVideo.views)} مشاهدة
                        </p>
                      </div>
                    )}
                  </Card>
                ))
              )}
            </div>

            {/* Footer */}
            <div className="text-center text-xs text-muted-foreground pt-4 border-t">
              تم إنشاء التقرير في: {new Date(data.generatedAt).toLocaleString('ar-EG')}
            </div>
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-muted-foreground">فشل في تحميل بيانات المشاهدات</p>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            <X className="w-4 h-4 mr-2" />
            إغلاق
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}; 