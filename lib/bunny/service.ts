import { HttpClient } from '../../src/lib/bunny/http-client';
// Corrected import paths to point to the 'services' subdirectory
import { LibraryService } from '../../src/lib/bunny/services/library-service';
import { CollectionService } from '../../src/lib/bunny/services/collections-service';
import { VideoService } from '../../src/lib/bunny/services/video-service';
import { BandwidthService } from '../../src/lib/bunny/services/bandwidth-service';
import { UploadService } from '../../src/lib/bunny/services/upload-service'; // Corrected path for UploadService
import { dataStorage } from '../../src/lib/data-storage';
import { cache } from '../../src/lib/cache';
import type { UploadProgress, Collection, Video, Library } from '../../src/lib/bunny/types'; // Import necessary types

export class BunnyService {
  private baseUrl = "https://api.bunny.net";
  private videoBaseUrl = "https://video.bunnycdn.com";
  private httpClient: HttpClient;

  private libraryService: LibraryService;
  private collectionService: CollectionService;
  private videoService: VideoService;
  private bandwidthService: BandwidthService;
  private uploadService: UploadService;

  private publicApiKey: string;
  private currentLibraryKey: string | null = null;
  private apiKey: string;
  private initialized = false;
  private initializationError: string | null = null;

  constructor() {
    this.publicApiKey = import.meta.env.VITE_BUNNY_API_KEY || "";
    this.apiKey = this.publicApiKey;

    if (this.publicApiKey) {
      cache.set('default_api_key', this.publicApiKey);
    }

    const storedApiKey = localStorage.getItem("bunny_api_key");
    if (storedApiKey) {
      this.currentLibraryKey = storedApiKey;
    }

    // Pass videoBaseUrl to services that need it
    this.httpClient = new HttpClient(this.baseUrl, this.apiKey);
    this.libraryService = new LibraryService(this.httpClient);
    this.collectionService = new CollectionService(this.httpClient, this.videoBaseUrl); // Pass videoBaseUrl
    this.videoService = new VideoService(this.httpClient, this.videoBaseUrl); // Pass videoBaseUrl
    this.bandwidthService = new BandwidthService(this.httpClient);
    this.uploadService = new UploadService(this.httpClient, this.videoBaseUrl); // Pass videoBaseUrl
  }

  async initialize(): Promise<void> {
    try {
      const savedData = dataStorage.getLibraryData();
      if (savedData) {
        this.setLibraryApiKey('default', savedData.mainApiKey);
        savedData.libraries.forEach(lib => {
          if (lib.apiKey) {
            cache.set(`library_${lib.id}_api`, lib.apiKey);
          }
        });
        this.initialized = true; // Mark as initialized if loaded from storage
        return;
      }

      await this.initializeFromAPI();
    } catch (error) {
      console.error('Error initializing BunnyService:', error);
      this.initializationError = error instanceof Error ? error.message : String(error);
      // Don't re-throw here, allow the app to potentially function with cached/default keys
    }
  }

  // Add the missing initializeFromAPI method
  private async initializeFromAPI(): Promise<void> {
    console.log("Initializing BunnyService from API...");
    try {
      // Fetch libraries using the main API key
      const libraries = await this.libraryService.getLibraries();

      // Store library data (including API keys if available)
      const libraryData = {
        lastUpdated: new Date().toISOString(),
        libraries: libraries.map(lib => ({
          id: lib.id,
          name: lib.name,
          apiKey: lib.apiKey, // Store API key if present
          collections: [] // Initialize collections, fetch later if needed
        })),
        mainApiKey: this.publicApiKey
      };

      await dataStorage.saveLibraryData(libraryData);

      // Cache API keys
      libraries.forEach(lib => {
        if (lib.apiKey) {
          cache.set(`library_${lib.id}_api`, lib.apiKey);
        }
      });

      console.log("Initialization from API complete.");
      this.initialized = true;
    } catch (error) {
      console.error('Error initializing from API:', error);
      this.initializationError = error instanceof Error ? error.message : String(error);
      throw error; // Re-throw error during initial API fetch
    }
  }

  setLibraryApiKey(libraryId: string, apiKey: string): void {
    cache.set(`library_${libraryId}_api`, apiKey);
    if (apiKey) {
      this.currentLibraryKey = apiKey;
      localStorage.setItem("bunny_api_key", apiKey);
      // Update HttpClient's default key if this is the main key being set
      if (libraryId === 'default') {
        this.httpClient.setApiKey(apiKey);
      }
    }
  }

  // Delegate methods to specific services
  getLibraries = (): Promise<Library[]> => this.libraryService.getLibraries();
  getLibrary = (libraryId: string): Promise<Library | null> => this.libraryService.getLibrary(libraryId);
  getCollections = (libraryId: string): Promise<Collection[]> => this.collectionService.getCollections(libraryId);
  // Update createCollection to accept accessToken
  createCollection = (libraryId: string, name: string, accessToken?: string): Promise<Collection> =>
    this.collectionService.createCollection(libraryId, name, accessToken);
  getVideos = (libraryId: string, collectionId?: string, accessToken?: string): Promise<Video[]> =>
    this.videoService.getVideos(libraryId, collectionId, accessToken); // Pass accessToken
  getVideoEmbedCode = (libraryId: string, videoGuid: string): string => // Return type is string, not Promise<string>
    this.videoService.getEmbedCode(libraryId, videoGuid);

  // Upload operations
  uploadVideo = (
    file: File,
    libraryId: string,
    onProgress?: (progress: UploadProgress) => void,
    collectionId?: string, // This should be the GUID
    accessToken?: string,
    signal?: AbortSignal
  ): Promise<{ guid: string; title: string }> => this.uploadService.uploadVideo(file, libraryId, onProgress, collectionId, accessToken, signal);

  // Add this method to expose the streaming upload functionality
  uploadVideoWithStreams = (
    file: File,
    libraryId: string,
    onProgress?: (progress: UploadProgress) => void,
    collectionId?: string, // This should be the GUID
    accessToken?: string,
    signal?: AbortSignal
  ): Promise<{ guid: string; title: string }> => this.uploadService.uploadVideoWithStreams(file, libraryId, onProgress, collectionId, accessToken, signal);

  getBandwidthStats = () => this.bandwidthService.getBandwidthStats();
}

export const bunnyService = new BunnyService();
