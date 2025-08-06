import { cache } from '../cache';
import { dataStorage } from '../data-storage';
import { BASE_URL, VIDEO_BASE_URL } from './constants';
import { validateApiKeyFormat, maskApiKey, sanitizeForLogging } from '../crypto-utils';

export interface BunnyResponse<T = any> {
  items?: T[];
  totalItems?: number;
  error?: string;
}

export interface BunnyError extends Error {
  status?: number;
  detail?: string;
}

export class HttpClient {
  private apiKey: string | null = null;
  private videoApiKey: string | null = null;
  private libraryApiKeys: Map<string, string> = new Map();
  private lastRequestTime: number = 0;
  private requestDelay: number = 0;
  public readonly baseUrl: string = BASE_URL;
  public readonly videoBaseUrl: string = VIDEO_BASE_URL;

  constructor(apiKey?: string, videoApiKey?: string) {
    if (apiKey) this.apiKey = apiKey;
    if (videoApiKey) this.videoApiKey = videoApiKey;
  }

  /**
   * Set the delay between requests in milliseconds
   */
  setRequestDelay(delayMs: number): void {
    this.requestDelay = delayMs;
  }

  /**
   * Get the appropriate API key for a request
   */
  getApiKey(libraryId?: string, accessToken?: string): string {
    console.log(`[HttpClient] getApiKey called with libraryId: ${libraryId}, hasAccessToken: ${!!accessToken}`);
    
    // First try the access token if provided
    if (accessToken) {
      console.log('[HttpClient] Using provided access token');
      return accessToken;
    }

    // PRIORITIZE library-specific key if libraryId is provided
    if (libraryId) {
      console.log(`[HttpClient] Looking for library-specific key for library ${libraryId}`);
      
      // First check the in-memory map
      const cachedKey = this.libraryApiKeys.get(libraryId);
      if (cachedKey) {
        console.log(`[HttpClient] ✅ Found cached library key for ${libraryId}: ${cachedKey.substring(0, 8)}...`);
        return cachedKey;
      }
      
      // Then check the global cache for individual library data
      const libraryData = cache.get(`library_${libraryId}_data`);
      if (libraryData?.apiKey) {
        // Store in memory for future use
        this.libraryApiKeys.set(libraryId, libraryData.apiKey);
        console.log(`[HttpClient] ✅ Found library-specific key in cache for ${libraryId}: ${libraryData.apiKey.substring(0, 8)}...`);
        return libraryData.apiKey;
      }
      
      // Try to get from the library data storage
      const allLibraries = cache.get('library_data');
      console.log(`[HttpClient] Checking library_data cache, found: ${allLibraries ? 'Yes' : 'No'}`);
      if (allLibraries?.libraries) {
        console.log(`[HttpClient] Found ${allLibraries.libraries.length} libraries in cache`);
        const library = allLibraries.libraries.find(l => 
          l.id === libraryId || l.id.toString() === libraryId
        );
        if (library?.apiKey) {
          // Store in memory for future use
          this.libraryApiKeys.set(libraryId, library.apiKey);
          console.log(`[HttpClient] ✅ Found stored library key for ${libraryId} (${library.name}): ${library.apiKey.substring(0, 8)}...`);
          return library.apiKey;
        } else {
          console.log(`[HttpClient] ❌ Library ${libraryId} found but no apiKey, library:`, library ? library.name : 'not found');
        }
      }
      
      console.log(`[HttpClient] ❌ No library-specific key found for ${libraryId}`);
    }

    // Check environment variable as fallback
    const envApiKey = (typeof window !== 'undefined' && (window as any).__env?.VITE_BUNNY_API_KEY) || 
                      (typeof process !== 'undefined' && process.env?.VITE_BUNNY_API_KEY);
    
    if (envApiKey) {
      console.log(`[HttpClient] ⚠️ Using environment API key as fallback: ${envApiKey.substring(0, 8)}...`);
      return envApiKey;
    }

    // Fall back to instance API key
    if (this.apiKey) {
      console.log(`[HttpClient] ⚠️ Using instance API key as fallback: ${this.apiKey.substring(0, 8)}...`);
      return this.apiKey;
    }

    // Check cached default key
    const cachedDefaultKey = cache.get('default_api_key');
    if (cachedDefaultKey) {
      console.log(`[HttpClient] ⚠️ Using cached default key as fallback: ${cachedDefaultKey.substring(0, 8)}...`);
      return cachedDefaultKey;
    }

    console.error('[HttpClient] ❌ No API key available anywhere!', sanitizeForLogging({
      hasAccessToken: !!accessToken,
      hasEnvKey: !!envApiKey,
      hasLibraryId: !!libraryId,
      hasInstanceKey: !!this.apiKey,
      hasCachedDefault: !!cachedDefaultKey,
      libraryDataCacheKeys: Object.keys(cache.get('library_data') || {})
    }));

    throw new Error('No API key available. Please set VITE_BUNNY_API_KEY environment variable or provide an access token.');
  }

