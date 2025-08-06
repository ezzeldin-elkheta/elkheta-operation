import { SecureCacheManager, secureLog } from './crypto-utils.ts';

class CacheManager {
  private cache = new Map<string, any>();
  private initialized = false;

  constructor() {
    this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      // Load cache from secure storage on initialization
      const savedCache = SecureCacheManager.getAll();
      if (savedCache && typeof savedCache === 'object') {
        Object.entries(savedCache).forEach(([key, value]) => {
          if (key && value !== undefined) {
            this.cache.set(key, value);
          }
        });
        secureLog('Cache loaded from secure storage', { keyCount: Object.keys(savedCache).length });
      }
      this.initialized = true;
    } catch (error) {
      console.error('Error loading cache from secure storage:', error);
      // Initialize with empty cache if there's an error
      this.initialized = true;
    }
  }

  private saveToSecureStorage(): void {
    if (!this.initialized) return;
    
    try {
      const cacheObj = Object.fromEntries(this.cache.entries());
      Object.entries(cacheObj).forEach(([key, value]) => {
        if (key && value !== undefined) {
          SecureCacheManager.set(key, value);
        }
      });
    } catch (error) {
      console.error('Error saving cache to secure storage:', error);
    }
  }

  set(key: string, value: any): void {
    if (!key || key === '') {
      console.warn('Attempted to set cache with empty key');
      return;
    }
    
    this.cache.set(key, value);
    this.saveToSecureStorage();
    secureLog('Cache set', { key, valueType: typeof value });
  }

  get(key: string): any {
    if (!key || key === '') {
      console.warn('Attempted to get cache with empty key');
      return null;
    }
    
    const value = this.cache.get(key);
    secureLog('Cache get', { key, hasValue: !!value });
    return value;
  }

  remove(key: string): void {
    if (!key || key === '') {
      console.warn('Attempted to remove cache with empty key');
      return;
    }
    
    this.cache.delete(key);
    SecureCacheManager.remove(key);
    secureLog('Cache removed', { key });
  }

  clear(): void {
    this.cache.clear();
    SecureCacheManager.clear();
    secureLog('Cache cleared');
  }

  isInitialized(): boolean {
    return this.initialized;
  }
}

export const cache = new CacheManager();

// Load cache from localStorage
export function loadCache(): void {
  try {
    if (!cache.isInitialized()) {
      console.warn('Cache not yet initialized, skipping load');
      return;
    }
    
    const cachedData = SecureCacheManager.getAll();
    if (cachedData && typeof cachedData === 'object' && Object.keys(cachedData).length > 0) {
      secureLog('Cache loaded from secure storage', { keyCount: Object.keys(cachedData).length });
      // Clear existing cache and load new data
      cache.clear();
      Object.entries(cachedData).forEach(([key, value]) => {
        if (key && value !== undefined) {
          cache.set(key, value);
        }
      });
    } else {
      secureLog('No cached data found, starting with empty cache');
      cache.clear();
    }
  } catch (error) {
    console.error('[Cache] Failed to load cache:', error);
    // Clear corrupted cache and start fresh
    try {
      SecureCacheManager.clear();
      cache.clear();
      secureLog('Cache corrupted, cleared and started fresh');
    } catch (clearError) {
      console.error('[Cache] Failed to clear corrupted cache:', clearError);
    }
  }
}
