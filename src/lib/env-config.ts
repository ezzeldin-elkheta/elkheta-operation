/**
 * Legacy environment configuration module
 * This file is deprecated - use src/lib/env.ts instead
 * Kept for compatibility until all imports are updated
 */

import { env, getBunnyApiKey, getGoogleSheetsConfig, EnvValidator } from './env';

// Re-export for compatibility
export const envConfig = {
  googleSheets: getGoogleSheetsConfig(),
  bunny: {
    apiKey: env.bunnyApiKey,
  }
};

// Re-export helper functions for compatibility  
export const ensureBunnyApiKey = getBunnyApiKey;
// Note: Removed local redefinition that was shadowing the validated getBunnyApiKey function
export { getBunnyApiKey };
export const checkEnvironmentHealth = EnvValidator.validateRequired;
export const validateEnvConfig = () => {
  const validation = EnvValidator.validateRequired();
  if (!validation.isValid) {
    console.error('Environment validation failed:', validation.errors);
    return false;
  }
  return true;
};

// Add more specific environment getters
export const getRequiredEnvVar = (name: string): string => {
  if (typeof process !== 'undefined' && process.env?.[name]) {
    return process.env[name];
  }
  if (typeof window !== 'undefined' && import.meta?.env?.[name]) {
    return import.meta.env[name];
  }
  throw new Error(`Required environment variable ${name} is not set`);
};

export const getOptionalEnvVar = (name: string, defaultValue: string): string => {
  if (typeof process !== 'undefined' && process.env?.[name]) {
    return process.env[name];
  }
  if (typeof window !== 'undefined' && import.meta?.env?.[name]) {
    return import.meta.env[name];
  }
  return defaultValue;
};
