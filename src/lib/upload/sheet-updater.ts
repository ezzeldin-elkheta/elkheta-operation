import { showToast } from "../../hooks/use-toast";
import type { UploadOperations } from "./upload-operations";
import { parseFilename, isQuestionFile } from "../filename-parser"; // Import filename parser functions
import type { SheetConfig } from "../sheet-config/sheet-config-manager";

type SheetUpdateStatus = 'pending' | 'error' | 'skipped' | 'updated' | 'notFound' | 'processing';

const UPDATE_STATUS = {
  NOT_FOUND: 'notFound',
  SKIPPED: 'skipped',
  UPDATED: 'updated',
  ERROR: 'error',
  PENDING: 'pending',
  PROCESSING: 'processing'
} as const;

interface WorkerResult {
  success: boolean;
  message: string;
  status: SheetUpdateStatus;
  embedCode?: string;
  updateTime?: number;
}

interface IUploadOperations {
  getUploadResults: () => any[];
  setUploadResults: (results: any[]) => void;
}

export class SheetUpdater {
  private completedUpdates: Set<string> = new Set();
  private totalExpectedUpdates: number = 0;
  private onAllUpdatesComplete?: () => void;
  private sheetUpdateWorkers: Set<Worker> = new Set();
  private uploadOperations?: IUploadOperations;
  private processingVideos: Set<string> = new Set();
  private uploadsStillInProgress: boolean = true; // Track if uploads are still happening
  private currentSheetConfig: SheetConfig | null = null; // Track current sheet config

  private sheetUpdateResults: Map<string, {
    videoName: string;
    status: SheetUpdateStatus;
    message: string;
    embedCode?: string;
    updateTime?: number;
  }> = new Map();

  constructor(uploadOperations?: IUploadOperations, onAllUpdatesComplete?: () => void) {
    this.onAllUpdatesComplete = onAllUpdatesComplete;
    this.uploadOperations = uploadOperations;
  }

  setSheetConfig(config: SheetConfig | null): void {
    this.currentSheetConfig = config;
    console.log(`[SheetUpdater] Sheet config updated:`, config ? `${config.name} (${config.spreadsheetId})` : 'using environment defaults');
  }

  getCurrentSheetConfig(): SheetConfig | null {
    return this.currentSheetConfig;
  }

  setTotalExpectedUpdates(count: number): void {
    // Only update if count is higher than current expected (incremental)
    if (count > this.totalExpectedUpdates) {
      this.totalExpectedUpdates = count;
      console.log(`[SheetUpdater] Expected updates increased to ${count}`);
    } else {
      console.log(`[SheetUpdater] Expected updates count not changed (already ${this.totalExpectedUpdates}, requested ${count})`);
    }
    // Don't clear completed updates - they should remain counted
  }

  // Signal that all uploads have completed
  setUploadsComplete(): void {
    this.uploadsStillInProgress = false;
    console.log(`[SheetUpdater] Uploads marked as complete, checking if sheet updates are done`);
    this.checkAllUpdatesComplete();
  }

