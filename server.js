import express from 'express';
import cors from 'cors';
import { google } from 'googleapis';
import dotenv from 'dotenv';
import path from 'path';
import { createProxyMiddleware } from 'http-proxy-middleware';
import multer from 'multer';
import { fileURLToPath } from 'url';
import axios from 'axios'; // Add this import
import fs from 'fs';
import { JWT } from 'google-auth-library';

// Define __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3004;

// CORS configuration based on environment
const allowedOrigins = [
  'http://localhost:800',
  'http://localhost:5173',
  'http://10.0.0.168:800',
  'http://10.0.0.207:800',
  'http://10.0.0.207:3004', // Add this missing origin
  'http://localhost:3004',
  'http://localhost:3001'
];

const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // Check if origin is in allowed list
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    
    // Allow any port from known IPs (more flexible approach)
    const allowedIPs = ['10.0.0.207', '10.0.0.168', '127.0.0.1', 'localhost'];
    const originUrl = new URL(origin);
    const originHost = originUrl.hostname;
    
    if (allowedIPs.includes(originHost)) {
      console.log(`[CORS] Allowing origin from known IP: ${origin}`);
      return callback(null, true);
    }
    
    const msg = `CORS policy does not allow access from origin ${origin}. Allowed: ${allowedOrigins.join(',')}`;
    console.warn(`[CORS] Blocked origin: ${origin}`);
    return callback(new Error(msg), false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'AccessKey']
};

app.use(cors(corsOptions));
// Use express.json() but skip for proxy routes to preserve raw body stream
app.use((req, res, next) => {
  // Allow JSON parsing for specific endpoints that need it
  if (req.path === '/api/proxy/create-video' || 
      req.path.startsWith('/api/diagnostics') || 
      req.path.startsWith('/api/auth-check') ||
      req.path.startsWith('/api/clear-cache') ||
      req.path.startsWith('/api/update-sheet') ||
      !req.path.startsWith('/api/proxy/')) {
    // Use JSON parsing for these endpoints
    return express.json()(req, res, next);
  }
  
  // Skip JSON parsing for other proxy routes to preserve raw body stream
  console.log(`[Express] Skipping JSON parsing for proxy route: ${req.path}`);
  return next();
});

// Proxy Middleware Setup
const defaultBunnyApiKey = process.env.VITE_BUNNY_API_KEY; // Keep the default key
console.log("🔑 Bunny API Key Status:", {
  hasEnvKey: !!defaultBunnyApiKey,
  keyLength: defaultBunnyApiKey ? defaultBunnyApiKey.length : 0,
  keyPreview: defaultBunnyApiKey ? maskApiKey(defaultBunnyApiKey) : 'Not set',
  isValidFormat: defaultBunnyApiKey ? validateApiKeyFormat(defaultBunnyApiKey) : false
});

if (!defaultBunnyApiKey) {
  console.warn("⚠️ WARN: VITE_BUNNY_API_KEY is not set in the environment variables. Proxy might fail if no key is provided in requests.");
  console.warn("⚠️ Please check your .env file and restart the server.");
}

// Import the custom middleware
import { createBunnyVideoProxyMiddleware } from './src/server-middleware.js';
import { createApiKeyValidationMiddleware } from './src/middleware/api-key-validation.js';
import { maskApiKey, sanitizeForLogging, validateApiKeyFormat } from './src/lib/crypto-utils.js';

// Apply API key validation middleware for Bunny.net routes
app.use('/api/proxy', createApiKeyValidationMiddleware());

// Apply our custom middleware before the proxy middleware
app.use(createBunnyVideoProxyMiddleware({ defaultApiKey: defaultBunnyApiKey }));

