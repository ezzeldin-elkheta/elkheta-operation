import { NextRequest, NextResponse } from 'next/server';
import { cache } from '@/lib/cache';

interface RouteParams {
  params: {
    libraryId: string;
    videoGuid: string;
  };
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { libraryId, videoGuid } = params;
    const url = new URL(request.url);
    const quality = url.searchParams.get('quality') || '720p';
    const filename = url.searchParams.get('filename') || `video_${videoGuid}`;

    console.log(`[Download Proxy] Downloading video ${videoGuid} from library ${libraryId} with quality ${quality}`);

    // Get the API key for this library
    const libraryApiKey = cache.get(`library_${libraryId}_api`);
    if (!libraryApiKey) {
      return NextResponse.json({ error: 'No API key found for this library' }, { status: 401 });
    }

    // Try multiple download URLs in order of preference
    const downloadUrls = [
      // Primary: Direct API download endpoint
      `https://video.bunnycdn.com/library/${libraryId}/videos/${videoGuid}/download?resolution=${quality}`,
      
      // Secondary: Direct MP4 URL
      `https://iframe.mediadelivery.net/play/${libraryId}/${videoGuid}/${quality}.mp4`,
      
      // Fallback: CDN URLs
      `https://vz-${libraryId}.b-cdn.net/${videoGuid}/mp4/${quality}.mp4`,
      `https://video-${libraryId}.b-cdn.net/${videoGuid}/mp4/${quality}.mp4`
    ];

    let lastError: any = null;

    for (const downloadUrl of downloadUrls) {
      try {
        console.log(`[Download Proxy] Trying URL: ${downloadUrl}`);

        const response = await fetch(downloadUrl, {
          method: 'GET',
          headers: {
            'AccessKey': libraryApiKey,
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'video/mp4,video/*,*/*',
            'Cache-Control': 'no-cache'
          },
          signal: AbortSignal.timeout(120000) // 2 minute timeout
        });

        if (response.ok) {
          console.log(`[Download Proxy] Successfully fetched video from ${downloadUrl}`);
          
          // Get the video data
          const videoData = await response.arrayBuffer();
          
          // Return with proper download headers
          return new Response(videoData, {
            status: 200,
            headers: {
              'Content-Type': 'video/mp4',
              'Content-Disposition': `attachment; filename="${filename}_${quality}.mp4"`,
              'Content-Length': videoData.byteLength.toString(),
              'Cache-Control': 'no-cache, no-store, must-revalidate',
              'Pragma': 'no-cache',
              'Expires': '0'
            }
          });
        } else {
          console.warn(`[Download Proxy] URL failed with status ${response.status}: ${downloadUrl}`);
          lastError = new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
      } catch (error) {
        console.warn(`[Download Proxy] Error with URL ${downloadUrl}:`, error);
        lastError = error;
        continue;
      }
    }

    // If all URLs failed
    console.error(`[Download Proxy] All download URLs failed for video ${videoGuid}`);
    return NextResponse.json({
      error: 'Failed to download video',
      message: 'All download sources failed',
      lastError: lastError?.message || 'Unknown error'
    }, { status: 404 });

  } catch (error) {
    console.error('[Download Proxy] General error:', error);
    return NextResponse.json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 