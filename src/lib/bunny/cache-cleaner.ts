/**
 * Cache cleaner for Bunny.net API keys and data
 */
import { cache } from '../cache';
import { validateApiKeyFormat } from '../crypto-utils';

export class BunnyCacheCleaner {
  /**
   * Clear all cached API keys for a specific library
   */
  static clearLibraryCache(libraryId: string): void {
    console.log(`[CacheCleaner] Clearing cache for library ${libraryId}`);
    
    // Clear specific library caches
    cache.remove(`library_${libraryId}_api`);
    cache.remove(`library_${libraryId}_data`);
    
    // Clear from library data storage
    const allLibraries = cache.get('library_data');
    if (allLibraries?.libraries) {
      allLibraries.libraries = allLibraries.libraries.filter(l => l.id !== libraryId);
      cache.set('library_data', allLibraries);
    }
    
    console.log(`[CacheCleaner] Cleared cache for library ${libraryId}`);
  }

  /**
   * Clear all cached API keys
   */
  static clearAllApiKeyCache(): void {
    console.log('[CacheCleaner] Clearing all API key caches');
    
    // Remove known cache patterns
    const knownPatterns = [
      'default_api_key',
      'library_data'
    ];
    
    knownPatterns.forEach(key => {
      cache.remove(key);
      console.log(`[CacheCleaner] Removed cache key: ${key}`);
    });
    
    // Try to remove library-specific keys for common library IDs
    for (let i = 300000; i < 400000; i++) {
      const libraryKey = `library_${i}_api`;
      const libraryDataKey = `library_${i}_data`;
      if (cache.get(libraryKey)) {
        cache.remove(libraryKey);
        console.log(`[CacheCleaner] Removed cache key: ${libraryKey}`);
      }
      if (cache.get(libraryDataKey)) {
        cache.remove(libraryDataKey);
        console.log(`[CacheCleaner] Removed cache key: ${libraryDataKey}`);
      }
    }
    
    console.log('[CacheCleaner] All API key caches cleared');
  }

  /**
   * Validate and clean invalid API keys from cache
   */
  static validateAndCleanCache(): void {
    console.log('[CacheCleaner] Validating and cleaning cache');
    
    // Check default API key
    const defaultKey = cache.get('default_api_key');
    if (defaultKey && typeof defaultKey === 'string' && !validateApiKeyFormat(defaultKey)) {
      console.warn('[CacheCleaner] Removing invalid default API key from cache');
      cache.remove('default_api_key');
    }
    
    // Check library-specific keys for common library IDs
    for (let i = 300000; i < 400000; i++) {
      const libraryKey = `library_${i}_api`;
      const apiKey = cache.get(libraryKey);
      if (apiKey && typeof apiKey === 'string' && !validateApiKeyFormat(apiKey)) {
        console.warn(`[CacheCleaner] Removing invalid API key from cache: ${libraryKey}`);
        cache.remove(libraryKey);
      }
    }
    
    // Validate library data
    const libraryData = cache.get('library_data');
    if (libraryData?.libraries) {
      libraryData.libraries = libraryData.libraries.filter(library => {
        if (library.apiKey && !validateApiKeyFormat(library.apiKey)) {
          console.warn(`[CacheCleaner] Removing library ${library.id} with invalid API key`);
          return false;
        }
        return true;
      });
      cache.set('library_data', libraryData);
    }
    
    console.log('[CacheCleaner] Cache validation and cleaning completed');
  }

  /**
   * Force refresh of API keys from environment
   */
  static forceRefreshFromEnvironment(): void {
    console.log('[CacheCleaner] Force refreshing from environment');
    
    // Clear all cached keys
    this.clearAllApiKeyCache();
    
    // Set default key from environment
    const envKey = process.env.VITE_BUNNY_API_KEY || (typeof window !== 'undefined' && (window as any).__env?.VITE_BUNNY_API_KEY);
    if (envKey && validateApiKeyFormat(envKey)) {
      cache.set('default_api_key', envKey);
      console.log('[CacheCleaner] Set fresh default API key from environment');
    }
    
    console.log('[CacheCleaner] Force refresh completed');
  }
}
