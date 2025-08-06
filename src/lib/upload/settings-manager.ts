import { UploadSettings } from './types';
import { DEFAULT_UPLOAD_CONFIG } from '../../types/bunny';
import { HttpClient } from '../bunny/http-client';
import { UploadService } from '../bunny/services/upload-service';

// Default settings compatible with UploadSettings
export const DEFAULT_SETTINGS: UploadSettings = {
  maxConcurrentUploads: DEFAULT_UPLOAD_CONFIG.maxConcurrent || 3,
  useStreaming: DEFAULT_UPLOAD_CONFIG.useStreaming || true,
  chunkSize: DEFAULT_UPLOAD_CONFIG.chunkSize || 5 * 1024 * 1024,
  timeoutMs: DEFAULT_UPLOAD_CONFIG.timeoutMs || 60000,
  useTusThresholdMB: DEFAULT_UPLOAD_CONFIG.useTusThresholdMB || 500,
  retryDelays: DEFAULT_UPLOAD_CONFIG.retryDelays || [0, 3000, 10000, 30000, 60000, 120000, 180000],
  retryAttempts: DEFAULT_UPLOAD_CONFIG.retryAttempts || 5,
  enableResumableSessions: DEFAULT_UPLOAD_CONFIG.enableResumableSessions || true,
  sessionExpiryHours: DEFAULT_UPLOAD_CONFIG.sessionExpiryHours || 48,
  enableAutoRetry: DEFAULT_UPLOAD_CONFIG.enableAutoRetry || true,
  enableConnectionCheck: DEFAULT_UPLOAD_CONFIG.enableConnectionCheck || true,
  maxConcurrent: DEFAULT_UPLOAD_CONFIG.maxConcurrent || 1,
  useStreamingUpload: DEFAULT_UPLOAD_CONFIG.useStreaming || true,
  enableProxyFallback: true,
  proxyTimeoutMs: 15000,
  validateConnectionBeforeUpload: true
};

/**
 * Apply upload settings to the upload service
 */
export function applySettingsToService(
  settings: UploadSettings,
  uploadService: UploadService
): void {
  console.log('[SettingsManager] Applying settings to upload service:', settings);
  
  // The new UploadService accepts settings through individual method calls
  // No direct configuration is needed as settings are passed per-upload
  // This is a no-op function now, as settings will be passed to individual upload methods
}

/**
 * Load saved settings from IndexedDB or localStorage
 */
export async function loadSavedSettings(): Promise<UploadSettings> {
  try {
    if ('indexedDB' in window) {
      return new Promise((resolve) => {
        const request = indexedDB.open('UploadSettingsDB', 1);
        
        request.onupgradeneeded = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains('settings')) {
            db.createObjectStore('settings', { keyPath: 'id' });
          }
        };
        
        request.onsuccess = () => {
          const db = request.result;
          const tx = db.transaction('settings', 'readonly');
          const store = tx.objectStore('settings');
          
          const getRequest = store.get('defaultUploadSettings');
          
          getRequest.onsuccess = () => {
            if (getRequest.result) {
              console.log('[SettingsManager] Loaded settings from IndexedDB');
              resolve({
                ...DEFAULT_SETTINGS,
                ...getRequest.result.data
              });
            } else {
              // Try localStorage as fallback
              const savedSettings = localStorage.getItem('defaultUploadSettings');
              if (savedSettings) {
                try {
                  const parsed = JSON.parse(savedSettings);
                  console.log('[SettingsManager] Loaded settings from localStorage');
                  resolve({
                    ...DEFAULT_SETTINGS,
                    ...parsed
                  });
                } catch (e) {
                  console.error('[SettingsManager] Error parsing settings:', e);
                  resolve(DEFAULT_SETTINGS);
                }
              } else {
                resolve(DEFAULT_SETTINGS);
              }
            }
          };
          
          getRequest.onerror = () => {
            console.error('[SettingsManager] Error loading settings from IndexedDB');
            resolve(DEFAULT_SETTINGS);
          };
        };
        
        request.onerror = () => {
          console.error('[SettingsManager] Error opening IndexedDB');
          resolve(DEFAULT_SETTINGS);
        };
      });
    } else {
      // Fallback to localStorage
      const savedSettings = localStorage.getItem('defaultUploadSettings');
      if (savedSettings) {
        try {
          const parsed = JSON.parse(savedSettings);
          console.log('[SettingsManager] Loaded settings from localStorage');
          return {
            ...DEFAULT_SETTINGS,
            ...parsed
          };
        } catch (e) {
          console.error('[SettingsManager] Error parsing settings:', e);
        }
      }
    }
  } catch (e) {
    console.error('[SettingsManager] Error loading saved settings:', e);
  }
  
  return DEFAULT_SETTINGS;
}

