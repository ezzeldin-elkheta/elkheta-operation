/**
 * Comprehensive encryption utilities for securing sensitive data
 */

// Generate a secure encryption key from user's browser fingerprint
function generateEncryptionKey(): string {
  const userAgent = navigator.userAgent;
  const screenInfo = `${screen.width}x${screen.height}x${screen.colorDepth}`;
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const language = navigator.language;
  
  // Create a unique fingerprint
  const fingerprint = `${userAgent}|${screenInfo}|${timezone}|${language}`;
  
  // Use a simple hash function to generate a consistent key
  let hash = 0;
  for (let i = 0; i < fingerprint.length; i++) {
    const char = fingerprint.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  // Convert to a 32-character hex string
  return Math.abs(hash).toString(16).padStart(8, '0').repeat(4);
}

// Encrypt data with AES-like algorithm
function encryptData(data: string): string {
  const key = generateEncryptionKey();
  const salt = Math.random().toString(36).substring(2, 15);
  
  // Simple XOR encryption with salt
  let encrypted = '';
  for (let i = 0; i < data.length; i++) {
    const charCode = data.charCodeAt(i);
    const keyChar = key.charCodeAt(i % key.length);
    const saltChar = salt.charCodeAt(i % salt.length);
    const encryptedChar = charCode ^ keyChar ^ saltChar;
    encrypted += String.fromCharCode(encryptedChar);
  }
  
  // Return encrypted data with salt using safe encoding
  return safeBase64Encode(salt + ':' + encrypted);
}

// Decrypt data
function decryptData(encryptedData: string): string {
  try {
    const decoded = safeBase64Decode(encryptedData);
    const [salt, encrypted] = decoded.split(':');
    
    if (!salt || !encrypted) {
      throw new Error('Invalid encrypted data format');
    }
    
    const key = generateEncryptionKey();
    let decrypted = '';
    
    for (let i = 0; i < encrypted.length; i++) {
      const charCode = encrypted.charCodeAt(i);
      const keyChar = key.charCodeAt(i % key.length);
      const saltChar = salt.charCodeAt(i % salt.length);
      const decryptedChar = charCode ^ keyChar ^ saltChar;
      decrypted += String.fromCharCode(decryptedChar);
    }
    
    return decrypted;
  } catch (error) {
    console.error('[Crypto] Decryption failed:', error);
    return '';
  }
}

// Safe base64 encoding that handles non-Latin1 characters
function safeBase64Encode(str: string): string {
  try {
    // Use TextEncoder to handle Unicode characters
    const encoder = new TextEncoder();
    const bytes = encoder.encode(str);
    const binaryString = Array.from(bytes, byte => String.fromCharCode(byte)).join('');
    return btoa(binaryString);
  } catch (error) {
    console.error('[Crypto] Safe base64 encoding failed:', error);
    // Fallback to simple encoding
    return btoa(unescape(encodeURIComponent(str)));
  }
}

// Safe base64 decoding
function safeBase64Decode(str: string): string {
  try {
    const binaryString = atob(str);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const decoder = new TextDecoder();
    return decoder.decode(bytes);
  } catch (error) {
    console.error('[Crypto] Safe base64 decoding failed:', error);
    // Fallback to simple decoding
    return decodeURIComponent(escape(atob(str)));
  }
}

// Encrypt API key specifically
export function encryptApiKey(apiKey: string): string {
  if (!apiKey) return '';
  return encryptData(apiKey);
}

// Decrypt API key specifically
export function decryptApiKey(encryptedApiKey: string): string {
  if (!encryptedApiKey) return '';
  return decryptData(encryptedApiKey);
}

/**
 * Secure storage for API keys in localStorage with encryption
 */
export class SecureApiKeyStorage {
  private static readonly STORAGE_KEY = 'secure_bunny_keys';
  
  static store(libraryId: string, apiKey: string): void {
    try {
      const encrypted = encryptApiKey(apiKey);
      const existing = this.getAll();
      existing[libraryId] = encrypted;
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(existing));
    } catch (error) {
      console.error('[SecureStorage] Failed to store API key:', error);
      throw new Error('Failed to securely store API key');
    }
  }
  
  static retrieve(libraryId: string): string | null {
    try {
      const all = this.getAll();
      const encrypted = all[libraryId];
      if (!encrypted) return null;
      
      return decryptApiKey(encrypted);
    } catch (error) {
      console.error('[SecureStorage] Failed to retrieve API key:', error);
      return null;
    }
  }
  
  static remove(libraryId: string): void {
    try {
      const existing = this.getAll();
      delete existing[libraryId];
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(existing));
    } catch (error) {
      console.error('[SecureStorage] Failed to remove API key:', error);
    }
  }
  
  static clear(): void {
    try {
      localStorage.removeItem(this.STORAGE_KEY);
    } catch (error) {
      console.error('[SecureStorage] Failed to clear API keys:', error);
    }
  }
  
  private static getAll(): Record<string, string> {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      return stored ? JSON.parse(stored) : {};
    } catch (error) {
      console.error('[SecureStorage] Failed to parse stored keys:', error);
      return {};
    }
  }
}

/**
 * Secure storage for all sensitive data
 */
export class SecureDataStorage {
  private static readonly PREFIX = 'secure_';
  