// Authentication check endpoint
app.get('/api/auth-check', (req, res) => {
  try {
    const apiKey = req.headers['accesskey'] || req.headers['AccessKey'] || defaultBunnyApiKey;
    
    if (!apiKey) {
      return res.status(401).json({
        authenticated: false,
        message: 'No API key provided'
      });
    }

    const isValidFormat = validateApiKeyFormat(apiKey);
    
    res.json({
      authenticated: true,
      hasApiKey: true,
      keyLength: apiKey.length,
      keyMask: maskApiKey(apiKey),
      isValidFormat,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[Auth Check] Error:', error);
    res.status(500).json({
      authenticated: false,
      error: 'Internal server error'
    });
  }
});

// Diagnostics endpoint
app.get('/api/diagnostics', (req, res) => {
  try {
    // Test different ways to get the API key
    const accessKey = req.headers.accesskey || 
                     req.headers.AccessKey || 
                     req.headers['accesskey'] || 
                     req.headers['access-key'] ||
                     req.headers.authorization?.replace('Bearer ', '') ||
                     defaultBunnyApiKey;
    
    // Test API key format
    let bunnyTestResult = null;
    if (accessKey) {
      bunnyTestResult = {
        success: validateApiKeyFormat(accessKey),
        message: validateApiKeyFormat(accessKey) ? 'API key format is valid' : 'API key format is invalid',
        keyLength: accessKey.length,
        keyPreview: maskApiKey(accessKey)
      };
    } else {
      bunnyTestResult = {
        success: false,
        message: 'No API key found to test'
      };
    }
    
    // Return comprehensive diagnostics
    res.json({
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
      bunnyApiTest: bunnyTestResult
    });
    
  } catch (error) {
    console.error('[Diagnostics] Error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error during diagnostics',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Clear cache endpoint
app.post('/api/clear-cache', (req, res) => {
  try {
    console.log('[Cache Clear] Clearing all cached API keys');
    
    res.json({
      success: true,
      message: 'Cache clear request processed',
      instructions: {
        clearLocalStorage: [
          'bunny_api_key',
          'app_cache',
          'library_data'
        ],
        clearCacheKeys: [
          'default_api_key',
          'library_*_api',
          'library_*_data'
        ]
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('[Cache Clear] Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error clearing cache',
      error: error.message
    });
  }
});

// Specialized endpoint for creating video entries
app.post('/api/proxy/create-video', async (req, res) => {
  try {
    console.log('[CreateVideo] Starting request handling...');
    console.log('[CreateVideo] Request body status:', {
      hasBody: !!req.body,
      bodyType: typeof req.body,
      bodyContent: req.body,
      contentType: req.headers['content-type'],
      contentLength: req.headers['content-length']
    });
    
    if (!req.body || typeof req.body !== 'object') {
      return res.status(400).json({
        success: false,
        error: 'Invalid request body. Expected JSON object.',
        bodyReceived: req.body
      });
    }
    
    const { libraryId, title, collectionId, accessToken } = req.body;

    // Log request headers (sanitized)
    console.log('[CreateVideo] Request headers:', sanitizeForLogging({
      ...req.headers,
      accesskey: req.headers.accesskey ? maskApiKey(req.headers.accesskey) : undefined
    }));

    // Log full request details
    console.log('[CreateVideo] Full request details:', {
      libraryId,
      title,
      collectionId,
      hasAccessToken: !!accessToken,
      accessTokenLength: accessToken?.length,
      method: req.method,
      url: req.url,
      path: req.path
    });

    // Validate required parameters
    if (!libraryId || !title) {
      console.error('[CreateVideo] Missing required parameters:', { libraryId, title });
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    // Validate access token
    if (!accessToken) {
      console.error('[CreateVideo] Missing access token');
      return res.status(401).json({ error: 'Missing access token' });
    }

    // Prepare request data
    const requestData = {
      title: title.replace(/\.[^/.]+$/, ''), // Remove file extension
      collectionId: collectionId // Use the collection GUID directly
    };

    // Log the full request we're about to send
    console.log('[CreateVideo] Sending request to Bunny.net:', sanitizeForLogging({
      url: `https://video.bunnycdn.com/library/${libraryId}/videos`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'AccessKey': accessToken ? maskApiKey(accessToken) : 'Not provided'
      },
      data: requestData
    }));

    try {
      // Make request to Bunny.net
      const response = await fetch(`https://video.bunnycdn.com/library/${libraryId}/videos`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'AccessKey': accessToken
        },
        body: JSON.stringify(requestData)
      });

      // Log response headers
      console.log('[CreateVideo] Bunny.net response headers:', {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries())
      });

      const responseText = await response.text();
      console.log('[CreateVideo] Raw response:', responseText);

      // Handle empty response
      if (!responseText.trim()) {
        console.error('[CreateVideo] Empty response from Bunny.net');
        return res.status(502).json({ 
          error: 'Empty response from Bunny.net',
          details: {
            status: response.status,
            statusText: response.statusText,
            requestData,
            headers: Object.fromEntries(response.headers.entries())
          }
        });
      }

      let responseData;
      try {
        responseData = JSON.parse(responseText);
      } catch (e) {
        console.error('[CreateVideo] Failed to parse response:', {
          error: e.message,
          responseText,
          status: response.status
        });
        return res.status(502).json({ 
          error: 'Invalid JSON response from Bunny.net',
          rawResponse: responseText,
          parseError: e.message,
          requestData,
          details: {
            status: response.status,
            statusText: response.statusText,
            headers: Object.fromEntries(response.headers.entries())
          }
        });
      }

      if (!response.ok) {
        console.error('[CreateVideo] Error response:', {
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries()),
          body: responseData,
          requestData
        });
        return res.status(response.status).json({
          error: responseData.Message || 'Unknown error from Bunny.net',
          details: responseData,
          requestData,
          status: response.status
        });
      }

      // Return the parsed response
      return res.json(responseData);
    } catch (error) {
      console.error('[CreateVideo] Unexpected error:', {
        error: error.message,
        stack: error.stack,
        name: error.name
      });
      return res.status(500).json({ 
        error: error.message,
        type: error.name,
        details: error.stack
      });
    }
  } catch (error) {
    console.error('[CreateVideo] Unexpected error:', {
      error: error.message,
      stack: error.stack,
      name: error.name
    });
    return res.status(500).json({ 
      error: error.message,
      type: error.name,
      details: error.stack
    });
  }
});

// === Collection Routes (explicit to avoid proxy 500) ===
app.get('/api/proxy/video/library/:libraryId/collections', async (req, res) => {
  try {
    const { libraryId } = req.params;
    const apiKey = req.headers['accesskey'] || req.headers['AccessKey'];

    if (!libraryId) return res.status(400).json({ error: 'Missing libraryId' });
    if (!apiKey) return res.status(401).json({ error: 'Missing AccessKey header' });

    const response = await fetch(`https://video.bunnycdn.com/library/${libraryId}/collections`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'AccessKey': apiKey
      }
    });

    const text = await response.text();
    if (!response.ok) {
      console.error('[Collection GET] Bunny error', response.status, text);
      return res.status(response.status).json({ error: 'Bunny API error', details: text });
    }
    return res.status(200).json(JSON.parse(text));
  } catch (err) {
    console.error('[Collection GET] Internal error', err);
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
});

app.post('/api/proxy/video/library/:libraryId/collections', async (req, res) => {
  try {
    const { libraryId } = req.params;
    const { name } = req.body || {};
    const apiKey = req.headers['accesskey'] || req.headers['AccessKey'];

    if (!libraryId || !name) return res.status(400).json({ error: 'Missing parameters' });
    if (!apiKey) return res.status(401).json({ error: 'Missing AccessKey header' });

    const response = await fetch(`https://video.bunnycdn.com/library/${libraryId}/collections`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'AccessKey': apiKey
      },
      body: JSON.stringify({ name })
    });

    const text = await response.text();
    if (!response.ok) {
      console.error('[Collection POST] Bunny error', response.status, text);
      return res.status(response.status).json({ error: 'Bunny API error', details: text });
    }
    return res.status(200).json(JSON.parse(text));
  } catch (err) {
    console.error('[Collection POST] Internal error', err);
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
});

// Import API handlers for direct routing (better than proxy middleware)
import videolibrary from './pages/api/proxy/base/videolibrary.js';

// Define specific routes before general proxy middleware
app.all('/api/proxy/base/videolibrary*', videolibrary);

// Apply proxy middleware with enhanced error handling
app.use('/api/proxy/base', createProxyMiddleware({
  target: 'https://api.bunny.net',
  changeOrigin: true,
  secure: false,
  proxyTimeout: 180000, // 3 minute timeout
  timeout: 180000, // 3 minute timeout
  pathRewrite: {
    '^/api/proxy/base': '',
  },
  onProxyReq: (proxyReq, req, res) => {
    proxyReq.removeHeader('origin');
    proxyReq.removeHeader('referer');
    proxyReq.removeHeader('host');

    // Use the AccessKey sent by the client, fallback to default if necessary
    const accessKey = req.headers['accesskey'] || defaultBunnyApiKey;

    if (!accessKey) {
      console.error('[Proxy Base] Missing AccessKey for request:', req.method, req.originalUrl);
      proxyReq.abort();
      if (!res.headersSent) {
        res.status(401).json({ message: 'Missing API Key' });
      }
      return;
    }

    proxyReq.setHeader('AccessKey', accessKey);
    proxyReq.setHeader('Connection', 'keep-alive');

    // Handle request body for POST/PUT/PATCH
    if ((req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') && req.body && Object.keys(req.body).length > 0) {
       try {
         let bodyData = JSON.stringify(req.body);
         // Ensure Content-Type is set correctly for JSON
         if (!proxyReq.getHeader('Content-Type')) {
            proxyReq.setHeader('Content-Type','application/json');
         }
         proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData));
         console.log(`[Proxy Base] Forwarding ${req.method} to ${proxyReq.path} with body: ${bodyData.substring(0, 100)}...`);
         proxyReq.write(bodyData);
       } catch (error) {
          console.error("[Proxy Base] Error stringifying request body:", error);
          proxyReq.abort(); // Abort if body cannot be processed
       }
    } else if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
        // If body is empty or not present for relevant methods, ensure Content-Length is 0
        proxyReq.setHeader('Content-Length', '0');
        console.log(`[Proxy Base] Forwarding ${req.method} to ${proxyReq.path} with empty body.`);
        // Don't remove Content-Type here, let the target API handle it if needed
    }
  },
  onError: (err, req, res) => {
    console.error('[Proxy Base] Error:', err);
    if (!res.headersSent) {
      res.status(504).json({
        error: 'Gateway Timeout',
        message: `Error occurred while trying to proxy: ${err.message || 'Unknown error'}`
      });
    }
  }
}));

app.use('/api/proxy/video', (req, res, next) => {
  console.log(`[Proxy Video] Incoming request: ${req.method} ${req.originalUrl}`);
  console.log(`[Proxy Video] Headers:`, Object.keys(req.headers));
  console.log(`[Proxy Video] Request body stream status:`, {
    bodyParsed: req.body !== undefined,
    bodySize: req.body ? JSON.stringify(req.body).length : 0,
    contentLength: req.headers['content-length']
  });
  
  try {
    next();
  } catch (error) {
    console.error(`[Proxy Video] Error in proxy middleware:`, error);
    res.status(500).json({ error: 'Proxy middleware error', details: error.message });
  }
}, createProxyMiddleware({
  target: 'https://video.bunnycdn.com',
  changeOrigin: true,
  secure: false,
  proxyTimeout: 180000, // 3 minute timeout
  timeout: 180000, // 3 minute timeout
  pathRewrite: {
    '^/api/proxy/video': '',
  },
  onProxyReq: (proxyReq, req, res) => {
    proxyReq.removeHeader('origin');
    proxyReq.removeHeader('referer');
    proxyReq.removeHeader('host');

    // Use the AccessKey sent by the client, fallback to default if necessary
    const accessKey = req.headers['accesskey'] || defaultBunnyApiKey;

    if (!accessKey) {
      console.error('[Proxy Video] Missing AccessKey for request:', req.method, req.originalUrl);
      proxyReq.abort();
      if (!res.headersSent) {
        res.status(401).json({ message: 'Missing API Key' });
      }
      return;
    }

    proxyReq.setHeader('AccessKey', accessKey);
    proxyReq.setHeader('Connection', 'keep-alive');

    // Handle request body for POST/PUT/PATCH
    if ((req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') && req.body && Object.keys(req.body).length > 0) {
       try {
         let bodyData = JSON.stringify(req.body);
         // Ensure Content-Type is set correctly for JSON
         if (!proxyReq.getHeader('Content-Type')) {
            proxyReq.setHeader('Content-Type','application/json');
         }
         proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData));
         console.log(`[Proxy Video] Forwarding ${req.method} to ${proxyReq.path} with body: ${bodyData.substring(0, 100)}...`);
         proxyReq.write(bodyData);
       } catch (error) {
          console.error("[Proxy Video] Error stringifying request body:", error);
          proxyReq.abort(); // Abort if body cannot be processed
       }
    } else if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
        // If body is empty or not present for relevant methods, ensure Content-Length is 0
        proxyReq.setHeader('Content-Length', '0');
        console.log(`[Proxy Video] Forwarding ${req.method} to ${proxyReq.path} with empty body.`);
        // Don't remove Content-Type here, let the target API handle it if needed
    }
  },
  onProxyReq: (proxyReq, req, res) => {
    console.log(`[Proxy Video] ✓ onProxyReq CALLED! Proxying ${req.method} ${req.originalUrl} to ${proxyReq.path}`);
    console.log(`[Proxy Video] Headers being sent:`, proxyReq.getHeaders());
  },
  onProxyRes: (proxyRes, req, res) => {
    console.log(`[Proxy Video] Response from ${req.originalUrl}: ${proxyRes.statusCode}`);
    
    if (proxyRes.statusCode >= 400) {
      let body = '';
      proxyRes.on('data', (chunk) => {
        body += chunk;
      });
      proxyRes.on('end', () => {
        console.error(`[Proxy Video] Error response: ${proxyRes.statusCode} - ${body}`);
      });
    } else {
      console.log(`[Proxy Video] Success response from ${req.originalUrl}`);
    }
  },
  onError: (err, req, res) => {
    console.error('[Proxy Video] Error:', err);
    if (!res.headersSent) {
      res.status(504).json({
        error: 'Gateway Timeout',
        message: `Error occurred while trying to proxy: ${err.message || 'Unknown error'}`
      });
    }
  }
}));


