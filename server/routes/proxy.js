const express = require('express');
const axios = require('axios');
const router = express.Router();

// Generic proxy endpoint for Bunny.net API requests
router.post('/', async (req, res) => {
  try {
    const { targetUrl, method, headers, body } = req.body;
    
    console.log(`Proxying request to ${targetUrl}`, { method, body });
    
    const response = await axios({
      method: method || 'GET',
      url: targetUrl,
      headers,
      data: body || undefined,
      validateStatus: () => true // Return response regardless of status code
    });
    
    return res.status(response.status).send(response.data);
  } catch (error) {
    console.error('Proxy error:', error.message);
    return res.status(500).json({
      error: 'Proxy request failed',
      message: error.message
    });
  }
});

// Specialized endpoint for creating collections
router.post('/create-collection', async (req, res) => {
  try {
    const { libraryId, collectionName, accessToken } = req.body;
    
    if (!libraryId || !collectionName || !accessToken) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }
    
    const response = await axios({
      method: 'POST',
      url: `https://video.bunnycdn.com/library/${libraryId}/collections`,
      headers: {
        'Content-Type': 'application/json',
        'AccessKey': accessToken
      },
      data: {
        name: collectionName
      },
      validateStatus: () => true
    });
    
    if (response.status >= 400) {
      return res.status(response.status).json({
        error: 'Collection creation failed',
        message: response.data,
        status: response.status
      });
    }
    
    return res.status(response.status).json(response.data);
  } catch (error) {
    console.error('Collection creation error:', error.message);
    return res.status(500).json({
      error: 'Collection creation failed',
      message: error.message
    });
  }
});

// New routes for handling collection operations via Bunny.net API
router.get('/video/library/:libraryId/collections', async (req, res) => {
  try {
    const { libraryId } = req.params;
    const apiKey = req.headers['accesskey'] || req.headers['AccessKey'] || req.headers['accessKey'] || req.headers['Accesskey'];

    if (!libraryId) {
      return res.status(400).json({ error: 'Missing libraryId parameter' });
    }

    if (!apiKey) {
      return res.status(401).json({ error: 'Missing AccessKey header' });
    }

    const response = await axios({
      method: 'GET',
      url: `https://video.bunnycdn.com/library/${libraryId}/collections`,
      headers: {
        'Accept': 'application/json',
        'AccessKey': apiKey
      },
      validateStatus: () => true // Return response regardless of status code
    });

    return res.status(response.status).json(response.data);
  } catch (error) {
    console.error('[Collection Proxy] Error fetching collections:', error.message);
    return res.status(500).json({
      error: 'Failed to fetch collections',
      message: error.message
    });
  }
});

router.post('/video/library/:libraryId/collections', async (req, res) => {
  try {
    const { libraryId } = req.params;
    const { name } = req.body;
    const apiKey = req.headers['accesskey'] || req.headers['AccessKey'] || req.headers['accessKey'] || req.headers['Accesskey'];

    if (!libraryId || !name) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    if (!apiKey) {
      return res.status(401).json({ error: 'Missing AccessKey header' });
    }

    const response = await axios({
      method: 'POST',
      url: `https://video.bunnycdn.com/library/${libraryId}/collections`,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'AccessKey': apiKey
      },
      data: { name },
      validateStatus: () => true // Don't throw on error status
    });

    if (response.status >= 400) {
      console.error('[Collection Proxy] Error response from Bunny API:', {
        status: response.status,
        data: response.data
      });
      return res.status(response.status).json({
        error: 'Collection creation failed',
        message: response.data,
        status: response.status
      });
    }

    return res.status(response.status).json(response.data);
  } catch (error) {
    console.error('[Collection Proxy] Error creating collection:', error.message);
    return res.status(500).json({
      error: 'Failed to create collection',
      message: error.message
    });
  }
});