  // Get sheet update results for separate reporting
  getSheetUpdateResults(): Array<{
    videoName: string;
    status: SheetUpdateStatus;
    details?: string;
    embedCode?: string;
  }> {
    return Array.from(this.sheetUpdateResults.values()).map(result => ({
      videoName: result.videoName,
      status: result.status,
      details: result.message,
      embedCode: result.embedCode
    }));
  }
  // Get stats for sheet updates
  getSheetUpdateStats() {
    const results = this.getSheetUpdateResults();
    return {
      updated: results.filter(r => r.status === 'updated').length,
      notFound: results.filter(r => r.status === 'notFound').length,
      skipped: results.filter(r => r.status === 'skipped').length,
      error: results.filter(r => r.status === 'error').length,
      pending: results.filter(r => r.status === 'pending' || r.status === 'processing').length
    };
    return {
      updated: results.filter(r => r.status === 'updated').length,
      notFound: results.filter(r => r.status === 'notFound').length,
      skipped: results.filter(r => r.status === 'skipped').length,
      error: results.filter(r => r.status === 'error').length,
      pending: results.filter(r => r.status === 'pending').length,
    };
  }
  /**
   * Updates sheet in background using Web Worker
   */
  updateSheetInBackground(videoName: string, videoGuid: string, libraryId: string, videoDurationSeconds?: number): void {
    if (this.processingVideos.has(videoName)) {
      console.log(`[SheetUpdater] ${videoName} is already being processed, skipping duplicate request`);
      return;
    }
    
    this.processingVideos.add(videoName);
    
    // Don't increment expected updates count here - it's already set in setTotalExpectedUpdates
    console.log(`[SheetUpdater] Adding update task for ${videoName}, total expected: ${this.totalExpectedUpdates}`);
    
    // Handle duplicate videos
    if (videoGuid === 'DUPLICATE') {
      this.onUpdateComplete(
        videoName,
        'skipped',
        'Sheet update skipped - duplicate video',
        undefined,
        Date.now()
      );
      return;
    }

    // Parse the filename to determine if it's a question video
    let isQuestion = false;
    try {
      const parsed = parseFilename(videoName);
      isQuestion = isQuestionFile(parsed);
      console.log(`[SheetUpdater] Video "${videoName}" is ${isQuestion ? 'a question' : 'not a question'} - final_minutes will ${isQuestion ? 'NOT' : ''} be updated`);
    } catch (error) {
      console.warn(`[SheetUpdater] Could not parse filename "${videoName}":`, error);
      // Default to false (not a question) if parsing fails
      isQuestion = false;
    }

    // Track that we're processing this sheet update and immediately update UI
    this.sheetUpdateResults.set(videoName, {
      videoName,
      status: 'processing',
      message: 'Sheet update in progress...',
    });
    
    // Update upload results with processing status
    if (this.uploadOperations?.getUploadResults && this.uploadOperations?.setUploadResults) {
      const results = this.uploadOperations.getUploadResults();
      const updatedResults = results.map(r => {
        if (r.filename === videoName) {
          return {
            ...r,
            details: {
              ...r.details,
              sheetStatus: 'processing',
              sheetUpdateDetails: {
                status: 'processing',
                message: 'Sheet update in progress...',
                updateTime: Date.now()
              }
            }
          };
        }
        return r;
      });
      this.uploadOperations.setUploadResults(updatedResults);
    }
    
    const origin = window.location.origin;
    
    // Get the access key using the same logic as HttpClient
    let accessKey = '';
    
    // Try to get library-specific API key first
    if (libraryId) {
      const cachedLibraryKey = localStorage.getItem('app_cache');
      if (cachedLibraryKey) {
        try {
          const cache = JSON.parse(cachedLibraryKey);
          accessKey = cache[`library_${libraryId}_api`] || '';
        } catch (error) {
          console.warn('[SheetUpdater] Error parsing app cache:', error);
        }
      }
    }
    
    // Fall back to environment variable or stored key
    if (!accessKey) {
      accessKey = import.meta.env?.VITE_BUNNY_API_KEY || 
                  localStorage.getItem('bunny_api_key') || 
                  localStorage.getItem('default_api_key') || '';
    }

    const workerBlob = new Blob([`
      // Helper function to add delay
      const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

      // Fetch with retry logic and exponential backoff
      const fetchWithRetry = async (url, options, maxRetries = 3) => {
        let lastError;
        
        for (let attempt = 0; attempt < maxRetries; attempt++) {
          try {
            const response = await fetch(url, options);
            
            if (!response.ok) {
              throw new Error(\`HTTP \${response.status}: \${response.statusText}\`);
            }
            
            // Parse response data
            const responseText = await response.text();
            if (!responseText.trim()) {
              throw new Error('Empty response from server');
            }
            
            let data;
            try {
              data = JSON.parse(responseText);
            } catch (parseError) {
              throw new Error('Invalid JSON response: ' + responseText.substring(0, 100));
            }
            
            return data;
          } catch (error) {
            console.log(\`Sheet update attempt \${attempt + 1} failed:\`, error);
            lastError = error;
            
            // Check if we should stop retrying based on error message or status from validateResponse
            const errorStatus = error.status; // Get status if added by validateResponse
            if (errorStatus === 'skipped' || errorStatus === 'notFound' ||
                error.message.includes('already exists') || 
                error.message.includes('not found')) {
              throw error; // Don't retry these cases
            }
            
            if (attempt < maxRetries - 1) {
              await delay(Math.pow(2, attempt) * 1000);
            }
          }
        }
        
        throw lastError;
      };

      self.addEventListener('message', async (e) => {
        if (e.data.type === 'updateSheet') {
          const { videoName, videoGuid, libraryId, origin, accessKey, videoDurationSeconds, isQuestion } = e.data;

          try {
            console.log(\`[Worker] Processing sheet update for "\${videoName}" (Library: \${libraryId}, API Key Length: \${accessKey ? accessKey.length : 0}, Is Question: \${isQuestion})\`);
            
            const embedCode = \`<div style="position:relative;padding-top:56.25%;"><iframe src="https://iframe.mediadelivery.net/embed/\${libraryId}/\${videoGuid}?autoplay=false&loop=false&muted=false&preload=true&responsive=true" loading="lazy" style="border:0;position:absolute;top:0;height:100%;width:100%;" allow="accelerometer;gyroscope;autoplay;encrypted-media;picture-in-picture;" allowfullscreen="true"></iframe></div>\`;
            
            // Use name without extension for API call
            const nameToSend = videoName.replace(/\\.mp4$/i, ''); 
            console.log(\`[Worker] Sending name to API: "\${nameToSend}" (Original: "\${videoName}")\`);

            // Use pre-extracted video duration if available, otherwise try to get from Bunny API
            // BUT only if this is NOT a question video
            let finalMinutes = undefined;
            
            if (!isQuestion && videoDurationSeconds && videoDurationSeconds > 0) {
              finalMinutes = Math.round(videoDurationSeconds / 60);
              
              // Enhanced console logging for pre-extracted duration
              const hours = Math.floor(videoDurationSeconds / 3600);
              const minutes = Math.floor((videoDurationSeconds % 3600) / 60);
              const seconds = videoDurationSeconds % 60;
              
              let durationText = '';
              if (hours > 0) {
                durationText = \`\${hours}h \${minutes}m \${seconds}s\`;
              } else if (minutes > 0) {
                durationText = \`\${minutes}m \${seconds}s\`;
              } else {
                durationText = \`\${seconds}s\`;
              }
              
              console.log(\`[UPLOAD] Using pre-extracted duration for "\${videoName}": \${durationText} (Total: \${videoDurationSeconds}s = \${finalMinutes} minutes)\`);
            } else if (!isQuestion) {
              // Fallback: try to get from Bunny API (for Video Management use case) - only for non-questions
              if (!accessKey || accessKey.length === 0) {
                console.warn(\`⚠️ [Worker] No duration provided and no API key available for video details request\`);
              } else {
                console.log(\`[Worker] No pre-extracted duration, trying Bunny API with key length \${accessKey.length} characters\`);
                
                try {
                  const videoDetailsResponse = await fetch(\`\${origin}/api/proxy/video/library/\${libraryId}/videos/\${videoGuid}\`, {
                    method: 'GET',
                    headers: { 
                      'Accept': 'application/json',
                      'AccessKey': accessKey
                    }
                  });
                  
                  if (videoDetailsResponse.ok) {
                    const videoDetails = await videoDetailsResponse.json();
                    if (videoDetails.length) {
                      const videoDurationFromAPI = videoDetails.length;
                      finalMinutes = Math.round(videoDurationFromAPI / 60);
                      
                      const hours = Math.floor(videoDurationFromAPI / 3600);
                      const minutes = Math.floor((videoDurationFromAPI % 3600) / 60);
                      const seconds = videoDurationFromAPI % 60;
                      
                      let durationText = '';
                      if (hours > 0) {
                        durationText = \`\${hours}h \${minutes}m \${seconds}s\`;
                      } else if (minutes > 0) {
                        durationText = \`\${minutes}m \${seconds}s\`;
                      } else {
                        durationText = \`\${seconds}s\`;
                      }
                      
                      console.log(\`[API] Retrieved duration from Bunny for "\${videoName}": \${durationText} (Total: \${videoDurationFromAPI}s = \${finalMinutes} minutes)\`);
                    } else {
                      console.warn(\`⚠️ [API] No duration info available for "\${videoName}"\`);
                    }
                  } else {
                    console.warn(\`⚠️ [API] Failed to get video details for "\${videoName}": HTTP \${videoDetailsResponse.status}\`);
                  }
                } catch (detailsError) {
                  console.warn(\`⚠️ [API] Could not get video details for "\${videoName}": \${detailsError.message}\`);
                }
              }
            } else {
              console.log(\`❓ [SKIP DURATION] Skipping final minutes for question video: "\${videoName}"\`);
            }

            // Prepare video data with optional final minutes
            const videoData = {
              name: nameToSend, // Use name without extension
              embed_code: embedCode
            };
            
            // Only add final_minutes if this is not a question video
            if (!isQuestion && finalMinutes !== undefined) {
              videoData.final_minutes = finalMinutes;
              console.log(\`📝 [FINAL MINUTES] Adding final_minutes (\${finalMinutes}) for non-question video: "\${videoName}"\`);
            } else if (isQuestion) {
              console.log(\`🚫 [FINAL MINUTES] Skipping final_minutes for question video: "\${videoName}"\`);
            }

            // Build request body and inject custom sheet configuration (if provided)
            const requestBody = {
              videos: [videoData]
            };

            if (e.data.sheetConfig) {
              requestBody.spreadsheetId      = e.data.sheetConfig.spreadsheetId;
              requestBody.sheetName          = e.data.sheetConfig.sheetName;
              // Support both canonical and alias field names
              requestBody.nameColumn         = e.data.sheetConfig.videoNameColumn  || e.data.sheetConfig.nameColumn;
              requestBody.embedColumn        = e.data.sheetConfig.embedCodeColumn   || e.data.sheetConfig.embedColumn;
              requestBody.finalMinutesColumn = e.data.sheetConfig.finalMinutesColumn;
            }

            const data = await fetchWithRetry(
              \`\${origin}/api/sheets/update-bunny-embeds\`,
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody)
              }
            );

            console.log(\`[Worker] API Response for "\${videoName}":\`, {
              success: data.success,
              message: data.message,
              resultsCount: data.results ? data.results.length : 0,
              stats: data.stats,
              fullResponse: data // Log the full response for debugging
            });

            // ENHANCED: Determine status based on actual API response with stricter validation
            let status = 'error'; // Default to error
            let message = data.message || 'Sheet update status unknown';
            let finalEmbedCode = undefined;
            let actualSuccess = false;

            console.log(\`[Worker] Raw API response analysis for "\${videoName}":\`, {
              hasResults: !!(data.results && data.results.length > 0),
              resultsLength: data.results ? data.results.length : 0,
              firstResultStatus: data.results && data.results.length > 0 ? data.results[0].status : 'no-results',
              statsUpdated: data.stats ? data.stats.updated : 'no-stats',
              statsNotFound: data.stats ? data.stats.notFound : 'no-stats',
              statsSkipped: data.stats ? data.stats.skipped : 'no-stats',
              overallSuccess: data.success
            });

            // CRITICAL: First check if we have detailed results for this specific video
            if (data.results && data.results.length > 0) {
              const result = data.results[0];
              status = result.status || 'error';
              message = result.details || result.message || 'No details provided';
              
              console.log(\`[Worker] Using detailed result for "\${videoName}": status=\${status}, message=\${message}\`);
              
              if (status === 'updated') {
                finalEmbedCode = embedCode;
                actualSuccess = true;
                console.log(\`[Worker] ✅ CONFIRMED UPDATE from detailed results for "\${videoName}"\`);
              } else if (status === 'notFound') {
                actualSuccess = false;
                console.log(\`[Worker] ❌ CONFIRMED NOT FOUND from detailed results for "\${videoName}"\`);
              } else if (status === 'skipped') {
                actualSuccess = false;
                console.log(\`[Worker] ⏭️ CONFIRMED SKIPPED from detailed results for "\${videoName}"\`);
              } else {
                actualSuccess = false;
                console.log(\`[Worker] ❌ UNKNOWN STATUS from detailed results for "\${videoName}": \${status}\`);
              }
              
            } else {
              // CRITICAL: Fallback to stats but with much stricter validation
              console.log(\`[Worker] ⚠️ No detailed results, analyzing stats for "\${videoName}"\`);
              
              // Only trust stats if they make logical sense
              if (data.stats) {
                const statsUpdated = data.stats.updated || 0;
                const statsNotFound = data.stats.notFound || 0;
                const statsSkipped = data.stats.skipped || 0;
                const statsError = data.stats.error || 0;
                
                console.log(\`[Worker] Stats breakdown for "\${videoName}": updated=\${statsUpdated}, notFound=\${statsNotFound}, skipped=\${statsSkipped}, error=\${statsError}\`);
                
                // STRICT: Only consider it updated if:
                // 1. stats.updated > 0 AND
                // 2. This was the ONLY video in the request (length === 1) AND
                // 3. No errors occurred
                if (statsUpdated > 0 && statsError === 0) {
                  // Additional check: ensure this matches expectations
                  if (statsUpdated === 1 && (statsNotFound + statsSkipped + statsError) === 0) {
                    status = 'updated';
                    message = 'Successfully updated embed code' + (!isQuestion && finalMinutes !== undefined ? ' and final minutes' : isQuestion ? ' (final minutes skipped for question)' : '');
                    finalEmbedCode = embedCode;
                    actualSuccess = true;
                    console.log(\`[Worker] ✅ CONFIRMED UPDATE from stats for "\${videoName}" (single video, clean update)\`);
                  } else {
                    // Suspicious: multiple videos or mixed results
                    status = 'error';
                    message = \`Ambiguous update result: updated=\${statsUpdated}, notFound=\${statsNotFound}, skipped=\${statsSkipped}, error=\${statsError}\`;
                    actualSuccess = false;
                    console.log(\`[Worker] 🚨 SUSPICIOUS STATS for "\${videoName}": mixed results detected\`);
                  }
                } else if (statsNotFound > 0 && statsUpdated === 0 && statsSkipped === 0 && statsError === 0) {
                  status = 'notFound';
                  message = 'Video name not found in sheet';
                  actualSuccess = false;
                  console.log(\`[Worker] ❌ CONFIRMED NOT FOUND from stats for "\${videoName}"\`);
                } else if (statsSkipped > 0 && statsUpdated === 0 && statsNotFound === 0 && statsError === 0) {
                  status = 'skipped';
                  message = 'Video already has embed code';
                  actualSuccess = false;
                  console.log(\`[Worker] ⏭️ CONFIRMED SKIPPED from stats for "\${videoName}"\`);
                } else {
                  // Default to error for anything unclear
                  status = 'error';
                  message = data.message || \`Unclear update result: updated=\${statsUpdated}, notFound=\${statsNotFound}, skipped=\${statsSkipped}, error=\${statsError}\`;
                  actualSuccess = false;
                  console.log(\`[Worker] ❌ DEFAULTING TO ERROR for "\${videoName}" due to unclear stats\`);
                }
              } else {
                // No stats available
                status = 'error';
                message = data.message || 'No update statistics available';
                actualSuccess = false;
                console.log(\`[Worker] ❌ NO STATS AVAILABLE for "\${videoName}"\`);
              }
            }

            // FINAL VALIDATION: Cross-check with API's overall success flag
            if (actualSuccess && !data.success) {
              console.log(\`[Worker] 🚨 WARNING: Local analysis says success but API says failure for "\${videoName}" - defaulting to failure\`);
              actualSuccess = false;
              status = 'error';
              message = 'API reported failure despite apparent success';
            }

            // CRITICAL: Override API success with our own logic
            // Only consider it successful if status is 'updated'
            const reportedSuccess = actualSuccess && status === 'updated';
            
            console.log(\`[Worker] 🎯 FINAL DETERMINATION for "\${videoName}": Status=\${status}, Success=\${reportedSuccess}, Message=\${message}\`);
            console.log(\`[Worker] 📊 Decision rationale: actualSuccess=\${actualSuccess}, status=\${status}, apiSuccess=\${data.success}\`);

            self.postMessage({
              success: reportedSuccess, // Use our own success determination
              status: status,
              message: message,
              embedCode: finalEmbedCode, // Send embed code only if actually updated
              videoName: videoName, // Include videoName for better tracking
              updateTime: Date.now()
            });
          } catch (error) {
             // Handle errors from fetchWithRetry (including non-retryable ones)
             let errorStatus = 'error';
             let errorMessage = error.message || 'Sheet update failed';
             
             // Check if the error object has a status property (added by validateResponse)
             if (error.status === 'skipped' || error.message.includes('already exists')) {
               errorStatus = 'skipped';
               errorMessage = error.details || 'Video already has embed code';
             } else if (error.status === 'notFound' || error.message.includes('not found')) {
               errorStatus = 'notFound';
               errorMessage = error.details || 'Video name not found in sheet';
             }

            self.postMessage({
              success: false,
              status: errorStatus,
              message: errorMessage,
              videoName: videoName, // Include videoName for consistency
              updateTime: Date.now()
            });
          }
        }
      });
    `], { type: 'application/javascript' });

    const worker = new Worker(URL.createObjectURL(workerBlob));
    this.sheetUpdateWorkers.add(worker); // Track the worker
    
    // Set initial pending status
    this.sheetUpdateResults.set(videoName, {
      videoName,
      status: 'pending',
      message: 'Sheet update in progress...',
      updateTime: Date.now()
    });
    
    worker.postMessage({
      type: 'updateSheet',
      videoName,
      videoGuid,
      libraryId,
      origin,
      accessKey,
      videoDurationSeconds, // Pass the pre-extracted duration
      isQuestion,
      sheetConfig: this.currentSheetConfig // Pass current sheet configuration
    });

    worker.addEventListener('message', (e) => {
      // Update with actual status from worker
      this.onUpdateComplete(
        e.data.videoName || videoName, // Use videoName from response or fallback to original
        e.data.status,
        e.data.message,
        e.data.embedCode,
        e.data.updateTime
      );
      worker.terminate();
      this.sheetUpdateWorkers.delete(worker); // Remove worker from tracking
      this.checkAllUpdatesComplete(); // Check completion after worker finishes
    });

    worker.addEventListener('error', (err) => {
      console.error("Worker error:", err);
      this.onUpdateComplete(
        videoName,
        'error',
        'Worker error during sheet update'
      );
      worker.terminate();
      this.sheetUpdateWorkers.delete(worker); // Remove worker from tracking
      this.checkAllUpdatesComplete(); // Check completion after worker finishes
    });
  }

