/**
 * Security migration system to encrypt existing unencrypted data
 */

import { SecureApiKeyStorage, SecureDataStorage, SecureCacheManager, secureLog } from './crypto-utils.ts';

export class SecurityMigration {
  private static readonly MIGRATION_FLAG = 'security_migration_completed';

  /**
   * Run the complete security migration
   */
  static async migrateToSecureStorage(): Promise<void> {
    try {
      secureLog('Starting security migration...');
      
      // Check if migration has already been completed
      if (localStorage.getItem(this.MIGRATION_FLAG)) {
        secureLog('Security migration already completed');
        return;
      }

      // Step 1: Migrate API keys
      await this.migrateApiKeys();
      
      // Step 2: Migrate library data
      await this.migrateLibraryData();
      
      // Step 3: Migrate cache data
      await this.migrateCacheData();
      
      // Step 4: Migrate other sensitive data
      await this.migrateOtherData();
      
      // Step 5: Clean up old unencrypted data
      await this.cleanupOldData();
      
      // Mark migration as completed
      localStorage.setItem(this.MIGRATION_FLAG, new Date().toISOString());
      
      secureLog('Security migration completed successfully');
    } catch (error) {
      console.error('[SecurityMigration] Migration failed:', error);
      // Don't throw the error, just log it to prevent app crashes
    }
  }

  /**
   * Migrate API keys from unencrypted storage to secure storage
   */
  private static async migrateApiKeys(): Promise<void> {
    try {
      // Migrate bunny_library_api_keys
      const oldApiKeys = localStorage.getItem('bunny_library_api_keys');
      if (oldApiKeys) {
        try {
          const keys = JSON.parse(oldApiKeys);
          if (keys && typeof keys === 'object') {
            Object.entries(keys).forEach(([libraryId, apiKey]) => {
              if (libraryId && apiKey && typeof apiKey === 'string') {
                SecureApiKeyStorage.store(libraryId, apiKey);
                secureLog('Migrated API key for library', { libraryId });
              }
            });
            localStorage.removeItem('bunny_library_api_keys');
            secureLog('Migrated library API keys');
          }
        } catch (parseError) {
          console.error('Error parsing old API keys:', parseError);
          localStorage.removeItem('bunny_library_api_keys');
        }
      }

      // Migrate bunny_api_key
      const oldMainKey = localStorage.getItem('bunny_api_key');
      if (oldMainKey && typeof oldMainKey === 'string') {
        SecureApiKeyStorage.store('default', oldMainKey);
        localStorage.removeItem('bunny_api_key');
        secureLog('Migrated main API key');
      }

      // Migrate default_api_key from cache
      const oldDefaultKey = localStorage.getItem('app_cache');
      if (oldDefaultKey) {
        try {
          const cache = JSON.parse(oldDefaultKey);
          if (cache && cache.default_api_key && typeof cache.default_api_key === 'string') {
            SecureApiKeyStorage.store('default', cache.default_api_key);
            secureLog('Migrated default API key from cache');
          }
        } catch (error) {
          console.error('Error parsing old cache for API key migration:', error);
        }
      }
    } catch (error) {
      console.error('[SecurityMigration] API key migration failed:', error);
    }
  }

  /**
   * Migrate library data from unencrypted storage to secure storage
   */
  private static async migrateLibraryData(): Promise<void> {
    try {
      const oldLibraryData = localStorage.getItem('library_data');
      if (oldLibraryData) {
        try {
          const data = JSON.parse(oldLibraryData);
          if (data && typeof data === 'object') {
            SecureDataStorage.set('library_data', data);
            localStorage.removeItem('library_data');
            secureLog('Migrated library data');
          }
        } catch (parseError) {
          console.error('Error parsing old library data:', parseError);
          localStorage.removeItem('library_data');
        }
      }
    } catch (error) {
      console.error('[SecurityMigration] Library data migration failed:', error);
    }
  }

  /**
   * Migrate cache data from unencrypted storage to secure storage
   */
  private static async migrateCacheData(): Promise<void> {
    try {
      const oldCache = localStorage.getItem('app_cache');
      if (oldCache) {
        try {
          const cache = JSON.parse(oldCache);
          if (cache && typeof cache === 'object') {
            Object.entries(cache).forEach(([key, value]) => {
              if (key && value !== undefined) {
                SecureCacheManager.set(key, value);
              }
            });
            localStorage.removeItem('app_cache');
            secureLog('Migrated cache data');
          }
        } catch (parseError) {
          console.error('Error parsing old cache data:', parseError);
          localStorage.removeItem('app_cache');
        }
      }
    } catch (error) {
      console.error('[SecurityMigration] Cache data migration failed:', error);
    }
  }

