/**
 * Security migration system to encrypt existing unencrypted data
 */

import { SecureApiKeyStorage, SecureDataStorage, SecureCacheManager, secureLog } from './crypto-utils';

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
      throw error;
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
        const keys = JSON.parse(oldApiKeys);
        Object.entries(keys).forEach(([libraryId, apiKey]) => {
          SecureApiKeyStorage.store(libraryId, apiKey as string);
          secureLog('Migrated API key for library', { libraryId });
        });
        localStorage.removeItem('bunny_library_api_keys');
        secureLog('Migrated library API keys');
      }

      // Migrate bunny_api_key
      const oldMainKey = localStorage.getItem('bunny_api_key');
      if (oldMainKey) {
        SecureApiKeyStorage.store('default', oldMainKey);
        localStorage.removeItem('bunny_api_key');
        secureLog('Migrated main API key');
      }

      // Migrate default_api_key from cache
      const oldDefaultKey = localStorage.getItem('app_cache');
      if (oldDefaultKey) {
        try {
          const cache = JSON.parse(oldDefaultKey);
          if (cache.default_api_key) {
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
        const data = JSON.parse(oldLibraryData);
        SecureDataStorage.set('library_data', data);
        localStorage.removeItem('library_data');
        secureLog('Migrated library data', { libraryCount: data.libraries?.length || 0 });
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
        const cache = JSON.parse(oldCache);
        Object.entries(cache).forEach(([key, value]) => {
          // Skip API keys as they're handled separately
          if (!key.includes('api_key') && !key.includes('api')) {
            SecureCacheManager.set(key, value);
          }
        });
        localStorage.removeItem('app_cache');
        secureLog('Migrated cache data');
      }
    } catch (error) {
      console.error('[SecurityMigration] Cache migration failed:', error);
    }
  }

  /**
   * Migrate other sensitive data
   */
  private static async migrateOtherData(): Promise<void> {
    try {
      // Migrate sheet configurations
      const oldSheetConfigs = localStorage.getItem('sheet_configurations');
      if (oldSheetConfigs) {
        const configs = JSON.parse(oldSheetConfigs);
        SecureDataStorage.set('sheet_configurations', configs);
        localStorage.removeItem('sheet_configurations');
        secureLog('Migrated sheet configurations');
      }

      // Migrate upload settings
      const oldUploadSettings = localStorage.getItem('upload_settings');
      if (oldUploadSettings) {
        const settings = JSON.parse(oldUploadSettings);
        SecureDataStorage.set('upload_settings', settings);
        localStorage.removeItem('upload_settings');
        secureLog('Migrated upload settings');
      }

      // Migrate selected library
      const oldSelectedLibrary = localStorage.getItem('selectedLibrary');
      if (oldSelectedLibrary) {
        const library = JSON.parse(oldSelectedLibrary);
        SecureDataStorage.set('selectedLibrary', library);
        localStorage.removeItem('selectedLibrary');
        secureLog('Migrated selected library');
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
        'library_data',
        'app_cache',
        'sheet_configurations',
        'upload_settings',
        'selectedLibrary',
        '_3g4_session_id' // Remove session ID as well
      ];

      keysToRemove.forEach(key => {
        if (localStorage.getItem(key)) {
          localStorage.removeItem(key);
          secureLog('Removed old unencrypted data', { key });
        }
      });

      secureLog('Cleanup completed');
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
    
    // Check for unencrypted sensitive data
    const sensitiveKeys = [
      'bunny_library_api_keys',
      'bunny_api_key',
      'library_data',
      'app_cache',
      'sheet_configurations',
      'upload_settings',
      'selectedLibrary'
    ];

    sensitiveKeys.forEach(key => {
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
   * Force re-migration (for testing or recovery)
   */
  static async forceRemigration(): Promise<void> {
    localStorage.removeItem(this.MIGRATION_FLAG);
    await this.migrateToSecureStorage();
  }
}

/**
 * Auto-migration on app startup
 */
export function initializeSecurityMigration(): void {
  if (SecurityMigration.isMigrationNeeded()) {
    secureLog('Security migration needed, starting...');
    SecurityMigration.migrateToSecureStorage().catch(error => {
      console.error('[SecurityMigration] Auto-migration failed:', error);
    });
  } else {
    secureLog('Security migration already completed');
  }
} 