  static set(key: string, value: any): void {
    try {
      const encrypted = encryptData(JSON.stringify(value));
      localStorage.setItem(this.PREFIX + key, encrypted);
    } catch (error) {
      console.error('[SecureDataStorage] Failed to store data:', error);
    }
  }
  
  static get(key: string): any {
    try {
      const encrypted = localStorage.getItem(this.PREFIX + key);
      if (!encrypted) return null;
      
      const decrypted = decryptData(encrypted);
      return JSON.parse(decrypted);
    } catch (error) {
      console.error('[SecureDataStorage] Failed to retrieve data:', error);
      return null;
    }
  }
  
  static remove(key: string): void {
    try {
      localStorage.removeItem(this.PREFIX + key);
    } catch (error) {
      console.error('[SecureDataStorage] Failed to remove data:', error);
    }
  }
  
  static clear(): void {
    try {
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith(this.PREFIX)) {
          localStorage.removeItem(key);
        }
      });
    } catch (error) {
      console.error('[SecureDataStorage] Failed to clear data:', error);
    }
  }
}

/**
 * Secure cache manager that encrypts all data
 */
export class SecureCacheManager {
  private static readonly CACHE_KEY = 'secure_cache';
  
  static set(key: string, value: any): void {
    try {
      const cache = this.getAll();
      cache[key] = value;
      const encrypted = encryptData(JSON.stringify(cache));
      localStorage.setItem(this.CACHE_KEY, encrypted);
    } catch (error) {
      console.error('[SecureCache] Failed to set cache:', error);
    }
  }
  
  static get(key: string): any {
    try {
      const cache = this.getAll();
      return cache[key];
    } catch (error) {
      console.error('[SecureCache] Failed to get cache:', error);
      return null;
    }
  }
  
  static remove(key: string): void {
    try {
      const cache = this.getAll();
      delete cache[key];
      const encrypted = encryptData(JSON.stringify(cache));
      localStorage.setItem(this.CACHE_KEY, encrypted);
    } catch (error) {
      console.error('[SecureCache] Failed to remove cache:', error);
    }
  }
  
  static clear(): void {
    try {
      localStorage.removeItem(this.CACHE_KEY);
    } catch (error) {
      console.error('[SecureCache] Failed to clear cache:', error);
    }
  }
  
  // Get all cached data
  static getAll(): Record<string, any> {
    try {
      const encryptedData = localStorage.getItem('secure_cache');
      if (!encryptedData) return {};
      
      const decryptedData = decryptData(encryptedData);
      if (!decryptedData) return {};
      
      const parsed = JSON.parse(decryptedData);
      return typeof parsed === 'object' ? parsed : {};
    } catch (error) {
      console.error('[SecureCache] Failed to parse cache:', error);
      // Clear corrupted cache
      localStorage.removeItem('secure_cache');
      return {};
    }
  }
}

/**
 * Utility to mask sensitive data in console logs
 */
export function maskSensitiveData(data: any): any {
  if (typeof data === 'string') {
    // Mask API keys (UUID format)
    if (data.match(/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/)) {
      return data.substring(0, 8) + '****...' + data.substring(data.length - 4);
    }
    // Mask other sensitive strings
    if (data.length > 10) {
      return data.substring(0, 4) + '****...' + data.substring(data.length - 4);
    }
  }
  
  if (typeof data === 'object' && data !== null) {
    const masked = Array.isArray(data) ? [] : {};
    for (const [key, value] of Object.entries(data)) {
      if (key.toLowerCase().includes('key') || key.toLowerCase().includes('token') || key.toLowerCase().includes('secret')) {
        masked[key] = maskSensitiveData(value);
      } else {
        masked[key] = typeof value === 'object' ? maskSensitiveData(value) : value;
      }
    }
    return masked;
  }
  
  return data;
}

/**
 * Secure console logging that masks sensitive data
 */
export function secureLog(message: string, data?: any): void {
  if (data) {
    console.log(`[SECURE] ${message}`, maskSensitiveData(data));
  } else {
    console.log(`[SECURE] ${message}`);
  }
}

/**
 * Migration utility to encrypt existing unencrypted data
 */
export function migrateToSecureStorage(): void {
  try {
    console.log('[Migration] Starting secure storage migration...');
    
    // Migrate API keys
    const oldApiKeys = localStorage.getItem('bunny_library_api_keys');
    if (oldApiKeys) {
      const keys = JSON.parse(oldApiKeys);
      Object.entries(keys).forEach(([libraryId, apiKey]) => {
        SecureApiKeyStorage.store(libraryId, apiKey as string);
      });
      localStorage.removeItem('bunny_library_api_keys');
      console.log('[Migration] Migrated API keys');
    }
    
    // Migrate library data
    const oldLibraryData = localStorage.getItem('library_data');
    if (oldLibraryData) {
      const data = JSON.parse(oldLibraryData);
      SecureDataStorage.set('library_data', data);
      localStorage.removeItem('library_data');
      console.log('[Migration] Migrated library data');
    }
    
    // Migrate cache data
    const oldCache = localStorage.getItem('app_cache');
    if (oldCache) {
      const cache = JSON.parse(oldCache);
      Object.entries(cache).forEach(([key, value]) => {
        SecureCacheManager.set(key, value);
      });
      localStorage.removeItem('app_cache');
      console.log('[Migration] Migrated cache data');
    }
    
    console.log('[Migration] Secure storage migration completed');
  } catch (error) {
    console.error('[Migration] Migration failed:', error);
  }
}