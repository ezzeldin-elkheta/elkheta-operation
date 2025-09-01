/**
 * Video Library API proxy endpoint
 * Handles Bunny.net library API requests
 */

const videolibrary = async (req, res) => {
  const { method, url } = req;
  console.log(`[VideoLibrary API] ${method} ${url}`);

  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, AccessKey, accesskey');

  if (method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // Extract API key from headers
    const apiKey = req.headers.accesskey || req.headers.AccessKey || process.env.VITE_BUNNY_API_KEY;
    
    if (!apiKey) {
      console.error('[VideoLibrary API] No API key found');
      return res.status(401).json({ error: 'No API key provided' });
    }

    // Build the target URL for Bunny.net
    const targetUrl = `https://api.bunny.net${req.url.replace('/api/proxy/base', '')}`;
    console.log(`[VideoLibrary API] Proxying to: ${targetUrl}`);

    // Forward the request to Bunny.net
    const proxyResponse = await fetch(targetUrl, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'AccessKey': apiKey,
        'User-Agent': 'BunnyProxy/1.0'
      },
      ...(method !== 'GET' && { body: JSON.stringify(req.body) })
    });

    const data = await proxyResponse.json();
    
    console.log(`[VideoLibrary API] Response status: ${proxyResponse.status}`);
    
    if (!proxyResponse.ok) {
      console.error('[VideoLibrary API] Bunny.net error:', data);
      return res.status(proxyResponse.status).json(data);
    }

    return res.status(200).json(data);

  } catch (error) {
    console.error('[VideoLibrary API] Error:', error);
    return res.status(500).json({
      error: 'Proxy request failed',
      message: error.message
    });
  }
};

export default videolibrary;