// --- Other API Endpoints ---

// File upload endpoint (Using multer) - Disabled as PUT proxy should handle uploads
const upload = multer({ storage: multer.memoryStorage() });
app.post('/api/proxy/video/upload/:guid', upload.single('file'), async (req, res) => {
   console.warn("Received request to deprecated POST upload endpoint. Use PUT to /api/proxy/video/:guid");
   res.status(501).json({ message: "Direct POST upload endpoint disabled, use PUT to /api/proxy/video/:guid" });
});

// Sheets update endpoint
app.post('/api/sheets/update-bunny-embeds', async (req, res) => {
  const overallStartTime = Date.now();
  try {
    const { 
      videos, 
      spreadsheetId: customSpreadsheetId, 
      sheetName: customSheetName, 
      nameColumn = 'M', 
      embedColumn = 'V', 
      finalMinutesColumn = 'P' 
    } = req.body;
    
    // Enhanced logging for debugging
    console.log(`\n🔍 [Sheet Update] ================================`);
    console.log(`[Sheet Update] Received request with ${videos ? videos.length : 0} videos`);
    console.log(`[Sheet Update] 🔧 RAW REQUEST BODY:`, JSON.stringify(req.body, null, 2));
    
    if (videos && videos.length > 0) {
      console.log(`[Sheet Update] Videos to update:`);
      videos.forEach((video, index) => {
        console.log(`  ${index + 1}. "${video.name}" (embed: ${video.embed_code ? 'YES' : 'NO'})`);
      });
    }
    
    console.log(`[Sheet Update] 🔍 DESTRUCTURED VALUES:`);
    console.log(`  customSpreadsheetId: ${customSpreadsheetId || 'undefined'}`);
    console.log(`  customSheetName: ${customSheetName || 'undefined'}`);
    console.log(`  nameColumn: ${nameColumn}`);
    console.log(`  embedColumn: ${embedColumn}`);
    console.log(`  finalMinutesColumn: ${finalMinutesColumn}`);
    
    // Use custom sheet config if provided, otherwise use environment defaults
    const spreadsheetId = customSpreadsheetId || process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
    const sheetName = customSheetName || process.env.GOOGLE_SHEET_NAME || 'OPERATIONS';
    
    console.log(`\n📊 [Sheet Update] Configuration:`);
    if (customSpreadsheetId) {
      console.log(`  � Using CUSTOM sheet config:`);
      console.log(`    - Spreadsheet ID: ${customSpreadsheetId}`);
      console.log(`    - Sheet Name: ${sheetName}`);
      console.log(`    - Name Column: ${nameColumn}`);
      console.log(`    - Embed Column: ${embedColumn}`);
      console.log(`    - Minutes Column: ${finalMinutesColumn}`);
    } else {
      console.log(`  📄 Using ENVIRONMENT defaults:`);
      console.log(`    - Spreadsheet ID: ${spreadsheetId}`);
      console.log(`    - Sheet Name: ${sheetName}`);
      console.log(`    - Name Column: M (default)`);
      console.log(`    - Embed Column: V (default)`);
      console.log(`    - Minutes Column: P (default)`);
    }
    console.log(`[Sheet Update] ================================\n`);

    if (!Array.isArray(videos) || videos.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'No videos provided',
        results: [],
        stats: { updated: 0, notFound: 0, skipped: 0, error: 0 }
      });
    }

    // Validate environment variables
    if (!process.env.GOOGLE_SHEETS_CREDENTIALS_JSON) {
      console.error('Error: GOOGLE_SHEETS_CREDENTIALS_JSON is not set in .env file');
      return res.status(500).json({ success: false, message: 'Invalid Google Sheets credentials configuration' });
    }

    let credentials;
    try {
      credentials = JSON.parse(process.env.GOOGLE_SHEETS_CREDENTIALS_JSON);
      if (!credentials.client_email || !credentials.private_key) {
        console.error('Error: Invalid credentials format in GOOGLE_SHEETS_CREDENTIALS_JSON');
        return res.status(500).json({ success: false, message: 'Invalid Google Sheets credentials configuration' });
      }
    } catch (error) {
      console.error('Error: Failed to parse GOOGLE_SHEETS_CREDENTIALS_JSON:', error.message);
      return res.status(500).json({ success: false, message: 'Invalid Google Sheets credentials configuration' });
    }

    if (!spreadsheetId) {
      return res.status(500).json({ success: false, message: 'Google Sheet Spreadsheet ID not configured.' });
    }

    // Create a new JWT client with proper configuration
    const auth = new google.auth.JWT({
      email: credentials.client_email,
      key: credentials.private_key,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
      subject: credentials.client_email,
      // Set token expiration to 1 hour from now
      exp: Math.floor(Date.now() / 1000) + 3600,
      iat: Math.floor(Date.now() / 1000)
    });

    const sheets = google.sheets({ version: 'v4', auth });

    // Helper function to convert column letter to index (A=0, B=1, etc.)
    function columnToIndex(column) {
      let index = 0;
      for (let i = 0; i < column.length; i++) {
        index = index * 26 + (column.charCodeAt(i) - 'A'.charCodeAt(0) + 1);
      }
      return index - 1;
    }

    // Calculate column indices
    const nameColumnIndex = columnToIndex(nameColumn);
    const embedColumnIndex = columnToIndex(embedColumn);
    const finalMinutesColumnIndex = columnToIndex(finalMinutesColumn);
    
    console.log(`[Sheet Update] Using columns: ${nameColumn} (index ${nameColumnIndex}), ${embedColumn} (index ${embedColumnIndex}), ${finalMinutesColumn} (index ${finalMinutesColumnIndex})`);

    // Get existing data - expand range to ensure we capture all needed columns
    // Calculate the rightmost column we need (between embed and final minutes columns)
    const maxColumnIndex = Math.max(embedColumnIndex, finalMinutesColumnIndex);
    
    // Convert back to column letter - Fixed for multi-letter columns
    function indexToColumn(index) {
      let column = '';
      while (index >= 0) {
        column = String.fromCharCode((index % 26) + 'A'.charCodeAt(0)) + column;
        index = Math.floor(index / 26) - 1;
      }
      return column;
    }
    
    // Use the actual column with the highest index, not converted back
    const allColumns = [nameColumn, embedColumn, finalMinutesColumn];
    const allColumnIndices = [nameColumnIndex, embedColumnIndex, finalMinutesColumnIndex];
    const maxIndex = Math.max(...allColumnIndices);
    const endColumnFromOriginal = allColumns[allColumnIndices.indexOf(maxIndex)];
    
    // Always start range from column A so that the indices we calculated match Google Sheets API response
    // If we start at nameColumn (e.g., N), the returned rows will be offset and indices 0..n will no longer correspond
    // to original sheet indices, causing lookup failures. Fetching from A preserves absolute positions.
    const rangeToRead = `${sheetName}!A:${endColumnFromOriginal}`;
    
    console.log(`[Sheet Update] 🔍 READING FROM CUSTOM SHEET:`);
    console.log(`[Sheet Update] 📊 Spreadsheet ID: ${spreadsheetId}`);
    console.log(`[Sheet Update] 📋 Sheet Name: ${sheetName}`);
    console.log(`[Sheet Update] 📍 Range: ${rangeToRead}`);
    console.log(`[Sheet Update] 🏷️ Columns - Names: ${nameColumn} (${nameColumnIndex}), Embed: ${embedColumn} (${embedColumnIndex}), Minutes: ${finalMinutesColumn} (${finalMinutesColumnIndex})`);
    console.log(`[Sheet Update] 📐 Expanded range to column ${endColumnFromOriginal} (index ${maxIndex}) to include all required columns`);
    
    const startTime = Date.now();
    console.log(`[Sheet Update] ⏰ Starting sheet read at ${new Date().toISOString()}`);
    
    const sheetResponse = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: rangeToRead,
    });
    
    const readTime = Date.now() - startTime;
    console.log(`[Sheet Update] ⏱️ Sheet read completed in ${readTime}ms`);

    const rows = sheetResponse.data.values || [];
    const nameToRowIndex = new Map();
    const existingEmbeds = new Map();
    
    console.log(`[Sheet Update] 📊 SHEET DATA ANALYSIS:`);
    console.log(`[Sheet Update] 📈 Total rows found: ${rows.length}`);
    console.log(`[Sheet Update] 🔍 Using column indices - Names: ${nameColumnIndex}, Embed: ${embedColumnIndex}, Minutes: ${finalMinutesColumnIndex}`);
    console.log(`[Sheet Update] 📐 Expected columns in data: name at index ${nameColumnIndex}, embed at index ${embedColumnIndex}`);
    
    // Debug: Show raw data from first few rows
    if (rows.length > 0) {
      console.log(`[Sheet Update] 🔍 RAW SHEET DATA (first 10 rows):`);
      rows.slice(0, 10).forEach((row, index) => {
        console.log(`[Sheet Update]   Row ${index + 1}: length=${row.length} [${row.map((cell, cellIndex) => `${cellIndex}:"${cell ? cell.toString().substring(0, 30) : 'EMPTY'}"`).join(', ')}]`);
        if (row.length > nameColumnIndex && row[nameColumnIndex]) {
          console.log(`[Sheet Update]     -> Name column (${nameColumnIndex}): "${row[nameColumnIndex]}"`);
        } else {
          console.log(`[Sheet Update]     -> Name column (${nameColumnIndex}): MISSING or EMPTY`);
        }
        if (row.length > embedColumnIndex && row[embedColumnIndex]) {
          console.log(`[Sheet Update]     -> Embed column (${embedColumnIndex}): HAS DATA (${row[embedColumnIndex].toString().length} chars)`);
        } else {
          console.log(`[Sheet Update]     -> Embed column (${embedColumnIndex}): MISSING or EMPTY`);
        }
      });
      
      // Also try to understand if this might be offset by header rows
      console.log(`[Sheet Update] 🔍 HEADER ANALYSIS:`);
      if (rows.length > 0) {
        const firstRow = rows[0];
        console.log(`[Sheet Update] First row appears to be: ${firstRow.length > nameColumnIndex && firstRow[nameColumnIndex] ? '"' + firstRow[nameColumnIndex] + '"' : 'EMPTY'}`);
        if (firstRow.length > nameColumnIndex && firstRow[nameColumnIndex]) {
          const cellValue = firstRow[nameColumnIndex].toString().toLowerCase();
          if (cellValue.includes('name') || cellValue.includes('video') || cellValue.includes('title')) {
            console.log(`[Sheet Update] ⚠️ First row might be HEADER - contains keywords: ${cellValue}`);
          }
        }
      }
    }
    
    if (rows.length === 0) {
      console.log(`[Sheet Update] ⚠️ WARNING: No data found in range ${rangeToRead}`);
      console.log(`[Sheet Update] 🔧 Please verify:`);
      console.log(`[Sheet Update]    - Sheet name "${sheetName}" exists`);
      console.log(`[Sheet Update]    - Columns ${nameColumn}:${endColumnFromOriginal} contain data`);
      console.log(`[Sheet Update]    - Sheet permissions allow reading`);
      console.log(`[Sheet Update]    - Data starts from row 1 (or adjust range if headers exist)`);
    }

    // Enhanced function to normalize text for better matching
    function normalizeText(text) {
      return text
        .replace(/\.mp4$/i, '') // Remove .mp4 extension
        .replace(/[{}[\]()]/g, '') // Remove brackets and parentheses
        .replace(/--/g, '-') // Replace double dashes with single dash
        .replace(/\s+/g, ' ') // Replace multiple spaces with single space
        .trim()
        .toLowerCase();
    }

    // Enhanced function to find fuzzy matches
    function findBestMatch(searchName, availableNames) {
      const normalizedSearch = normalizeText(searchName);
      
      // First try exact match
      const exactMatch = availableNames.find(name => normalizeText(name) === normalizedSearch);
      if (exactMatch) {
        return { match: exactMatch, confidence: 1.0, type: 'exact' };
      }
      
      // Try contains match (both directions)
      const containsMatch = availableNames.find(name => {
        const normalizedName = normalizeText(name);
        return normalizedName.includes(normalizedSearch) || normalizedSearch.includes(normalizedName);
      });
      if (containsMatch) {
        return { match: containsMatch, confidence: 0.8, type: 'contains' };
      }
      
      // Try partial word matching
      const searchWords = normalizedSearch.split(/[\s-]+/).filter(word => word.length > 2);
      let bestMatch = null;
      let bestScore = 0;
      
      for (const name of availableNames) {
        const normalizedName = normalizeText(name);
        const nameWords = normalizedName.split(/[\s-]+/).filter(word => word.length > 2);
        
        let matchingWords = 0;
        for (const searchWord of searchWords) {
          if (nameWords.some(nameWord => nameWord.includes(searchWord) || searchWord.includes(nameWord))) {
            matchingWords++;
          }
        }
        
        const score = matchingWords / Math.max(searchWords.length, nameWords.length);
        if (score > bestScore && score > 0.5) { // At least 50% word match
          bestScore = score;
          bestMatch = name;
        }
      }
      
      if (bestMatch) {
        return { match: bestMatch, confidence: bestScore, type: 'partial' };
      }
      
      return null;
    }

    // Create lookup maps with better normalization
    const originalNames = []; // Store original names for fuzzy matching
    let processedRows = 0;
    let validNameCount = 0;
    
    rows.forEach((row, index) => {
      processedRows++;
      
      // Check if the row has enough columns and contains data in the name column
      if (row.length > nameColumnIndex && row[nameColumnIndex]) { // Name column
        const originalName = row[nameColumnIndex].toString();
        originalNames.push(originalName);
        validNameCount++;
        
        // Normalize the name: remove extension, trim, and convert to lowercase
        const normalizedName = normalizeText(originalName);
        nameToRowIndex.set(normalizedName, index + 1);
        
        // Debug logging for the first 5 rows
        if (index < 5) {
          console.log(`[Sheet Debug] Row ${index + 1}: "${originalName}" -> "${normalizedName}"`);
        }
        
        // Check if embed column exists and has data
        if (row.length > embedColumnIndex && row[embedColumnIndex]) { // Embed column
          existingEmbeds.set(index + 1, row[embedColumnIndex].toString());
        }
      } else {
        // Debug why this row was skipped
        if (index < 5) {
          console.log(`[Sheet Debug] Row ${index + 1} SKIPPED: rowLength=${row.length}, nameColumnIndex=${nameColumnIndex}, hasNameData=${row[nameColumnIndex] ? 'YES' : 'NO'}`);
        }
      }
    });
    
    console.log(`[Sheet Update] 📊 PROCESSING SUMMARY:`);
    console.log(`[Sheet Update] 📝 Processed rows: ${processedRows}`);
    console.log(`[Sheet Update] ✅ Valid names found: ${validNameCount}`);
    console.log(`[Sheet Update] 🗺️ Name lookup map size: ${nameToRowIndex.size}`);
    console.log(`[Sheet Update] 💾 Existing embeds: ${existingEmbeds.size}`);
    
    // Log sample of names for debugging
    if (originalNames.length > 0) {
      console.log(`[Sheet Debug] Sample names from sheet (first 10):`);
      originalNames.slice(0, 10).forEach((name, i) => {
        console.log(`[Sheet Debug]   ${i + 1}. "${name}"`);
      });
    }

    console.log(`[Sheet Debug] Total rows with names: ${nameToRowIndex.size}`);

    // Process updates
    const updates = [];
    const results = [];
    const stats = { updated: 0, notFound: 0, skipped: 0, error: 0 };
    
    console.log(`\n🎯 [Sheet Update] ========= VIDEO PROCESSING PHASE =========`);
    console.log(`[Sheet Update] 📹 Videos to process: ${videos.length}`);
    console.log(`[Sheet Update] 🏗️ Lookup map contains ${nameToRowIndex.size} video names`);
    console.log(`[Sheet Update] 🔧 Search will be performed in:`);
    console.log(`[Sheet Update]   📊 Spreadsheet: ${spreadsheetId}`);
    console.log(`[Sheet Update]   📋 Sheet: "${sheetName}"`);
    console.log(`[Sheet Update]   📍 Range: ${rangeToRead}`);
    console.log(`[Sheet Update]   🏷️ Name Column: ${nameColumn} (index ${nameColumnIndex})`);
    console.log(`[Sheet Update]   💾 Embed Column: ${embedColumn} (index ${embedColumnIndex})`);
    console.log(`[Sheet Update] ===============================================\n`);

    for (const video of videos) {
      const videoStartTime = Date.now();
      const videoIndex = videos.indexOf(video) + 1;
      
      // Normalize video name in the same way
      const originalVideoName = video.name;
      const normalizedVideoName = normalizeText(originalVideoName);
      
      console.log(`\n🔍 [Sheet Update] ===== PROCESSING VIDEO ${videoIndex}/${videos.length} =====`);
      console.log(`[Sheet Update] 📹 Original name: "${originalVideoName}"`);
      console.log(`[Sheet Update] 🔤 Normalized name: "${normalizedVideoName}"`);
      console.log(`[Sheet Update] ⏰ Started at: ${new Date().toLocaleTimeString()}`);
      
      // For first 3 videos, show more detailed comparison
      if (videoIndex <= 3) {
        console.log(`[Sheet Update] 🔍 DETAILED SEARCH for video ${videoIndex}:`);
        console.log(`[Sheet Update] 📝 Will search in ${nameToRowIndex.size} cached names`);
        console.log(`[Sheet Update] 🎯 Looking for exact match with: "${normalizedVideoName}"`);
      }
      
      const searchStartTime = Date.now();
      let rowIndex = nameToRowIndex.get(normalizedVideoName);
      let matchType = 'exact';
      
      const exactSearchTime = Date.now() - searchStartTime;
      
      if (rowIndex) {
        console.log(`[Sheet Update] ✅ EXACT MATCH FOUND in ${exactSearchTime}ms!`);
        console.log(`[Sheet Update] 📍 Found at row: ${rowIndex}`);
      } else {
        console.log(`[Sheet Update] ❌ No exact match in ${exactSearchTime}ms`);
      }
      
      // If exact match not found, try fuzzy matching
      if (!rowIndex) {
        console.log(`[Sheet Debug] ❌ No exact match found, trying fuzzy matching...`);
        const fuzzyStartTime = Date.now();
        const fuzzyMatch = findBestMatch(originalVideoName, originalNames);
        const fuzzySearchTime = Date.now() - fuzzyStartTime;
        console.log(`[Sheet Update] 🔍 Fuzzy search completed in ${fuzzySearchTime}ms`);
        
        if (fuzzyMatch && fuzzyMatch.confidence >= 0.6) { // Accept matches with 60%+ confidence
          console.log(`[Sheet Debug] ✅ Fuzzy match found:`, fuzzyMatch);
          const fuzzyNormalizedName = normalizeText(fuzzyMatch.match);
          rowIndex = nameToRowIndex.get(fuzzyNormalizedName);
          matchType = fuzzyMatch.type;
          
          if (rowIndex) {
            console.log(`[Sheet Update] Using fuzzy match: "${fuzzyMatch.match}" (confidence: ${fuzzyMatch.confidence})`);
          }
        }
      }
      
      if (!rowIndex) {
        const videoProcessTime = Date.now() - videoStartTime;
        console.log(`\n❌ [Sheet Update] VIDEO NOT FOUND - DETAILED ANALYSIS:`);
        console.log(`[Sheet Update] 📹 Searched for: "${originalVideoName}"`);
        console.log(`[Sheet Update] 🔤 Normalized to: "${normalizedVideoName}"`);
        console.log(`[Sheet Update] ⏱️ Search time: ${videoProcessTime}ms`);
        console.log(`[Sheet Update] 🎯 Sheet info: "${sheetName}" (${spreadsheetId})`);
        console.log(`[Sheet Update] 📍 Range searched: ${rangeToRead}`);
        console.log(`[Sheet Update] 📍 Names in lookup: ${nameToRowIndex.size}`);
        
        // Show some names from the sheet for comparison
        const allNames = Array.from(nameToRowIndex.keys());
        console.log(`[Sheet Debug] 📝 Sample names from sheet (first 5):`);
        allNames.slice(0, 5).forEach((name, i) => {
          console.log(`[Sheet Debug]   ${i + 1}. "${name}"`);
        });
        
        // Look for partial matches
        const partialMatches = allNames.filter(name => 
          name.includes(normalizedVideoName.substring(0, 10)) || 
          normalizedVideoName.includes(name.substring(0, 10))
        );
        
        if (partialMatches.length > 0) {
          console.log(`[Sheet Debug] 🎯 Found ${partialMatches.length} potential partial matches:`);
          partialMatches.slice(0, 3).forEach((match, i) => {
            console.log(`[Sheet Debug]   ${i + 1}. "${match}"`);
          });
        }
        
        // Try fuzzy matching for debugging
        const fuzzyMatch = findBestMatch(originalVideoName, originalNames);
        
        if (fuzzyMatch) {
          console.log(`[Sheet Debug] Best fuzzy match found but below threshold:`, fuzzyMatch);
        } else {
          console.log(`[Sheet Debug] No fuzzy matches found at all`);
        }
        
        results.push({ 
          videoName: video.name, 
          status: 'notFound',
          details: `Video "${originalVideoName}" not found in sheet "${sheetName}" with ${nameToRowIndex.size} entries`
        });
        stats.notFound++;
        
        console.log(`[Sheet Update] ❌ VIDEO NOT FOUND: "${originalVideoName}" - marked as notFound`);
        continue;
      }

      const videoProcessTime = Date.now() - videoStartTime;
      console.log(`[Sheet Update] ✅ MATCH FOUND for "${originalVideoName}" in row ${rowIndex} (${matchType} match, ${videoProcessTime}ms)`);
      console.log(`[Sheet Update] Found video in row ${rowIndex}`);
      
      const existingEmbed = existingEmbeds.get(rowIndex);
      if (existingEmbed && existingEmbed.trim().length > 0) {
        console.log(`[Sheet Update] Video already has embed code, skipping`);
        results.push({ 
          videoName: video.name, 
          status: 'skipped',
          details: 'Video already has embed code'
        });
        stats.skipped++;
        continue;
      }

      updates.push({
        range: `${sheetName}!${embedColumn}${rowIndex}`,
        values: [[video.embed_code]]
      });

      // Also update final minutes if provided and NOT a question video
      if (video.final_minutes !== undefined) {
        // Check if this is a question video using the enhanced function
        const isQuestion = isQuestionVideo(video.name);
        
        if (!isQuestion) {
          updates.push({
            range: `${sheetName}!${finalMinutesColumn}${rowIndex}`,
            values: [[Math.round(video.final_minutes)]]
          });
          console.log(`[Sheet Update] ✅ Added final minutes update for "${video.name}": ${Math.round(video.final_minutes)} minutes (non-question video)`);
        } else {
          console.log(`[Sheet Update] ⚠️ SKIPPING final minutes update for question video: "${video.name}"`);
        }
      }

      results.push({ 
        videoName: video.name, 
        status: 'updated',
        details: 'Successfully updated embed code' + (video.final_minutes !== undefined ? ' and final minutes' : '')
      });
      stats.updated++;
      console.log(`[Sheet Update] Will update row ${rowIndex} for "${originalVideoName}"`);
    }

    // Perform batch update if there are updates
    if (updates.length > 0) {
      console.log(`[Sheet Update] ⚡ PERFORMING BATCH UPDATE for ${updates.length} cell updates`);
      try {
        await sheets.spreadsheets.values.batchUpdate({
          spreadsheetId,
          requestBody: {
            data: updates,
            valueInputOption: 'RAW'
          }
        });
        console.log('[Sheet Update] ✅ BATCH UPDATE SUCCESSFUL - All updates applied to sheet');
      } catch (updateError) {
        console.error('[Sheet Update] ❌ BATCH UPDATE FAILED:', updateError);
        
        // Mark all updated videos as errors since the batch update failed
        results.forEach(result => {
          if (result.status === 'updated') {
            result.status = 'error';
            result.details = 'Failed to update sheet - batch update error';
            stats.updated--;
            stats.error++;
          }
        });
        
        throw updateError; // Re-throw to trigger catch block
      }
    } else {
      console.log('[Sheet Update] ⚠️ NO UPDATES TO PERFORM - All videos were either not found or skipped');
    }

    // VALIDATION: Ensure we don't claim success if no actual updates occurred
    const actuallyUpdated = stats.updated;
    const hasErrors = stats.error > 0;
    const overallSuccess = actuallyUpdated > 0 && !hasErrors;

    console.log(`[Sheet Update] FINAL STATS: Updated=${stats.updated}, NotFound=${stats.notFound}, Skipped=${stats.skipped}, Error=${stats.error}`);
    console.log(`[Sheet Update] OVERALL SUCCESS: ${overallSuccess} (Updated: ${actuallyUpdated}, HasErrors: ${hasErrors})`);

    // Create a detailed response with consistent structure
    const apiResponse = {
      success: overallSuccess, // Only true if we actually updated something without errors
      message: actuallyUpdated > 0 
        ? `تم تحديث ${stats.updated} فيديو بنجاح, ${stats.notFound} غير موجود, ${stats.skipped} تم تخطيه`
        : `لم يتم تحديث أي فيديو: ${stats.notFound} غير موجود, ${stats.skipped} تم تخطيه`,
      results: results, // Send the detailed results
      stats: stats
    };
    
    return res.status(200).json(apiResponse);

  } catch (error) {
    console.error('Sheet update error:', error);
    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'خطأ في تحديث الشيت: ' + error
    });
  }
});

