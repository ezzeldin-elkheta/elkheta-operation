import { HttpClient } from './http-client';
import { Library } from './types';
import { cache } from '../cache'; // Corrected path

interface LibraryResponse {
  Id: string;
  Name: string;
  VideoCount: number;
  StorageUsage: number;
  TrafficUsage: number;
  DateCreated: string;
  ApiKey: string;
  ReplicationRegions: string[];
  EnabledResolutions: string[];
  Bitrate240p: number;
  Bitrate360p: number;
  Bitrate480p: number;
  Bitrate720p: number;
  Bitrate1080p: number;
  Bitrate1440p: number;
  Bitrate2160p: number;
  AllowDirectPlay: boolean;
  EnableMP4Fallback: boolean;
  KeepOriginalFiles: boolean;
  PlayerKeyColor: string;
  FontFamily: string;
}

interface LibrariesResponse {
  Items: LibraryResponse[];
  TotalItems: number;
}

export class LibraryService {
  constructor(private httpClient: HttpClient) {}

  /**
   * Get all libraries from the Bunny.net API with pagination
   */
  async getLibraries(): Promise<Library[]> {
    const response = await this.httpClient.fetchWithError<LibrariesResponse>('/library');
    const libraries = response.Items.map(lib => ({
      id: lib.Id,
      name: lib.Name,
      videoCount: lib.VideoCount,
      storageUsage: lib.StorageUsage,
      trafficUsage: lib.TrafficUsage,
      dateCreated: lib.DateCreated,
      apiKey: lib.ApiKey,
      replicationRegions: lib.ReplicationRegions,
      enabledResolutions: lib.EnabledResolutions,
      bitrate240p: lib.Bitrate240p,
      bitrate360p: lib.Bitrate360p,
      bitrate480p: lib.Bitrate480p,
      bitrate720p: lib.Bitrate720p,
      bitrate1080p: lib.Bitrate1080p,
      bitrate1440p: lib.Bitrate1440p,
      bitrate2160p: lib.Bitrate2160p,
      allowDirectPlay: lib.AllowDirectPlay,
      enableMP4Fallback: lib.EnableMP4Fallback,
      keepOriginalFiles: lib.KeepOriginalFiles,
      playerKeyColor: lib.PlayerKeyColor,
      fontFamily: lib.FontFamily
    }));

    // Cache library API keys
    libraries.forEach(lib => {
      if (lib.apiKey) {
        cache.set(`library_${lib.id}_api`, lib.apiKey);
      }
    });

    return libraries;
  }

  /**
   * Get a specific library by ID
   */
  async getLibrary(libraryId: string): Promise<Library> {
    const response = await this.httpClient.fetchWithError<LibraryResponse>(`/library/${libraryId}`);
    return {
      id: response.Id,
      name: response.Name,
      videoCount: response.VideoCount,
      storageUsage: response.StorageUsage,
      trafficUsage: response.TrafficUsage,
      dateCreated: response.DateCreated,
      apiKey: response.ApiKey,
      replicationRegions: response.ReplicationRegions,
      enabledResolutions: response.EnabledResolutions,
      bitrate240p: response.Bitrate240p,
      bitrate360p: response.Bitrate360p,
      bitrate480p: response.Bitrate480p,
      bitrate720p: response.Bitrate720p,
      bitrate1080p: response.Bitrate1080p,
      bitrate1440p: response.Bitrate1440p,
      bitrate2160p: response.Bitrate2160p,
      allowDirectPlay: response.AllowDirectPlay,
      enableMP4Fallback: response.EnableMP4Fallback,
      keepOriginalFiles: response.KeepOriginalFiles,
      playerKeyColor: response.PlayerKeyColor,
      fontFamily: response.FontFamily
    };
  }
}
