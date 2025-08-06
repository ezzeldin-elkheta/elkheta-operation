export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, AccessKey, accesskey');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }
  
  try {
    // Get API key from headers OR body
    const accessKey = req.headers.accesskey || 
                     req.headers.AccessKey || 
                     req.headers['accesskey'] || 
                     req.body.accessToken ||
                     process.env.VITE_BUNNY_API_KEY;
    
    if (!accessKey) {
      return res.status(401).json({
        error: 'Missing AccessKey header',
        message: 'Please provide API key in AccessKey, accesskey header, or accessToken in body'
      });
    }
    
    const { libraryId, title, collectionId } = req.body;
    
    if (!libraryId || !title) {
      return res.status(400).json({
        error: 'Missing required parameters',
        message: 'libraryId and title are required'
      });
    }
    
    console.log('Creating video:', {
      libraryId,
      title,
      collectionId: collectionId || 'none',
      keyPreview: `${accessKey.substring(0, 8)}...`,
      keySource: req.headers.accesskey ? 'accesskey header' : 
                req.headers.AccessKey ? 'AccessKey header' :
                req.body.accessToken ? 'body accessToken' : 'environment'
    });
    
    // Create video object
    const videoData = {
      title: title.trim()
    };
    
    if (collectionId) {
      videoData.collectionId = collectionId;
    }
    
    // Make request to Bunny.net video API
    const bunnyUrl = `https://video.bunnycdn.com/library/${libraryId}/videos`;
    console.log('Creating video at:', bunnyUrl);
    
    const response = await fetch(bunnyUrl, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'AccessKey': accessKey
      },
      body: JSON.stringify(videoData)
    });
    
    console.log('Bunny video creation response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Bunny video creation error:', {
        status: response.status,
        statusText: response.statusText,
        body: errorText
      });
      
      return res.status(response.status).json({
        error: `Video creation failed: ${response.status}`,
        details: errorText,
        bunnyUrl
      });
    }
    
    const videoResponse = await response.json();
    console.log('Video created successfully:', {
      guid: videoResponse.guid,
      title: videoResponse.title,
      status: videoResponse.status
    });
    
    return res.json({
      success: true,
      video: videoResponse,
      message: 'Video created successfully'
    });
    
  } catch (error) {
    console.error('Video creation proxy error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      details: error.message
    });
  }
}
