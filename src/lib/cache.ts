import { encryptApiKey, decryptApiKey } from './crypto-utils';

class CacheManager {
  private cache = new Map<string, any>();
  private sensitiveKeys = ['bunny_api_key', 'default_api_key', 'mainApiKey'];

  constructor() {
    // Load cache from localStorage on initialization
    try {
      const savedCache = localStorage.getItem('app_cache');
      if (savedCache) {
        const parsed = JSON.parse(savedCache);
        Object.entries(parsed).forEach(([key, value]) => {
          // Skip mainApiKey completely
          if (key === 'mainApiKey') return;
          
          // If it's a sensitive key, decrypt it before storing in memory
          if (this.sensitiveKeys.includes(key) && typeof value === 'string') {
            try {
              const decrypted = decryptApiKey(value);
              this.cache.set(key, decrypted);
            } catch (error) {
              console.warn(`Failed to decrypt sensitive key ${key}, skipping...`);
            }
          } else {
            this.cache.set(key, value);
          }
        });
      }
    } catch (error) {
      console.warn('Error loading cache from localStorage');
    }
  }

  private saveToLocalStorage(): void {
    try {
      const cacheObj = {} as Record<string, any>;
      
      // Process each cache entry
      this.cache.forEach((value, key) => {
        // Skip mainApiKey entirely
        if (key === 'mainApiKey') return;
        
        // Encrypt sensitive values before saving
        if (this.sensitiveKeys.includes(key) && typeof value === 'string') {
          try {
            cacheObj[key] = encryptApiKey(value);
          } catch (error) {
            console.warn(`Failed to encrypt sensitive key ${key}, skipping...`);
          }
        } else {
          cacheObj[key] = value;
        }
      });
      
      localStorage.setItem('app_cache', JSON.stringify(cacheObj));
    } catch (error) {
      console.warn('Error saving cache to localStorage');
    }
  }

  set(key: string, value: any): void {
    this.cache.set(key, value);
    this.saveToLocalStorage();
  }

  get(key: string): any {
    return this.cache.get(key);
  }

  remove(key: string): void {
    this.cache.delete(key);
    this.saveToLocalStorage();
  }

  clear(): void {
    this.cache.clear();
    localStorage.removeItem('app_cache');
  }
}

export const cache = new CacheManager();