  setApiKey(apiKey: string): void {
    this.apiKey = apiKey;
  }

  setLibraryApiKey(libraryId: string, apiKey: string): void {
    this.libraryApiKeys.set(libraryId, apiKey);
  }

  /**
   * Helper function to add a delay between requests
   */
  private async addDelay(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    if (timeSinceLastRequest < this.requestDelay) {
      const delayNeeded = this.requestDelay - timeSinceLastRequest;
      await new Promise(resolve => setTimeout(resolve, delayNeeded));
    }
    
    this.lastRequestTime = Date.now();
  }

  public async fetchWithError<T = any>(path: string, options: RequestInit = {}): Promise<T> {
    try {
      // Add delay before request if configured
      if (this.requestDelay > 0) {
        await new Promise(resolve => setTimeout(resolve, this.requestDelay));
      }

      // Determine if this is a video/collection request
      const isVideoApi = this.shouldUseVideoApi(path);
      
      // Extract library ID from path for video/collection requests OR from body for create-video
      let libraryId: string | undefined;
      if (isVideoApi) {
        const match = path.match(/\/library\/(\d+)/);
        if (match) {
          libraryId = match[1];
        }
      }

      // Special case: For create-video endpoint, extract library ID from body
      if (path === '/api/proxy/create-video' && typeof options.body === 'string') {
        try {
          const bodyData = JSON.parse(options.body);
          if (bodyData.libraryId) {
            libraryId = bodyData.libraryId;
            console.log(`[HttpClient] Extracted library ID from create-video body: ${libraryId}`);
          }
        } catch (error) {
          console.warn('[HttpClient] Failed to parse create-video body for library ID:', error);
        }
      }

      // Get the appropriate API key
      const apiKeyToUse = this.getApiKey(libraryId);
      
      if (!apiKeyToUse) {
        throw new Error('API key not set. Please provide API key in headers or environment variable.');
      }

      // Validate the API key format before use
      if (!validateApiKeyFormat(apiKeyToUse)) {
        console.warn('[HttpClient] API key format validation failed:', maskApiKey(apiKeyToUse));
        // Don't throw error here, let the API return its own validation error
      }

      // Special handling for collection operations
      if (path.includes('/collections')) {
        console.log(`[HttpClient] Collection operation: ${options.method || 'GET'} ${path}`);
        
        // Ensure the path is routed through the video proxy
        const collectionPath = path.startsWith('/api/proxy/') ?
          path : `/api/proxy/video${this.cleanPath(path)}`;
        const finalUrl = `${window.location.origin}${collectionPath}`;
        
        console.log(`[HttpClient] Making collection request to: ${finalUrl}`);
        console.log(`[HttpClient] Using API key: ${maskApiKey(apiKeyToUse)}`);
        
        // Prepare headers with proper AccessKey
        const headers = new Headers(options.headers || {});
        headers.set('AccessKey', apiKeyToUse);
        headers.set('accesskey', apiKeyToUse); // Also set lowercase for compatibility
        headers.set('Content-Type', 'application/json');
        headers.set('Accept', 'application/json');
        
        console.log(`[HttpClient] Making collection request to: ${finalUrl}`);
        
        const response = await fetch(finalUrl, {
          ...options,
          headers,
          signal: options.signal || AbortSignal.timeout(60000) // 1 minute timeout for collections
        });

        console.log(`[HttpClient] Collection response status: ${response.status}`);

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`[HttpClient] Collection request failed:`, {
            url: finalUrl,
            status: response.status,
            statusText: response.statusText,
            response: errorText
          });
          
          // Enhanced error handling
          let errorMessage = `Collection request failed: ${response.status}`;
          if (response.status === 401) {
            errorMessage += ' - Authentication failed. Check API key.';
          } else if (response.status === 404) {
            errorMessage += ' - Collection or library not found.';
          } else if (response.status === 429) {
            errorMessage += ' - Rate limit exceeded. Please try again later.';
          }
          
          throw new Error(`${errorMessage}\nDetails: ${errorText}`);
        }

        const responseText = await response.text();
        
        try {
          const jsonData = JSON.parse(responseText);
          console.log(`[HttpClient] Collection operation successful`);
          return jsonData;
        } catch (parseError) {
          console.error(`[HttpClient] Failed to parse collection response:`, {
            parseError: parseError.message,
            responseText: responseText.substring(0, 500)
          });
          throw new Error(`Failed to parse JSON response: ${parseError.message}`);
        }
      }

