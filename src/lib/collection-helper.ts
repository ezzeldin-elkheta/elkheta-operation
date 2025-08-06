import { dataStorage } from './data-storage';
import { parseFilename, determineCollection } from './filename-parser';
import { LibraryData } from './types';

/**
 * Helper functions for dealing with collections
 */
class CollectionHelper {
  private collectionCache: Map<string, { id: string, name: string }> = new Map();

  /**
   * Ensure cached collections are available for a library
   * @param libraryId The library ID
   * @returns true if collections were found in cache
   */
  async getCollectionInfo(libraryId: string, collectionId?: string): Promise<{ name: string } | null> {
    try {
      // First try from in-memory cache for speed
      const cacheKey = `${libraryId}:${collectionId}`;
      if (this.collectionCache.has(cacheKey)) {
        return { name: this.collectionCache.get(cacheKey)!.name };
      }
      
      // Then try from storage
      const libraryData = await dataStorage.getLibraryData();
      if (!libraryData) return null;
      
      const library = libraryData.libraries.find(lib => lib.id === libraryId);
      if (!library || !library.collections) return null;
      
      if (!collectionId) return null;
      
      const collection = library.collections.find(col => col.id === collectionId);
      
      if (collection) {
        // Cache for future use
        this.collectionCache.set(cacheKey, { id: collectionId, name: collection.name });
        return { name: collection.name };
      }
      
      return null;
    } catch (error) {
      console.error('Error getting collection info:', error);
      return null;
    }
  }

  /**
   * Store collection info in memory cache
   */
  storeCollectionInfo(libraryId: string, collectionId: string, collectionName: string): void {
    const cacheKey = `${libraryId}:${collectionId}`;
    this.collectionCache.set(cacheKey, { id: collectionId, name: collectionName });
    console.log(`Stored collection in cache: ${collectionName} (${collectionId})`);
  }

  /**
   * Look up collection name by ID
   * @param libraryId The library ID
   * @param collectionId The collection ID
   * @returns The collection name or null if not found
   */
  async getCollectionNameById(libraryId: string, collectionId: string): Promise<string | null> {
    const collectionInfo = await this.getCollectionInfo(libraryId, collectionId);
    return collectionInfo ? collectionInfo.name : null;
  }

  /**
   * Ensures a collection exists, creating it if it doesn't
   * @param libraryId The library ID
   * @param collectionName The collection name 
   * @returns Promise resolving to the collection ID
   */
  async ensureCollectionExists(libraryId: string, collectionName: string): Promise<string | null> {
    try {
      // Try to find existing collection first
      const libraryData = await dataStorage.getLibraryData();
      if (!libraryData) return null;
      
      const library = libraryData.libraries.find(lib => lib.id === libraryId);
      if (!library || !library.collections) return null;
      
      // Check if collection already exists
      const existingCollection = library.collections.find(
        col => col.name.toLowerCase() === collectionName.toLowerCase()
      );
      
      if (existingCollection) {
        console.log(`Collection "${collectionName}" already exists in library "${library.name}"`);
        return existingCollection.id;
      }
      
      // Collection doesn't exist, create it
      console.log(`Creating new collection "${collectionName}" in library "${library.name}"`);
      
      // This would need the bunnyService to be imported and available
      // const newCollection = await bunnyService.createCollection(libraryId, collectionName);
      // this.storeCollectionInfo(libraryId, newCollection.id, collectionName);
      // return newCollection.id;
      
      // For now, just log this would happen (implement the actual API call when ready)
      console.log(`[Would create collection] "${collectionName}" in library "${library.name}"`);
      return null;
      
    } catch (error) {
      console.error('Error ensuring collection exists:', error);
      return null;
    }
  }

  /**
   * Get all collections for a specific library
   * @param libraryId The library ID
   * @returns Array of collections with id and name
   */
  async getCollectionsForLibrary(libraryId: string): Promise<Array<{ id: string; name: string }>> {
    try {
      if (!libraryId) return [];
      
      const libraryData = await dataStorage.getLibraryData();
      if (!libraryData) return [];
      
      const library = libraryData.libraries.find(lib => lib.id === libraryId);
      if (!library || !library.collections) return [];
      
      // Map to the expected format for the UI
      return library.collections.map(collection => ({
        id: collection.id,
        name: collection.name
      }));
      
    } catch (error) {
      console.error('Error getting collections for library:', error);
      return [];
    }
  }

