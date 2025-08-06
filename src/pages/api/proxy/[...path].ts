import { NextApiRequest, NextApiResponse } from 'next';
import httpProxyMiddleware from 'next-http-proxy-middleware';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Get the target path from the URL
  const path = req.query.path as string[];
  const targetPath = path.join('/');
  
  // Determine target base URL based on first path segment
  let targetBaseUrl = 'https://api.bunny.net';
  if (path[0] === 'base') {
    path.shift(); // Remove 'base' from path
  }

  // Forward the request to Bunny API
  try {
    return httpProxyMiddleware(req, res, {
      target: targetBaseUrl,
      pathRewrite: [
        {
          patternStr: '^/api/proxy/base',
          replaceStr: ''
        },
        {
          patternStr: '^/api/proxy',
          replaceStr: ''
        }
      ],
      headers: {
        AccessKey: process.env.VITE_BUNNY_API_KEY || '',
        'Content-Type': 'application/json',
      }
    });
  } catch (error) {
    console.error('Proxy error:', error);
    return res.status(500).json({ error: 'Proxy error', message: error instanceof Error ? error.message : String(error) });
  }
}
