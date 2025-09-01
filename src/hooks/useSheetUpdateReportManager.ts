import { useState, useCallback, useEffect } from 'react';
import { UploadManager } from '../lib/upload-manager';

// Define the structure for sheet update results used in the report
interface SheetUpdateResultForReport {
  videoName: string;
  status: 'updated' | 'notFound' | 'skipped' | 'error' | 'pending';
  details?: string;
  embedCode?: string;
}

export function useSheetUpdateReportManager(uploadManagerRef: React.MutableRefObject<UploadManager | null>) {
  const [showSheetUpdateReport, setShowSheetUpdateReport] = useState(false);
  const [sheetUpdateResults, setSheetUpdateResults] = useState<SheetUpdateResultForReport[]>([]);
  const [sheetUpdateStats, setSheetUpdateStats] = useState({
    updated: 0,
    notFound: 0,
    skipped: 0,
    error: 0,
    pending: 0
  });
  const [sheetUpdateMessage, setSheetUpdateMessage] = useState('جاري تحديث البيانات في جداول جوجل...');
  const [isPolling, setIsPolling] = useState(false);

  // Function to get the latest sheet update status
  const refreshSheetUpdateStatus = useCallback(() => {
    if (!uploadManagerRef.current) return;
    
    const sheetUpdater = uploadManagerRef.current.getSheetUpdater();
    if (!sheetUpdater) return;
    
    try {
      const results = sheetUpdater.getSheetUpdateResults();
      const stats = sheetUpdater.getSheetUpdateStats();
      
      console.log("[useSheetUpdateReportManager] Refreshing status:", { 
        resultsCount: results.length, 
        stats 
      });
      
      setSheetUpdateResults(results);
      setSheetUpdateStats(stats);
      
      const message = generateStatusMessage(stats);
      setSheetUpdateMessage(message);

      // Return true if there are still pending updates
      return stats.pending > 0;
    } catch (error) {
      console.error("[useSheetUpdateReportManager] Error refreshing status:", error);
      return false;
    }
  }, [uploadManagerRef]);

  // Helper to generate status message
  const generateStatusMessage = (stats: any) => {
    const parts = [];
    if (stats.updated > 0) parts.push(`${stats.updated} تم تحديثه`);
    if (stats.notFound > 0) parts.push(`${stats.notFound} غير موجود`);
    if (stats.skipped > 0) parts.push(`${stats.skipped} تم تخطيه`);
    if (stats.error > 0) parts.push(`${stats.error} أخطاء`);
    if (stats.pending > 0) parts.push(`${stats.pending} قيد الانتظار`);
    
    if (parts.length === 0) {
      return "لا توجد تحديثات لجداول البيانات لمعالجتها.";
    }
    
    return `حالة تحديث البيانات: ${parts.join(', ')}`;
  };

  // Setup polling when uploads are active or report is open with pending items
  useEffect(() => {
    if (!uploadManagerRef.current) return;

    let intervalId: NodeJS.Timeout | null = null;

    const startPolling = () => {
      if (isPolling) return; // Prevent multiple intervals
      console.log("[useSheetUpdateReportManager] Starting polling");
      setIsPolling(true);
      intervalId = setInterval(() => {
        const stillPending = refreshSheetUpdateStatus();
        if (!stillPending) {
          stopPolling(); // Stop if no more pending items
          // Optionally auto-show report if it wasn't manually opened
          // if (!showSheetUpdateReport && sheetUpdateResults.length > 0) {
          //   setShowSheetUpdateReport(true);
          // }
        }
      }, 2000); // Check every 2 seconds
    };

    const stopPolling = () => {
      if (intervalId) {
        console.log("[useSheetUpdateReportManager] Stopping polling");
        clearInterval(intervalId);
        intervalId = null;
        setIsPolling(false);
      }
    };

    // Start polling if the report is open and has pending items,
    // OR if the upload manager has active uploads (implying potential sheet updates)
    const manager = uploadManagerRef.current;
    const sheetUpdater = manager?.getSheetUpdater();
    const hasPending = sheetUpdater?.getSheetUpdateStats().pending ?? 0 > 0;

    if ((showSheetUpdateReport && hasPending) || (manager?.hasActiveUploads() && !isPolling)) {
       startPolling();
    } else if (!showSheetUpdateReport && !manager?.hasActiveUploads() && isPolling) {
       // Stop polling if report is closed and no uploads are active
       stopPolling();
    }

    // Cleanup on unmount or when dependencies change
    return () => {
      stopPolling();
    };
  }, [uploadManagerRef, refreshSheetUpdateStatus, showSheetUpdateReport, isPolling]); // Added showSheetUpdateReport and isPolling

  // Method to manually show the report
  const openSheetUpdateReport = useCallback(() => {
    refreshSheetUpdateStatus(); // Refresh data right before showing
    setShowSheetUpdateReport(true);
  }, [refreshSheetUpdateStatus]);

  return {
    showSheetUpdateReport,
    setShowSheetUpdateReport,
    sheetUpdateResults,
    sheetUpdateStats,
    sheetUpdateMessage,
    refreshSheetUpdateStatus,
    openSheetUpdateReport
  };
}
