export default async function handler(req, res) {
  console.log('Video Proxy API called:', {
    method: req.method,
    url: req.url,
    query: req.query,
    path: req.query.path,
    contentLength: req.headers['content-length'] ? `${(parseInt(req.headers['content-length']) / (1024 * 1024)).toFixed(2)} MB` : 'unknown'
  });

  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, AccessKey, accesskey');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // Check for large payloads early
  const contentLength = parseInt(req.headers['content-length'] || '0');
  const MAX_PAYLOAD_SIZE = 3 * 1024 * 1024; // 3MB limit for Vercel
  
  if (contentLength > MAX_PAYLOAD_SIZE) {
    console.error(`[Video Proxy] Payload too large: ${(contentLength / (1024 * 1024)).toFixed(2)} MB exceeds ${(MAX_PAYLOAD_SIZE / (1024 * 1024)).toFixed(2)} MB limit`);
    return res.status(413).json({
      error: 'Payload Too Large',
      message: `File size ${(contentLength / (1024 * 1024)).toFixed(2)} MB exceeds Vercel's ${(MAX_PAYLOAD_SIZE / (1024 * 1024)).toFixed(2)} MB limit. Use direct upload to Bunny.net for large files.`,
      fileSizeMB: (contentLength / (1024 * 1024)).toFixed(2),
      maxSizeMB: (MAX_PAYLOAD_SIZE / (1024 * 1024)).toFixed(2)
    });
  }
  
  try {
    // Extract path parameters
    const { path } = req.query;
    const fullPath = Array.isArray(path) ? path.join('/') : path;
    
    // Get API key from request headers with priority order
    const accessKey = req.headers.accesskey || 
                     req.headers.AccessKey || 
                     req.headers['accesskey'] || 
                     req.headers['access-key'] ||
                     req.headers.authorization?.replace('Bearer ', '');
    
    console.log('Video API request details:', {
      path: fullPath,
      method: req.method,
      query: req.query,
      hasAccessKey: !!accessKey,
      keyLength: accessKey?.length,
      keyPreview: accessKey ? `${accessKey.substring(0, 8)}...` : 'none',
      headers: {
        accesskey: !!req.headers.accesskey,
        AccessKey: !!req.headers.AccessKey,
        authorization: !!req.headers.authorization
      }
    });
    
    if (!accessKey) {
      console.error('No AccessKey provided in request headers');
      return res.status(401).json({ 
        error: 'Missing AccessKey header',
        message: 'Please provide API key in AccessKey or accesskey header',
        receivedHeaders: Object.keys(req.headers)
      });
    }
    
    console.log('Video API using key from:', {
      fromAccessKey: !!req.headers.accesskey,
      fromAccessKeyHeader: !!req.headers.AccessKey,
      fromAuth: !!req.headers.authorization,
      fromEnv: !!process.env.VITE_BUNNY_API_KEY,
      keyLength: accessKey.length,
      path: fullPath
    });
    
    // Construct the URL for Bunny.net video API with query parameters
    const queryString = new URLSearchParams(req.query);
    // Remove the 'path' parameter as it's used for routing
    queryString.delete('path');
    const queryParams = queryString.toString();
    const bunnyUrl = `https://video.bunnycdn.com/${fullPath}${queryParams ? '?' + queryParams : ''}`;
    console.log('Proxying video request to:', bunnyUrl);
    
    // Forward the request to Bunny.net
    const response = await fetch(bunnyUrl, {
      method: req.method,
      headers: {
        'Accept': 'application/json',
        'Content-Type': req.headers['content-type'] || 'application/json',
        'AccessKey': accessKey,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      body: req.method !== 'GET' && req.method !== 'HEAD' ? JSON.stringify(req.body) : undefined
    });

    console.log('Bunny video API response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Bunny video API error:', {
        status: response.status,
        statusText: response.statusText,
        body: errorText
      });
      
      return res.status(response.status).json({ 
        error: `Bunny video API error: ${response.status}`,
        details: errorText 
      });
    }
    
    // For binary responses (like video content)
    const contentType = response.headers.get('Content-Type');
    if (contentType && !contentType.includes('application/json')) {
      const arrayBuffer = await response.arrayBuffer();
      res.setHeader('Content-Type', contentType);
      return res.send(Buffer.from(arrayBuffer));
    }
    
    // For JSON responses
    const data = await response.json();
    return res.json(data);
    
  } catch (error) {
    console.error('Video proxy error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
}
