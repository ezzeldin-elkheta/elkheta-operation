class CacheManager {
  private cache = new Map<string, any>();

  constructor() {
    // Load cache from localStorage on initialization
    try {
      const savedCache = localStorage.getItem('app_cache');
      if (savedCache) {
        const parsed = JSON.parse(savedCache);
        Object.entries(parsed).forEach(([key, value]) => {
          this.cache.set(key, value);
        });
      }
    } catch (error) {
      console.error('Error loading cache from localStorage:', error);
    }
  }

  private saveToLocalStorage(): void {
    try {
      const cacheObj = Object.fromEntries(this.cache.entries());
      localStorage.setItem('app_cache', JSON.stringify(cacheObj));
    } catch (error) {
      console.error('Error saving cache to localStorage:', error);
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