/**
 * Save settings to persistent storage
 */
export async function saveSettings(settings: UploadSettings): Promise<boolean> {
  try {
    // Use IndexedDB instead of localStorage for better storage
    if ('indexedDB' in window) {
      return new Promise((resolve) => {
        const request = indexedDB.open('UploadSettingsDB', 1);
        
        request.onupgradeneeded = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains('settings')) {
            db.createObjectStore('settings', { keyPath: 'id' });
          }
        };
        
        request.onsuccess = () => {
          const db = request.result;
          const tx = db.transaction('settings', 'readwrite');
          const store = tx.objectStore('settings');
          
          store.put({ id: 'defaultUploadSettings', data: settings });
          
          tx.oncomplete = () => {
            console.log('[SettingsManager] Settings saved to IndexedDB');
            resolve(true);
          };
          
          tx.onerror = () => {
            console.error('[SettingsManager] Error saving settings to IndexedDB:', tx.error);
            // Try localStorage as fallback
            try {
              localStorage.setItem('defaultUploadSettings', JSON.stringify(settings));
              console.log('[SettingsManager] Settings saved to localStorage');
              resolve(true);
            } catch (e) {
              console.error('[SettingsManager] Error saving settings to localStorage:', e);
              resolve(false);
            }
          };
        };
        
        request.onerror = () => {
          console.error('[SettingsManager] Error opening IndexedDB:', request.error);
          // Try localStorage as fallback
          try {
            localStorage.setItem('defaultUploadSettings', JSON.stringify(settings));
            console.log('[SettingsManager] Settings saved to localStorage');
            resolve(true);
          } catch (e) {
            console.error('[SettingsManager] Error saving settings to localStorage:', e);
            resolve(false);
          }
        };
      });
    } else {
      // Fallback to localStorage
      localStorage.setItem('defaultUploadSettings', JSON.stringify(settings));
      console.log('[SettingsManager] Settings saved to localStorage');
      return true;
    }
  } catch (e) {
    console.error('[SettingsManager] Error saving settings:', e);
    return false;
  }
}

// Validate settings against the upload config
export function validateSettings(settings: UploadSettings): UploadSettings {
  const validatedSettings = { ...DEFAULT_SETTINGS, ...settings };
  
  // Ensure sane min/max values for various settings
  validatedSettings.maxConcurrent = Math.min(Math.max(validatedSettings.maxConcurrent, 1), 10);
  validatedSettings.maxConcurrentUploads = validatedSettings.maxConcurrent;
  
  validatedSettings.chunkSize = Math.min(Math.max(validatedSettings.chunkSize, 1024 * 1024), 50 * 1024 * 1024);
  validatedSettings.timeoutMs = Math.min(Math.max(validatedSettings.timeoutMs, 5000), 300000);
  validatedSettings.proxyTimeoutMs = Math.min(Math.max(validatedSettings.proxyTimeoutMs || 15000, 5000), 60000);
  
  validatedSettings.useTusThresholdMB = Math.min(Math.max(validatedSettings.useTusThresholdMB, 10), 5000);
  validatedSettings.retryAttempts = Math.min(Math.max(validatedSettings.retryAttempts, 0), 10);
  validatedSettings.sessionExpiryHours = Math.min(Math.max(validatedSettings.sessionExpiryHours, 1), 48);
  
  // Ensure the retry delays are present, with appropriate values
  if (!validatedSettings.retryDelays || !Array.isArray(validatedSettings.retryDelays) || validatedSettings.retryDelays.length === 0) {
    validatedSettings.retryDelays = [0, 3000, 10000, 30000, 60000];
  }
  
  return validatedSettings;
} 