// Sheets update endpoint for final minutes
app.post('/api/sheets/update-final-minutes', async (req, res) => {
  try {
    const { 
      videos, 
      spreadsheetId: customSpreadsheetId, 
      sheetName: customSheetName, 
      nameColumn = 'M', 
      embedColumn = 'V', 
      finalMinutesColumn = 'P' 
    } = req.body;
    
    console.log(`[Final Minutes Update] Received request with ${videos ? videos.length : 0} videos`);
    
    // Enhanced function to detect if video is a question/quiz (QV) video
    const isQuestionVideo = (videoName) => {
      if (!videoName) return false;
      
      // Check for Q+number pattern anywhere in filename (most reliable indicator)
      if (/[Qq]\d+/.test(videoName)) {
        console.log(`[isQuestionVideo] Video "${videoName}" has Q-number pattern - treating as question video`);
        return true;
      }
      
      // Check for Arabic question indicators with numbers
      if (/سؤال\s*\d+|أسئلة\s*\d+/.test(videoName)) {
        console.log(`[isQuestionVideo] Video "${videoName}" has Arabic question pattern - treating as question video`);
        return true;
      }
      
      // Check for exam/test indicators with numbers
      if (/اختبار\s*\d+|امتحان\s*\d+/.test(videoName)) {
        console.log(`[isQuestionVideo] Video "${videoName}" has exam/test pattern - treating as question video`);
        return true;
      }
      
      // Check for quiz or test keywords (but only if they appear to be main components)
      if (/\bquiz\b|\btest\b|\bexam\b/i.test(videoName) && 
          (!/\b[a-z]+\s+quiz\b/i.test(videoName))) {
        console.log(`[isQuestionVideo] Video "${videoName}" has quiz/test keyword - treating as question video`);
        return true;
      }
      
      // Check for homework indicators with question numbers
      if (/\bhw\s*\d+\b|\bhomework\s*\d+\b/i.test(videoName)) {
        console.log(`[isQuestionVideo] Video "${videoName}" has homework with numbers - treating as question video`);
        return true;
      }
      
      // Additional check for Arabic question words without numbers (but with context)
      if (/سؤال|أسئلة/.test(videoName) && /\d+/.test(videoName)) {
        console.log(`[isQuestionVideo] Video "${videoName}" has Arabic question word with number - treating as question video`);
        return true;
      }
      
      // Additional check for Arabic exam/test words without numbers (but with context)
      if (/اختبار|امتحان/.test(videoName) && /\d+/.test(videoName)) {
        console.log(`[isQuestionVideo] Video "${videoName}" has Arabic exam/test word with number - treating as question video`);
        return true;
      }
      
      // Additional check for homework words with numbers
      if (/\bhw\b|\bhomework\b/i.test(videoName) && /\d+/.test(videoName)) {
        console.log(`[isQuestionVideo] Video "${videoName}" has homework word with number - treating as question video`);
        return true;
      }
      
      console.log(`[isQuestionVideo] Video "${videoName}" is NOT a question video - will update final minutes`);
      return false;
    };
    
    // Use custom sheet config if provided, otherwise use environment defaults
    const spreadsheetId = customSpreadsheetId || process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
    const sheetName = customSheetName || process.env.GOOGLE_SHEET_NAME || 'OPERATIONS';
    
    if (customSpreadsheetId) {
      console.log(`[Final Minutes Update] 📊 Using custom sheet config: ${customSpreadsheetId}, sheet: ${sheetName}`);
      console.log(`[Final Minutes Update] 📋 Columns - Names: ${nameColumn}, Embed: ${embedColumn}, Minutes: ${finalMinutesColumn}`);
    } else {
      console.log(`[Final Minutes Update] ⚠️ Using environment defaults`);
    }
    
    if (!Array.isArray(videos) || videos.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'No videos provided',
        results: [],
        stats: { updated: 0, notFound: 0, skipped: 0, error: 0 }
      });
    }

    // Validate environment variables
    if (!process.env.GOOGLE_SHEETS_CREDENTIALS_JSON) {
      console.error('Error: GOOGLE_SHEETS_CREDENTIALS_JSON is not set in .env file');
      return res.status(500).json({ success: false, message: 'Invalid Google Sheets credentials configuration' });
    }

    let credentials;
    try {
      credentials = JSON.parse(process.env.GOOGLE_SHEETS_CREDENTIALS_JSON);
      if (!credentials.client_email || !credentials.private_key) {
        console.error('Error: Invalid credentials format in GOOGLE_SHEETS_CREDENTIALS_JSON');
        return res.status(500).json({ success: false, message: 'Invalid Google Sheets credentials configuration' });
      }
    } catch (error) {
      console.error('Error: Failed to parse GOOGLE_SHEETS_CREDENTIALS_JSON:', error.message);
      return res.status(500).json({ success: false, message: 'Invalid Google Sheets credentials configuration' });
    }

    if (!spreadsheetId) {
      return res.status(500).json({ success: false, message: 'Google Sheet Spreadsheet ID not configured.' });
    }

    // Create a new JWT client with proper configuration
    const auth = new google.auth.JWT({
      email: credentials.client_email,
      key: credentials.private_key,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
      subject: credentials.client_email,
      exp: Math.floor(Date.now() / 1000) + 3600,
      iat: Math.floor(Date.now() / 1000)
    });

    const sheets = google.sheets({ version: 'v4', auth });

    // Helper function to convert column letter to index (A=0, B=1, etc.)
    function columnToIndex(column) {
      let index = 0;
      for (let i = 0; i < column.length; i++) {
        index = index * 26 + (column.charCodeAt(i) - 'A'.charCodeAt(0) + 1);
      }
      return index - 1;
    }

    // Helper function to convert column index back to letters
    function indexToColumn(index) {
      let column = '';
      index++; // Convert from 0-based to 1-based
      while (index > 0) {
        index--; // Convert back to 0-based for calculation
        column = String.fromCharCode((index % 26) + 'A'.charCodeAt(0)) + column;
        index = Math.floor(index / 26);
      }
      return column;
    }

    // Calculate column indices
    const nameColumnIndex = columnToIndex(nameColumn);
    const embedColumnIndex = columnToIndex(embedColumn);
    const finalMinutesColumnIndex = columnToIndex(finalMinutesColumn);
    
    // Get existing data - expand range to ensure we capture all needed columns
    // Calculate the rightmost column we need (between embed and final minutes columns)
    const maxColumnIndex = Math.max(embedColumnIndex, finalMinutesColumnIndex);
    
    // Convert back to column letter - Fixed for multi-letter columns
    const endColumnLetter = indexToColumn(maxColumnIndex);
    
    // Read starting from column A to keep zero-based indices consistent
    const rangeToRead = `${sheetName}!A:${endColumnLetter}`;

    console.log(`[Final Minutes Update] Reading range: ${rangeToRead}`);
    const sheetResponse = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: rangeToRead,
    });

    const rows = sheetResponse.data.values || [];
    console.log(`[Final Minutes Update] Read ${rows.length} rows from sheet`);

    // Create a map of normalized names to row indices for efficient lookup
    const nameToRowIndex = new Map();
    const originalNames = [];

    // Helper function to normalize text for comparison
    function normalizeText(text) {
      if (!text) return '';
      return text.toString()
        .trim()
        .replace(/\.[^/.]+$/, '') // remove extension
        .replace(/\s+/g, ' ') // collapse spaces
        .replace(/[\[\](){}]/g, ' ') // remove brackets
        .replace(/[-_]+/g, '-') // normalize dashes/underscores
        .replace(/\s+/g, ' ') // collapse again
        .trim();
    }

    // Helper function to find best fuzzy match
    function findBestMatch(searchName, availableNames) {
      const normalizedSearch = normalizeText(searchName);
      let bestMatch = null;
      let bestScore = 0;

      for (const availableName of availableNames) {
        const normalizedAvailable = normalizeText(availableName);
        
        // Calculate similarity score (simple implementation)
        const longer = normalizedSearch.length > normalizedAvailable.length ? normalizedSearch : normalizedAvailable;
        const shorter = normalizedSearch.length > normalizedAvailable.length ? normalizedAvailable : normalizedSearch;
        
        if (longer.length === 0) return { match: availableName, confidence: 1.0 };
        
        const distance = levenshteinDistance(longer, shorter);
        const score = (longer.length - distance) / longer.length;
        
        if (score > bestScore) {
          bestScore = score;
          bestMatch = { match: availableName, confidence: score };
        }
      }

      return bestMatch;
    }

    // Simple Levenshtein distance implementation
    function levenshteinDistance(str1, str2) {
      const matrix = [];
      for (let i = 0; i <= str2.length; i++) {
        matrix[i] = [i];
      }
      for (let j = 0; j <= str1.length; j++) {
        matrix[0][j] = j;
      }
      for (let i = 1; i <= str2.length; i++) {
        for (let j = 1; j <= str1.length; j++) {
          if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
            matrix[i][j] = matrix[i - 1][j - 1];
          } else {
            matrix[i][j] = Math.min(
              matrix[i - 1][j - 1] + 1,
              matrix[i][j - 1] + 1,
              matrix[i - 1][j] + 1
            );
          }
        }
      }
      return matrix[str2.length][str1.length];
    }

    // Populate the name-to-row mapping
    rows.forEach((row, index) => {
      if (row && row.length > nameColumnIndex && row[nameColumnIndex]) {
        const originalName = row[nameColumnIndex].toString();
        const normalizedName = normalizeText(originalName);
        
        nameToRowIndex.set(normalizedName, index + 1); // 1-based row index
        originalNames.push(originalName);
      }
    });

    console.log(`[Final Minutes Update] Built name mapping with ${nameToRowIndex.size} entries`);

    const updates = [];
    const results = [];
    const stats = {
      updated: 0,
      notFound: 0,
      skipped: 0,
      error: 0
    };

    // Process each video
    for (const video of videos) {
      console.log(`[Final Minutes Update] Processing video: "${video.name}"`);
      
      // Check if this is a question video - SKIP final minutes update for QV videos
      const isQuestion = isQuestionVideo(video.name);
      
      if (isQuestion) {
        console.log(`[Final Minutes Update] ⚠️ SKIPPING final minutes update for question video: "${video.name}"`);
        results.push({
          videoName: video.name,
          status: 'skipped',
          details: 'Question video detected - final minutes not updated for QV videos',
          isQuestion: true
        });
        stats.skipped++;
        continue; // Skip to next video
      }
      
      const originalVideoName = video.name;
      const normalizedVideoName = normalizeText(originalVideoName);
      
      console.log(`[Final Minutes Debug] Looking for: "${originalVideoName}" (normalized: "${normalizedVideoName}")`);
      
      let rowIndex = nameToRowIndex.get(normalizedVideoName);
      
      if (!rowIndex) {
        // Try fuzzy matching for better results
        const fuzzyMatch = findBestMatch(originalVideoName, originalNames);
        
        if (fuzzyMatch && fuzzyMatch.confidence >= 0.6) { // Accept matches with 60%+ confidence
          console.log(`[Final Minutes Debug] Fuzzy match found:`, fuzzyMatch);
          const fuzzyNormalizedName = normalizeText(fuzzyMatch.match);
          rowIndex = nameToRowIndex.get(fuzzyNormalizedName);
          
          if (rowIndex) {
            console.log(`[Final Minutes Update] Using fuzzy match: "${fuzzyMatch.match}" (confidence: ${fuzzyMatch.confidence})`);
          }
        }
      }
      
      if (!rowIndex) {
        // Enhanced debugging for not found videos
        console.log(`[Final Minutes Debug] Video not found. Available names (first 10):`);
        const availableNames = Array.from(nameToRowIndex.keys()).slice(0, 10);
        availableNames.forEach(name => console.log(`  - "${name}"`));
        
        // Try fuzzy matching for debugging
        const fuzzyMatch = findBestMatch(originalVideoName, originalNames);
        
        if (fuzzyMatch) {
          console.log(`[Final Minutes Debug] Best fuzzy match found but below threshold:`, fuzzyMatch);
        } else {
          console.log(`[Final Minutes Debug] No fuzzy matches found`);
        }
        
        results.push({ 
          videoName: video.name, 
          status: 'notFound',
          details: 'Video name not found in sheet',
          isQuestion: false
        });
        stats.notFound++;
        continue;
      }

      console.log(`[Final Minutes Update] Found video in row ${rowIndex}`);
      
      // Convert seconds to minutes (rounded)
      const finalMinutes = Math.round(video.final_minutes || 0);
      
      updates.push({
        range: `${sheetName}!${finalMinutesColumn}${rowIndex}`,
        values: [[finalMinutes]]
      });

      results.push({ 
        videoName: video.name, 
        status: 'updated',
        details: `Successfully updated final minutes: ${finalMinutes} minutes`,
        isQuestion: false
      });
      stats.updated++;
      console.log(`[Final Minutes Update] Will update row ${rowIndex} for "${originalVideoName}" with ${finalMinutes} minutes`);
    }

    // Perform batch update if there are updates
    if (updates.length > 0) {
      console.log(`[Sheet Update] ⚡ PERFORMING BATCH UPDATE for ${updates.length} cell updates`);
      try {
        await sheets.spreadsheets.values.batchUpdate({
          spreadsheetId,
          requestBody: {
            data: updates,
            valueInputOption: 'RAW'
          }
        });
        console.log('[Sheet Update] ✅ BATCH UPDATE SUCCESSFUL - All updates applied to sheet');
      } catch (updateError) {
        console.error('[Sheet Update] ❌ BATCH UPDATE FAILED:', updateError);
        
        // Mark all updated videos as errors since the batch update failed
        results.forEach(result => {
          if (result.status === 'updated') {
            result.status = 'error';
            result.details = 'Failed to update sheet - batch update error';
            stats.updated--;
            stats.error++;
          }
        });
        
        throw updateError; // Re-throw to trigger catch block
      }
    } else {
      console.log('[Sheet Update] ⚠️ NO UPDATES TO PERFORM - All videos were either not found or skipped');
    }

    // VALIDATION: Ensure we don't claim success if no actual updates occurred
    const actuallyUpdated = stats.updated;
    const hasErrors = stats.error > 0;
    const overallSuccess = actuallyUpdated > 0 && !hasErrors;

    console.log(`[Sheet Update] FINAL STATS: Updated=${stats.updated}, NotFound=${stats.notFound}, Skipped=${stats.skipped}, Error=${stats.error}`);
    console.log(`[Sheet Update] OVERALL SUCCESS: ${overallSuccess} (Updated: ${actuallyUpdated}, HasErrors: ${hasErrors})`);

    // Create a detailed response with consistent structure
    const apiResponse = {
      success: overallSuccess, // Only true if we actually updated something without errors
      message: actuallyUpdated > 0 
        ? `تم تحديث ${stats.updated} فيديو بنجاح, ${stats.notFound} غير موجود, ${stats.skipped} تم تخطيه`
        : `لم يتم تحديث أي فيديو: ${stats.notFound} غير موجود, ${stats.skipped} تم تخطيه`,
      results: results, // Send the detailed results
      stats: stats
    };
    
    return res.status(200).json(apiResponse);

  } catch (error) {
    console.error('Final minutes update error:', error);
    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'خطأ في تحديث الدقائق النهائية: ' + error
    });
  }
});