      // Special handling for create-video endpoint
      if (path === '/api/proxy/create-video') {
        console.log(`[HttpClient] Using create-video endpoint`, {
          method: options.method,
          headers: Object.fromEntries(new Headers(options.headers || {}).entries()),
          bodyLength: typeof options.body === 'string' ? options.body.length : 'unknown'
        });
        
        // Parse the body to get library ID and set the correct API key
        let requestBody;
        let targetLibraryId: string | undefined;
        
        if (typeof options.body === 'string') {
          try {
            requestBody = JSON.parse(options.body);
            targetLibraryId = requestBody.libraryId;
            console.log(`[HttpClient] Found library ID in create-video body: ${targetLibraryId}`);
            
            // Get the correct API key for this library
            if (targetLibraryId) {
              const librarySpecificKey = this.getApiKey(targetLibraryId);
              requestBody.accessToken = librarySpecificKey;
              console.log(`[HttpClient] Using library-specific key for ${targetLibraryId}: ${librarySpecificKey.substring(0, 8)}...`);
            } else {
              requestBody.accessToken = apiKeyToUse;
              console.log(`[HttpClient] No library ID found, using fallback key: ${apiKeyToUse.substring(0, 8)}...`);
            }
          } catch (e) {
            console.error('[HttpClient] Failed to parse request body:', e);
            requestBody = { accessToken: apiKeyToUse };
          }
        } else {
          requestBody = { accessToken: apiKeyToUse };
        }
        
        // Prepare headers
        const headers = new Headers(options.headers || {});
        headers.set('Content-Type', 'application/json');
        headers.set('AccessKey', requestBody.accessToken);
        headers.set('accesskey', requestBody.accessToken);
        
        // Log the request we're about to make
        console.log('[HttpClient] Sending create-video request:', {
          url: `${window.location.origin}${path}`,
          method: options.method,
          headers: Object.fromEntries(headers.entries()),
          body: requestBody
        });
        
        // Make the request to our local proxy
        const response = await fetch(`${window.location.origin}${path}`, {
          ...options,
          headers,
          body: JSON.stringify(requestBody),
          signal: options.signal || AbortSignal.timeout(180000) // 3 minute timeout
        });

        // Log response details before checking status
        console.log('[HttpClient] Create video response:', {
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries())
        });

        const responseText = await response.text();
        console.log('[HttpClient] Create video raw response:', responseText);

        if (!response.ok) {
          console.error(`[HttpClient] Create video request failed:`, {
            status: response.status,
            statusText: response.statusText,
            headers: Object.fromEntries(response.headers.entries()),
            response: responseText
          });
          
          // Enhanced error handling for video creation
          let errorMessage = `Video creation failed: ${response.status}`;
          if (response.status === 401) {
            errorMessage += ' - Authentication failed. Check API key for the library.';
          } else if (response.status === 403) {
            errorMessage += ' - Access forbidden. Check library permissions.';
          } else if (response.status === 400) {
            errorMessage += ' - Bad request. Check video title and library ID.';
          } else if (response.status === 429) {
            errorMessage += ' - Rate limit exceeded. Please try again later.';
          }
          
          throw new Error(`${errorMessage}\nDetails: ${responseText}`);
        }

