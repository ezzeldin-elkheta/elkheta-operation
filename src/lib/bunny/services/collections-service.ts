import { HttpClient, BunnyResponse } from '../http-client';
import { Collection } from '../types';
import { cache } from '../../cache';
import { LibraryService } from './library-service';

interface CollectionResponse {
  id: string;
  guid: string;
  name: string;
  videoCount: number;
  totalSize: number;
  dateCreated: string;
  pullZoneId?: number;
  storageZoneId?: number;
  previewVideoIds: string | null;
  previewImageUrls: string[];
}

export class CollectionService {
  constructor(private httpClient: HttpClient, private videoBaseUrl: string) {}

  /**
   * Get all collections for a specific library with pagination.
   */
  async getCollections(libraryId: string): Promise<Collection[]> {
    console.log(`Fetching collections for library ${libraryId}`);
    try {
      // First try to get the API key
      const apiKey = this.httpClient.getApiKey(libraryId);
      if (!apiKey) {
        console.error(`No API key found for library ${libraryId}, attempting to fetch library data first`);
        // Try to fetch the library to get its API key
        const libraryService = new LibraryService(this.httpClient);
        await libraryService.getLibrary(libraryId);
      }

      let allCollections: Collection[] = [];
      let currentPage = 1;
      let hasMorePages = true;
      const itemsPerPage = 100; // Max items per page

      while (hasMorePages) {
        const response = await this.httpClient.fetchWithError<BunnyResponse<CollectionResponse>>(
          `/library/${libraryId}/collections?page=${currentPage}&itemsPerPage=${itemsPerPage}&orderBy=date`,
          { 
            method: "GET"
          }
        );

        const collections = (response.items || []).map((col): Collection => ({
          id: col.id || col.guid,
          guid: col.guid,
          name: col.name || "Unnamed Collection",
          videoCount: col.videoCount || 0,
          totalSize: col.totalSize || 0,
          dateCreated: col.dateCreated || new Date(0).toISOString(),
          pullZoneId: col.pullZoneId,
          storageZoneId: col.storageZoneId,
          previewVideoIds: col.previewVideoIds || null,
          previewImageUrls: col.previewImageUrls || []
        }));

        allCollections = [...allCollections, ...collections];

        if (!response.items || response.items.length < itemsPerPage || allCollections.length >= response.totalItems) {
          hasMorePages = false;
        } else {
          currentPage++;
        }
      }

      console.log(`Found ${allCollections.length} collections for library ${libraryId}`);
      return allCollections;
    } catch (error) {
      console.error(`Error fetching collections for library ${libraryId}:`, error);
      // Try to get cached collections if available
      const cachedLibrary = cache.get(`library_${libraryId}_data`);
      if (cachedLibrary?.collections) {
        console.warn(`Returning cached collections for library ${libraryId} due to API error`);
        return cachedLibrary.collections;
      }
      // If no cached collections, return empty array instead of throwing
      return [];
    }
  }

  /**
   * Create a new collection within a library.
   * Requires library-specific API key passed as accessToken.
   */
  async createCollection(libraryId: string, name: string, accessToken?: string): Promise<Collection> {
    console.log(`Creating collection "${name}" in library ${libraryId}`);
    if (!accessToken) {
      accessToken = this.httpClient.getApiKey(libraryId);
      if (!accessToken) {
         throw new Error(`API key for library ${libraryId} is required to create a collection.`);
      }
    }
    try {
      const response = await this.httpClient.fetchWithError<CollectionResponse>(
        `/library/${libraryId}/collections`,
        {
          method: "POST",
          body: JSON.stringify({ name }),
          headers: { 'Content-Type': 'application/json' }
        }
      );

      return {
        id: response.id || response.guid,
        guid: response.guid,
        name: response.name,
        videoCount: 0,
        totalSize: 0,
        dateCreated: new Date().toISOString(),
        pullZoneId: response.pullZoneId,
        storageZoneId: response.storageZoneId,
        previewVideoIds: null,
        previewImageUrls: []
      };
    } catch (error) {
      console.error(`Error creating collection "${name}" in library ${libraryId}:`, error);
      throw error;
    }
  }

  /**
   * Update a collection's settings
   */
  async updateCollection(libraryId: string, collectionId: string, updates: Partial<Collection>, accessToken?: string): Promise<Collection> {
    try {
      const response = await this.httpClient.fetchWithError<CollectionResponse>(
        `/library/${libraryId}/collections/${collectionId}`,
        {
          method: "PUT",
          body: JSON.stringify(updates)
        }
      );

      return {
        id: response.id || response.guid,
        guid: response.guid,
        name: response.name,
        videoCount: response.videoCount || 0,
        totalSize: response.totalSize || 0,
        dateCreated: response.dateCreated || new Date(0).toISOString(),
        pullZoneId: response.pullZoneId,
        storageZoneId: response.storageZoneId,
        previewVideoIds: response.previewVideoIds || null,
        previewImageUrls: response.previewImageUrls || []
      };
    } catch (error) {
      console.error(`Error updating collection ${collectionId} in library ${libraryId}:`, error);
      throw error;
    }
  }
}
