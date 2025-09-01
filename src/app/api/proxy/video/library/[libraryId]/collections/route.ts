import { NextRequest, NextResponse } from 'next/server';
import { VIDEO_BASE_URL } from '@/lib/bunny/constants';

interface RouteParams {
  params: {
    libraryId: string;
  };
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  return handleCollectionRequest(request, params, 'GET');
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  return handleCollectionRequest(request, params, 'POST');
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  return handleCollectionRequest(request, params, 'PUT');
}

// DELETE functionality completely removed for security - no deletion allowed

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, AccessKey',
    },
  });
}

async function handleCollectionRequest(
  request: NextRequest,
  params: { libraryId: string },
  method: string
) {
  try {
    const { libraryId } = params;
    const url = new URL(request.url);
    
    // Try multiple header variations for API key
    const apiKey = request.headers.get('AccessKey') || 
                   request.headers.get('accesskey') || 
                   request.headers.get('Access-Key') ||
                   request.headers.get('access-key') ||
                   process.env.VITE_BUNNY_API_KEY;

    console.log(`[Collections Proxy] ${method} request for library ${libraryId}`);
    console.log(`[Collections Proxy] Available headers:`, Object.fromEntries(request.headers.entries()));

    if (!apiKey) {
      console.error('[Collections Proxy] No API key found in any header format or environment');
      return NextResponse.json({ 
        error: 'API key is required',
        debug: {
          headers: Object.fromEntries(request.headers.entries()),
          hasEnvKey: !!process.env.VITE_BUNNY_API_KEY
        }
      }, { status: 401 });
    }

    if (!libraryId) {
      console.error('[Collections Proxy] No library ID provided');
      return NextResponse.json({ error: 'Library ID is required' }, { status: 400 });
    }

    // Build target URL
    const targetUrl = `${VIDEO_BASE_URL}/library/${libraryId}/collections${url.search}`;
    console.log(`[Collections Proxy] Forwarding to: ${targetUrl}`);
    console.log(`[Collections Proxy] Using API key: ${apiKey.substring(0, 8)}...`);

    // Prepare headers for Bunny.net request
    const headers = new Headers();
    headers.set('AccessKey', apiKey);
    headers.set('Accept', 'application/json');
    headers.set('Content-Type', 'application/json');
    headers.set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');

    // Prepare request body for non-GET methods
    let requestBody: string | undefined = undefined;
    if (method !== 'GET') {
      try {
        const body = await request.text();
        if (body) {
          requestBody = body;
          console.log(`[Collections Proxy] Request body:`, JSON.parse(body));
        }
      } catch (error) {
        console.error(`[Collections Proxy] Error reading request body:`, error);
      }
    }

    // Make request to Bunny.net with timeout
    console.log(`[Collections Proxy] Making ${method} request with API key length: ${apiKey.length}`);
    
    const response = await fetch(targetUrl, {
      method,
      headers,
      body: requestBody,
      signal: AbortSignal.timeout(30000) // 30 second timeout
    });

    console.log(`[Collections Proxy] Bunny.net response status: ${response.status}`);
    console.log(`[Collections Proxy] Response headers:`, Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Collections Proxy] Error response from Bunny.net:`, {
        status: response.status,
        statusText: response.statusText,
        body: errorText,
        requestUrl: targetUrl,
        requestMethod: method,
        requestBody: requestBody ? JSON.parse(requestBody) : null,
        apiKeyUsed: apiKey.substring(0, 8) + '...'
      });
      
      return NextResponse.json({
        error: `Collection operation failed: ${response.status} ${response.statusText}`,
        details: errorText,
        bunnyStatus: response.status,
        requestData: {
          url: targetUrl,
          method,
          body: requestBody ? JSON.parse(requestBody) : null
        }
      }, { status: response.status });
    }

    // Parse and return successful response
    try {
      const responseText = await response.text();
      console.log(`[Collections Proxy] Raw response: ${responseText}`);
      
      if (!responseText.trim()) {
        console.log(`[Collections Proxy] Empty response from Bunny.net`);
        return NextResponse.json({ message: 'Operation completed successfully' });
      }
      
      const data = JSON.parse(responseText);
      console.log(`[Collections Proxy] Parsed response:`, data);
      return NextResponse.json(data);
    } catch (parseError) {
      console.error(`[Collections Proxy] Error parsing response:`, parseError);
      const text = await response.text();
      return new Response(text, {
        status: response.status,
        headers: { 'Content-Type': 'text/plain' }
      });
    }

  } catch (error) {
    console.error(`[Collections Proxy] General error:`, error);
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
