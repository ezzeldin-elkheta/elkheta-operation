import { HttpClient } from './bunny/http-client';
import { LibraryService } from './bunny/services/library-service';
import { CollectionService } from './bunny/services/collections-service';
import { VideoService } from './bunny/services/video-service';
import { BandwidthService } from './bunny/services/bandwidth-service';
import { UploadService } from './bunny/services/upload-service';
import { dataStorage } from './data-storage';
import { cache } from './cache';
import { BASE_URL, VIDEO_BASE_URL } from './bunny/constants';
import type { Library, Collection, UploadProgress } from './bunny/types';
import { LibraryData, LibraryInfo, CollectionInfo } from '@/types/library-data';
import { showToast } from '../hooks/use-toast';
import { SecureApiKeyStorage, secureLog } from './crypto-utils';

export { Collection };

/**
 * Main service that delegates to specialized services
 */
export class BunnyService {
  private baseUrl = BASE_URL;
  private videoBaseUrl = VIDEO_BASE_URL;
  private httpClient: HttpClient;
  
  private libraryService: LibraryService;
  private collectionService: CollectionService;
  private videoService: VideoService;
  private bandwidthService: BandwidthService;
  private uploadService: UploadService;
  private initialized = false;
  private initializationError: string | null = null;

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
    this.videoService = new VideoService(this.httpClient, this.videoBaseUrl);
    this.bandwidthService = new BandwidthService(this.httpClient);