// Bandwidth stats endpoint
app.post('/api/sheets/update-bandwidth-stats', async (req, res) => {
  try {
    const { data } = req.body; // Expecting an array of { Date, 'Bandwidth (GB)', 'Cost ($)' }

    if (!Array.isArray(data)) {
      return res.status(400).json({ success: false, message: 'Invalid data format, expected array.' });
    }
    if (data.length === 0) {
       return res.json({ success: true, message: 'No bandwidth data provided to update.' });
    }

    // Validate environment variables
    if (!process.env.GOOGLE_SHEETS_CREDENTIALS_JSON) {
      console.error('Error: GOOGLE_SHEETS_CREDENTIALS_JSON is not set in .env file');
      return res.status(500).json({ success: false, message: 'Invalid Google Sheets credentials configuration' });
    }

    let credentials;
    try {
      credentials = JSON.parse(process.env.GOOGLE_SHEETS_CREDENTIALS_JSON);
      if (!credentials.client_email || !credentials.private_key) {
        console.error('Error: Invalid credentials format in GOOGLE_SHEETS_CREDENTIALS_JSON');
        return res.status(500).json({ success: false, message: 'Invalid Google Sheets credentials configuration' });
      }
    } catch (error) {
      console.error('Error: Failed to parse GOOGLE_SHEETS_CREDENTIALS_JSON:', error.message);
      return res.status(500).json({ success: false, message: 'Invalid Google Sheets credentials configuration' });
    }

     if (!process.env.GOOGLE_SHEETS_SPREADSHEET_ID) {
       return res.status(500).json({ success: false, message: 'Google Sheet Spreadsheet ID not configured.' });
    }

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });

    const sheets = google.sheets({ version: 'v4', auth });
    const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
    const sheetTitle = 'BandwidthStats'; // Target sheet name

    // 1. Check if sheet exists, create if not
    try {
       await sheets.spreadsheets.get({ spreadsheetId, ranges: [`${sheetTitle}!A1`] });
       console.log(`Sheet "${sheetTitle}" already exists.`);
    } catch (error) {
       // Google API returns 400 if the sheet doesn't exist when getting a range
       if (error.code === 400 && error.message.includes('Unable to parse range')) {
          console.log(`Sheet "${sheetTitle}" not found, creating...`);
          await sheets.spreadsheets.batchUpdate({
             spreadsheetId,
             requestBody: {
                requests: [{ addSheet: { properties: { title: sheetTitle } } }]
             }
          });
          console.log(`Sheet "${sheetTitle}" created.`);
       } else {
          throw error; // Re-throw unexpected errors
       }
    }

    // 2. Clear existing data (overwrite behavior)
    console.log(`Clearing existing data in "${sheetTitle}"`);
    await sheets.spreadsheets.values.clear({
       spreadsheetId,
       range: sheetTitle // Clear the whole sheet
    });

    // 3. Prepare and write new data
    const headerRow = ['Date', 'Bandwidth (GB)', 'Cost ($)'];
    const dataRows = data.map(row => [
      row.Date, // Assuming Date is already formatted correctly (e.g., 'YYYY-MM-DD')
      Number(row['Bandwidth (GB)']).toFixed(2),
      Number(row['Cost ($)']).toFixed(2)
    ]);

    console.log(`Writing ${dataRows.length} rows of bandwidth data to "${sheetTitle}"`);
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${sheetTitle}!A1`, // Start writing from A1
      valueInputOption: 'USER_ENTERED', // Interpret values as if typed by user (numbers as numbers)
      requestBody: {
        values: [headerRow, ...dataRows]
      }
    });

    res.json({
      success: true,
      message: `Updated ${data.length} days of bandwidth statistics in sheet "${sheetTitle}"`
    });

  } catch (error) {
    console.error('Error updating bandwidth stats:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Internal server error during bandwidth update'
    });
  }
});

// Test Google Sheets connection endpoint
app.get('/api/test-sheets-connection', async (req, res) => {
  try {
    // Validate environment variables
    if (!process.env.GOOGLE_SHEETS_CREDENTIALS_JSON) {
      console.error('Error: GOOGLE_SHEETS_CREDENTIALS_JSON is not set in .env file');
      return res.status(500).json({ success: false, message: 'Invalid Google Sheets credentials configuration', error: 'GOOGLE_SHEETS_CREDENTIALS_JSON not set' });
    }

    let credentials;
    try {
      credentials = JSON.parse(process.env.GOOGLE_SHEETS_CREDENTIALS_JSON);
    } catch (error) {
      console.error('Error parsing Google credentials:', error);
      return res.status(500).json({ success: false, message: 'Invalid Google Sheets credentials configuration', error: error.message });
    }

    if (!process.env.GOOGLE_SHEETS_SPREADSHEET_ID) {
      return res.status(500).json({ success: false, message: 'Google Sheet Spreadsheet ID not configured.' });
    }

    // Create a new JWT client with proper configuration
    const auth = new google.auth.JWT({
      email: credentials.client_email,
      key: credentials.private_key,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
      subject: credentials.client_email,
      // Set token expiration to 1 hour from now
      exp: Math.floor(Date.now() / 1000) + 3600,
      iat: Math.floor(Date.now() / 1000)
    });

    const sheets = google.sheets({ version: 'v4', auth });
    const sheetName = process.env.GOGLE_SHEET_NAME || 'OPERATIONS';

    console.log(`Testing connection to Spreadsheet ID: ${process.env.GOOGLE_SHEETS_SPREADSHEET_ID}, Sheet: ${sheetName}`);

    // Try reading a single cell (A1) to verify connection and permissions
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEETS_SPREADSHEET_ID,
      range: `${sheetName}!A1:A1` // Read just cell A1
    });

    console.log('Google Sheets connection test successful.');
    res.json({
      success: true,
      message: 'Successfully connected to Google Sheets',
      data: {
        sheetName: sheetName,
        cellA1Value: response.data.values?.[0]?.[0] ?? null,
        hasValuesInRange: !!response.data.values?.length
      }
    });

  } catch (error) {
    console.error('Google Sheets Connection Test Error:', error);
    const googleErrorMessage = error.response?.data?.error?.message || error.errors?.[0]?.message;
    res.status(500).json({
      success: false,
      message: 'Failed to connect to Google Sheets',
      error: googleErrorMessage || (error instanceof Error ? error.message : String(error))
    });
  }
});


// --- Static Files and SPA Fallback ---
// Serve static files from the dist directory AFTER API routes
app.use(express.static(path.join(__dirname, 'dist')));

// Serve index.html for all other GET routes (SPA fallback) AFTER API routes and static files
app.get('*', (req, res) => {
  // Check if the request accepts HTML - avoids interfering with API 404s if client doesn't want HTML
  if (req.accepts('html')) {
    const indexPath = path.join(__dirname, 'dist', 'index.html');
    console.log(`SPA Fallback: Serving ${indexPath} for ${req.path}`);
    res.sendFile(indexPath, (err) => {
       if (err) {
          console.error(`Error sending index.html: ${err.message}`);
          // If file not found (e.g., during build), send a simple 500
          if (err.code === 'ENOENT') {
             res.status(500).send('Application not built or index.html missing.');
          } else if (!res.headersSent) {
             // For other errors, send 500 if possible
             res.status(500).send('Error serving application.');
          }
       }
    });
  } else {
    // For non-HTML requests that didn't match API or static files
    console.log(`404 Not Found for ${req.path} (Accept: ${req.headers.accept})`);
    res.status(404).json({ error: 'Resource not found.' });
  }
});


// --- Server Start and Error Handling ---
const server = app.listen(PORT, () => { // Capture server instance here
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`CORS Origins Allowed: ${allowedOrigins}`);
  console.log(`Proxying /api/proxy/base -> https://api.bunny.net`);
  console.log(`Proxying /api/proxy/video -> https://video.bunnycdn.com`);
  console.log(`Serving static files from: ${path.join(__dirname, 'dist')}`);
}).on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`ERROR: Port ${PORT} is already in use.`);
  } else {
    console.error('Server startup error:', err);
  }
  process.exit(1); // Exit if server can't start
});

// Global error handlers
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Consider exiting process for unhandled rejections depending on severity
  // process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  // It's generally recommended to exit gracefully after an uncaught exception
  process.exit(1);
});

// Graceful shutdown handling
const gracefulShutdown = (signal) => {
  console.log(`Received ${signal}. Shutting down gracefully...`);
  // Add any cleanup logic here (e.g., close database connections)
  server.close(() => {
    console.log('HTTP server closed.');
    process.exit(0);
  });
  
  // Force shutdown after timeout
  setTimeout(() => {
    console.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 10000); // 10 seconds timeout
};

process.on('SIGTERM', gracefulShutdown); // kill command
process.on('SIGINT', gracefulShutdown); // Ctrl+C