  private onUpdateComplete(
    videoName: string,
    status: SheetUpdateStatus,
    message: string,
    embedCode?: string,
    updateTime?: number
  ) {
    this.processingVideos.delete(videoName);
    
    // Enhanced console logging based on status
    console.log(`[SheetUpdater] Update complete for ${videoName}: Status=${status}, Message=${message}`);
    
    // Show clear success/failure messages
    if (status === 'updated') {
      console.log(`✅ [SHEET SUCCESS] "${videoName}" - ${message}`);
    } else if (status === 'skipped') {
      console.log(`⏭️ [SHEET SKIPPED] "${videoName}" - Video already has embed code in sheet`);
    } else if (status === 'notFound') {
      console.log(`❌ [SHEET NOT FOUND] "${videoName}" - Video name not found in sheet`);
    } else if (status === 'error') {
      console.log(`🔥 [SHEET ERROR] "${videoName}" - Sheet update failed: ${message}`);
    }
    
    // Update results map
    this.sheetUpdateResults.set(videoName, {
      videoName,
      status,
      message,
      embedCode,
      updateTime: updateTime || Date.now()
    });
    
    // Update upload results with sheet status
    if (this.uploadOperations?.getUploadResults && this.uploadOperations?.setUploadResults) {
      const results = this.uploadOperations.getUploadResults();
      const updatedResults = results.map(r => {
        if (r.filename === videoName) {
          return {
            ...r,
            details: {
              ...r.details,
              sheetStatus: status,
              sheetUpdateDetails: {
                status,
                message,
                embedCode,
                updateTime: updateTime || Date.now()
              }
            }
          };
        }
        return r;
      });
      this.uploadOperations.setUploadResults(updatedResults);
    }

    // Show toast for non-success/non-skipped states
    // Note: Commented out to avoid spam during background updates - user will see results in report
    // if (status !== 'updated' && status !== 'skipped' && status !== 'pending' && status !== 'processing') {
    //   showToast({
    //     title: status === 'notFound' ? "⚠️ Sheet Update Issue" : "❌ Sheet Update Error",
    //     description: message,
    //     variant: status === 'notFound' ? "warning" : "destructive"
    //   });
    // }

    // Mark as completed only if status is final (not pending or processing)
    if (status !== 'pending' && status !== 'processing') {
      this.completedUpdates.add(videoName);
      this.checkAllUpdatesComplete();
    }
  }
  private checkAllUpdatesComplete(): void {
    console.log(`[SheetUpdater] Checking completion: completed=${this.completedUpdates.size}, expected=${this.totalExpectedUpdates}, workers=${this.sheetUpdateWorkers.size}, uploadsInProgress=${this.uploadsStillInProgress}`);
    
    // Only complete when:
    // 1. All uploads are finished AND
    // 2. We have reached the expected count AND
    // 3. No active workers are running
    const hasActiveWorkers = this.sheetUpdateWorkers.size > 0;
    const reachedExpectedCount = this.totalExpectedUpdates > 0 && this.completedUpdates.size >= this.totalExpectedUpdates;
    const uploadsFinished = !this.uploadsStillInProgress;
    
    if (uploadsFinished && reachedExpectedCount && !hasActiveWorkers) {
      
      console.log(`[SheetUpdater] All sheet updates completed (${this.completedUpdates.size}/${this.totalExpectedUpdates})`);
      
      if (this.onAllUpdatesComplete) {
        console.log("[SheetUpdater] Notifying completion handler");
        this.onAllUpdatesComplete();
      }
    } else {
       console.log(`[SheetUpdater] Completion check: Completed=${this.completedUpdates.size}, Expected=${this.totalExpectedUpdates}, ActiveWorkers=${this.sheetUpdateWorkers.size}, UploadsFinished=${uploadsFinished}, ReachedExpected=${reachedExpectedCount}`);
    }
  }

  getCompletedCount(): number {
    return this.completedUpdates.size;
  }

  reset(): void {
    // Terminate any active workers
    this.sheetUpdateWorkers.forEach(worker => worker.terminate());
    this.sheetUpdateWorkers.clear();
    
    this.completedUpdates.clear();
    this.totalExpectedUpdates = 0;
    this.processingVideos.clear();
    this.uploadsStillInProgress = true; // Reset uploads flag

    this.sheetUpdateResults.clear();
  }
}

export const sheetUpdater = new SheetUpdater();
