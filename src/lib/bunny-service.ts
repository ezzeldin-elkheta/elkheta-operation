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
    this.httpClient = new HttpClient(this.baseUrl, '');
    
    // Initialize services
    this.uploadService = new UploadService(this.httpClient, '/api/proxy/video');
    this.libraryService = new LibraryService(this.httpClient);
    this.collectionService = new CollectionService(this.httpClient, '/api/proxy/video');
    this.videoService = new VideoService(this.httpClient, this.videoBaseUrl);
    this.bandwidthService = new BandwidthService(this.httpClient);
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

    // Store the API key in localStorage for persistence
    localStorage.setItem("bunny_api_key", apiKey);
    cache.set('default_api_key', apiKey);
  };

  setDefaultApiKey = (apiKey: string) => {
    this.httpClient.setApiKey(apiKey);
    cache.set('default_api_key', apiKey);
  };

  setLibraryApiKey = (libraryId: string, apiKey: string) => {
    // Update the library-specific API key in the HttpClient
    this.httpClient.setLibraryApiKey(libraryId, apiKey);

    // Store the library-specific API key in localStorage for persistence
    const libraryApiKeys = JSON.parse(localStorage.getItem("bunny_library_api_keys") || "{}");
    libraryApiKeys[libraryId] = apiKey;
    localStorage.setItem("bunny_library_api_keys", JSON.stringify(libraryApiKeys));
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
          cache.set(`library_${lib.id}_api`, lib.apiKey);
        }
      });
      
      // Get collections for each library
      const libraryInfos: LibraryInfo[] = await Promise.all(
        libraries.map(async (lib) => {
          let collections: CollectionInfo[] = [];
          try {
            const apiCollections = await this.getCollections(lib.id);
            collections = apiCollections.map(col => ({
              id: col.id,
              guid: col.id,
              name: col.name,
              videoCount: 0,
              totalSize: 0,
              previewVideoIds: null,
              previewImageUrls: [],
              dateCreated: new Date().toISOString()
            }));
          } catch (error) {
            console.error(`Error fetching collections for library ${lib.name}:`, error);
          }
          
          const libraryInfo: LibraryInfo = {
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
            collections
          };
          
          return libraryInfo;
        })
      );

      const data: LibraryData = {
        lastUpdated: new Date().toISOString(),
        libraries: libraryInfos,
        mainApiKey
      };

      // Save to persistent storage AND cache
      console.log("About to save library data");
      await dataStorage.saveLibraryData(data);
      
      // Also cache the data for immediate access
      cache.set('library_data', data);
      
      console.log("Library data saved successfully");

      // Verify the save worked by doing a test read
      try {
        const testRead = dataStorage.getLibraryData();
        console.log("Verification read success:", !!testRead);
      } catch (verifyError) {
        console.error("Verification read failed:", verifyError);
      }

      showToast({
        title: "🔄 Library Update Complete",
        description: `Updated ${libraryInfos.length} libraries\nTotal collections: ${
          libraryInfos.reduce((acc, lib) => acc + (lib.collections?.length || 0), 0)
        }`,
        variant: "success",
        duration: 5000
      });

      return data;

    } catch (error) {
      showToast({
        title: "❌ Library Update Failed", 
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive",
        duration: 5000
      });
      throw error;
    }
  }
}

// Export a singleton instance
export const bunnyService = new BunnyService();