// Specialized endpoint for creating videos
router.post('/create-video', async (req, res) => {
  try {
    const { libraryId, title, collectionId, accessToken } = req.body;
    
    if (!libraryId || !title || !accessToken) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }
    
    // Sanitize title - normalize and remove problematic characters
    const normalizedTitle = title
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, ''); // Remove diacritics
    
    const sanitizedTitle = normalizedTitle
      .replace(/[^\w\s-]/g, '_')
      .replace(/\s+/g, '_')
      .replace(/__+/g, '_')
      .substring(0, 80)
      .toLowerCase();
    
    console.log(`[CreateVideo] Sanitized title from "${title}" to "${sanitizedTitle}"`);
    
    const requestData = {
      title: sanitizedTitle
    };
    
    // Only add collectionId if it's valid
    if (collectionId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(collectionId)) {
      requestData.collectionId = collectionId;
    }
    
    // Make the API call directly to Bunny.net
    const response = await axios({
      method: 'POST',
      url: `https://video.bunnycdn.com/library/${libraryId}/videos`,
      headers: {
        'Content-Type': 'application/json',
        'AccessKey': accessToken
      },
      data: requestData,
      validateStatus: () => true // Don't throw on error status
    });
    
    if (response.status >= 400) {
      console.error('[CreateVideo] Error response from Bunny API:', {
        status: response.status,
        data: response.data
      });
      
      return res.status(response.status).json({
        error: 'Video creation failed',
        message: response.data,
        status: response.status
      });
    }
    
    return res.status(response.status).json(response.data);
  } catch (error) {
    console.error('[CreateVideo] Error:', error.message);
    return res.status(500).json({
      error: 'Server error',
      message: error.message
    });
  }
});

// Add video download proxy route
router.get('/video/download/:libraryId/:videoGuid', async (req, res) => {
  try {
    const { libraryId, videoGuid } = req.params;
    const { quality = '720p' } = req.query;
    const apiKey = req.headers['accesskey'] || process.env.BUNNY_API_KEY;
    
    if (!apiKey) {
      return res.status(401).json({ error: 'API key required' });
    }
    
    // Try different download URL patterns
    const downloadUrls = [
      `https://vz-${libraryId}.b-cdn.net/${videoGuid}/play_${quality.replace('p', '')}p.mp4`,
      `https://video-${libraryId}.b-cdn.net/${videoGuid}/play_${quality.replace('p', '')}p.mp4`,
      `https://vz-${libraryId}.b-cdn.net/${videoGuid}/mp4/video.mp4`,
      `https://iframe.mediadelivery.net/play/${libraryId}/${videoGuid}/${quality.replace('p', '')}p.mp4`
    ];
    
    for (const url of downloadUrls) {
      try {
        console.log(`[Proxy] Trying download URL: ${url}`);
        
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'video/mp4,video/*,*/*'
          }
        });
        
        if (response.ok) {
          console.log(`[Proxy] ✅ Working download URL found: ${url}`);
          
          // Set appropriate headers for download
          res.setHeader('Content-Type', 'video/mp4');
          res.setHeader('Content-Disposition', `attachment; filename="video_${videoGuid}_${quality}.mp4"`);
          
          // Forward the content length if available
          const contentLength = response.headers.get('Content-Length');
          if (contentLength) {
            res.setHeader('Content-Length', contentLength);
          }
          
          // Stream the video content
          response.body.pipe(res);
          return;
        }
        
        console.log(`[Proxy] ❌ URL failed (${response.status}): ${url}`);
      } catch (error) {
        console.log(`[Proxy] ❌ URL error: ${url}`, error.message);
      }
    }
    
    // If all URLs fail, return 404
    res.status(404).json({ 
      error: 'Video file not found or access denied',
      message: 'No working download URL found for this video'
    });
    
  } catch (error) {
    console.error('[Proxy] Video download error:', error);
    res.status(500).json({ 
      error: 'Internal server error', 
      message: error.message 
    });
  }
});

module.exports = router;
