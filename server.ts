import { createServer } from 'http';
import { parse } from 'url';
import { validateEnvConfig } from './src/lib/env-config';
import fetch from 'node-fetch';

const port = parseInt(process.env.PORT || '800', 10);

// Validate environment variables on startup
try {
  console.log('Current working directory:', process.cwd());
  console.log('Validating environment configuration...');
  
  if (!validateEnvConfig()) {
    throw new Error('Environment validation failed');
  }
  console.log('Environment configuration validated successfully');
} catch (error) {
  console.error('Environment configuration error:', error);
  console.error('Process environment:', {
    NODE_ENV: process.env.NODE_ENV,
    PWD: process.env.PWD,
    // Add any other relevant non-sensitive env vars
  });
  process.exit(1);
}

const server = createServer(async (req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, AccessKey');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  const parsedUrl = parse(req.url!, true);
  
  // Handle BunnyCDN proxy requests
  if (parsedUrl.pathname?.startsWith('/api/proxy/base/')) {
    try {
      const targetPath = parsedUrl.pathname.replace('/api/proxy/base/', '');
      const apiKey = req.headers['accesskey'];
      
      if (!apiKey) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ message: 'API key is required' }));
        return;
      }

      let requestBody;
      if (req.method !== 'GET') {
        const chunks: Buffer[] = [];
        for await (const chunk of req) {
          chunks.push(chunk);
        }
        requestBody = Buffer.concat(chunks);
      }

      // Forward the request to Bunny API
      const response = await fetch(`https://api.bunny.net/${targetPath}${parsedUrl.search || ''}`, {
        method: req.method,
        headers: {
          'AccessKey': apiKey as string,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: requestBody,
        timeout: 180000 // 3 minute timeout
      });

      // Forward the response status and headers
      res.writeHead(response.status, {
        'Content-Type': response.headers.get('Content-Type') || 'application/json'
      });

      // Stream the response body
      if (response.body) {
        response.body.pipe(res);
      } else {
        res.end();
      }
      return;
    } catch (error) {
      console.error('Error proxying request to BunnyCDN:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        message: 'Error proxying request to BunnyCDN',
        error: error instanceof Error ? error.message : String(error)
      }));
      return;
    }
  }

  // Handle video API proxy requests
  if (parsedUrl.pathname?.startsWith('/api/proxy/video/')) {
    try {
      const targetPath = parsedUrl.pathname.replace('/api/proxy/video/', '');
      const apiKey = req.headers['accesskey'];
      
      if (!apiKey) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ message: 'API key is required' }));
        return;
      }

      let requestBody;
      if (req.method !== 'GET') {
        const chunks: Buffer[] = [];
        for await (const chunk of req) {
          chunks.push(chunk);
        }
        requestBody = Buffer.concat(chunks);
      }

      // Extract library ID and collection ID from path if present
      const pathParts = targetPath.split('/');
      const libraryId = pathParts[1]; // library/{libraryId}/...
      const collectionId = pathParts[3]; // library/{libraryId}/collections/{collectionId}

      // Forward the request to Bunny Video API
      const response = await fetch(`https://video.bunnycdn.com/${targetPath}${parsedUrl.search || ''}`, {
        method: req.method,
        headers: {
          'AccessKey': apiKey as string,
          'Content-Type': req.method === 'PUT' ? 'application/octet-stream' : 'application/json',
          'Accept': 'application/json',
          'X-Library-Id': libraryId,
          ...(collectionId && { 'X-Collection-Id': collectionId })
        },
        body: requestBody,
        timeout: 180000 // 3 minute timeout
      });

      // Forward the response status and headers
      res.writeHead(response.status, {
        'Content-Type': response.headers.get('Content-Type') || 'application/json'
      });

      // Stream the response body
      if (response.body) {
        response.body.pipe(res);
      } else {
        res.end();
      }
      return;
    } catch (error) {
      console.error('Error proxying request to Bunny Video API:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        message: 'Error proxying request to Bunny Video API',
        error: error instanceof Error ? error.message : String(error)
      }));
      return;
    }
  }

  // Add load-config endpoint
  if (parsedUrl.pathname === '/api/load-config') {
    try {
      const { default: handler } = await import('./api/load-config');
      await handler(req as any, res as any);
    } catch (error) {
      console.error('Error loading configuration:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: false,
        message: 'Failed to load configuration',
        error: error instanceof Error ? error.message : String(error)
      }));
    }
    return;
  }

  // Add test-connection endpoint
  if (parsedUrl.pathname === '/api/sheets/test-connection') {
    try {
      const { default: handler } = await import('./api/sheets/test-connection');
      await handler(req as any, res as any);
    } catch (error) {
      console.error('Error handling test connection:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: false,
        message: 'Failed to connect to Google Sheets',
        error: error instanceof Error ? error.message : String(error)
      }));
    }
    return;
  }

  if (parsedUrl.pathname === '/api/sheets/update-bunny-embeds') {
    let body = '';
    req.on('data', chunk => body += chunk);
    
    req.on('end', async () => {
      try {
        // Import the handler dynamically to ensure environment is loaded
        const { default: handler } = await import('./api/sheets/update-bunny-embeds');
        
        const mockReq = {
          method: req.method,
          headers: req.headers,
          body: JSON.parse(body),
        };

        // Create a mock response object that matches Vercel's Response
        const mockRes = {
          setHeader: res.setHeader.bind(res),
          status: (code: number) => {
            res.statusCode = code;
            return mockRes;
          },
          json: (data: any) => {
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(data));
            return mockRes;
          },
          end: () => {
            res.end();
            return mockRes;
          }
        };

        await handler(mockReq as any, mockRes as any);
      } catch (error) {
        console.error('Error handling request:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          message: 'Internal server error',
          error: process.env.NODE_ENV === 'development' ? String(error) : undefined
        }));
      }
    });
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

server.listen(port, () => {
  console.log(`> Ready on http://localhost:${port}`);
});