        try {
          const jsonResponse = JSON.parse(responseText);
          console.log('[HttpClient] Create video parsed response:', jsonResponse);
          return jsonResponse;
        } catch (e) {
          console.error('[HttpClient] Failed to parse create video response:', {
            error: e,
            responseText
          });
          throw new Error(`Failed to parse response: ${e.message}`);
        }
      }

      // Determine if we should use proxy
      const useProxy = this.shouldUseProxy(path);

      // Determine the effective base URL
      const baseUrl = isVideoApi ? this.videoBaseUrl : this.baseUrl;

      if (useProxy) {
        // Check if path already contains proxy prefix
        let finalUrl: string;
        if (path.startsWith('/api/proxy/')) {
          // Path already contains proxy prefix, use it as is
          finalUrl = `${window.location.origin}${path}`;
          console.log(`[HttpClient] Using proxy path as-is: ${path}`);
        } else {
          // Add proxy prefix
          const proxyPath = isVideoApi ? '/api/proxy/video' : '/api/proxy/base';
          const cleanPath = this.cleanPath(path);
          finalUrl = `${window.location.origin}${proxyPath}${cleanPath}`;
          console.log(`[HttpClient] Using proxy: ${proxyPath}${cleanPath}`);
        }
        
        // Prepare headers with proper API key transmission
        const headers = new Headers(options.headers || {});
        headers.set('AccessKey', apiKeyToUse);
        headers.set('accesskey', apiKeyToUse); // Also set lowercase for compatibility
        headers.set('Content-Type', 'application/json');
        headers.set('Accept', 'application/json');
        headers.set('Connection', 'keep-alive');
        
        console.log(`[HttpClient] Proxy headers:`, {
          'AccessKey': `${apiKeyToUse.substring(0, 8)}...`,
          'accesskey': `${apiKeyToUse.substring(0, 8)}...`,
          'Content-Type': headers.get('Content-Type'),
          'Accept': headers.get('Accept')
        });
        
        // Make the request through our proxy
        const response = await fetch(finalUrl, {
          ...options,
          headers,
          signal: options.signal || AbortSignal.timeout(180000) // 3 minute timeout
        });

        console.log(`[HttpClient] Proxy response status: ${response.status}`);
        console.log(`[HttpClient] Proxy response headers:`, Object.fromEntries(response.headers.entries()));

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`[HttpClient] Proxy request failed:`, {
            url: finalUrl,
            status: response.status,
            statusText: response.statusText,
            headers: Object.fromEntries(response.headers.entries()),
            response: errorText
          });
          throw new Error(`Request failed: ${response.status} ${errorText}`);
        }

        const responseText = await response.text();
        console.log(`[HttpClient] Proxy raw response:`, responseText.substring(0, 200) + '...');
        
        try {
          const jsonData = JSON.parse(responseText);
          console.log(`[HttpClient] Proxy parsed response successfully`);
          return jsonData;
        } catch (parseError) {
          console.error(`[HttpClient] Failed to parse proxy response:`, {
            parseError: parseError.message,
            responseText: responseText.substring(0, 500),
            isHTML: responseText.startsWith('<!DOCTYPE') || responseText.startsWith('<!doctype')
          });
          throw new Error(`Failed to parse JSON response: ${parseError.message}. Response was: ${responseText.substring(0, 200)}`);
        }
      }

      // For non-proxy requests, use the direct API URL
      const url = `${baseUrl}${path}`;
      console.log(`[HttpClient] Making direct request to: ${url}`);

      // Prepare headers
      const headers = new Headers(options.headers || {});
      headers.set('AccessKey', apiKeyToUse);
      headers.set('Connection', 'keep-alive');

      // Make the request
      const response = await fetch(url, {
        ...options,
        headers,
        signal: options.signal || AbortSignal.timeout(180000) // 3 minute timeout
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[HttpClient] Request failed: ${response.status} ${errorText}`);
        throw new Error(`Request failed: ${response.status} ${errorText}`);
      }

      return response.json();
    } catch (error) {
      console.error('[HttpClient] Error in fetchWithError:', error);
      throw error;
    }
  }

  private cleanPath(path: string): string {
    return path.startsWith('/') ? path : `/${path}`;
  }

  private createError(message: string, status: number): Error {
    const error = new Error(message) as BunnyError;
    error.status = status;
    return error;
  }

  private shouldUseVideoApi(path: string): boolean {
    return path.includes('/library/') && (path.includes('/videos') || path.includes('/collections'));
  }

  private shouldUseProxy(path: string): boolean {
    // Always use proxy when running on localhost development environment
    const isDevelopment = !import.meta.env.PROD || window.location.hostname === 'localhost';
    const isVercel = window.location.hostname.includes('vercel.app') || 
                    window.location.hostname.includes('app.vercel.com') ||
                    import.meta.env.VITE_VERCEL_ENV;
    
    // Always use proxy for paths that start with /api/proxy/
    const isProxyPath = path.startsWith('/api/proxy/');
    
    // In development, always use proxy to avoid CORS issues
    // In production or Vercel, use proxy for video API calls or proxy paths
    return isDevelopment || isVercel || this.shouldUseVideoApi(path) || isProxyPath;
  }
}
