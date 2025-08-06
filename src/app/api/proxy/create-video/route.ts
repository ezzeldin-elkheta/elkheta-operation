import { NextRequest, NextResponse } from 'next/server';
import { VIDEO_BASE_URL } from '@/lib/bunny/constants';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, libraryId, collectionId, accessToken } = body;

    console.log(`[Create Video API] Request received:`, {
      title,
      libraryId,
      hasCollectionId: !!collectionId,
      collectionId: collectionId,
      hasAccessToken: !!accessToken,
      accessTokenLength: accessToken?.length
    });

    if (!title || !libraryId || !accessToken) {
      console.error('[Create Video API] Missing required fields');
      return NextResponse.json({
        error: 'Missing required fields: title, libraryId, and accessToken are required'
      }, { status: 400 });
    }

    // Prepare video creation data
    const videoData: any = { 
      title: title.replace(/\.[^/.]+$/, '') // Remove file extension if present
    };
    
    // Only add collectionId if it's a valid GUID format
    if (collectionId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(collectionId)) {
      videoData.collectionId = collectionId;
      console.log(`[Create Video API] Assigning video to collection: ${collectionId}`);
    } else if (collectionId) {
      console.warn(`[Create Video API] Invalid collection ID format: ${collectionId}, creating video without collection`);
    }

    // Create video entry
    const createUrl = `${VIDEO_BASE_URL}/library/${libraryId}/videos`;
    console.log(`[Create Video API] Making request to: ${createUrl}`);
    console.log(`[Create Video API] Request data:`, videoData);

    const response = await fetch(createUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'AccessKey': accessToken,
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      body: JSON.stringify(videoData),
      signal: AbortSignal.timeout(30000) // 30 second timeout
    });

    console.log(`[Create Video API] Bunny.net response status: ${response.status}`);

    const responseText = await response.text();
    console.log(`[Create Video API] Raw response: ${responseText}`);

    if (!response.ok) {
      console.error(`[Create Video API] Bunny.net API error:`, {
        status: response.status,
        statusText: response.statusText,
        body: responseText,
        requestData: videoData
      });
      
      return NextResponse.json({
        error: `Video creation failed: ${response.status} ${response.statusText}`,
        details: responseText,
        bunnyStatus: response.status,
        requestData: videoData
      }, { status: response.status });
    }

    // Parse successful response
    if (!responseText.trim()) {
      console.error('[Create Video API] Empty response from Bunny.net');
      return NextResponse.json({
        error: 'Empty response from Bunny.net',
        requestData: videoData
      }, { status: 502 });
    }

    let videoResponse;
    try {
      videoResponse = JSON.parse(responseText);
    } catch (parseError) {
      console.error('[Create Video API] Failed to parse response:', parseError);
      return NextResponse.json({
        error: 'Invalid JSON response from Bunny.net',
        rawResponse: responseText,
        parseError: parseError.message,
        requestData: videoData
      }, { status: 502 });
    }

    console.log(`[Create Video API] Video created successfully:`, {
      guid: videoResponse.guid,
      title: videoResponse.title,
      status: videoResponse.status,
      collectionId: videoResponse.collectionId
    });

    return NextResponse.json(videoResponse);

  } catch (error) {
    console.error('[Create Video API] Unexpected error:', error);
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
