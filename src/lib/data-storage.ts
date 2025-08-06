import { LibraryData } from './types';
import { SecureDataStorage, secureLog } from './crypto-utils';

class DataStorage {
  private libraryData: LibraryData | null = null;
  private readonly STORAGE_KEY = 'library_data';

  async saveLibraryData(data: LibraryData): Promise<void> {
    try {
      this.libraryData = data;
      SecureDataStorage.set(this.STORAGE_KEY, data);
      secureLog('Library data saved securely', { 
        libraryCount: data.libraries.length,
        hasMainApiKey: !!data.mainApiKey 
      });
    } catch (error) {
      console.error('Failed to save library data:', error);
      throw error;
    }
  }

  async getLibraryData(): Promise<LibraryData | null> {
    if (this.libraryData) {
      return this.libraryData;
    }

    try {
      const storedData = SecureDataStorage.get(this.STORAGE_KEY);
      if (storedData) {
        this.libraryData = storedData as LibraryData;
        secureLog('Library data loaded from secure storage', { 
          libraryCount: storedData.libraries?.length || 0 
        });
        return this.libraryData;
      }
    } catch (error) {
      console.error('Failed to retrieve library data:', error);
      // Clear potentially corrupted data
      SecureDataStorage.remove(this.STORAGE_KEY);
    }

    return null;
  }

  async clearLibraryData(): Promise<void> {
    try {
      this.libraryData = null;
      SecureDataStorage.remove(this.STORAGE_KEY);
      secureLog('Library data cleared');
    } catch (error) {
      console.error('Failed to clear library data:', error);
    }
  }

  async saveSheetConfigurations(configs: any[]): Promise<void> {
    try {
      SecureDataStorage.set('sheet_configurations', configs);
      secureLog('Sheet configurations saved securely', { configCount: configs.length });
    } catch (error) {
      console.error('Failed to save sheet configurations:', error);
      throw error;
    }
  }

  async getSheetConfigurations(): Promise<any[]> {
    try {
      const configs = SecureDataStorage.get('sheet_configurations');
      secureLog('Sheet configurations loaded', { configCount: configs?.length || 0 });
      return configs || [];
    } catch (error) {
      console.error('Failed to retrieve sheet configurations:', error);
      return [];
    }
  }

  async saveUploadSettings(settings: any): Promise<void> {
    try {
      SecureDataStorage.set('upload_settings', settings);
      secureLog('Upload settings saved securely');
    } catch (error) {
      console.error('Failed to save upload settings:', error);
      throw error;
    }
  }

  async getUploadSettings(): Promise<any> {
    try {
      const settings = SecureDataStorage.get('upload_settings');
      secureLog('Upload settings loaded');
      return settings || {};
    } catch (error) {
      console.error('Failed to retrieve upload settings:', error);
      return {};
    }
  }

  async clearAllData(): Promise<void> {
    try {
      this.libraryData = null;
      SecureDataStorage.clear();
      secureLog('All data cleared from secure storage');
    } catch (error) {
      console.error('Failed to clear all data:', error);
    }
  }
}

export const dataStorage = new DataStorage();

