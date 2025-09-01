/**
 * Server middleware for handling file uploads and proxying to Bunny.net
 */

export const createBunnyVideoProxyMiddleware = (options = {}) => {
  const { defaultApiKey } = options;
  
  return async (req, res, next) => {
    // Skip if this isn't a Bunny video API request
    if (!req.path.startsWith('/api/proxy/video')) {
      return next();
    }
    
    // Skip if this is a video creation request - let the newer proxy handle it
    if (req.path.match(/\/api\/proxy\/video\/library\/\d+\/videos$/) && req.method === 'POST') {
      console.log(`[BunnyMiddleware] Skipping video creation request, letting proxy handle it: ${req.method} ${req.path}`);
      return next();
    }
    
    // Skip if this is a collections request - let specific handlers handle it
    if (req.path.includes('/collections')) {
      return next();
    }
    
    // Add CORS headers for preflight requests
    if (req.method === 'OPTIONS') {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      // Ensure all necessary headers for upload are allowed
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, AccessKey, Content-Length, Accept, Authorization, X-Upload-Content-Length');
      res.setHeader('Access-Control-Max-Age', '86400');
      return res.status(204).end();
    }
    
    // Log all requests to video API with more detail
    console.log(`[BunnyMiddleware] ${req.method} ${req.path}`, {
      headers: Object.keys(req.headers),
      hasAccessKey: !!req.headers['accesskey'],
      contentType: req.headers['content-type'],
      contentLength: req.headers['content-length'],
      bodySize: req.body ? Object.keys(req.body).length : 0
    });

    // Handle download requests specifically
    if (req.path.includes('/download/')) {
      return handleDownloadRequest(req, res, defaultApiKey);
    }

    // Handle other proxy requests
    return handleRegularProxy(req, res, next, defaultApiKey);
  };
};

async function handleDownloadRequest(req, res, defaultApiKey) {
  const pathParts = req.path.split('/');
  const libraryId = pathParts[pathParts.indexOf('download') + 1];
  const videoGuid = pathParts[pathParts.indexOf('download') + 2];
  const quality = req.query.quality || '720p';
  
  console.log(`[BunnyMiddleware] Enhanced download request for video ${videoGuid}, quality ${quality}`);
  
  const apiKey = req.headers['accesskey'] || defaultApiKey;
  
  try {
    // Step 1: Get video details to check MP4 Fallback and available qualities
    const videoDetailsUrl = `https://video.bunnycdn.com/library/${libraryId}/videos/${videoGuid}`;
    const videoResponse = await fetch(videoDetailsUrl, {
      headers: {
        'AccessKey': apiKey,
        'accept': 'application/json'
      }
    });

    if (!videoResponse.ok) {
      return res.status(videoResponse.status).json({
        error: 'Video Not Found',
        message: 'Could not fetch video details from Bunny API',
        statusCode: videoResponse.status
      });
    }

    const videoData = await videoResponse.json();
    console.log(`[BunnyMiddleware] Video details:`, {
      title: videoData.title,
      hasMP4Fallback: videoData.hasMP4Fallback,
      availableResolutions: videoData.availableResolutions,
      status: videoData.status,
      dateCreated: videoData.dateCreated
    });

    // Step 2: Check if video supports MP4 download
    if (!videoData.hasMP4Fallback) {
      return res.status(400).json({
        error: 'Download Not Supported',
        message: 'This video does not support direct download. MP4 Fallback must be enabled in the library settings before uploading videos.',
        arabicMessage: 'هذا الفيديو لا يدعم التحميل المباشر. يجب تفعيل MP4 Fallback في إعدادات المكتبة قبل رفع الفيديو.',
        hasMP4Fallback: false,
        solution: 'Enable MP4 Fallback in your video library settings and re-upload the video.'
      });
    }

    // Step 3: Validate requested quality
    const availableQualities = determineAvailableQualities(videoData);
    if (!availableQualities.includes(quality)) {
      return res.status(400).json({
        error: 'Quality Not Available',
        message: `Requested quality ${quality} is not available for this video.`,
        arabicMessage: `الجودة المطلوبة ${quality} غير متاحة لهذا الفيديو.`,
        requestedQuality: quality,
        availableQualities: availableQualities,
        suggestedQuality: availableQualities[0] || null
      });
    }

    // Step 4: Try download URLs in order of reliability
    const downloadUrls = generateEnhancedDownloadUrls(libraryId, videoGuid, quality, videoData);
    
    for (const urlInfo of downloadUrls) {
      console.log(`[BunnyMiddleware] Trying ${urlInfo.type}: ${urlInfo.url}`);
      
      try {
        const downloadResponse = await fetch(urlInfo.url, {
          method: 'GET',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            ...(urlInfo.requiresAuth && apiKey ? { 'AccessKey': apiKey } : {})
          }
        });
        
        if (downloadResponse.ok) {
          console.log(`[BunnyMiddleware] ✅ Working download URL (${urlInfo.type}): ${urlInfo.url}`);
          
          // Stream the video content back to client
          res.setHeader('Content-Type', 'video/mp4');
          res.setHeader('Content-Disposition', `attachment; filename="${sanitizeFilename(videoData.title || 'video')}_${quality}.mp4"`);
          
          const contentLength = downloadResponse.headers.get('content-length');
          if (contentLength) {
            res.setHeader('Content-Length', contentLength);
          }
          
          // Add CORS headers
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Disposition');
          
          // Pipe the response
          const reader = downloadResponse.body.getReader();
          
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            res.write(Buffer.from(value));
          }
          
          res.end();
          return;
        } else {
          console.log(`[BunnyMiddleware] ❌ ${urlInfo.type} failed (${downloadResponse.status}): ${urlInfo.url}`);
        }
      } catch (error) {
        console.log(`[BunnyMiddleware] ❌ ${urlInfo.type} error: ${urlInfo.url}`, error.message);
      }
    }

    // Step 5: If all downloads fail, try HLS manifest approach
    try {
      const hlsResult = await tryHLSManifestApproach(libraryId, videoGuid, quality);
      if (hlsResult.success) {
        return res.json({
          error: 'Direct Download Failed',
          message: 'Direct download URLs are not accessible, but HLS stream is available.',
          arabicMessage: 'روابط التحميل المباشر غير متاحة، لكن البث المباشر متوفر.',
          hlsUrl: hlsResult.hlsUrl,
          suggestion: 'Use HLS stream or contact support to enable direct download.'
        });
      }
    } catch (hlsError) {
      console.log(`[BunnyMiddleware] HLS approach also failed:`, hlsError);
    }

    // Step 6: Return comprehensive error with diagnostics
    res.status(404).json({
      error: 'Download Failed',
      message: 'No working download URL found for this video.',
      arabicMessage: 'لم يتم العثور على رابط تحميل صالح لهذا الفيديو.',
      diagnostics: {
        hasMP4Fallback: videoData.hasMP4Fallback,
        requestedQuality: quality,
        availableQualities: availableQualities,
        videoStatus: videoData.status,
        testedUrls: downloadUrls.length
      },
      possibleCauses: [
        'CDN domain may be suspended or not properly configured',
        'Video was uploaded before MP4 Fallback was enabled',
        'Requested quality may not be fully processed yet',
        'Network connectivity issues'
      ],
      solutions: [
        'Verify MP4 Fallback is enabled in library settings',
        'Try a different quality option',
        'Re-upload the video after enabling MP4 Fallback',
        'Contact support if issue persists'
      ]
    });

  } catch (error) {
    console.error(`[BunnyMiddleware] Download request error:`, error);
    res.status(500).json({
      error: 'Server Error',
      message: 'Internal server error while processing download request',
      arabicMessage: 'خطأ داخلي في الخادم أثناء معالجة طلب التحميل',
      details: error.message
    });
  }
}

