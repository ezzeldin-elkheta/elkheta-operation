/**
 * Client-side cache management utilities
 */

export class ClientCacheManager {
  /**
   * Clear all client-side caches related to Bunny.net
   */
  static clearAllCaches(): void {
    console.log('[ClientCache] Clearing all client-side caches');
    
    // Clear localStorage
    const localStorageKeys = [
      'bunny_api_key',
      'app_cache',
      'library_data',
      'default_api_key'
    ];
    
    localStorageKeys.forEach(key => {
      try {
        localStorage.removeItem(key);
        console.log(`[ClientCache] Removed localStorage key: ${key}`);
      } catch (error) {
        console.warn(`[ClientCache] Failed to remove localStorage key ${key}:`, error);
      }
    });
    
    // Clear sessionStorage
    try {
      sessionStorage.clear();
      console.log('[ClientCache] Cleared sessionStorage');
    } catch (error) {
      console.warn('[ClientCache] Failed to clear sessionStorage:', error);
    }
    
    // Clear any window-level cache
    if (typeof window !== 'undefined') {
      // Clear any global cache objects
      if ((window as any).__bunnyCache) {
        delete (window as any).__bunnyCache;
        console.log('[ClientCache] Cleared window.__bunnyCache');
      }
    }
    
    console.log('[ClientCache] All client-side caches cleared');
  }

  /**
   * Clear specific library cache
   */
  static clearLibraryCache(libraryId: string): void {
    console.log(`[ClientCache] Clearing cache for library ${libraryId}`);
    
    // Clear from localStorage app_cache
    try {
      const appCache = localStorage.getItem('app_cache');
      if (appCache) {
        const parsed = JSON.parse(appCache);
        delete parsed[`library_${libraryId}_api`];
        delete parsed[`library_${libraryId}_data`];
        localStorage.setItem('app_cache', JSON.stringify(parsed));
        console.log(`[ClientCache] Cleared library ${libraryId} from app_cache`);
      }
    } catch (error) {
      console.warn(`[ClientCache] Failed to clear library ${libraryId} from app_cache:`, error);
    }
    
    // Clear library data
    try {
      const libraryData = localStorage.getItem('library_data');
      if (libraryData) {
        const parsed = JSON.parse(libraryData);
        if (parsed.libraries) {
          parsed.libraries = parsed.libraries.filter(lib => lib.id !== libraryId);
          localStorage.setItem('library_data', JSON.stringify(parsed));
          console.log(`[ClientCache] Removed library ${libraryId} from library_data`);
        }
      }
    } catch (error) {
      console.warn(`[ClientCache] Failed to clear library ${libraryId} from library_data:`, error);
    }
  }

  /**
   * Force refresh from environment
   */
  static async forceRefreshFromEnvironment(): Promise<void> {
    console.log('[ClientCache] Force refreshing from environment');
    
    // Clear all caches first
    this.clearAllCaches();
    
    // Call server-side cache clear
    try {
      const response = await fetch('/api/clear-cache', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log('[ClientCache] Server-side cache clear successful:', result);
      } else {
        console.warn('[ClientCache] Server-side cache clear failed:', response.status);
      }
    } catch (error) {
      console.warn('[ClientCache] Failed to call server-side cache clear:', error);
    }
    
    // Reload the page to get fresh data
    if (typeof window !== 'undefined') {
      console.log('[ClientCache] Reloading page to refresh from environment');
      window.location.reload();
    }
  }
}

// Export as window global for debugging
if (typeof window !== 'undefined') {
  (window as any).BunnyCacheManager = ClientCacheManager;
}
