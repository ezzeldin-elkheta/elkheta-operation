import { HttpClient } from './http-client';
import type { UploadProgress } from './types';
import { cache } from '../cache';
import { VIDEO_BASE_URL } from './constants';
import { env, getBunnyApiKey } from '../env'; // Use centralized env config
import { BunnyCacheCleaner } from './cache-cleaner';

interface UploadResponse {
  guid: string;
}

export class UploadService {
  private httpClient: HttpClient;

  constructor(apiKey?: string, videoApiKey?: string) {
    this.httpClient = new HttpClient(apiKey, videoApiKey);
  }

  private getApiKey(libraryId?: string, accessToken?: string): string {
    // 1. Use provided access token if available
    if (accessToken) {
      console.log('[UploadService] Using provided access token');
      return accessToken;
    }
    
    // 2. Always use validated environment API key for uploads
    // This ensures we use a fresh, valid key instead of potentially stale cached keys
    try {
      const envKey = getBunnyApiKey();
      console.log('[UploadService] Using validated environment API key');
      return envKey;
    } catch (error) {
      console.warn('[UploadService] No valid environment API key found:', error.message);
    }
    
    // 3. Only fall back to library-specific cache if environment key is not available
    if (libraryId) {
      const cachedKey = cache.get(`library_${libraryId}_api`);
      if (cachedKey) {
        console.log(`[UploadService] Falling back to cached library key for ${libraryId}`);
        return cachedKey;
      }
    }
    
    throw new Error('No valid API key available for upload. Please check your environment configuration.');
  }

  /**
   * Sanitize video title for Bunny API.
   * Allows alphanumeric, spaces, hyphens, underscores. Replaces others with underscore.
   * Limits length.
   */
  private sanitizeTitle(title: string): string {
    return title
      .replace(/[^\w\s-]/g, '_') // Allow alphanumeric, whitespace, hyphen. Replace others with underscore.
      .replace(/\s+/g, '_')     // Replace whitespace sequences with single underscore.
      .replace(/__+/g, '_')    // Collapse multiple underscores.
      .substring(0, 80)        // Limit length.
      .toLowerCase();           // Convert to lowercase.
  }

