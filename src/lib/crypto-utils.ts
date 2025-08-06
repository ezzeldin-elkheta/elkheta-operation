/**
 * Secure crypto utilities for API key encryption and validation
 */
import CryptoJS from 'crypto-js';
import { env } from './env'; // Use centralized env config

// Generate a secure encryption key from environment or fallback
const getEncryptionKey = (): string => {
  // Try to get encryption key from environment (works in both dev and production)
  const envKey = (typeof window !== 'undefined' && import.meta?.env?.VITE_ENCRYPTION_KEY) || 
    (typeof process !== 'undefined' && process.env?.VITE_ENCRYPTION_KEY);
    
  if (envKey) return envKey;
  
  // Fallback to a derived key (not ideal for production)
  const fallbackBase = 'bunny-video-app-secure-key-2024';
  return CryptoJS.SHA256(fallbackBase).toString();
};

/**
 * Encrypts an API key using AES encryption
 */
export function encryptApiKey(apiKey: string): string {
  if (!apiKey) return '';
  
  try {
    const key = getEncryptionKey();
    const encrypted = CryptoJS.AES.encrypt(apiKey, key).toString();
    return encrypted;
  } catch (error) {
    console.error('[CryptoUtils] Failed to encrypt API key:', error);
    throw new Error('Failed to encrypt API key');
  }
}

/**
 * Decrypts an encrypted API key
 */
export function decryptApiKey(encryptedKey: string): string {
  if (!encryptedKey) return '';
  
  try {
    const key = getEncryptionKey();
    const bytes = CryptoJS.AES.decrypt(encryptedKey, key);
    const decrypted = bytes.toString(CryptoJS.enc.Utf8);
    
    if (!decrypted) {
      throw new Error('Decryption returned empty result');
    }
    
    return decrypted;
  } catch (error) {
    console.error('[CryptoUtils] Failed to decrypt API key:', error);
    throw new Error('Failed to decrypt API key');
  }
}

/**
 * Validates an API key format (Bunny.net API keys can be various formats)
 */
export function validateApiKeyFormat(apiKey: string): boolean {
  if (!apiKey || typeof apiKey !== 'string') return false;
  
  // Check minimum/maximum length constraints
  if (apiKey.length < 20 || apiKey.length > 100) return false;
  
  // Bunny.net API keys can be:
  // 1. UUID format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx (36 chars)
  // 2. Long alphanumeric string (40+ chars)
  // 3. Mixed format with hyphens
  
  // UUID pattern
  const uuidPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
  if (uuidPattern.test(apiKey)) return true;
  
  // Long alphanumeric pattern (with optional hyphens)
  const longKeyPattern = /^[a-zA-Z0-9\-_]{20,100}$/;
  if (longKeyPattern.test(apiKey)) return true;
  
  // If it doesn't match known patterns but has reasonable length and chars, accept it
  // This is more permissive to handle various Bunny.net key formats
  const generalPattern = /^[a-zA-Z0-9\-_\.]{20,100}$/;
  return generalPattern.test(apiKey);
}

/**
 * Safely masks an API key for logging (shows only first 4 and last 4 characters)
 */
export function maskApiKey(apiKey: string): string {
  if (!apiKey || apiKey.length < 8) return '***';
  
  return `${apiKey.substring(0, 4)}${'*'.repeat(apiKey.length - 8)}${apiKey.substring(apiKey.length - 4)}`;
}

/**
 * Generates a secure hash of an API key for comparison purposes
 */
export function hashApiKey(apiKey: string): string {
  if (!apiKey) return '';
  
  return CryptoJS.SHA256(apiKey).toString();
}

/**
 * Sanitizes request/response data by removing sensitive information
 */
export function sanitizeForLogging(data: any): any {
  if (!data || typeof data !== 'object') return data;
  
  const sensitiveKeys = [
    'apikey', 'api_key', 'accesskey', 'access_key', 'AccessKey',
    'password', 'secret', 'token', 'auth', 'authorization',
    'credentials', 'key', 'private_key', 'client_secret'
  ];
  
  const sanitized = { ...data };
  
  const sanitizeObject = (obj: any): any => {
    if (Array.isArray(obj)) {
      return obj.map(item => sanitizeObject(item));
    }
    
    if (obj && typeof obj === 'object') {
      const result = {};
      for (const [key, value] of Object.entries(obj)) {
        const lowerKey = key.toLowerCase();
        if (sensitiveKeys.some(sensitive => lowerKey.includes(sensitive))) {
          result[key] = typeof value === 'string' ? maskApiKey(value) : '***';
        } else {
          result[key] = sanitizeObject(value);
        }
      }
      return result;
    }
    
    return obj;
  };
  
  return sanitizeObject(sanitized);
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
 * Environment variable validator with security checks
 */
export function validateEnvironmentSecurity(): {
  isSecure: boolean;
  warnings: string[];
  recommendations: string[];
} {
  const warnings: string[] = [];
  const recommendations: string[] = [];
  
  const apiKey = env.bunnyApiKey;
  
  // Check if API key is present
  if (!apiKey) {
    warnings.push('VITE_BUNNY_API_KEY is not set');
    recommendations.push('Set VITE_BUNNY_API_KEY in your environment variables');
  } else if (!validateApiKeyFormat(apiKey)) {
    warnings.push('VITE_BUNNY_API_KEY format appears invalid');
    recommendations.push('Verify your Bunny.net API key format');
  }
  
  // Check if running in development with production keys
  if (env.isDevelopment && apiKey && apiKey.length > 20) {
    warnings.push('Production API key detected in development environment');
    recommendations.push('Use separate API keys for development and production');
  }
  
  const isSecure = warnings.length === 0;
  
  return { isSecure, warnings, recommendations };
}