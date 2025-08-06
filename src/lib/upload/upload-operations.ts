import { QueueItem, UploadResult, UploadSettings } from "./types";
import { bunnyService } from "../bunny-service";
import { dataStorage } from "../data-storage";
import { showToast } from "../../hooks/use-toast";
import { formatBytes } from "../utils";
import { cache } from "../cache";
import { Library, Collection } from './types';
import { BunnyService } from '../bunny-service';

interface UploadMetadata {
  library: string;
  collection: string;
  year: string;
  needsManualSelection?: boolean;
  reason?: string;
  libraryName?: string;
  collectionName?: string;
  confidence?: number;
  suggestedCollection?: string;
  suggestedLibraryName?: string;
  suggestedLibraries?: { id: string; name: string }[];
  apiKey?: string;
}

const DEFAULT_UPLOAD_SETTINGS: UploadSettings = {
  chunkSize: 5 * 1024 * 1024,
  maxConcurrentUploads: 1,
  useStreaming: true,
  retryAttempts: 3,
  useTusThresholdMB: 100,
  timeoutMs: 30000,
  retryDelays: [1000, 2000, 4000],
  enableResumableSessions: true,
  sessionExpiryHours: 24,
  enableAutoRetry: true,
  enableConnectionCheck: true
};

export class UploadOperations {
  private uploadResults: UploadResult[] = [];
  private settings: UploadSettings = DEFAULT_UPLOAD_SETTINGS;

  constructor() {
    this.uploadResults = [];
  }

  setSettings(settings: Partial<UploadSettings>): void {
    this.settings = { ...this.settings, ...settings };
  }

  getUploadResults(): UploadResult[] {
    return this.uploadResults;
  }

  setUploadResults(results: UploadResult[]): void {
    this.uploadResults = results;
  }

  clearUploadResults(): void {
    this.uploadResults = [];
  }

  /**
   * Upload a single file
   */
  async uploadFile(
    item: QueueItem,
    onProgressUpdate: () => void,
    onVideoUploaded?: (videoTitle: string, videoGuid: string, libraryId: string) => void
  ): Promise<void> {
    const startTime = Date.now();
    
    try {
      // Create library and collection objects
      const library: Library = {
        id: item.metadata.library,
        name: item.metadata.libraryName || item.metadata.library,
        apiKey: item.metadata.apiKey || 'default_key'
      };

      // Use collection from metadata, or fallback to suggestedCollection
      const collectionName = item.metadata.collection && item.metadata.collection.trim() !== ''
        ? item.metadata.collection
        : (item.metadata.suggestedCollection || '');

      const collection: Collection = {
        id: collectionName,
        name: collectionName,
        libraryId: item.metadata.library
      };

      // Ensure we propagate the resolved collection back to metadata for consistency
      if (!item.metadata.collection && collectionName) {
        item.metadata.collection = collectionName;
      }

      console.log(`[UploadOperations] Starting upload for ${item.filename}`);

      // Initialize file size tracking
      item.totalSize = item.file.size;
      item.uploadedSize = 0;
      item.uploadSpeed = 0;
      item.timeRemaining = 0;
      item.startTime = Date.now(); // Track when upload started

      // Call initial progress update to show file size immediately
      onProgressUpdate();

      // Call upload service
      const result = await bunnyService.uploadVideo(
        item.file,
        library.id,
        (progress) => {
          // Update all progress-related properties for real-time display
          item.progress = progress.percentage;
          item.uploadedSize = progress.loaded;
          item.totalSize = progress.total;
          item.uploadSpeed = progress.bytesPerSecond && progress.bytesPerSecond > 0
            ? progress.bytesPerSecond
            : (() => {
                // Fallback calculation if bytesPerSecond is zero or undefined
                const elapsed = (Date.now() - (item.startTime || Date.now())) / 1000;
                return elapsed > 0 ? progress.loaded / elapsed : 0;
              })();
          
          // Calculate time remaining if speed is available
          if (item.uploadSpeed && item.uploadSpeed > 0) {
            const remainingBytes = progress.total - progress.loaded;
            item.timeRemaining = Math.max(0, remainingBytes / item.uploadSpeed);
          } else {
            item.timeRemaining = 0;
          }
          
          // Enhanced debugging for speed tracking - only log every 10% progress or significant speed changes
          if (item.uploadSpeed && item.uploadSpeed > 0) {
            const progressPercent = Math.floor(progress.percentage);
            const lastLoggedPercent = item.lastLoggedPercent || 0;
            
            // Log only at 10% intervals or when speed changes significantly
            if (progressPercent >= lastLoggedPercent + 10 || 
                (item.lastLoggedSpeed && Math.abs(item.uploadSpeed - item.lastLoggedSpeed) > item.lastLoggedSpeed * 0.3)) {
              console.log(`[Upload] ${item.filename}: ${progress.percentage.toFixed(1)}% - ${formatBytes(item.uploadSpeed, 1)}/s`);
              item.lastLoggedPercent = progressPercent;
              item.lastLoggedSpeed = item.uploadSpeed;
            }
          }
          
          onProgressUpdate();
        },
        collection.id || undefined,
        undefined, // accessToken
        item.controller?.signal
      );

      const endTime = Date.now();
      const duration = (endTime - startTime) / 1000;

      // *** FIX: Only create ONE upload result per file ***
      const uploadResult: UploadResult = {
        filename: item.filename,
        status: 'completed',
        message: `Successfully uploaded to ${library.name} (Collection: ${collection.name})`,
        library: library.id,
        collection: collection.name,
        details: {
          uploadStatus: result.warning ? 'duplicate' : 'success',
          videoGuid: result.guid,
          duration: duration,
          size: item.file.size,
          uploadSpeed: item.file.size / duration,
          uploadDuration: duration,
          directPlayUrl: `https://iframe.mediadelivery.net/play/${library.id}/${result.guid}`,
          embedCode: `https://video.bunnycdn.com/embed/${result.guid}`,
          sheetStatus: 'pending',
          sheetUpdateDetails: {
            status: 'pending',
            message: 'Waiting for sheet update...'
          }
        }
      };

      // Check if result already exists to prevent duplication
      const existingIndex = this.uploadResults.findIndex(r => r.filename === item.filename);
      if (existingIndex !== -1) {
        // Update existing result instead of adding new one
        this.uploadResults[existingIndex] = uploadResult;
      } else {
        // Add new result
        this.uploadResults.push(uploadResult);
      }

      // Update item status
      item.status = 'completed';
      item.progress = 100;

      // Call the video uploaded callback
      if (onVideoUploaded && result.guid) {
        onVideoUploaded(item.filename, result.guid, library.id);
      }

      // Only log completion for large files or errors
      if (item.file.size > 50 * 1024 * 1024) {
        console.log(`[Upload] ✅ ${item.filename} completed (${(item.file.size / 1024 / 1024).toFixed(1)}MB)`);
      }

    } catch (error) {
      const endTime = Date.now();
      const duration = (endTime - startTime) / 1000;
      
      console.error(`[UploadOperations] Upload failed for ${item.filename}:`, error);

      // Create error result
      const errorResult: UploadResult = {
        filename: item.filename,
        status: 'error',
        message: error instanceof Error ? error.message : String(error),
        library: item.metadata.library,
        collection: item.metadata.collection,
        details: {
          uploadStatus: 'error',
          sheetStatus: 'error',
          errorDetails: error instanceof Error ? error.message : String(error),
          duration: duration,
          size: item.file.size
        }
      };

      // Check if result already exists to prevent duplication
      const existingIndex = this.uploadResults.findIndex(r => r.filename === item.filename);
      if (existingIndex !== -1) {
        this.uploadResults[existingIndex] = errorResult;
      } else {
        this.uploadResults.push(errorResult);
      }

      // Update item status
      item.status = 'error';
      item.errorMessage = error instanceof Error ? error.message : String(error);

      throw error;
    }
  }