    // Load cached library API keys from secure storage
    this.loadSecureApiKeys();
  }

  private loadSecureApiKeys(): void {
    try {
      // Load all secure API keys
      const allKeys = SecureApiKeyStorage.getAll();
      Object.entries(allKeys).forEach(([libraryId, encryptedKey]) => {
        const apiKey = SecureApiKeyStorage.retrieve(libraryId);
        if (apiKey) {
          this.httpClient.setLibraryApiKey(libraryId, apiKey);
          secureLog('Loaded secure API key for library', { libraryId });
        }
      });
    } catch (error) {
      console.error('Error loading secure API keys:', error);
    }
  }

  // Library management
  getLibraries = () => this.libraryService.getLibraries();
  getLibrary = (id: string) => this.libraryService.getLibrary(id);

  // Collection management
  getCollections = (libraryId: string) => this.collectionService.getCollections(libraryId);
  createCollection = (libraryId: string, name: string, accessToken?: string) => 
    this.collectionService.createCollection(libraryId, name, accessToken);

  // Video management
  getVideos = (libraryId: string, collectionId?: string, accessToken?: string) => 
    this.videoService.getVideos(libraryId, collectionId, accessToken);
  getVideoEmbedCode = (libraryId: string, videoGuid: string) => 
    this.videoService.getEmbedCode(libraryId, videoGuid);
  getVideoDetails = (libraryId: string, videoGuid: string, accessToken?: string) =>
    this.videoService.getVideoDetails(libraryId, videoGuid, accessToken);
  getAvailableQualities = (libraryId: string, videoGuid: string, accessToken?: string) =>
    this.videoService.getAvailableQualities(libraryId, videoGuid, accessToken);
  generateDownloadUrl = (libraryId: string, videoGuid: string, quality?: string, useMP4Fallback?: boolean) =>
    this.videoService.generateDownloadUrl(libraryId, videoGuid, quality, useMP4Fallback);

  // Upload operations
  uploadVideo = (
    file: File, 
    libraryId: string, 
    onProgress?: (progress: UploadProgress) => void, 
    collectionId?: string,
    accessToken?: string,
    signal?: AbortSignal
  ) => this.uploadService.uploadVideo(file, libraryId, onProgress, collectionId, accessToken, signal);

  uploadVideoWithStreams = (
    file: File, 
    libraryId: string, 
    onProgress?: (progress: UploadProgress) => void, 
    collectionId?: string,
    accessToken?: string,
    signal?: AbortSignal
  ) => this.uploadService.uploadVideoWithStreams(file, libraryId, onProgress, collectionId, accessToken, signal);

  // Bandwidth stats
  getBandwidthStats = () => this.bandwidthService.getBandwidthStats();

  // API key management
  setApiKey = (apiKey: string) => {
    if (!apiKey) {
      console.warn('Attempting to set empty API key');
      return;
    }

    // Update the API key in the HttpClient
    this.httpClient.setApiKey(apiKey);

    // Re-initialize all services with the updated HttpClient
    this.libraryService = new LibraryService(this.httpClient);
    this.collectionService = new CollectionService(this.httpClient, this.videoBaseUrl);
    this.videoService = new VideoService(this.httpClient, this.videoBaseUrl);
    this.bandwidthService = new BandwidthService(this.httpClient);
    this.uploadService = new UploadService(this.httpClient, this.videoBaseUrl);

    // Store the API key securely
    SecureApiKeyStorage.store('default', apiKey);
    cache.set('default_api_key', apiKey);
    secureLog('Default API key stored securely');
  };

  setDefaultApiKey = (apiKey: string) => {
    this.httpClient.setApiKey(apiKey);
    cache.set('default_api_key', apiKey);
    SecureApiKeyStorage.store('default', apiKey);
    secureLog('Default API key updated securely');
  };

  setLibraryApiKey = (libraryId: string, apiKey: string) => {
    // Update the library-specific API key in the HttpClient
    this.httpClient.setLibraryApiKey(libraryId, apiKey);

    // Store the library-specific API key securely
    SecureApiKeyStorage.store(libraryId, apiKey);
    secureLog('Library API key stored securely', { libraryId });
  };

  getLibraryApiKey = (libraryId: string): string | null => {
    return SecureApiKeyStorage.retrieve(libraryId);
  };

  removeLibraryApiKey = (libraryId: string): void => {
    SecureApiKeyStorage.remove(libraryId);
    secureLog('Library API key removed', { libraryId });
  };

  clearAllApiKeys = (): void => {
    SecureApiKeyStorage.clear();
    secureLog('All API keys cleared');
  };

  // Library data management
  async fetchAllLibraryData(mainApiKey: string) {
    // Update main API key
    this.httpClient.setApiKey(mainApiKey);
    
    try {
      // Get libraries with their API keys
      const libraries = await this.getLibraries();
      
      // Cache library API keys
      libraries.forEach(lib => {
        if (lib.apiKey) {
          this.httpClient.setLibraryApiKey(lib.id, lib.apiKey);
        }
      });
      
      // Get collections for each library
      const libraryInfos = await Promise.all(
        libraries.map(async (lib) => {
          let collections = [];
          try {
            collections = await this.getCollections(lib.id);
          } catch (error) {
            console.error(`Error fetching collections for library ${lib.name}:`, error);
          }
          
          return {
            id: lib.id,
            name: lib.name,
            apiKey: lib.apiKey,
            videoCount: 0,
            storageUsage: 0,
            trafficUsage: 0,
            dateCreated: new Date().toISOString(),
            replicationRegions: [],
            enabledResolutions: [],
            bitrate240p: 0,
            bitrate360p: 0,
            bitrate480p: 0,
            bitrate720p: 0,
            bitrate1080p: 0,
            bitrate1440p: 0,
            bitrate2160p: 0,
            allowDirectPlay: true,
            enableMP4Fallback: true,
            keepOriginalFiles: true,
            playerKeyColor: '#000000',
            fontFamily: 'Arial',
            StorageZoneId: "0",
            PullZoneId: "0",
            collections: collections.map(col => ({
              id: col.id,
              guid: col.id,
              name: col.name,
              videoCount: 0,
              totalSize: 0,
              previewVideoIds: null,
              previewImageUrls: [],
              dateCreated: new Date().toISOString()
            }))
          };
        })
      );

      const libraryData = {
        lastUpdated: new Date().toISOString(),
        libraries: libraryInfos,
        mainApiKey
      };
      
      // Save to persistent storage
      await dataStorage.saveLibraryData(libraryData);
      
      return libraryData;
    } catch (error) {
      console.error("Error fetching library data:", error);
      throw error;
    }
  }

  // Initialization methods
  async initialize(): Promise<void> {
    try {
      const savedData = await dataStorage.getLibraryData();
      if (savedData) {
        // Set main API key
        if (savedData.mainApiKey) {
          this.httpClient.setApiKey(savedData.mainApiKey);
        }
        
        // Cache library API keys
        savedData.libraries.forEach(lib => {
          if (lib.apiKey) {
            this.httpClient.setLibraryApiKey(lib.id, lib.apiKey);
          }
        });
        
        this.initialized = true;
        return;
      }

      // If no saved data, we'll wait for manual initialization
      console.log('No saved library data found. Please use Update Library Data to initialize.');
    } catch (error) {
      console.error('Error initializing BunnyService:', error);
      this.initializationError = error instanceof Error ? error.message : String(error);
    }
  }

  async updateLibraryData(mainApiKey: string): Promise<LibraryData> {
    try {
      // Update main API key
      this.httpClient.setApiKey(mainApiKey);
      cache.set('default_api_key', mainApiKey);
      
      // Get libraries with their API keys
      const libraries = await this.getLibraries();
      
      // Cache library API keys in HttpClient and cache
      libraries.forEach(lib => {
        if (lib.apiKey) {
          this.httpClient.setLibraryApiKey(lib.id, lib.apiKey);
          cache.set(`library_${lib.id}_data`, lib);
          secureLog('Cached API key for library', { libraryId: lib.id });
        }
      });

      // Create library data object
      const libraryData = {
        lastUpdated: new Date().toISOString(),
        libraries: libraries,
        mainApiKey
      };

      // Save to secure storage
      await dataStorage.saveLibraryData(libraryData);
      
      return libraryData;
    } catch (error) {
      console.error("Error fetching library data:", error);
      throw error;
    }
  }
}

export const bunnyService = new BunnyService();