  /**
   * Get collections for a library filtered by search query
   * @param libraryId The library ID
   * @param searchQuery Optional search query to filter collections
   * @returns Filtered array of collections
   */
  async getFilteredCollections(libraryId: string, searchQuery?: string): Promise<Array<{ id: string; name: string }>> {
    const collections = await this.getCollectionsForLibrary(libraryId);
    
    if (!searchQuery) return collections;
    
    return collections.filter(collection => 
      collection.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }

  /**
   * Get suggested collection based on filename analysis
   * @param libraryId The library ID
   * @param filename The filename to analyze
   * @returns The suggested collection or null if not found
   */
  async getSuggestedCollection(libraryId: string, filename: string): Promise<{ id?: string; name: string } | null> {
    try {
      // Parse the filename to determine the collection
      const parsed = parseFilename(filename);
      const collectionResult = determineCollection(parsed);
      
      if (!collectionResult || !collectionResult.name) {
        return null;
      }
      
      // Find matching collection in the library
      const collections = await this.getCollectionsForLibrary(libraryId);
      const match = collections.find(c => 
        c.name.toLowerCase() === collectionResult.name.toLowerCase()
      );
      
      if (match) {
        return { id: match.id, name: match.name };
      }
      
      return { name: collectionResult.name };
    } catch (error) {
      console.error('Error getting suggested collection:', error);
      return null;
    }
  }

  /**
   * Create a new collection for a library
   * @param libraryId The library ID
   * @param collectionName The name for the new collection
   * @returns Promise resolving to the new collection ID or null if creation failed
   */
  async createCollection(libraryId: string, collectionName: string): Promise<string | null> {
    try {
      console.log(`Creating new collection "${collectionName}" for library ${libraryId}`);
      
      // This would call an API endpoint to create the collection
      // const response = await fetch('/api/collections', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ libraryId, name: collectionName })
      // });
      // const data = await response.json();
      // return data.id;
      
      // For now, just log and return a placeholder ID
      console.log(`[Would create collection] "${collectionName}" in library ID ${libraryId}`);
      return `new-collection-${Date.now()}`;
      
    } catch (error) {
      console.error('Error creating collection:', error);
      return null;
    }
  }

  /**
   * Find the closest matching collection by name
   * @param libraryId The library ID
   * @param suggestedName The suggested collection name
   * @returns The closest matching collection or null if not found
   */
  async findClosestCollection(libraryId: string, suggestedName: string): Promise<{ id: string; name: string } | null> {
    try {
      const collections = await this.getCollectionsForLibrary(libraryId);
      if (!collections.length) return null;
      
      let closestMatch = null;
      let highestSimilarity = 0;
      
      for (const collection of collections) {
        const similarity = this.calculateNameSimilarity(collection.name, suggestedName);
        if (similarity > highestSimilarity) {
          highestSimilarity = similarity;
          closestMatch = collection;
        }
      }
      
      return closestMatch;
    } catch (error) {
      console.error('Error finding closest collection:', error);
      return null;
    }
  }

  /**
   * Calculate similarity between two strings
   * @param str1 First string
   * @param str2 Second string
   * @returns Similarity score between 0 and 1
   */
  private calculateNameSimilarity(str1: string, str2: string): number {
    // Simple implementation - can be improved with more sophisticated algorithms
    const s1 = str1.toLowerCase();
    const s2 = str2.toLowerCase();
    
    if (s1 === s2) return 1;
    if (s1.includes(s2) || s2.includes(s1)) return 0.8;
    if (s1.split(' ').some(word => s2.includes(word)) || 
        s2.split(' ').some(word => s1.includes(word))) return 0.5;
    
    return 0;
  }
}

export const collectionHelper = new CollectionHelper();
