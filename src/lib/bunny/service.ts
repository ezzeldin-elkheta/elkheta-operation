import { HttpClient } from './http-client';
// Corrected import paths to point to the 'services' subdirectory
import { LibraryService } from './services/library-service';
import { CollectionService } from './services/collections-service';
import { VideoService } from './services/video-service';
import { BandwidthService } from './services/bandwidth-service';
import { ViewsService } from './services/views-service';
import { UploadService } from './services/upload-service'; // Corrected path for UploadService
import { dataStorage } from '../data-storage';
import { cache } from '../cache';
import { getBunnyApiKey, env } from '../env'; // Use centralized env config
import type { UploadProgress, Collection, Video, Library } from './types'; // Import necessary types
import type { LibraryData } from '../../types/library-data';

export class BunnyService {
  private baseUrl = import.meta.env.PROD 
    ? "https://014-ju3s3rfx7-ezzeldinelkhateebs-projects.vercel.app" 
    : "http://localhost:800";  // Use production URL in production, local proxy in dev
  private videoBaseUrl = import.meta.env.PROD 
    ? "https://014-ju3s3rfx7-ezzeldinelkhateebs-projects.vercel.app" 
    : "http://localhost:800";  // Use production URL in production, local proxy in dev
  private httpClient: HttpClient;

  private libraryService: LibraryService;
  private collectionService: CollectionService;
  private videoService: VideoService;
  private bandwidthService: BandwidthService;
  private viewsService: ViewsService;
  private uploadService: UploadService;

  private publicApiKey: string;
  private currentLibraryKey: string | null = null;
  private apiKey: string;
  private initialized = false;
  private initializationError: string | null = null;
  private mainApiKey: string;

  constructor() {
    // Try to use environment configuration but don't fail if not available
    try {
      this.publicApiKey = getBunnyApiKey();
      this.apiKey = this.publicApiKey;
      this.mainApiKey = this.publicApiKey;
      cache.set('default_api_key', this.publicApiKey);
      console.log('[BunnyService] Initialized with environment API key');
    } catch (error) {
      console.warn('[BunnyService] No environment API key found, will use library-specific keys:', error.message);
      // Set empty values and rely on library-specific keys
      this.publicApiKey = "";
      this.apiKey = "";
      this.mainApiKey = "";
    }
    
    // Initialize HTTP client and services regardless of API key availability
    this.httpClient = new HttpClient(this.apiKey || undefined);
    this.libraryService = new LibraryService(this.httpClient);
    this.collectionService = new CollectionService(this.httpClient, this.videoBaseUrl);
    this.videoService = new VideoService(this.httpClient, this.videoBaseUrl);
    this.bandwidthService = new BandwidthService(this.httpClient);
    this.viewsService = new ViewsService(this.httpClient);
    this.uploadService = new UploadService(this.httpClient, this.videoBaseUrl);
  }

  async initialize(): Promise<void> {
    try {
      const savedData = await dataStorage.getLibraryData();
      if (savedData) {
        console.log('[BunnyService] Loading saved library data');
        // Set main API key if available
        if (savedData.mainApiKey) {
          this.mainApiKey = savedData.mainApiKey;
          this.httpClient.setApiKey(savedData.mainApiKey);
          cache.set('default_api_key', savedData.mainApiKey);
        }
        
        // Store library-specific API keys
        savedData.libraries.forEach(lib => {
          if (lib.apiKey) {
            this.httpClient.setLibraryApiKey(lib.id, lib.apiKey);
            cache.set(`library_${lib.id}_data`, lib);
            console.log(`[BunnyService] Stored API key for library ${lib.id}`);
          }
        });
        this.initialized = true;
        return;
      }

      console.log('[BunnyService] No saved data, initializing from API');
      const data = await this.initializeFromAPI();
      
      // Set main API key if available
      if (data.mainApiKey) {
        this.mainApiKey = data.mainApiKey;
        this.httpClient.setApiKey(data.mainApiKey);
        cache.set('default_api_key', data.mainApiKey);
      }
      
      // Store library-specific API keys
      data.libraries.forEach(lib => {
        if (lib.apiKey) {
          this.httpClient.setLibraryApiKey(lib.id, lib.apiKey);
          cache.set(`library_${lib.id}_data`, lib);
          console.log(`[BunnyService] Stored API key for library ${lib.id}`);
        }
      });
      
      this.initialized = true;
    } catch (error) {
      console.error('Error initializing BunnyService:', error);
      this.initializationError = error instanceof Error ? error.message : String(error);
    }
  }

  private async storeLibraryData(data: LibraryData): Promise<void> {
    await dataStorage.saveLibraryData(data);
  }

  private async initializeFromAPI(): Promise<LibraryData> {
    try {
      const libraries = await this.libraryService.getLibraries();
      const data: LibraryData = {
        lastUpdated: new Date().toISOString(),
        date: new Date(),
        libraries,
        mainApiKey: this.apiKey
      };
      await this.storeLibraryData(data);
      return data;
    } catch (error) {
      console.error('Failed to initialize from API:', error);
      throw error;
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
      } else {
        // Set the library-specific key in HttpClient
        this.httpClient.setLibraryApiKey(libraryId, apiKey);
        cache.set(`library_${libraryId}_data`, { 
          id: libraryId, 
          apiKey: apiKey 
        });
        console.log(`[BunnyService] Set API key for library ${libraryId}`);
      }
    }
  }

  // Delegate methods to specific services
  getLibraries = (): Promise<Library[]> => this.libraryService.getLibraries();
  getLibrary = (libraryId: string): Promise<Library | null> => this.libraryService.getLibrary(libraryId); // Fix return type
  getCollections = (libraryId: string): Promise<Collection[]> => this.collectionService.getCollections(libraryId);
  // Update createCollection to accept accessToken
  createCollection = (libraryId: string, name: string, accessToken?: string): Promise<Collection> =>
    this.collectionService.createCollection(libraryId, name, accessToken);
  
  getVideos = (libraryId: string, collectionId?: string, accessToken?: string): Promise<Video[]> =>
    this.videoService.getVideos(libraryId, collectionId, accessToken);
  getVideoEmbedCode = (libraryId: string, videoGuid: string): string =>
    this.videoService.getEmbedCode(libraryId, videoGuid);
  getVideoDetails = (libraryId: string, videoGuid: string, accessToken?: string) =>
    this.videoService.getVideoDetails(libraryId, videoGuid, accessToken);

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
  
  // Views statistics methods
  getViewsStats = () => this.viewsService.getAllLibrariesViewsStats();
  getMonthlyViews = (year: number, month: number) => this.viewsService.getMonthlyViewsForAllLibraries(year, month);
  
  // Video download URL generation
  generateDownloadUrl = (libraryId: string, videoGuid: string, quality?: string): string =>
    this.videoService.generateDownloadUrl(libraryId, videoGuid, quality);
    
  generateMultipleDownloadUrls = (libraryId: string, videoGuid: string, quality?: string): string[] =>
    this.videoService.generateMultipleDownloadUrls(libraryId, videoGuid, quality);
}

export const bunnyService = new BunnyService();