  /**
   * Migrate other sensitive data
   */
  private static async migrateOtherData(): Promise<void> {
    try {
      // Migrate selected library
      const selectedLibrary = localStorage.getItem('selectedLibrary');
      if (selectedLibrary) {
        try {
          const library = JSON.parse(selectedLibrary);
          if (library && typeof library === 'object') {
            SecureDataStorage.set('selectedLibrary', library);
            localStorage.removeItem('selectedLibrary');
            secureLog('Migrated selected library');
          }
        } catch (parseError) {
          console.error('Error parsing selected library:', parseError);
          localStorage.removeItem('selectedLibrary');
        }
      }

      // Migrate selected collection
      const selectedCollection = localStorage.getItem('selectedCollection');
      if (selectedCollection) {
        try {
          const collection = JSON.parse(selectedCollection);
          if (collection && typeof collection === 'object') {
            SecureDataStorage.set('selectedCollection', collection);
            localStorage.removeItem('selectedCollection');
            secureLog('Migrated selected collection');
          }
        } catch (parseError) {
          console.error('Error parsing selected collection:', parseError);
          localStorage.removeItem('selectedCollection');
        }
      }

      // Migrate sheet configurations
      const sheetConfigs = localStorage.getItem('sheet_configurations');
      if (sheetConfigs) {
        try {
          const configs = JSON.parse(sheetConfigs);
          if (configs && Array.isArray(configs)) {
            SecureDataStorage.set('sheet_configurations', configs);
            localStorage.removeItem('sheet_configurations');
            secureLog('Migrated sheet configurations');
          }
        } catch (parseError) {
          console.error('Error parsing sheet configurations:', parseError);
          localStorage.removeItem('sheet_configurations');
        }
      }
    } catch (error) {
      console.error('[SecurityMigration] Other data migration failed:', error);
    }
  }

  /**
   * Clean up old unencrypted data
   */
  private static async cleanupOldData(): Promise<void> {
    try {
      const keysToRemove = [
        'bunny_library_api_keys',
        'bunny_api_key',
        'app_cache',
        'library_data',
        'selectedLibrary',
        'selectedCollection',
        'sheet_configurations'
      ];

      keysToRemove.forEach(key => {
        if (localStorage.getItem(key)) {
          localStorage.removeItem(key);
          secureLog(`Cleaned up old data: ${key}`);
        }
      });
    } catch (error) {
      console.error('[SecurityMigration] Cleanup failed:', error);
    }
  }

  /**
   * Check if migration is needed
   */
  static isMigrationNeeded(): boolean {
    return !localStorage.getItem(this.MIGRATION_FLAG);
  }

  /**
   * Get migration status
   */
  static getMigrationStatus(): {
    completed: boolean;
    hasUnencryptedData: boolean;
    unencryptedKeys: string[];
  } {
    const completed = !!localStorage.getItem(this.MIGRATION_FLAG);
    const unencryptedKeys: string[] = [];
    
    const keysToCheck = [
      'bunny_library_api_keys',
      'bunny_api_key',
      'app_cache',
      'library_data',
      'selectedLibrary',
      'selectedCollection',
      'sheet_configurations'
    ];

    keysToCheck.forEach(key => {
      if (localStorage.getItem(key)) {
        unencryptedKeys.push(key);
      }
    });

    return {
      completed,
      hasUnencryptedData: unencryptedKeys.length > 0,
      unencryptedKeys
    };
  }

  /**
   * Force remigration (for testing or recovery)
   */
  static async forceRemigration(): Promise<void> {
    localStorage.removeItem(this.MIGRATION_FLAG);
    await this.migrateToSecureStorage();
  }
}

/**
 * Initialize security migration
 */
export function initializeSecurityMigration(): void {
  try {
    if (SecurityMigration.isMigrationNeeded()) {
      secureLog('Security migration needed, starting...');
      SecurityMigration.migrateToSecureStorage().catch(error => {
        console.error('Security migration failed:', error);
      });
    } else {
      secureLog('Security migration already completed');
    }
  } catch (error) {
    console.error('Error initializing security migration:', error);
  }
} 