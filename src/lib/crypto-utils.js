/**
 * Secure crypto utilities for API key encryption and validation (ES Module version)
 */
import CryptoJS from 'crypto-js';

// Generate a secure encryption key from environment or fallback
const getEncryptionKey = () => {
  const envKey = process.env.VITE_ENCRYPTION_KEY;
  if (envKey) return envKey;
  
  // Fallback to a derived key (not ideal for production)
  const fallbackBase = 'bunny-video-app-secure-key-2024';
  return CryptoJS.SHA256(fallbackBase).toString();
};

/**
 * Encrypts an API key using AES encryption
 */
export function encryptApiKey(apiKey) {
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
export function decryptApiKey(encryptedKey) {
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
export function validateApiKeyFormat(apiKey) {
  if (!apiKey || typeof apiKey !== 'string') return false;
  
  // Check minimum/maximum length constraints
  if (apiKey.length < 20 || apiKey.length > 100) return false;
  
  // Bunny.net API keys can be:
  // 1. UUID format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx (36 chars)
  // 2. Long alphanumeric string (40+ chars)
  // 3. Mixed format with hyphens, underscores, dots
  
  // UUID pattern
  const uuidPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
  if (uuidPattern.test(apiKey)) return true;
  
  // Long alphanumeric pattern (with optional hyphens, underscores, dots)
  const longKeyPattern = /^[a-zA-Z0-9\-_\.]{20,100}$/;
  if (longKeyPattern.test(apiKey)) return true;
  
  // If it doesn't match known patterns but has reasonable length and chars, accept it
  // This is more permissive to handle various Bunny.net key formats
  const generalPattern = /^[a-zA-Z0-9\-_\.]{20,100}$/;
  return generalPattern.test(apiKey);
}

/**
 * Safely masks an API key for logging (shows only first 4 and last 4 characters)
 */
export function maskApiKey(apiKey) {
  if (!apiKey || apiKey.length < 8) return '***';
  
  return `${apiKey.substring(0, 4)}${'*'.repeat(apiKey.length - 8)}${apiKey.substring(apiKey.length - 4)}`;
}

/**
 * Generates a secure hash of an API key for comparison purposes
 */
export function hashApiKey(apiKey) {
  if (!apiKey) return '';
  
  return CryptoJS.SHA256(apiKey).toString();
}

/**
 * Sanitizes request/response data by removing sensitive information
 */
export function sanitizeForLogging(data) {
  if (!data || typeof data !== 'object') return data;
  
  const sensitiveKeys = [
    'apikey', 'api_key', 'accesskey', 'access_key', 'AccessKey',
    'password', 'secret', 'token', 'auth', 'authorization',
    'credentials', 'key', 'private_key', 'client_secret'
  ];
  
  const sanitized = { ...data };
  
  const sanitizeObject = (obj) => {
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
 * Environment variable validator with security checks
 */
export function validateEnvironmentSecurity() {
  const warnings = [];
  const recommendations = [];
  
  const apiKey = process.env.VITE_BUNNY_API_KEY;
  const encryptionKey = process.env.VITE_ENCRYPTION_KEY;
  
  // Check if API key is present
  if (!apiKey) {
    warnings.push('VITE_BUNNY_API_KEY is not set');
    recommendations.push('Set VITE_BUNNY_API_KEY in your environment variables');
  } else if (!validateApiKeyFormat(apiKey)) {
    warnings.push('VITE_BUNNY_API_KEY format appears invalid');
    recommendations.push('Verify your Bunny.net API key format');
  }
  
  // Check if encryption key is present
  if (!encryptionKey) {
    warnings.push('VITE_ENCRYPTION_KEY is not set - using fallback encryption');
    recommendations.push('Set VITE_ENCRYPTION_KEY for enhanced security');
  } else if (encryptionKey.length < 32) {
    warnings.push('VITE_ENCRYPTION_KEY is too short');
    recommendations.push('Use a longer encryption key (at least 32 characters)');
  }
  
  // Check if running in development with production keys
  if (process.env.NODE_ENV !== 'production' && apiKey && apiKey.length > 20) {
    warnings.push('Production API key detected in development environment');
    recommendations.push('Use separate API keys for development and production');
  }
  
  const isSecure = warnings.length === 0;
  
  return { isSecure, warnings, recommendations };
}