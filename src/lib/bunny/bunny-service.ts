import { UploadService } from './services/upload-service';
import { HttpClient } from './http-client';
import { UploadProgress, UploadSettings } from '../upload/types';
import { cache } from '../cache';
import { LibraryService } from './services/library-service';
import { CollectionService } from './services/collections-service';
import { encryptApiKey, decryptApiKey } from '../crypto-utils';

export class BunnyService {
  private uploadService: UploadService;
  private httpClient: HttpClient;
  private libraryService: LibraryService;
  private collectionService: CollectionService;

  constructor() {
    // Get the default API key from cache
    const defaultApiKey = cache.get('default_api_key') || '';
    
    // Initialize HTTP client with base URL and default API key
    this.httpClient = new HttpClient(
      'https://api.bunny.net', 
      defaultApiKey
    );
    
    // Initialize services
    this.uploadService = new UploadService(this.httpClient, '/api/proxy/video');
    this.libraryService = new LibraryService(this.httpClient);
    this.collectionService = new CollectionService(this.httpClient, '/api/proxy/video');

    // Load cached library API keys
    const appCache = localStorage.getItem('app_cache');
    if (appCache) {
      try {
        const parsed = JSON.parse(appCache);
        Object.entries(parsed).forEach(([key, value]) => {
          if (key.startsWith('library_') && key.endsWith('_api')) {
            try {
              const libraryId = key.replace('library_', '').replace('_api', '');
              const decryptedKey = decryptApiKey(value as string);
              this.httpClient.setLibraryApiKey(libraryId, decryptedKey);
            } catch (error) {
              console.warn(`Failed to decrypt API key for library, skipping...`);
            }
          }
        });
      } catch (error) {
        console.warn('Error loading library API keys from cache');
      }
    }
  }

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
      if (settings?.useStreaming) {
        return await this.uploadService.uploadVideoWithStreams(
          file,
          libraryId,
          onProgress,
          collectionId,
          accessToken,
          signal
        );
      } else {
        return await this.uploadService.uploadVideo(
          file,
          libraryId,
          onProgress,
          collectionId,
          accessToken,
          signal
        );
      }
    } catch (error) {
      console.error('[BunnyService] Upload error:', error);
      throw error;
    }
  }
  
  /**
   * Get all libraries
   */
  async getLibraries() {
    return this.libraryService.getLibraries();
  }
  
  /**
   * Get a specific library by ID
   */
  async getLibrary(id: string) {
    return this.libraryService.getLibrary(id);
  }
  
  /**
   * Get all collections for a specific library
   */
  async getCollections(libraryId: string) {
    return this.collectionService.getCollections(libraryId);
  }
  
  /**
   * Set the default API key for all requests
   */
  setDefaultApiKey(apiKey: string) {
    this.httpClient.setApiKey(apiKey);
  }
  
  /**
   * Set a library-specific API key
   */
  setLibraryApiKey(libraryId: string, apiKey: string) {
    this.httpClient.setLibraryApiKey(libraryId, apiKey);
  }
} 