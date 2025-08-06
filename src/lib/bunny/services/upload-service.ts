import { HttpClient } from '../http-client';
import { UploadProgress, Library, Collection } from '../types';
import { UploadSettings } from '../../upload/types';
import { DEFAULT_UPLOAD_CONFIG } from '../../../types/bunny';
import { cache } from '../../cache';
import * as tus from 'tus-js-client';
import CryptoJS from 'crypto-js';

interface Video {
  guid: string;
  title: string;
  status: number;
  length: number;
  storageSize: number;
  collectionId?: string;
  width: number;
  height: number;
  framerate: number;
  dateUploaded: string;
  views: number;
  isPublic: boolean;
  thumbnailCount: number;
  encodeProgress: number;
  hasMP4Fallback: boolean;
  availableResolutions: string[] | null;
  outputCodecs: string[] | null;
}

// Video status constants according to Bunny.net API
const VIDEO_STATUS = {
  UPLOADING: 0,
  PROCESSING: 1,
  READY: 2,
  FAILED: 3,
  ENCODING: 4,
  QUEUED: 5
} as const;

const TUS_ENDPOINT = 'https://video.bunnycdn.com/tusupload';

export class UploadService {
  constructor(
    private httpClient: HttpClient,
    private videoBaseUrl: string
  ) {}

  private getApiKey(libraryId?: string, accessToken?: string): string {
    // 1. Use provided access token if available
    if (accessToken) {
      console.log('[UploadService] Using provided access token.');
      return accessToken;
    }
    
    try {
      // 2. Use the HttpClient's getApiKey method which handles all the logic
      return this.httpClient.getApiKey(libraryId);
    } catch (error) {
      console.error(`[UploadService] Error getting API key: ${error.message}`);
      throw error;
    }
  }

