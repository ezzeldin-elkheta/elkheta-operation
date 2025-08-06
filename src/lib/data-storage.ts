import { Library, Collection } from './bunny/types';
import { LibraryData, LibraryInfo, CollectionInfo } from '../types/library-data';
import { CollectionsResponse } from './types';
import { cache } from './cache';
import { bunnyService } from './bunny-service';

interface CollectionData {
  videoLibraryId: number;
  guid: string;
  name: string;
  videoCount: number;
  totalSize: number;
  previewVideoIds: string | null;
  previewImageUrls: string[];
}

class DataStorage {
  private static instance: DataStorage;
  private readonly STORAGE_KEY = 'library_data';
  private readonly CONFIG_FILE = 'bunny-config.json';
  private libraryData: LibraryData | null = null;
  private collectionsCache: Map<string, CollectionsResponse> = new Map();
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAY = 1000; // 1 second
  private cache: LibraryData | null = null;

  private constructor() {}

  static getInstance(): DataStorage {
    if (!DataStorage.instance) {
      DataStorage.instance = new DataStorage();
    }
    return DataStorage.instance;
  }

  private async fetchCollectionsWithRetry(libraryId: string, libraryName: string): Promise<CollectionInfo[]> {
    let retries = 0;
    const baseDelay = 1000; // 1 second base delay
    
    while (retries < this.MAX_RETRIES) {
      try {
        console.log(`Attempting to fetch collections for library ${libraryName} (${libraryId}) - Attempt ${retries + 1}/${this.MAX_RETRIES}`);
        const apiCollections = await bunnyService.getCollections(libraryId);
        console.log(`Successfully fetched ${apiCollections.length} collections for library ${libraryName} (${libraryId})`);
        
        return apiCollections.map(col => ({
          id: col.id,
          guid: col.guid,
          name: col.name,
          videoCount: col.videoCount || 0,
          totalSize: col.totalSize || 0,
          previewVideoIds: null,
          previewImageUrls: [],
          dateCreated: col.dateCreated || new Date().toISOString()
        }));
      } catch (error) {
        retries++;
        const delay = baseDelay * Math.pow(2, retries - 1); // Exponential backoff
        console.error(`Error fetching collections for library ${libraryName} (${libraryId}) - Attempt ${retries}/${this.MAX_RETRIES}:`, error);
        
        if (retries < this.MAX_RETRIES) {
          console.log(`Waiting ${delay}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          console.error(`Failed to fetch collections for library ${libraryName} (${libraryId}) after ${this.MAX_RETRIES} attempts`);
          // Try to get cached collections as fallback
          try {
            const cachedData = await this.getLibraryData();
            if (cachedData) {
              const cachedLibrary = cachedData.libraries.find(lib => lib.id === libraryId);
              if (cachedLibrary?.collections) {
                console.log(`Using cached collections for library ${libraryName} (${libraryId})`);
                return cachedLibrary.collections;
              }
            }
          } catch (cacheError) {
            console.error('Error accessing cached collections:', cacheError);
          }
          return []; // Return empty array if no cache available
        }
      }
    }
    
    return []; // Fallback
  }

  async saveLibraryData(data: LibraryData): Promise<void> {
    try {
      // Process each library to fetch and add collections
      const processedLibraries = await Promise.all(
        data.libraries.map(async (library: Library) => {
          try {
            // Construct API endpoint if not available
            const apiEndpoint = library.apiEndpoint || `https://video.bunnycdn.com/library/${library.id}`;

            // Fetch collections for this library
            const response = await fetch(`${apiEndpoint}/collections`, {
              headers: {
                'AccessKey': library.apiKey,
                'Content-Type': 'application/json'
              }
            });

            if (!response.ok) {
              throw new Error(`Failed to fetch collections: ${response.statusText}`);
            }

            const collectionsData: { items: Collection[] } = await response.json();
            const collections: Collection[] = collectionsData.items.map((apiCollection) => ({
              id: apiCollection.id,
              guid: apiCollection.guid,
              name: apiCollection.name,
              videoCount: apiCollection.videoCount || 0,
              totalSize: apiCollection.totalSize || 0,
              previewVideoIds: null,
              previewImageUrls: [],
              dateCreated: apiCollection.dateCreated || new Date().toISOString()
            }));

            // Return updated library with collections
            return {
              ...library,
              collections,
              apiEndpoint // Include the API endpoint in case it was constructed
            };
          } catch (error) {
            console.error(`Error processing library ${library.name}:`, error);
            return library; // Return original library if collection fetch fails
          }
        })
      );

      // Update the data with processed libraries
      const updatedData: LibraryData = {
        ...data,
        libraries: processedLibraries,
        lastUpdated: new Date().toISOString()
      };

      // Save to localStorage
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(updatedData));
      
      // Update cache
      this.cache = updatedData;
    } catch (error) {
      console.error('Error saving library data:', error);
      throw error;
    }
  }

  async getLibraryData(): Promise<LibraryData | null> {
    if (this.libraryData) {
      return this.libraryData;
    }

    try {
      const storedData = localStorage.getItem(this.STORAGE_KEY);
      if (storedData) {
        this.libraryData = JSON.parse(storedData) as LibraryData;
        return this.libraryData;
      }
    } catch (error) {
      console.error('Failed to retrieve library data:', error);
      // Clear potentially corrupted data
      localStorage.removeItem(this.STORAGE_KEY);
    }

    return null;
  }

  async getLibraryById(id: number): Promise<LibraryData | null> {
    const data = await this.getLibraryData();
    if (!data) return null;

    const library = data.libraries.find(lib => Number(lib.id) === id);
    if (!library) return null;

    return {
      lastUpdated: data.lastUpdated,
      libraries: [library],
      mainApiKey: data.mainApiKey
    };
  }

  async storeCollections(libraryId: number, collections: CollectionsResponse): Promise<void> {
    this.collectionsCache.set(libraryId.toString(), collections);
  }

  async getCollections(libraryId: number): Promise<CollectionsResponse | null> {
    return this.collectionsCache.get(libraryId.toString()) || null;
  }

  async clearCache(): Promise<void> {
    this.libraryData = null;
    this.collectionsCache.clear();
    localStorage.removeItem(this.STORAGE_KEY);
  }
}

export const dataStorage = DataStorage.getInstance();