  /**
   * Upload file with direct XHR control
   */
  private uploadFileWithXHR(
    file: File,
    libraryId: string,
    guid: string,
    onProgress?: (progress: any) => void,
    apiKey?: string,
    signal?: AbortSignal
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const uploadUrl = `/api/proxy/video/library/${libraryId}/videos/${guid}`;
      
      xhr.open("PUT", uploadUrl, true);
      
      if (!apiKey) {
        reject(new Error("API key not found for upload"));
        return;
      }
      
      xhr.setRequestHeader('AccessKey', apiKey);
      xhr.setRequestHeader('Content-Type', 'application/octet-stream');
      xhr.setRequestHeader('Accept', '*/*');
      xhr.setRequestHeader('Cache-Control', 'no-cache');
      
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable && onProgress) {
          const percent = Math.round((event.loaded / event.total) * 100);
          const now = Date.now();
          const startTime = file.lastModified || Date.now() - 1000;
          const elapsedSeconds = (now - startTime) / 1000;
          const bytesPerSecond = elapsedSeconds > 0 ? event.loaded / elapsedSeconds : 0;

          onProgress({
            percentage: percent,
            loaded: event.loaded,
            total: event.total,
            bytesPerSecond
          });
        }
      };
      
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve();
        } else {
          reject(new Error(`Upload failed with status ${xhr.status}: ${xhr.responseText || 'No error details'}`));
        }
      };
      
      xhr.onerror = () => reject(new Error("Network error during upload"));
      xhr.ontimeout = () => reject(new Error("Upload timed out"));
      
      if (signal) {
        if (signal.aborted) {
          xhr.abort();
          reject(new DOMException("Upload aborted by user", "AbortError"));
          return;
        }
        signal.addEventListener('abort', () => {
          xhr.abort();
          reject(new DOMException("Upload aborted by user", "AbortError"));
        });
      }
      
      xhr.send(file);
    });
  }

  /**
   * Find library by identifier
   */
  private async findLibrary(identifier: string): Promise<Library> {
    try {
      // First check cache/storage
      const libraryData = await dataStorage.getLibraryData();
      if (libraryData?.libraries) {
        const library = libraryData.libraries.find(l => l.id === identifier || l.name === identifier);
        if (library) {
          console.log(`[UploadOperations] Found library in storage: ${library.name} (${library.id})`);
          return {
            id: library.id,
            name: library.name,
            apiKey: library.apiKey
          };
        }
      }

      // If not found in cache, try API
      console.log(`[UploadOperations] Looking up library via API: ${identifier}`);
      const libraries = await bunnyService.getLibraries();
      const library = libraries.find(l => l.id === identifier);
      
      if (!library) {
        throw new Error(`Library not found: ${identifier}`);
      }

      // Return the library without updating the cache
      return {
        id: library.id,
        name: library.name,
        apiKey: library.apiKey
      };
    } catch (error) {
      console.error(`[UploadOperations] Error finding library ${identifier}:`, error);
      throw new Error(`Library not found or inaccessible: ${identifier}`);
    }
  }
}
