/**
 * Server route for diagnostics
 */
import { validateApiKeyFormat, maskApiKey } from '../src/lib/crypto-utils.js';

export default function diagnosticsRoute(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, AccessKey');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  try {
    // Test different ways to get the API key
    const accessKey = req.headers.accesskey || 
                     req.headers.AccessKey || 
                     req.headers['accesskey'] || 
                     req.headers['access-key'] ||
                     req.headers.authorization?.replace('Bearer ', '') ||
                     process.env.VITE_BUNNY_API_KEY;
    
    // Test API key by making a simple request to Bunny.net
    let bunnyTestResult = null;
    if (accessKey) {
      try {
        console.log('Testing API key with Bunny.net...');
        
        // We'll test this in the response, not actually call here for server-side
        bunnyTestResult = {
          success: validateApiKeyFormat(accessKey),
          message: validateApiKeyFormat(accessKey) ? 'API key format is valid' : 'API key format is invalid',
          keyLength: accessKey.length,
          keyPreview: maskApiKey(accessKey)
        };
        
      } catch (error) {
        console.error('Bunny.net API test failed:', error);
        bunnyTestResult = {
          success: false,
          message: `API test failed: ${error.message}`,
          error: error.message
        };
      }
    } else {
      bunnyTestResult = {
        success: false,
        message: 'No API key found to test'
      };
    }
    
    // Return comprehensive diagnostics
    res.status(200).json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      
      // Environment Info
      environment: {
        nodeEnv: process.env.NODE_ENV || 'development',
        hasEnvKey: !!process.env.VITE_BUNNY_API_KEY,
        envKeyLength: process.env.VITE_BUNNY_API_KEY ? process.env.VITE_BUNNY_API_KEY.length : 0
      },
      
      // API Key Sources
      apiKeySources: {
        fromAccesskeyHeader: !!req.headers.accesskey,
        fromAccessKeyHeader: !!req.headers.AccessKey,
        fromAccesskeyLower: !!req.headers['accesskey'],
        fromAccessDash: !!req.headers['access-key'],
        fromAuthorization: !!req.headers.authorization,
        fromEnvironment: !!process.env.VITE_BUNNY_API_KEY
      },
      
      // Final API Key Info
      apiKey: accessKey ? {
        configured: true,
        length: accessKey.length,
        preview: maskApiKey(accessKey),
        source: req.headers.accesskey ? 'accesskey header' : 
                req.headers.AccessKey ? 'AccessKey header' :
                req.headers['accesskey'] ? 'accesskey headers object' :
                req.headers['access-key'] ? 'access-key header' :
                req.headers.authorization ? 'authorization header' : 'environment variable',
        isValidFormat: validateApiKeyFormat(accessKey)
      } : {
        configured: false
      },
      
      // Bunny.net API Test
      bunnyApiTest: bunnyTestResult,
      
      // Request Headers (sanitized)
      requestHeaders: {
        hasAccessKey: !!req.headers.accesskey || !!req.headers.AccessKey,
        hasAuthorization: !!req.headers.authorization,
        userAgent: req.headers['user-agent'] || 'Unknown',
        contentType: req.headers['content-type'] || 'None'
      }
    });
    
  } catch (error) {
    console.error('Diagnostics error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error during diagnostics',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}
