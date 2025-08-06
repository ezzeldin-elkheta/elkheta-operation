import { SecureCacheManager, secureLog } from './crypto-utils';

class CacheManager {
  private cache = new Map<string, any>();

  constructor() {
    // Load cache from secure storage on initialization
    try {
      const savedCache = SecureCacheManager.getAll();
      if (savedCache) {
        Object.entries(savedCache).forEach(([key, value]) => {
          this.cache.set(key, value);
        });
        secureLog('Cache loaded from secure storage', { keyCount: Object.keys(savedCache).length });
      }
    } catch (error) {
      console.error('Error loading cache from secure storage:', error);
    }
  }

  private saveToSecureStorage(): void {
    try {
      const cacheObj = Object.fromEntries(this.cache.entries());
      Object.entries(cacheObj).forEach(([key, value]) => {
        SecureCacheManager.set(key, value);
      });
    } catch (error) {
      console.error('Error saving cache to secure storage:', error);
    }
  }

  set(key: string, value: any): void {
    this.cache.set(key, value);
    this.saveToSecureStorage();
    secureLog('Cache set', { key, valueType: typeof value });
  }

  get(key: string): any {
    const value = this.cache.get(key);
    secureLog('Cache get', { key, hasValue: !!value });
    return value;
  }

  remove(key: string): void {
    this.cache.delete(key);
    SecureCacheManager.remove(key);
    secureLog('Cache removed', { key });
  }

  clear(): void {
    this.cache.clear();
    SecureCacheManager.clear();
    secureLog('Cache cleared');
  }
}

export const cache = new CacheManager();