  /**
   * Create the video entry in Bunny.net.
   */
  private async createVideoEntry(
    originalTitle: string,
    libraryId: string,
    apiKey: string,
    collectionId?: string // Should be GUID
  ): Promise<{ guid: string; title: string }> {
    const sanitizedTitle = this.sanitizeTitle(originalTitle);
    console.log(`Creating video entry. Original: "${originalTitle}" -> Sanitized: "${sanitizedTitle}"`);

    const createData: any = {
      title: sanitizedTitle
    };

    // Only include collectionId if it's a valid GUID format
    if (collectionId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(collectionId)) {
      createData.collectionId = collectionId;
      console.log(`Assigning to collection: ${collectionId}`);
    } else if (collectionId) {
      console.warn(`Invalid collection ID format provided: "${collectionId}". Skipping collection assignment.`);
    }

    const createResponse = await this.httpClient.fetchWithError<UploadResponse>(
      `/library/${libraryId}/videos`,
      {
        method: "POST",
        body: JSON.stringify(createData),
        headers: {
          'Content-Type': 'application/json',
          'AccessKey': apiKey
        }
      }
    );

    if (!createResponse?.guid) {
      throw new Error("Failed to create video entry - no GUID received");
    }

    return {
      guid: createResponse.guid,
      title: sanitizedTitle // Return the title used for creation
    };
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
      // Use the proxy URL configured in server.js/vite.config.js
      const uploadUrl = `/api/proxy/video/library/${libraryId}/videos/${guid}`;

      xhr.open('PUT', uploadUrl, true);
      xhr.setRequestHeader('AccessKey', apiKey); // The proxy will use this header
      xhr.setRequestHeader('Content-Type', 'application/octet-stream');

      let lastTimestamp = Date.now();
      let lastLoaded = 0;
      let startTimestamp = Date.now();
      let speedSamples: number[] = [];

      // Progress handling with improved speed calculation
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable && onProgress) {
          const now = Date.now();
          const timeDiff = (now - lastTimestamp) / 1000; // seconds
          const bytesDiff = event.loaded - lastLoaded;
          
          // Calculate current speed
          let currentSpeed = 0;
          if (timeDiff > 0.1) { // Only calculate if enough time has passed (100ms)
            currentSpeed = bytesDiff / timeDiff;
            
            // Add to speed samples for smoothing (keep last 10 samples)
            speedSamples.push(currentSpeed);
            if (speedSamples.length > 10) {
              speedSamples.shift();
            }
            
            lastLoaded = event.loaded;
            lastTimestamp = now;
          }
          
          // Calculate average speed from samples for smoother display
          const avgSpeed = speedSamples.length > 0 
            ? speedSamples.reduce((sum, speed) => sum + speed, 0) / speedSamples.length
            : 0;
          
          // Calculate overall average speed from start
          const totalElapsed = (now - startTimestamp) / 1000;
          const overallSpeed = totalElapsed > 0 ? event.loaded / totalElapsed : 0;
          
          // Use the more stable speed (prefer overall speed after first few seconds)
          const finalSpeed = totalElapsed > 3 ? overallSpeed : avgSpeed;
          
          // Calculate time remaining
          const remainingBytes = event.total - event.loaded;
          const timeRemaining = finalSpeed > 0 ? remainingBytes / finalSpeed : 0;

          onProgress({
            percentage: Math.round((event.loaded / event.total) * 100),
            loaded: event.loaded,
            total: event.total,
            bytesPerSecond: Math.max(0, finalSpeed), // Ensure non-negative
            timeRemaining: Math.max(0, timeRemaining) // Ensure non-negative
          });
        }
      };

      // Response handling
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve();
        } else {
          reject(new Error(`Upload failed with status ${xhr.status}: ${xhr.responseText}`));
        }
      };

      xhr.onerror = () => reject(new Error("Network error during upload"));
      xhr.ontimeout = () => reject(new Error("Upload timed out"));

      // Handle abort signal
      if (signal) {
        if (signal.aborted) {
           xhr.abort();
           return reject(new DOMException('Upload aborted by user', 'AbortError'));
        }
        signal.addEventListener('abort', () => {
          xhr.abort();
          // Use DOMException for AbortError consistency
          reject(new DOMException('Upload aborted by user', 'AbortError'));
        });
      }

      // Start upload
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
    signal?: AbortSignal
  ): Promise<void> {
    const uploadUrl = `/api/proxy/video/library/${libraryId}/videos/${guid}`;
    const headers = {
      'AccessKey': apiKey,
      'Content-Type': 'application/octet-stream',
      'Accept': '*/*'
    };

    let loaded = 0;
    const total = file.size;
    let lastTimestamp = Date.now();
    let lastLoaded = 0;
    let startTimestamp = Date.now();
    let speedSamples: number[] = [];

    const reportProgress = () => {
      if (onProgress) {
        const now = Date.now();
        const timeDiff = (now - lastTimestamp) / 1000;
        const bytesDiff = loaded - lastLoaded;
        
        // Calculate current speed
        let currentSpeed = 0;
        if (timeDiff > 0.1) { // Only calculate if enough time has passed (100ms)
          currentSpeed = bytesDiff / timeDiff;
          
          // Add to speed samples for smoothing (keep last 10 samples)
          speedSamples.push(currentSpeed);
          if (speedSamples.length > 10) {
            speedSamples.shift();
          }
          
          lastLoaded = loaded;
          lastTimestamp = now;
        }
        
        // Calculate average speed from samples for smoother display
        const avgSpeed = speedSamples.length > 0 
          ? speedSamples.reduce((sum, speed) => sum + speed, 0) / speedSamples.length
          : 0;
        
        // Calculate overall average speed from start
        const totalElapsed = (now - startTimestamp) / 1000;
        const overallSpeed = totalElapsed > 0 ? loaded / totalElapsed : 0;
        
        // Use the more stable speed (prefer overall speed after first few seconds)
        const finalSpeed = totalElapsed > 3 ? overallSpeed : avgSpeed;
        
        // Calculate time remaining
        const remainingBytes = total - loaded;
        const timeRemaining = finalSpeed > 0 ? remainingBytes / finalSpeed : 0;

        onProgress({
          percentage: Math.round((loaded / total) * 100),
          loaded,
          total,
          bytesPerSecond: Math.max(0, finalSpeed), // Ensure non-negative
          timeRemaining: Math.max(0, timeRemaining) // Ensure non-negative
        });
      }
    };

    try {
      const progressStream = new ReadableStream({
        start(controller) {
          const reader = file.stream().getReader();

          function pump() {
            reader.read().then(({ done, value }) => {
              if (done) {
                controller.close();
                reportProgress();
                return;
              }
              loaded += value.length;
              controller.enqueue(value);
              reportProgress();
              pump();
            }).catch(error => {
              console.error("Stream read error:", error);
              controller.error(error);
            });
          }
          pump();

          if (signal) {
            if (signal.aborted) {
              reader.cancel('Upload aborted by user');
              controller.error(new DOMException('Upload aborted by user', 'AbortError'));
              return;
            }
            signal.addEventListener('abort', () => {
              reader.cancel('Upload aborted by user');
              controller.error(new DOMException('Upload aborted by user', 'AbortError'));
            });
          }
        }
      });

      const response = await fetch(uploadUrl, {
        method: 'PUT',
        headers,
        body: progressStream,
        signal
      });

      if (!response.ok) {
        throw new Error(`Upload failed with status ${response.status}: ${await response.text()}`);
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw error;
      }
      console.error('Stream upload failed:', error);
      throw new Error(`Stream upload failed: ${error.message}`);
    }
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
    retryCount = 0
  ): Promise<void> {
    const maxRetries = 3;
    try {
      await this.uploadVideoContentStream(file, libraryId, guid, apiKey, onProgress, signal);
    } catch (error) {
      if (retryCount < maxRetries) {
        console.log(`Upload failed, retrying (${retryCount + 1}/${maxRetries})...`);
        await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
        return this.uploadVideoContentWithRetry(file, libraryId, guid, apiKey, onProgress, signal, retryCount + 1);
      }
      throw error;
    }
  }

  /**
   * Upload video to Bunny.net using basic XHR (legacy method).
   */
  async uploadVideo(
    file: File,
    libraryId: string,
    onProgress?: (progress: UploadProgress) => void,
    collectionId?: string, // Should be GUID
    accessToken?: string,
    signal?: AbortSignal
  ): Promise<{ guid: string; title: string }> {
    // Clean invalid cached keys before starting upload
    console.log('[UploadService] Cleaning invalid cached API keys before upload');
    BunnyCacheCleaner.validateAndCleanCache();
    
    const apiKey = this.getApiKey(libraryId, accessToken);
    const { guid, title } = await this.createVideoEntry(file.name, libraryId, apiKey, collectionId);
    
    try {
      await this.uploadVideoContentWithRetry(file, libraryId, guid, apiKey, onProgress, signal);
      return { guid, title };
    } catch (error) {
      console.error('Upload failed:', error);
      throw error;
    }
  }
}