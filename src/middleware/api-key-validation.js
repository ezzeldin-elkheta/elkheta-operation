/**
 * Secure middleware for API key validation and management
 */
import { validateApiKeyFormat, maskApiKey, sanitizeForLogging } from '../lib/crypto-utils.js';

export function createApiKeyValidationMiddleware() {
  return (req, res, next) => {
    // Skip validation for certain routes
    const skipRoutes = ['/health', '/api/auth-check', '/api/proxy/test'];
    if (skipRoutes.some(route => req.path.startsWith(route))) {
      return next();
    }

    // Skip for OPTIONS requests
    if (req.method === 'OPTIONS') {
      return next();
    }

    console.log(`[API Key Validation] ${req.method} ${req.path}`);
    
    // Extract API key from various header formats
    const apiKey = req.headers['accesskey'] || 
                   req.headers['AccessKey'] || 
                   req.headers['access-key'] ||
                   req.headers['Access-Key'] ||
                   req.headers['authorization']?.replace('Bearer ', '') ||
                   process.env.VITE_BUNNY_API_KEY;

    // Secure logging without exposing sensitive data
    console.log('[API Key Validation] Key sources:', {
      hasAccesskey: !!req.headers['accesskey'],
      hasAccessKey: !!req.headers['AccessKey'],
      hasAccessDash: !!req.headers['access-key'],
      hasAccessDashCap: !!req.headers['Access-Key'],
      hasAuthorization: !!req.headers['authorization'],
      hasEnvKey: !!process.env.VITE_BUNNY_API_KEY,
      finalKey: apiKey ? maskApiKey(apiKey) : 'None'
    });

    if (!apiKey) {
      console.error('[API Key Validation] No API key found for Bunny.net request');
      return res.status(401).json({
        error: 'Authentication required',
        message: 'No API key provided in request headers',
        expectedHeaders: ['AccessKey', 'accesskey', 'Access-Key', 'access-key'],
        receivedHeaders: sanitizeForLogging(Object.keys(req.headers))
      });
    }

    // Validate API key format
    if (!validateApiKeyFormat(apiKey)) {
      console.error('[API Key Validation] Invalid API key format detected');
      return res.status(401).json({
        error: 'Invalid API key format',
        message: 'The provided API key does not match the expected Bunny.net format',
        keyMask: maskApiKey(apiKey)
      });
    }

    // Add the API key to request for downstream use
    req.bunnyApiKey = apiKey;
    
    // Set header for proxy forwarding
    req.headers['AccessKey'] = apiKey;
    
    console.log(`[API Key Validation] ✅ Valid API key found (${apiKey.length} chars, format: ${maskApiKey(apiKey)})`);
    next();
  };
}

export function logApiKeyUsage(req, operation) {
  const apiKey = req.bunnyApiKey || req.headers['AccessKey'] || 'Not found';
  console.log(`[API Usage] ${operation}:`, {
    method: req.method,
    path: req.path,
    hasApiKey: !!apiKey,
    keyLength: typeof apiKey === 'string' ? apiKey.length : 0,
    keyMask: typeof apiKey === 'string' ? maskApiKey(apiKey) : 'None',
    timestamp: new Date().toISOString()
  });
}

export default {
  createApiKeyValidationMiddleware,
  logApiKeyUsage
};