  /**
   * Sanitize video title for Bunny API.
   * Allows alphanumeric, spaces, hyphens, underscores. Replaces others with underscore.
   * Limits length.
   */
  private sanitizeTitle(title: string): string {
    // Remove file extension if present
    const titleWithoutExt = title.replace(/\.[^/.]+$/, '');
    
    // Only replace invalid characters, keep Arabic and special characters
    const sanitized = titleWithoutExt
      .replace(/[<>:"/\\|?*]/g, '_') // Replace only truly invalid filename chars
      .replace(/\s+/g, ' ')          // Normalize spaces
      .replace(/__+/g, '_')          // Collapse multiple underscores
      .replace(/^_+|_+$/g, '')       // Remove leading/trailing underscores
      .substring(0, 200);            // Increase max length to accommodate Arabic text
    
    console.log('[UploadService] Title sanitization:', 
      `Original: "${title}"`,
      `Final: "${sanitized}"`
    );
    
    return sanitized;
  }

  private async findOrCreateCollection(
    libraryInfo: Library,
    collectionName: string,
    accessToken: string
  ): Promise<{ collectionId?: string; collectionName: string }> {
    const trimmedCollectionName = collectionName.trim();
    if (!trimmedCollectionName) {
      console.log(`[UploadService] Empty collection name provided for library ${libraryInfo.id}.`);
      return { collectionName: '' };
    }

    try {
      // First try to find existing collection
      const collections = await this.httpClient.fetchWithError<Collection[]>(
        `/library/${libraryInfo.id}/collections`,
        { 
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'AccessKey': accessToken
          }
        }
      );

      const existingCollection = collections.find(c =>
        c.name.trim().toLowerCase() === trimmedCollectionName.toLowerCase()
      );

      if (existingCollection) {
        console.log(`[UploadService] Found existing collection "${existingCollection.name}" (GUID: ${existingCollection.guid})`);
        return { collectionId: existingCollection.guid, collectionName: trimmedCollectionName };
      }

      // Create new collection if not found
      console.log(`[UploadService] Creating new collection "${trimmedCollectionName}"`);
      const newCollection = await this.httpClient.fetchWithError<Collection>(
        `/library/${libraryInfo.id}/collections`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'AccessKey': accessToken
          },
          body: JSON.stringify({ name: trimmedCollectionName })
        }
      );

      if (!newCollection?.guid) {
        throw new Error(`Collection creation failed for "${trimmedCollectionName}" - no GUID received`);
      }

      console.log(`[UploadService] Created new collection "${trimmedCollectionName}" (GUID: ${newCollection.guid})`);
      return { collectionId: newCollection.guid, collectionName: trimmedCollectionName };

    } catch (error) {
      console.error(`[UploadService] Error in findOrCreateCollection for "${trimmedCollectionName}":`, error);
      return { collectionName: trimmedCollectionName };
    }
  }

  /**
   * Create the video entry in Bunny.net.
   */
  private async createVideoEntry(
    originalTitle: string,
    libraryId: string,
    apiKey: string,
    collectionId?: string
  ): Promise<{ guid: string; title: string }> {
    // Sanitize the title while preserving Arabic characters
    const sanitizedTitle = this.sanitizeTitle(originalTitle);
    
    const logData = {
      originalTitle,
      sanitizedTitle,
      libraryId,
      collectionId,
      apiKeyLength: apiKey?.length,
      apiKeyMask: apiKey ? `${apiKey.substring(0, 4)}...${apiKey.substring(apiKey.length - 4)}` : 'none'
    };
    console.log(`[UploadService] Creating video entry: ${JSON.stringify(logData)}`);

    // Validate API key format before proceeding
    if (!apiKey || apiKey.length < 20) {
      const error = new Error(`Invalid API key: ${apiKey ? 'too short' : 'missing'}`);
      console.error('[UploadService] API key validation failed:', error.message);
      throw error;
    }

    // Resolve collection name to GUID if needed
    let resolvedCollectionId = collectionId;
    if (collectionId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(collectionId)) {
      try {
        console.log(`[UploadService] Resolving collection name "${collectionId}" to GUID`);
        
        // Get collections for the library
        const collections = await this.httpClient.fetchWithError<{ items: Collection[] }>(
          `/api/proxy/video/library/${libraryId}/collections`,
          {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'AccessKey': apiKey
            }
          }
        );

        if (!collections?.items) {
          throw new Error('Invalid collections response');
        }

        // Try to find existing collection
        const existingCollection = collections.items.find(c =>
          c.name.toLowerCase() === collectionId.toLowerCase()
        );

        if (existingCollection) {
          resolvedCollectionId = existingCollection.guid;
          console.log(`[UploadService] Found existing collection "${collectionId}" with GUID: ${resolvedCollectionId}`);
        } else {
          // Create new collection with better error handling
          console.log(`[UploadService] Creating new collection "${collectionId}"`);
          
          try {
            const newCollection = await this.httpClient.fetchWithError<Collection>(
              `/api/proxy/video/library/${libraryId}/collections`,
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'AccessKey': apiKey
                },
                body: JSON.stringify({ name: collectionId })
              }
            );

            if (!newCollection?.guid) {
              throw new Error('Invalid new collection response - no GUID received');
            }

            resolvedCollectionId = newCollection.guid;
            console.log(`[UploadService] Successfully created collection "${collectionId}" with GUID: ${resolvedCollectionId}`);
            
          } catch (collectionError) {
            console.error(`[UploadService] Failed to create collection "${collectionId}":`, collectionError);
            
            // Check if it's a specific API error
            if (collectionError.message?.includes('already exists')) {
              console.log(`[UploadService] Collection "${collectionId}" already exists, fetching updated list`);
              
              // Retry getting collections in case it was created by another process
              try {
                const retryCollections = await this.httpClient.fetchWithError<{ items: Collection[] }>(
                  `/api/proxy/video/library/${libraryId}/collections`,
                  {
                    method: 'GET',
                    headers: {
                      'Content-Type': 'application/json',
                      'AccessKey': apiKey
                    }
                  }
                );
                
                const existingRetry = retryCollections.items?.find(c =>
                  c.name.toLowerCase() === collectionId.toLowerCase()
                );
                
                if (existingRetry) {
                  resolvedCollectionId = existingRetry.guid;
                  console.log(`[UploadService] Found collection on retry: ${resolvedCollectionId}`);
                } else {
                  console.warn(`[UploadService] Collection creation failed and not found on retry, proceeding without collection`);
                  resolvedCollectionId = undefined;
                }
              } catch (retryError) {
                console.warn(`[UploadService] Retry collection fetch failed:`, retryError);
                resolvedCollectionId = undefined;
              }
            } else {
              // For other errors, log and continue without collection
              console.warn(`[UploadService] Collection creation failed with non-recoverable error, proceeding without collection:`, collectionError.message);
              resolvedCollectionId = undefined;
            }
          }
        }
      } catch (error) {
        console.error(`[UploadService] Error resolving collection "${collectionId}":`, error);
        // Continue without collection if there's an error
        resolvedCollectionId = undefined;
      }
    }

    // Create video entry with resolved collection ID
    const data = {
      title: sanitizedTitle,
      libraryId,
      collectionId: resolvedCollectionId,
      accessToken: apiKey
    };

    console.log('[UploadService] Calling /api/proxy/create-video with data:', {
      ...data,
      accessToken: data.accessToken ? `${data.accessToken.substring(0, 4)}...${data.accessToken.substring(data.accessToken.length - 4)}` : 'none'
    });

    try {
      const response = await this.httpClient.fetchWithError<any>(
        '/api/proxy/create-video',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        }
      );

      // Debug: log the exact response structure
      console.log('[UploadService] Create video response debug:', {
        hasResponse: !!response,
        responseKeys: response ? Object.keys(response) : [],
        hasVideo: !!response?.video,
        videoKeys: response?.video ? Object.keys(response.video) : [],
        hasVideoGuid: !!response?.video?.guid,
        hasDirectGuid: !!response?.guid,
        videoGuidValue: response?.video?.guid,
        directGuidValue: response?.guid
      });

      // Handle different response formats
      let video: Video;
      let guid: string;
      
      if (response && response.video && response.video.guid) {
        // New format: { success: true, video: { guid: "...", ... } }
        video = response.video;
        guid = response.video.guid;
        console.log('[UploadService] Using new format with video.guid:', guid);
      } else if (response && response.guid) {
        // Old format: { guid: "...", ... }
        video = response;
        guid = response.guid;
        console.log('[UploadService] Using old format with direct guid:', guid);
      } else {
        console.error('[UploadService] No GUID found in response:', JSON.stringify(response, null, 2));
        throw new Error('Failed to create video entry: No GUID in response');
      }

      // Log the complete response for debugging
      console.log('[UploadService] Video entry created successfully:', {
        guid: guid,
        title: video.title,
        collection: video.collectionId || 'none',
        status: this.getStatusName(video.status),
        metadata: {
          width: video.width,
          height: video.height,
          length: video.length,
          framerate: video.framerate,
          dateUploaded: video.dateUploaded,
          views: video.views,
          storageSize: video.storageSize,
          encodeProgress: video.encodeProgress
        }
      });

      return { guid: guid, title: sanitizedTitle };
    } catch (error) {
      console.error('[UploadService] Failed to create video entry:', {
        error: error.message,
        status: error.status,
        response: error.response,
        apiKeyValid: apiKey && apiKey.length >= 20,
        libraryId,
        title: sanitizedTitle
      });
      
      // Re-throw with more context
      throw new Error(`Video creation failed: ${error.message}`);
    }
  }

  /**
   * Upload video content using XMLHttpRequest.
   */
  private async uploadVideoContentXHR(
    file: File,
    libraryId: string,
    guid: string,
    apiKey: string,
    onProgress?: (progress: UploadProgress) => void,
    signal?: AbortSignal
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const uploadUrl = `https://video.bunnycdn.com/library/${libraryId}/videos/${guid}`; // Direct URL for XHR

      xhr.open("PUT", uploadUrl, true);
      xhr.setRequestHeader("AccessKey", apiKey);
      xhr.setRequestHeader("Content-Type", "application/octet-stream");

      let lastBytes = 0;
      let lastTime = Date.now();
      let startTime = lastTime;
      let lastProgressReport = 0; // Add throttling for progress reports

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const now = Date.now();
          const timeDiff = (now - lastTime) / 1000; // Time difference in seconds
          const bytesDiff = event.loaded - lastBytes;
          
          // Better speed calculation with fallback for initial uploads
          let speed = 0;
          if (timeDiff > 0) {
            speed = bytesDiff / timeDiff; // Bytes per second
          } else if (event.loaded > 0) {
            // For very fast initial uploads, calculate based on total elapsed time
            const totalElapsed = (now - startTime) / 1000;
            speed = totalElapsed > 0 ? event.loaded / totalElapsed : 0;
          }

          const progress = (event.loaded / event.total) * 100;
          const totalTimeElapsed = (now - startTime) / 1000;
          const estimatedTotalTime = totalTimeElapsed > 0 && progress > 0 ? totalTimeElapsed / (progress / 100) : 0;
          const timeRemaining = Math.max(0, estimatedTotalTime - totalTimeElapsed);

          // Update progress more frequently for better UX (every 50ms or 0.5% progress change)
          const progressChange = Math.abs(progress - lastProgressReport);
          const timeElapsed = now - lastTime;
          
          if (onProgress && (timeElapsed >= 50 || progressChange >= 0.25)) {
            onProgress({
              loaded: event.loaded,
              total: event.total,
              percentage: Math.min(progress, 100), // Ensure percentage doesn't exceed 100%
              bytesPerSecond: speed,
              timeRemaining: timeRemaining
            });
            lastProgressReport = progress;
          }

          // Update tracking variables more frequently for better speed calculation
          if (timeDiff >= 0.05) { // Update every 50ms
            lastBytes = event.loaded;
            lastTime = now;
          }
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          console.log(`[UploadService-XHR] Upload successful for GUID: ${guid}`);
          resolve();
        } else {
          console.error(`[UploadService-XHR] Upload failed for GUID: ${guid}. Status: ${xhr.status}`, xhr.responseText);
          reject(new Error(`Upload failed with status ${xhr.status}: ${xhr.responseText}`));
        }
      };

      xhr.onerror = () => {
        console.error(`[UploadService-XHR] Network error during upload for GUID: ${guid}`);
        reject(new Error("Network error during upload"));
      };

      xhr.onabort = () => {
        console.log(`[UploadService-XHR] Upload aborted for GUID: ${guid}`);
        reject(new DOMException('Upload aborted by user', 'AbortError'));
      };

      if (signal) {
        signal.addEventListener('abort', () => {
          if (xhr.readyState !== 4) { // Only abort if not already completed/failed
            xhr.abort();
          }
        });
      }

      xhr.send(file);
    });
  }

  /**
   * Upload video content using fetch streams.
   */
   private async uploadVideoContentStream(
    file: File,
    libraryId: string,
    guid: string,
    apiKey: string,
    onProgress?: (progress: UploadProgress) => void,
    signal?: AbortSignal,
    settings?: UploadSettings
  ): Promise<void> {
    // Vercel Serverless Function payload limit is 4.5MB, but we'll be more conservative
    // Use 3MB as threshold to avoid any potential issues with Vercel limits
    const VERCEL_PAYLOAD_LIMIT = 3 * 1024 * 1024; // 3MB in bytes
    const useDirectUpload = file.size > VERCEL_PAYLOAD_LIMIT;
    
    console.log(`[UploadService-Stream] File size: ${(file.size / (1024 * 1024)).toFixed(2)} MB, Vercel limit: ${(VERCEL_PAYLOAD_LIMIT / (1024 * 1024)).toFixed(2)} MB, using direct upload: ${useDirectUpload}`);
    
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      
      // Choose upload URL based on file size
      const uploadUrl = useDirectUpload 
        ? `https://video.bunnycdn.com/library/${libraryId}/videos/${guid}` // Direct to Bunny for large files
        : `/api/proxy/video/library/${libraryId}/videos/${guid}`; // Via proxy for small files

      if (useDirectUpload) {
        console.log(`[UploadService-Stream] Large file detected (${(file.size / (1024 * 1024)).toFixed(2)} MB), using direct upload to Bunny.net`);
      } else {
        console.log(`[UploadService-Stream] Small file (${(file.size / (1024 * 1024)).toFixed(2)} MB), using proxy upload`);
      }

      xhr.open("PUT", uploadUrl, true);
      xhr.setRequestHeader("AccessKey", apiKey);
      xhr.setRequestHeader("Content-Type", "application/octet-stream");

      // Set chunk size if provided
      if (settings?.chunkSize) {
        xhr.setRequestHeader("X-Chunk-Size", `${settings.chunkSize}`);
        console.log(`[UploadService-Stream] Using chunk size: ${(settings.chunkSize / (1024 * 1024)).toFixed(2)} MB`);
      }

      // Set timeout if provided
      if (settings?.timeoutMs) {
        xhr.timeout = settings.timeoutMs;
        console.log(`[UploadService-Stream] Using timeout: ${settings.timeoutMs / 1000} seconds`);
      }

      let lastBytes = 0;
      let lastTime = Date.now();
      let startTime = lastTime;
      let lastProgressReport = 0; // Add throttling for progress reports

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const now = Date.now();
          const timeDiff = (now - lastTime) / 1000; // Time difference in seconds
          const bytesDiff = event.loaded - lastBytes;
          
          // Better speed calculation with fallback for initial uploads
          let speed = 0;
          if (timeDiff > 0) {
            speed = bytesDiff / timeDiff; // Bytes per second
          } else if (event.loaded > 0) {
            // For very fast initial uploads, calculate based on total elapsed time
            const totalElapsed = (now - startTime) / 1000;
            speed = totalElapsed > 0 ? event.loaded / totalElapsed : 0;
          }

          const progress = (event.loaded / event.total) * 100;
          const totalTimeElapsed = (now - startTime) / 1000;
          const estimatedTotalTime = totalTimeElapsed > 0 && progress > 0 ? totalTimeElapsed / (progress / 100) : 0;
          const timeRemaining = Math.max(0, estimatedTotalTime - totalTimeElapsed);

          // Update progress more frequently for better UX (every 50ms or 0.5% progress change)
          const progressChange = Math.abs(progress - lastProgressReport);
          const timeElapsed = now - lastTime;
          
          if (onProgress && (timeElapsed >= 50 || progressChange >= 0.25)) {
            onProgress({
              loaded: event.loaded,
              total: event.total,
              percentage: Math.min(progress, 100), // Ensure percentage doesn't exceed 100%
              bytesPerSecond: speed,
              timeRemaining: timeRemaining
            });
            lastProgressReport = progress;
          }

          // Update tracking variables more frequently for better speed calculation
          if (timeDiff >= 0.05) { // Update every 50ms
            lastBytes = event.loaded;
            lastTime = now;
          }
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          console.log(`[UploadService-Stream] Upload successful for GUID: ${guid}`);
          resolve();
        } else {
          const errorMsg = `Upload failed with status ${xhr.status}: ${xhr.responseText}`;
          console.error(`[UploadService-Stream] ${errorMsg}`);
          reject(new Error(errorMsg));
        }
      };

      xhr.onerror = () => {
        console.error(`[UploadService-Stream] Network error during upload for GUID: ${guid}`);
        reject(new Error("Network error during upload"));
      };

      xhr.ontimeout = () => {
        console.error(`[UploadService-Stream] Request timed out for GUID: ${guid}`);
        reject(new Error(`Request timed out after ${settings?.timeoutMs || 50000}ms`));
      };

      xhr.onabort = () => {
        console.log(`[UploadService-Stream] Upload aborted for GUID: ${guid}`);
        reject(new DOMException('Upload aborted by user', 'AbortError'));
      };

      if (signal) {
        signal.addEventListener('abort', () => {
          if (xhr.readyState !== 4) { // Only abort if not already completed/failed
            xhr.abort();
          }
        });
      }

      xhr.send(file);
    });
  }

  /**
   * Upload video content with retry logic.
   */
  private async uploadVideoContentWithRetry(
    file: File,
    libraryId: string,
    guid: string,
    apiKey: string,
    onProgress?: (progress: UploadProgress) => void,
    signal?: AbortSignal,
    useStreaming = true, // Add flag to control method
    settings?: UploadSettings
  ): Promise<void> {
    const maxRetries = 2; // Total 3 attempts (1 initial + 2 retries)
    let attempt = 0;

    // Force XHR (direct upload) for large files to avoid Vercel payload limits
    const VERCEL_PAYLOAD_LIMIT = 3 * 1024 * 1024; // 3MB limit
    const isLargeFile = file.size > VERCEL_PAYLOAD_LIMIT;
    
    if (isLargeFile) {
      console.log(`[UploadService-Retry] Large file detected (${(file.size / (1024 * 1024)).toFixed(2)} MB), forcing XHR direct upload to avoid Vercel limits`);
      useStreaming = false; // Force XHR for large files
    }

    while (attempt <= maxRetries) {
      try {
        const uploadMethod = useStreaming && typeof file.stream === 'function' && !isLargeFile
          ? this.uploadVideoContentStream
          : this.uploadVideoContentXHR;

        console.log(`[UploadService-Retry] Attempt ${attempt + 1}/${maxRetries + 1} using ${useStreaming && !isLargeFile ? 'stream' : 'XHR'} for GUID: ${guid}, file size: ${(file.size / (1024 * 1024)).toFixed(2)} MB`);
        await uploadMethod(file, libraryId, guid, apiKey, onProgress, signal, settings);
        return; // Success
      } catch (error) {
        attempt++;
        console.warn(`[UploadService-Retry] Upload attempt ${attempt} failed for GUID ${guid}:`, error.message);

        if (attempt > maxRetries || (error instanceof DOMException && error.name === 'AbortError')) {
          console.error(`[UploadService-Retry] Upload failed permanently for GUID ${guid} after ${attempt} attempts.`);
          throw error; // Rethrow after max retries or if aborted
        }

        // Exponential backoff delay
        const delay = Math.pow(2, attempt - 1) * 1000; // 1s, 2s
        console.log(`[UploadService-Retry] Retrying in ${delay / 1000}s...`);
        await new Promise(resolve => setTimeout(resolve, delay));

        // Check for abort signal during delay
        if (signal?.aborted) {
           console.log(`[UploadService-Retry] Abort detected during retry delay for GUID ${guid}.`);
           throw new DOMException('Upload aborted during retry delay', 'AbortError');
        }
      }
    }
  }

  /**
   * Check for existing video in the collection.
   */
  private async checkExistingVideo(
    file: File,
    libraryId: string,
    collectionId?: string,
    accessToken?: string
  ): Promise<{ exists: boolean; warning?: string; guid?: string }> { // Added guid to return type
    try {
      console.log('[UploadService] Checking for existing video in library', libraryId);
      
      const apiKey = this.getApiKey(libraryId, accessToken);
      
      let allVideos: Video[] = [];
      let currentPage = 1;
      const itemsPerPage = 100;
      const maxPages = 5; // Limit to first 5 pages (500 videos) to prevent infinite loops
      let hasMoreItems = true;

      // Get video metadata
      const videoDuration = await this.getVideoDuration(file);
      const videoTitle = this.sanitizeTitle(file.name);
      console.log(`[UploadService] Checking video - Title: "${videoTitle}", Duration: ${videoDuration}s (checking first ${maxPages} pages)`);

      // Fetch limited pages
      while (hasMoreItems && currentPage <= maxPages) {
        console.log(`[UploadService] Checking page ${currentPage}/${maxPages} for existing videos`);
        
        const response = await this.httpClient.fetchWithError<{ items: Video[] }>(
          `/api/proxy/video/library/${libraryId}/videos?page=${currentPage}&itemsPerPage=${itemsPerPage}&orderBy=date`,
          {
            method: 'GET',
            headers: {
              'AccessKey': apiKey,
              'Content-Type': 'application/json'
            }
          }
        );

        if (!response?.items) {
          console.error('[UploadService] Invalid response format:', response);
          throw new Error('Invalid response format from API');
        }

        allVideos = allVideos.concat(response.items);
        hasMoreItems = response.items.length === itemsPerPage;
        currentPage++;

        // Check videos from current page
        for (const video of response.items) {
          const titleMatch = video.title && videoTitle ? video.title.toLowerCase() === videoTitle.toLowerCase() : false;
          const durationDiff = Math.abs(video.length - videoDuration);
          
          if (titleMatch && durationDiff <= 1) {
            console.log('[UploadService] Found matching video:', {
              existingTitle: video.title,
              newTitle: videoTitle,
              existingDuration: video.length,
              newDuration: videoDuration,
              difference: durationDiff,
              status: this.getStatusName(video.status),
              guid: video.guid
            });
            
            return {
              exists: true,
              warning: `Video already exists with GUID: ${video.guid}`,
              guid: video.guid // Return the guid for sheet updates
            };
          }
        }
      }

      if (currentPage > maxPages) {
        console.log(`[UploadService] Reached page limit (${maxPages}), assuming video doesn't exist in recent uploads`);
      }

      return { exists: false };

    } catch (error) {
      console.error('[UploadService] Error checking for existing video:', error);
      throw error;
    }
  }

  private getStatusName(status: number): string {
    switch (status) {
      case VIDEO_STATUS.UPLOADING:
        return 'UPLOADING';
      case VIDEO_STATUS.PROCESSING:
        return 'PROCESSING';
      case VIDEO_STATUS.READY:
        return 'READY';
      case VIDEO_STATUS.FAILED:
        return 'FAILED';
      case VIDEO_STATUS.ENCODING:
        return 'ENCODING';
      case VIDEO_STATUS.QUEUED:
        return 'QUEUED';
      default:
        return 'UNKNOWN';
    }
  }

  private async getVideoDuration(file: File): Promise<number> {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      
      video.onloadedmetadata = () => {
        URL.revokeObjectURL(video.src);
        resolve(Math.round(video.duration));
      };
      
      video.onerror = () => {
        URL.revokeObjectURL(video.src);
        reject(new Error('Failed to load video metadata'));
      };
      
      video.src = URL.createObjectURL(file);
    });
  }

  /**
   * رفع الفيديو بتقسيمه إلى أجزاء صغيرة (Chunked Upload)
   * يُستخدم كبديل عندما يفشل TUS
   */
  private async uploadVideoChunked(
    file: File,
    libraryId: string,
    guid: string,
    apiKey: string,
    onProgress?: (progress: UploadProgress) => void,
    signal?: AbortSignal,
    settings?: UploadSettings
  ): Promise<void> {
    const chunkSize = settings?.chunkSize || 10 * 1024 * 1024; // 10MB default
    const totalChunks = Math.ceil(file.size / chunkSize);
    let uploadedBytes = 0;
    const startTime = Date.now();
    let lastProgressReport = 0; // Add progress throttling for chunked uploads

    console.log(`[UploadService] Starting chunked upload: ${totalChunks} chunks of ${(chunkSize / (1024 * 1024)).toFixed(2)}MB`);

    for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
      if (signal?.aborted) {
        throw new DOMException('Upload aborted', 'AbortError');
      }

      const start = chunkIndex * chunkSize;
      const end = Math.min(start + chunkSize, file.size);
      const chunk = file.slice(start, end);
      
      // محاولة رفع القطعة مع إعادة المحاولة
      let retryCount = 0;
      const maxRetries = settings?.retryAttempts || 3;
      
      while (retryCount <= maxRetries) {
        try {
          await this.uploadChunk(chunk, libraryId, guid, apiKey, start, end, file.size);
          
          uploadedBytes = end;
          
          if (onProgress) {
            const now = Date.now();
            const elapsedSeconds = (now - startTime) / 1000;
            const bytesPerSecond = elapsedSeconds > 0 ? uploadedBytes / elapsedSeconds : 0;
            const remainingBytes = file.size - uploadedBytes;
            const timeRemaining = bytesPerSecond > 0 ? remainingBytes / bytesPerSecond : 0;
            const progress = (uploadedBytes / file.size) * 100;
            
            // Only report progress if significant change occurred (same throttling as XHR)
            const progressChange = Math.abs(progress - lastProgressReport);
            if (progressChange >= 0.5 || chunkIndex === totalChunks - 1) {
              onProgress({
                loaded: uploadedBytes,
                total: file.size,
                percentage: Math.min(progress, 100), // Ensure percentage doesn't exceed 100%
                bytesPerSecond,
                timeRemaining
              });
              lastProgressReport = progress;
            }
          }
          
          console.log(`[UploadService] Chunk ${chunkIndex + 1}/${totalChunks} uploaded successfully (${((uploadedBytes / file.size) * 100).toFixed(1)}%)`);
          break; // نجح الرفع، اخرج من حلقة إعادة المحاولة
          
        } catch (error) {
          retryCount++;
          console.error(`[UploadService] Chunk ${chunkIndex + 1} failed (attempt ${retryCount}/${maxRetries + 1}):`, error);
          
          if (retryCount > maxRetries) {
            throw error;
          }
          
          // انتظر قبل إعادة المحاولة
          const delay = (settings?.retryDelays?.[retryCount - 1] || retryCount * 5000);
          console.log(`[UploadService] Waiting ${delay}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    console.log(`[UploadService] Chunked upload completed for ${guid}`);
  }

  /**
   * رفع قطعة واحدة من الملف
   */
  private async uploadChunk(
    chunk: Blob,
    libraryId: string,
    guid: string,
    apiKey: string,
    rangeStart: number,
    rangeEnd: number,
    totalSize: number
  ): Promise<void> {
    const uploadUrl = `https://video.bunnycdn.com/library/${libraryId}/videos/${guid}`;
    
    const response = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'AccessKey': apiKey,
        'Content-Type': 'application/octet-stream',
        'Content-Range': `bytes ${rangeStart}-${rangeEnd - 1}/${totalSize}`
      },
      body: chunk
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Chunk upload failed: ${response.status} - ${errorText}`);
    }
  }

  /**
   * Upload video to Bunny.net using basic XHR (legacy method).
   */
  async uploadVideo(
    file: File,
    libraryId: string,
    onProgress?: (progress: UploadProgress) => void,
    collectionId?: string,
    accessToken?: string,
    signal?: AbortSignal,
    settings?: UploadSettings
  ): Promise<{ guid: string; title: string; warning?: string }> {
    try {
      const apiKey = this.getApiKey(libraryId, accessToken);
      if (!apiKey) {
        throw new Error('No API key available for upload');
      }

      // Check for existing video first
      const existingCheck = await this.checkExistingVideo(file, libraryId, collectionId, accessToken);
      if (existingCheck.exists && existingCheck.guid) {
        return {
          guid: existingCheck.guid,
          title: file.name,
          warning: 'Video already exists in library'
        };
      }

      // تحديد طريقة الرفع بناءً على الإعدادات
      const uploadMethod = settings?.uploadMethod || 'auto';
      const maxDirectSizeBytes = (settings?.maxDirectUploadSizeMB || 100) * 1024 * 1024;
      
      // منطق اختيار طريقة الرفع
      let shouldUseTUS = false;
      let shouldUseChunked = false;
      
      if (uploadMethod === 'tus') {
        shouldUseTUS = true;
      } else if (uploadMethod === 'chunked') {
        shouldUseChunked = true;
      } else if (uploadMethod === 'direct') {
        // Use direct upload regardless of file size
        shouldUseTUS = false;
        shouldUseChunked = false;
      } else {
        // Auto mode - choose based on file size and connection
        const tusThresholdBytes = (settings?.useTusThresholdMB || 100) * 1024 * 1024;
        const isLargeFile = file.size >= tusThresholdBytes;
        const isVeryLargeFile = file.size >= 500 * 1024 * 1024; // >500MB
        const isProxyConnection = window.location.hostname !== 'video.bunnycdn.com';
        
        shouldUseTUS = isLargeFile || (file.size >= 100 * 1024 * 1024 && isProxyConnection);
        shouldUseChunked = isVeryLargeFile && settings?.enableAutoFallback !== false;
      }
      
      // Try TUS first if determined
      if (shouldUseTUS) {
        console.log(`[UploadService] Using TUS for ${file.name} (${(file.size / (1024 * 1024)).toFixed(2)} MB)`);
        
        try {
          return await this.uploadVideoResumable(
            file, libraryId, onProgress, collectionId, accessToken, signal, settings
          );
        } catch (tusError) {
          console.error('[UploadService] TUS upload failed:', tusError);
          
          // Try chunked upload as fallback if enabled
          if (shouldUseChunked && settings?.enableAutoFallback !== false) {
            console.log('[UploadService] Falling back to chunked upload...');
            const { guid, title } = await this.createVideoEntry(file.name, libraryId, apiKey, collectionId);
            await this.uploadVideoChunked(file, libraryId, guid, apiKey, onProgress, signal, settings);
            return { guid, title };
          }
          
          // If no fallback or fallback disabled, throw the error
          if (settings?.enableAutoFallback === false) {
            throw tusError;
          }
          
          // Otherwise continue to direct upload
        }
      }
      
      // Try chunked upload if determined (and not already tried via TUS fallback)
      if (shouldUseChunked && !shouldUseTUS) {
        console.log(`[UploadService] Using chunked upload for ${file.name} (${(file.size / (1024 * 1024)).toFixed(2)} MB)`);
        const { guid, title } = await this.createVideoEntry(file.name, libraryId, apiKey, collectionId);
        
        try {
          await this.uploadVideoChunked(file, libraryId, guid, apiKey, onProgress, signal, settings);
          return { guid, title };
        } catch (chunkedError) {
          console.error('[UploadService] Chunked upload failed:', chunkedError);
          
          if (settings?.enableAutoFallback === false) {
            throw chunkedError;
          }
          // Continue to direct upload as last resort
        }
      }

      // Direct upload (or fallback to direct)
      console.log(`[UploadService] Using direct upload for ${file.name} (${(file.size / (1024 * 1024)).toFixed(2)} MB)`);
      const { guid, title } = await this.createVideoEntry(file.name, libraryId, apiKey, collectionId);
      
      // Force XHR for large files to avoid Vercel payload limits
      const VERCEL_PAYLOAD_LIMIT = 3 * 1024 * 1024; // 3MB limit
      const isLargeFile = file.size > VERCEL_PAYLOAD_LIMIT;
      
      // تحديد أسلوب الرفع المباشر
      const useStreamUpload = !isLargeFile && settings?.useStreaming !== false && typeof file.stream === 'function' && file.size < maxDirectSizeBytes;
      
      if (isLargeFile) {
        console.log(`[UploadService] Large file detected (${(file.size / (1024 * 1024)).toFixed(2)} MB), forcing XHR direct upload to avoid Vercel limits`);
      }
      
      try {
        console.log(`[UploadService] Using ${useStreamUpload ? 'stream' : 'XHR'} upload method for file size: ${(file.size / (1024 * 1024)).toFixed(2)} MB`);
        await this.uploadVideoContentWithRetry(file, libraryId, guid, apiKey, onProgress, signal, useStreamUpload, settings);
        return { guid, title };
      } catch (uploadError) {
        // في حالة فشل الرفع المباشر، جرب TUS كملاذ أخير للملفات المتوسطة
        if (file.size >= 50 * 1024 * 1024 && settings?.enableAutoFallback !== false && uploadMethod === 'auto') {
          console.log(`[UploadService] Direct upload failed, falling back to TUS for ${file.name}`);
          try {
            return await this.uploadVideoResumable(file, libraryId, onProgress, collectionId, accessToken, signal, settings);
          } catch (lastError) {
            console.error('[UploadService] All upload methods failed');
            throw lastError;
          }
        }
        throw uploadError;
      }
    } catch (error) {
      console.error('[UploadService] Error uploading video:', error);
      throw error;
    }
  }

  /**
   * Upload video to Bunny.net using fetch streams.
   */
  async uploadVideoWithStreams(
    file: File,
    libraryId: string,
    onProgress?: (progress: UploadProgress) => void,
    collectionId?: string,
    accessToken?: string,
    signal?: AbortSignal
  ): Promise<{ guid: string; title: string; warning?: string }> {
    try {
      const apiKey = this.getApiKey(libraryId, accessToken);
      if (!apiKey) {
        throw new Error('No API key available for upload');
      }

      // Check for existing video first
      const existingCheck = await this.checkExistingVideo(file, libraryId, collectionId, accessToken);
      if (existingCheck.exists && existingCheck.guid) {
        // Return the GUID and warning, but do NOT skip sheet update
        return {
          guid: existingCheck.guid,
          title: file.name,
          warning: 'Video already exists in library'
        };
      }

      // Create video entry
      const { guid, title } = await this.createVideoEntry(file.name, libraryId, apiKey, collectionId);
      
      // Force XHR for large files to avoid Vercel payload limits
      const VERCEL_PAYLOAD_LIMIT = 3 * 1024 * 1024; // 3MB limit
      const isLargeFile = file.size > VERCEL_PAYLOAD_LIMIT;
      const useStreaming = !isLargeFile; // Only use streaming for small files
      
      if (isLargeFile) {
        console.log(`[UploadService-Streams] Large file detected (${(file.size / (1024 * 1024)).toFixed(2)} MB), forcing XHR direct upload to avoid Vercel limits`);
      }
      
      await this.uploadVideoContentWithRetry(file, libraryId, guid, apiKey, onProgress, signal, useStreaming);

      return { guid, title };
    } catch (error) {
      console.error('[UploadService] Error uploading video with streams:', error);
      throw error;
    }
  }

  /**
   * رفع قابل للاستئناف باستخدام TUS.
   * يُستخدم تلقائياً للملفات الكبيرة (size >= 1 GB) أو عند تمرير ‎useTus=true فى الإعدادات.
   */
  async uploadVideoResumable(
    file: File,
    libraryId: string,
    onProgress?: (p: UploadProgress) => void,
    collectionId?: string,
    accessToken?: string,
    signal?: AbortSignal,
    settings?: UploadSettings
  ): Promise<{ guid: string; title: string; warning?: string }> {
    const apiKey = this.getApiKey(libraryId, accessToken);
    const config = { ...DEFAULT_UPLOAD_CONFIG, ...settings };

    // 1. تأكد من عدم وجود نسخة سابقة
    const existing = await this.checkExistingVideo(file, libraryId, collectionId, accessToken);
    if (existing.exists && existing.guid) {
      return { guid: existing.guid, title: file.name, warning: 'Video already exists' };
    }

    // 2. أنشئ Video GUID أولاً
    const { guid, title } = await this.createVideoEntry(file.name, libraryId, apiKey, collectionId);

    return new Promise((resolve, reject) => {
      let isPaused = false;
      let upload: tus.Upload;

      // مراقبة حالة الاتصال إذا كان مفعلاً
      const handleOnline = () => {
        if (config.enableAutoRetry && isPaused && upload) {
          console.log('[TUS] Connection restored, resuming upload...');
          isPaused = false;
          upload.start();
        }
      };

      const handleOffline = () => {
        if (config.enableAutoRetry && upload && !isPaused) {
          console.log('[TUS] Connection lost, pausing upload...');
          isPaused = true;
          upload.abort();
        }
      };

      if (config.enableConnectionCheck) {
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
      }

      // تنظيف event listeners
      const cleanup = () => {
        if (config.enableConnectionCheck) {
          window.removeEventListener('online', handleOnline);
          window.removeEventListener('offline', handleOffline);
        }
      };

      upload = new tus.Upload(file, {
        endpoint: TUS_ENDPOINT,
        retryDelays: config.retryDelays,
        chunkSize: config.chunkSize,
        storeFingerprintForResuming: config.enableResumableSessions,
        removeFingerprintOnSuccess: true,
        onBeforeRequest: function(req) {
          const expire = Math.floor(Date.now() / 1000) + (6 * 60 * 60);
          const sigRaw = `${libraryId}${apiKey}${expire}${guid}`;
          const signature = CryptoJS.SHA256(sigRaw).toString(CryptoJS.enc.Hex);

          req.setHeader('AuthorizationSignature', signature);
          req.setHeader('AuthorizationExpire', expire.toString());
          req.setHeader('LibraryId', libraryId.toString());
          req.setHeader('VideoId', guid);
        },
        metadata: {
          filetype: file.type || 'video/mp4',
          title,
          collection: collectionId || ''
        },
        onProgress: (bytesUploaded, bytesTotal) => {
          if (onProgress) {
            const now = Date.now();
            onProgress({
              loaded: bytesUploaded,
              total: bytesTotal,
              percentage: (bytesUploaded / bytesTotal) * 100,
              isPaused
            });
          }
        },
        onError: (err) => {
          console.error('[TUS] Error:', err);
          
          // تحليل نوع الخطأ
          const errorMessage = err.message || err.toString();
          const isNetworkError = errorMessage.includes('Failed to fetch') || 
                               errorMessage.includes('Network') ||
                               errorMessage.includes('ECONNREFUSED') ||
                               errorMessage.includes('ETIMEDOUT');
          
          const isAuthError = errorMessage.includes('401') || 
                             errorMessage.includes('403') ||
                             errorMessage.includes('Invalid expiry time');
          
          // في حالة خطأ الشبكة، حاول الإيقاف المؤقت بدلاً من الفشل
          if (isNetworkError && config.enableAutoRetry && !isPaused) {
            console.log('[TUS] Network error detected, pausing upload for retry...');
            isPaused = true;
            
            // جدولة إعادة المحاولة بعد فترة
            setTimeout(() => {
              if (isPaused && navigator.onLine) {
                console.log('[TUS] Attempting to resume upload after network error...');
                isPaused = false;
                upload.start();
              }
            }, config.retryDelays?.[1] || 5000);
            
            return; // لا ترفض الوعد بعد
          }
          
          // في حالة خطأ المصادقة، لا فائدة من إعادة المحاولة
          if (isAuthError) {
            console.error('[TUS] Authentication error, cannot retry');
            cleanup();
            reject(new Error('Authentication failed: ' + errorMessage));
            return;
          }
          
          cleanup();
          reject(err);
        },
        onSuccess: () => {
          console.log('[TUS] Upload completed:', guid);
          cleanup();
          resolve({ guid, title });
        },
        // إضافة خيارات إضافية لـ TUS
        parallelUploads: 1, // رفع متسلسل للقطع لتجنب التحميل الزائد
        overridePatchMethod: false, // استخدام PATCH القياسي
        uploadDataDuringCreation: false // تجنب إرسال بيانات مع طلب CREATE
      });

      // ابحث عن جلسة سابقة لاستئنافها إذا كان مفعلاً
      if (config.enableResumableSessions) {
        upload.findPreviousUploads().then(previous => {
          if (previous.length) {
            console.log('[TUS] Found previous upload, resuming...');
            upload.resumeFromPreviousUpload(previous[0]);
          }
          
          // تحقق من حالة الاتصال قبل البدء إذا كان الفحص مفعلاً
          if (config.enableConnectionCheck && !navigator.onLine) {
            console.log('[TUS] No connection, waiting...');
            isPaused = true;
            return;
          }

          // دعم الإلغاء عبر AbortSignal
          if (signal) {
            signal.addEventListener('abort', () => {
              cleanup();
              upload.abort();
            });
          }

          upload.start();
        });
      } else {
        // ابدأ رفعاً جديداً مباشرة
        if (signal) {
          signal.addEventListener('abort', () => {
            cleanup();
            upload.abort();
          });
        }
        upload.start();
      }
    });
  }
}