function determineAvailableQualities(videoData) {
  if (videoData.availableResolutions && videoData.availableResolutions.length > 0) {
    return videoData.availableResolutions;
  }
  
  // Fallback based on original dimensions
  const height = videoData.height || 720;
  const qualities = ['240p', '360p', '480p', '720p', '1080p', '1440p', '2160p'];
  
  return qualities.filter(quality => {
    const qualityHeight = parseInt(quality.replace('p', ''));
    return qualityHeight <= height;
  });
}

function generateEnhancedDownloadUrls(libraryId, videoGuid, quality, videoData) {
  const cleanQuality = quality.replace('p', '');
  
  const urls = [
    // Official API endpoint (requires auth)
    {
      type: 'official-api',
      url: `https://video.bunnycdn.com/library/${libraryId}/videos/${videoGuid}/download?resolution=${quality}`,
      requiresAuth: true,
      priority: 1
    },
    
    // Primary CDN patterns (most reliable for MP4 Fallback)
    {
      type: 'primary-cdn',
      url: `https://vz-${libraryId}.b-cdn.net/${videoGuid}/play_${cleanQuality}p.mp4`,
      requiresAuth: false,
      priority: 2
    },
    {
      type: 'alternative-cdn',
      url: `https://video-${libraryId}.b-cdn.net/${videoGuid}/play_${cleanQuality}p.mp4`,
      requiresAuth: false,
      priority: 3
    },
    
    // MP4 fallback patterns (if available)
    ...(videoData.hasMP4Fallback ? [
      {
        type: 'mp4-fallback-primary',
        url: `https://vz-${libraryId}.b-cdn.net/${videoGuid}/mp4/video.mp4`,
        requiresAuth: false,
        priority: 4
      },
      {
        type: 'mp4-fallback-alt',
        url: `https://video-${libraryId}.b-cdn.net/${videoGuid}/mp4/video.mp4`,
        requiresAuth: false,
        priority: 5
      }
    ] : []),
    
    // Media delivery patterns
    {
      type: 'media-delivery',
      url: `https://iframe.mediadelivery.net/play/${libraryId}/${videoGuid}/${cleanQuality}p.mp4`,
      requiresAuth: false,
      priority: 6
    }
  ];
  
  return urls.sort((a, b) => a.priority - b.priority);
}

async function tryHLSManifestApproach(libraryId, videoGuid, quality) {
  const hlsUrl = `https://vz-${libraryId}.b-cdn.net/${videoGuid}/playlist.m3u8`;
  
  try {
    const response = await fetch(hlsUrl);
    if (response.ok) {
      return { success: true, hlsUrl };
    }
  } catch (error) {
    console.log('HLS manifest not accessible:', error);
  }
  
  return { success: false };
}

function sanitizeFilename(filename) {
  return filename
    .replace(/[^a-zA-Z0-9\u0600-\u06FF\s\-_\.]/g, '') // Keep Arabic, English, numbers, spaces, hyphens, underscores, dots
    .replace(/\s+/g, '_') // Replace spaces with underscores
    .substring(0, 100); // Limit length
}

async function handleRegularProxy(req, res, next, defaultApiKey) {
  // Handle regular proxy requests (existing implementation)
  next();
}
