/**
 * Centralized Environment Configuration
 * 
 * This module provides a unified way to access environment variables
 * for both client-side (Vite) and server-side (Node.js) code.
 */

// Type definitions for environment variables
export interface EnvConfig {
  // Bunny.net Configuration
  bunnyApiKey: string | null;
  
  // Google Sheets Configuration
  googleSheetsSpreadsheetId: string | null;
  googleSheetsCredentialsJson: string | null;
  googleSheetName: string;
  
  // Application Configuration
  basePath: string;
  apiUrl: string;
  nodeEnv: string;
  
  // Runtime flags
  isDevelopment: boolean;
  isProduction: boolean;
}

/**
 * Get environment variable value with proper fallback for client/server contexts
 */
function getEnvVar(key: string): string | undefined {
  // In client-side Vite environment, use import.meta.env
  if (typeof window !== 'undefined' && import.meta?.env) {
    return import.meta.env[key];
  }
  
  // In server-side Node.js environment, use process.env
  if (typeof process !== 'undefined' && process.env) {
    return process.env[key];
  }
  
  return undefined;
}

/**
 * Get environment variable with validation
 */
function getRequiredEnvVar(key: string): string {
  const value = getEnvVar(key);
  if (!value) {
    throw new Error(`Required environment variable ${key} is not set`);
  }
  return value;
}

/**
 * Get environment variable with default value
 */
function getEnvVarWithDefault(key: string, defaultValue: string): string {
  return getEnvVar(key) ?? defaultValue;
}

/**
 * Create centralized environment configuration
 */
export function createEnvConfig(): EnvConfig {
  const nodeEnv = getEnvVarWithDefault('NODE_ENV', 'development');
  
  return {
    // Bunny.net Configuration
    bunnyApiKey: getEnvVar('VITE_BUNNY_API_KEY') || null,
    
    // Google Sheets Configuration  
    googleSheetsSpreadsheetId: getEnvVar('GOOGLE_SHEETS_SPREADSHEET_ID') || null,
    googleSheetsCredentialsJson: getEnvVar('GOOGLE_SHEETS_CREDENTIALS_JSON') || null,
    googleSheetName: getEnvVarWithDefault('GOOGLE_SHEET_NAME', 'OPERATIONS'),
    
    // Application Configuration
    basePath: getEnvVarWithDefault('VITE_BASE_PATH', '/'),
    apiUrl: getEnvVarWithDefault('VITE_API_URL', 'http://localhost:3000'),
    nodeEnv,
    
    // Runtime flags
    isDevelopment: nodeEnv === 'development',
    isProduction: nodeEnv === 'production'
  };
}

/**
 * Global environment configuration instance
 */
export const env = createEnvConfig();

/**
 * Validation functions
 */
export class EnvValidator {
  static validateBunnyApiKey(apiKey: string | null): { isValid: boolean; error?: string } {
    if (!apiKey) {
      return {
        isValid: false,
        error: 'VITE_BUNNY_API_KEY is not set. Please add it to your .env file.'
      };
    }
    
    if (apiKey === 'your_bunny_api_key_here') {
      return {
        isValid: false,
        error: 'VITE_BUNNY_API_KEY is still set to placeholder value. Please update it with your actual API key.'
      };
    }
    
    // Bunny.net API keys can be various formats - be more flexible
    if (apiKey.length < 20 || apiKey.length > 100) {
      return {
        isValid: false,
        error: `VITE_BUNNY_API_KEY length (${apiKey.length}) is outside expected range (20-100 characters).`
      };
    }
    
    // Allow more characters for different Bunny.net API key formats
    if (!/^[a-zA-Z0-9\-_\.]+$/.test(apiKey)) {
      return {
        isValid: false,
        error: 'VITE_BUNNY_API_KEY contains invalid characters. Only alphanumeric characters, hyphens, underscores, and dots are allowed.'
      };
    }
    
    return { isValid: true };
  }
  
  static validateRequired(): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    // Validate Bunny API key
    const bunnyValidation = this.validateBunnyApiKey(env.bunnyApiKey);
    if (!bunnyValidation.isValid && bunnyValidation.error) {
      errors.push(bunnyValidation.error);
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
  
  static logEnvironmentStatus(): void {
    console.group('🔧 Environment Configuration Status');
    
    console.log('Environment Variables:');
    console.log(`  NODE_ENV: ${env.nodeEnv}`);
    console.log(`  VITE_BUNNY_API_KEY: ${env.bunnyApiKey ? `[SET - ${env.bunnyApiKey.length} chars]` : '[NOT SET]'}`);
    console.log(`  GOOGLE_SHEETS_SPREADSHEET_ID: ${env.googleSheetsSpreadsheetId ? '[SET]' : '[NOT SET]'}`);
    console.log(`  GOOGLE_SHEETS_CREDENTIALS_JSON: ${env.googleSheetsCredentialsJson ? '[SET]' : '[NOT SET]'}`);
    console.log(`  GOOGLE_SHEET_NAME: ${env.googleSheetName}`);
    console.log(`  BASE_PATH: ${env.basePath}`);
    console.log(`  API_URL: ${env.apiUrl}`);
    
    const validation = this.validateRequired();
    if (!validation.isValid) {
      console.error('❌ Environment validation failed:');
      validation.errors.forEach(error => console.error(`  - ${error}`));
    } else {
      console.log('✅ All required environment variables are properly configured');
    }
    
    console.groupEnd();
  }
}

/**
 * Helper functions for specific use cases
 */
export function getBunnyApiKey(): string {
  const validation = EnvValidator.validateBunnyApiKey(env.bunnyApiKey);
  if (!validation.isValid) {
    throw new Error(validation.error || 'Invalid Bunny API key');
  }
  return env.bunnyApiKey!;
}

export function getGoogleSheetsConfig() {
  if (!env.googleSheetsSpreadsheetId || !env.googleSheetsCredentialsJson) {
    return null;
  }
  
  try {
    const credentials = JSON.parse(env.googleSheetsCredentialsJson);
    return {
      spreadsheetId: env.googleSheetsSpreadsheetId,
      credentials,
      sheetName: env.googleSheetName
    };
  } catch (error) {
    console.error('Failed to parse Google Sheets credentials JSON:', error);
    return null;
  }
}

// Auto-log environment status in development
if (env.isDevelopment && typeof console !== 'undefined') {
  setTimeout(() => {
    EnvValidator.logEnvironmentStatus();
  }, 1000);
}