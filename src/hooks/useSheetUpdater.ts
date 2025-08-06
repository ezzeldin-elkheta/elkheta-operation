import { useState, useCallback } from "react";
import { useToast } from "./use-toast";
import { bunnyService } from "../lib/bunny-service";
import { updateSheetForVideo as updateSheetApi } from "../lib/api"; // Renamed import
import { type SheetConfig } from "../lib/sheet-config/sheet-config-manager"; // Import sheet config

interface SheetUpdateState {
  open: boolean;
  results: Array<{
    videoName: string;
    status: 'updated' | 'notFound' | 'skipped' | 'error';
    details?: string;
  }>;
  stats: {
    updated: number;
    notFound: number;
    skipped: number;
    error: number;
  };
  message: string;
  setOpen: (open: boolean) => void;
}

// Helper to safely parse JSON; returns [success, data|string]
async function safeParseJSON(response: Response): Promise<[boolean, any]> {
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    try {
      const json = await response.json();
      return [true, json];
    } catch (e) {
      // Fall through to text parsing
    }
  }
  try {
    const text = await response.text();
    return [false, text];
  } catch {
    return [false, 'Unable to parse response'];
  }
}

export function useSheetUpdater(getCurrentSheetConfig?: () => SheetConfig | null) {
  const { toast } = useToast();
  const [isUpdatingSheet, setIsUpdatingSheet] = useState(false);
  const [isUpdatingFinalMinutes, setIsUpdatingFinalMinutes] = useState(false);
  const [sheetUpdateResults, setSheetUpdateResults] = useState<SheetUpdateState>({
    open: false,
    results: [],
    stats: {
      updated: 0,
      notFound: 0,
      skipped: 0,
      error: 0
    },
    message: "",
    setOpen: (open: boolean) => setSheetUpdateResults(prev => ({ ...prev, open }))
  });

  // Function to update sheet for a single video
  const updateSheetForVideo = useCallback(async (videoTitle: string, videoGuid: string, libraryId: string) => {
    try {
      console.log(`[useSheetUpdater] Attempting sheet update for: ${videoTitle} (GUID: ${videoGuid})`);
      
      // Get current sheet config
      const currentSheetConfig = getCurrentSheetConfig?.();
      if (currentSheetConfig) {
        console.log(`[useSheetUpdater] 📊 Using custom sheet config: "${currentSheetConfig.name}"`);
      } else {
        console.log(`[useSheetUpdater] No custom sheet config, using environment defaults`);
      }
      
      const result = await updateSheetApi(videoTitle, videoGuid, libraryId, currentSheetConfig);
      
      if (result.success) {
        console.log(`[useSheetUpdater] ✅ Sheet updated successfully for: ${videoTitle}`);
      } else {
        console.warn(`[useSheetUpdater] Sheet update skipped or failed for ${videoTitle}: ${result.message}`);
        toast({
          title: `Sheet Update Issue`,
          description: `Could not update sheet for "${videoTitle}". ${result.message}`,
          variant: "warning",
          duration: 5000
        });
      }
    } catch (error) {
      console.error(`[useSheetUpdater] ❌ Error updating sheet for ${videoTitle}:`, error);
      toast({
        title: `Sheet Update Failed`,
        description: `Could not update sheet for "${videoTitle}". ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "warning",
        duration: 7000
      });
    }
  }, [toast, getCurrentSheetConfig]);

  // Handler for bulk sheet update
  const handleUpdateSheet = useCallback(async (selectedVideos: Set<string>, allVideos: any[], selectedLibrary: string) => {
    if (selectedVideos.size === 0) {
      toast({
        title: "No Videos Selected",
        description: "Please select videos to update the sheet.",
        variant: "warning"
      });
      return;
    }

    setIsUpdatingSheet(true);

    try {
      const videosToUpdate = allVideos.filter(v => selectedVideos.has(v.guid));
      const embedUpdates = await Promise.all(
        videosToUpdate.map(async video => {
          const embedCode = await bunnyService.getVideoEmbedCode(selectedLibrary, video.guid);
          return {
            name: video.title,
            embed_code: embedCode
          };
        })
      );

      const response = await fetch('/api/update-sheet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          videos: embedUpdates,
          // Send sheet config as a separate object
          sheetConfig: getCurrentSheetConfig?.() ? {
            spreadsheetId: getCurrentSheetConfig().spreadsheetId,
            sheetName: getCurrentSheetConfig().sheetName,
            nameColumn: getCurrentSheetConfig().videoNameColumn,
            embedColumn: getCurrentSheetConfig().embedCodeColumn,
            finalMinutesColumn: getCurrentSheetConfig().finalMinutesColumn
          } : undefined
        })
      });
      
      console.log(`[useSheetUpdater] 📡 REQUEST SENT TO API:`);
      console.log(`[useSheetUpdater] 📹 Videos count: ${embedUpdates.length}`);
      
      const currentConfig = getCurrentSheetConfig?.();
      if (currentConfig) {
        console.log(`[useSheetUpdater] 📊 Using custom sheet config in API call:`);
        console.log(`[useSheetUpdater] 🆔 Spreadsheet ID: ${currentConfig.spreadsheetId}`);
        console.log(`[useSheetUpdater] 📋 Sheet Name: ${currentConfig.sheetName}`);
        console.log(`[useSheetUpdater] 📍 Columns: ${currentConfig.videoNameColumn}, ${currentConfig.embedCodeColumn}, ${currentConfig.finalMinutesColumn}`);
      } else {
        console.log(`[useSheetUpdater] No sheet config available - using environment defaults`);
      }
      
      console.log(`[useSheetUpdater] 📝 First video example:`, embedUpdates[0]);

      const [isJSON, parsedResult] = await safeParseJSON(response);

      if (!isJSON) {
        throw new Error(`Sheet update failed: ${parsedResult}`);
      }

      const result = parsedResult;
      
      console.log(`[useSheetUpdater] 📥 RESPONSE RECEIVED FROM API:`);
      console.log(`[useSheetUpdater] ✅ Success: ${result.success}`);
      console.log(`[useSheetUpdater] 📊 Stats:`, result.stats);
      console.log(`[useSheetUpdater] 📝 Message: ${result.message}`);
      console.log(`[useSheetUpdater] 📋 Results count: ${result.results ? result.results.length : 0}`);
      
      if (result.results && result.results.length > 0) {
        console.log(`[useSheetUpdater] 🔍 Detailed results:`);
        result.results.forEach((res, index) => {
          console.log(`[useSheetUpdater]   ${index + 1}. "${res.videoName}" -> ${res.status} (${res.details || 'no details'})`);
        });
      }

      if (result.success) {
        // Directly use the detailed results from the API
        const detailedResults = result.results || [];
        const stats = result.stats || {
          updated: 0,
          notFound: 0,
          skipped: 0,
          error: 0
        };

        // Create a user-friendly message based on actual results
        let message = `تم اكتمال العملية: `;
        const parts = [];
        if (stats.updated > 0) parts.push(`${stats.updated} تم تحديثه`);
        if (stats.notFound > 0) parts.push(`${stats.notFound} غير موجود`);
        if (stats.skipped > 0) parts.push(`${stats.skipped} تم تخطيه`);
        if (stats.error > 0) parts.push(`${stats.error} أخطاء`);
        message += parts.join(', ');

        setSheetUpdateResults({
          open: true,
          results: detailedResults,
          stats: stats,
          message: message,
          setOpen: (open) => setSheetUpdateResults(prev => ({ ...prev, open }))
        });

        // Show success toast only if videos were actually updated
        if (stats.updated > 0) {
          toast({
            title: "✅ Sheet Update Success",
            description: `${stats.updated} videos updated successfully with embed codes`,
            variant: "success"
          });
        }
        
        // Show summary for non-updated items
        if (stats.notFound > 0 || stats.skipped > 0 || stats.error > 0) {
          const summaryParts = [];
          if (stats.notFound > 0) summaryParts.push(`${stats.notFound} not found`);
          if (stats.skipped > 0) summaryParts.push(`${stats.skipped} skipped`);
          if (stats.error > 0) summaryParts.push(`${stats.error} errors`);
          
          toast({
            title: "ℹ️ Sheet Update Summary",
            description: summaryParts.join(', '),
            variant: "default"
          });
        }
      } else {
        throw new Error(result.message || 'Sheet update failed');
      }
    } catch (error) {
      console.error(`[useSheetUpdater] ❌ BULK UPDATE ERROR:`, error);
      console.error(`[useSheetUpdater] 📊 Context: ${selectedVideos.size} videos selected, ${allVideos.length} total videos available`);
      console.error(`[useSheetUpdater] 🏷️ Library: ${selectedLibrary}`);
      
      const currentConfig = getCurrentSheetConfig?.();
      if (currentConfig) {
        console.error(`[useSheetUpdater] 📋 Was using custom sheet config: ${currentConfig.name} (${currentConfig.spreadsheetId})`);
      } else {
        console.error(`[useSheetUpdater] Was using environment defaults (no custom config)`);
      }
      
      toast({
        title: "❌ Sheet Update Failed",
        description: error instanceof Error ? error.message : 'Unknown error occurred',
        variant: "destructive"
      });
    } finally {
      setIsUpdatingSheet(false);
    }
  }, [toast]);

  // Handler for updating final minutes
  const handleUpdateFinalMinutes = useCallback(async (selectedVideos: Set<string>, allVideos: any[], selectedLibrary: string) => {
    if (selectedVideos.size === 0) {
      toast({
        title: "No Videos Selected",
        description: "Please select videos to update final minutes.",
        variant: "warning"
      });
      return;
    }

    setIsUpdatingFinalMinutes(true);

    try {
      const videosToUpdate = allVideos.filter(v => selectedVideos.has(v.guid));
      
      console.log(`[FINAL MINUTES] Starting duration check for ${videosToUpdate.length} videos...`);
      
      // Get video details including duration for each selected video
      const videoUpdates = await Promise.all(
        videosToUpdate.map(async video => {
          try {
            console.log(`🔍 [FINAL MINUTES] Getting details for "${video.title}"...`);
            
            // Get detailed video information including duration
            const videoDetails = await bunnyService.getVideoDetails(selectedLibrary, video.guid);
            
            if (videoDetails?.length) {
              const durationInSeconds = videoDetails.length;
              const durationInMinutes = Math.round(durationInSeconds / 60);
              
              // Enhanced console logging for video duration
              const hours = Math.floor(durationInSeconds / 3600);
              const minutes = Math.floor((durationInSeconds % 3600) / 60);
              const seconds = durationInSeconds % 60;
              
              let durationText = '';
              if (hours > 0) {
                durationText = `${hours}h ${minutes}m ${seconds}s`;
              } else if (minutes > 0) {
                durationText = `${minutes}m ${seconds}s`;
              } else {
                durationText = `${seconds}s`;
              }
              
              console.log(`[FINAL MINUTES] "${video.title}": ${durationText} (Total: ${durationInSeconds}s = ${durationInMinutes} minutes)`);
              
              return {
                name: video.title,
                final_minutes: durationInMinutes
              };
            } else {
              console.warn(`[FINAL MINUTES] No duration available for "${video.title}"`);
              return {
                name: video.title,
                final_minutes: 0
              };
            }
          } catch (error) {
            console.error(`🔥 [FINAL MINUTES] Error getting details for "${video.title}":`, error);
            return {
              name: video.title,
              final_minutes: 0
            };
          }
        })
      );

      console.log(`📋 [FINAL MINUTES] Sending ${videoUpdates.length} videos to sheet update...`);

      const response = await fetch('/api/sheets/update-final-minutes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          videos: videoUpdates,
          // Send sheet config as separate parameters
          spreadsheetId: getCurrentSheetConfig?.()?.spreadsheetId,
          sheetName: getCurrentSheetConfig?.()?.sheetName,
          nameColumn: getCurrentSheetConfig?.()?.videoNameColumn,
          finalMinutesColumn: getCurrentSheetConfig?.()?.finalMinutesColumn
        })
      });
      
      console.log(`[useSheetUpdater] 📡 FINAL MINUTES REQUEST SENT:`);
      console.log(`[useSheetUpdater] 📹 Videos count: ${videoUpdates.length}`);
      
      const currentConfigFinal = getCurrentSheetConfig?.();
      if (currentConfigFinal) {
        console.log(`[useSheetUpdater] 📊 Using custom sheet config for final minutes:`);
        console.log(`[useSheetUpdater] 🆔 Spreadsheet ID: ${currentConfigFinal.spreadsheetId}`);
        console.log(`[useSheetUpdater] 📋 Sheet Name: ${currentConfigFinal.sheetName}`);
        console.log(`[useSheetUpdater] 📍 Columns: ${currentConfigFinal.videoNameColumn}, ${currentConfigFinal.embedCodeColumn}, ${currentConfigFinal.finalMinutesColumn}`);
      } else {
        console.log(`[useSheetUpdater] No sheet config - using env defaults for final minutes`);
      }

      const [isJSON2, parsedResult2] = await safeParseJSON(response);

      if (!isJSON2) {
        throw new Error(`Final minutes update failed: ${parsedResult2}`);
      }

      const finalResult = parsedResult2;
      
      console.log(`[useSheetUpdater] 📥 FINAL MINUTES RESPONSE:`);
      console.log(`[useSheetUpdater] ✅ Success: ${finalResult.success}`);
      console.log(`[useSheetUpdater] 📊 Stats:`, finalResult.stats);
      console.log(`[useSheetUpdater] 📝 Message: ${finalResult.message}`);
      console.log(`[useSheetUpdater] 📋 Results count: ${finalResult.results ? finalResult.results.length : 0}`);
      
      if (finalResult.results && finalResult.results.length > 0) {
        console.log(`[useSheetUpdater] 🔍 Final minutes detailed results:`);
        finalResult.results.forEach((res, index) => {
          console.log(`[useSheetUpdater]   ${index + 1}. "${res.videoName}" -> ${res.status} (${res.details || 'no details'})`);
        });
      }

      if (finalResult.success) {
        // Directly use the detailed results from the API
        const detailedResults = finalResult.results || [];
        const stats = finalResult.stats || {
          updated: 0,
          notFound: 0,
          skipped: 0,
          error: 0
        };

        // Create a user-friendly message based on actual results
        let message = `تم اكتمال تحديث الدقائق النهائية: `;
        const parts = [];
        if (stats.updated > 0) parts.push(`${stats.updated} تم تحديثه`);
        if (stats.notFound > 0) parts.push(`${stats.notFound} غير موجود`);
        if (stats.error > 0) parts.push(`${stats.error} أخطاء`);
        message += parts.join(', ');

        setSheetUpdateResults({
          open: true,
          results: detailedResults,
          stats: stats,
          message: message,
          setOpen: (open) => setSheetUpdateResults(prev => ({ ...prev, open }))
        });

        // Show success toast only if videos were actually updated
        if (stats.updated > 0) {
          toast({
            title: "✅ Final Minutes Update Success",
            description: `${stats.updated} videos updated successfully with final minutes`,
            variant: "success"
          });
        }
        
        // Show summary for non-updated items
        if (stats.notFound > 0 || stats.error > 0) {
          const summaryParts = [];
          if (stats.notFound > 0) summaryParts.push(`${stats.notFound} not found`);
          if (stats.error > 0) summaryParts.push(`${stats.error} errors`);
          
          toast({
            title: "ℹ️ Final Minutes Update Summary",
            description: summaryParts.join(', '),
            variant: "default"
          });
        }
      } else {
        throw new Error(finalResult.message || 'Final minutes update failed');
      }
    } catch (error) {
      console.error(`[useSheetUpdater] ❌ FINAL MINUTES UPDATE ERROR:`, error);
      console.error(`[useSheetUpdater] 📊 Context: ${selectedVideos.size} videos selected for final minutes update`);
      console.error(`[useSheetUpdater] 🏷️ Library: ${selectedLibrary}`);
      
      const currentConfigFinal = getCurrentSheetConfig?.();
      if (currentConfigFinal) {
        console.error(`[useSheetUpdater] 📋 Was using custom sheet config: ${currentConfigFinal.name} (${currentConfigFinal.spreadsheetId})`);
      } else {
        console.error(`[useSheetUpdater] Was using environment defaults for final minutes`);
      }
      
      toast({
        title: "❌ Final Minutes Update Failed",
        description: error instanceof Error ? error.message : 'Unknown error occurred',
        variant: "destructive"
      });
    } finally {
      setIsUpdatingFinalMinutes(false);
    }
  }, [toast]);

  return {
    updateSheetForVideo,
    handleUpdateSheet,
    handleUpdateFinalMinutes,
    isUpdatingSheet,
    isUpdatingFinalMinutes,
    sheetUpdateResults
  };
}
