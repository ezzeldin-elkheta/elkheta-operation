export default async function handler(req, res) {
  console.log('Base Proxy API called:', {
    method: req.method,
    url: req.url,
    query: req.query,
    path: req.query.path
  });

  const { path } = req.query;
  const fullPath = Array.isArray(path) ? path.join('/') : path;
  
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, AccessKey, accesskey');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  try {
    // Get API key from multiple sources with priority order
    const accessKey = req.headers.accesskey || 
                     req.headers.AccessKey || 
                     req.headers['accesskey'] || 
                     req.headers['access-key'] ||
                     req.headers.authorization?.replace('Bearer ', '') ||
                     process.env.VITE_BUNNY_API_KEY;
    
    console.log('Base API request details:', {
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
      console.error('No AccessKey provided in request headers or environment');
      return res.status(401).json({ 
        error: 'Missing AccessKey header',
        message: 'Please provide API key in AccessKey, accesskey header, or set VITE_BUNNY_API_KEY environment variable',
        receivedHeaders: Object.keys(req.headers)
      });
    }
    
    // Build URL with query parameters  
    const queryString = new URLSearchParams();
    Object.keys(req.query).forEach(key => {
      if (key !== 'path') { // Exclude route parameter
        if (Array.isArray(req.query[key])) {
          req.query[key].forEach(value => queryString.append(key, value));
        } else {
          queryString.append(key, req.query[key]);
        }
      }
    });
    const queryParams = queryString.toString();
    const bunnyUrl = `https://api.bunny.net/${fullPath}${queryParams ? '?' + queryParams : ''}`;
    
    console.log('Proxying to:', bunnyUrl);
    console.log('Using API key:', accessKey.substring(0, 8) + '...');
    
    const response = await fetch(bunnyUrl, {
      method: req.method,
      headers: {
        'Accept': 'application/json',
        'Content-Type': req.headers['content-type'] || 'application/json',
        'AccessKey': accessKey,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      body: req.method !== 'GET' && req.method !== 'HEAD' ? JSON.stringify(req.body) : undefined,
      signal: AbortSignal.timeout(30000) // 30 second timeout
    });

    console.log('Bunny API response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Bunny API error:', {
        status: response.status,
        statusText: response.statusText,
        body: errorText,
        url: bunnyUrl
      });
      return res.status(response.status).json({ 
        error: `Bunny API error: ${response.status}`,
        details: errorText,
        url: bunnyUrl
      });
    }
    
    const data = await response.json();
    console.log('Bunny API success, returning data');
    return res.json(data);
    
  } catch (error) {
    console.error('Base Proxy error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error.message,
      path: fullPath
    });
  }
}
