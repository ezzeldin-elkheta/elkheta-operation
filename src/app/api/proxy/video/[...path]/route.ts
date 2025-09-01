import { NextRequest, NextResponse } from 'next/server';
import { VIDEO_BASE_URL } from '@/lib/bunny/constants';

interface RouteParams {
  params: {
    path: string[];
  };
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  return handleProxyRequest(request, params);
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  return handleProxyRequest(request, params);
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  return handleProxyRequest(request, params);
}

// DELETE functionality removed for security

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, AccessKey',
    },
  });
}

async function handleProxyRequest(request: NextRequest, params: { path: string[] }) {
  try {
    const url = new URL(request.url);
    const apiKey = request.headers.get('AccessKey') || request.headers.get('accesskey');
    const method = request.method;

    // Build the target path from the route params
    const targetPath = params.path ? `/${params.path.join('/')}` : '';

    if (!targetPath) {
      return NextResponse.json({ error: 'Path parameter is required' }, { status: 400 });
    }

    if (!apiKey) {
      return NextResponse.json({ error: 'API key is required' }, { status: 401 });
    }

    const targetUrl = `${VIDEO_BASE_URL}${targetPath}${url.search}`;
    console.log(`[Video Proxy Dynamic] Forwarding ${method} request to ${targetUrl}`);

    // Set up headers
    const headers = new Headers();
    headers.set('AccessKey', apiKey);
    headers.set('Accept', '*/*');
    
    // Copy content type if it exists
    const contentType = request.headers.get('Content-Type');
    if (contentType) {
      headers.set('Content-Type', contentType);
    }

    // Prepare request body for non-GET methods. We need to fully read the
    // body before forwarding because the Edge runtime does not automatically
    // stream the original ReadableStream to the outbound fetch.
    let forwardBody: BodyInit | undefined = undefined;
    if (method !== 'GET') {
      const contentType = request.headers.get('Content-Type') || '';

      if (contentType.startsWith('application/json')) {
        // Read the raw text so we can forward the exact JSON string
        const rawText = await request.text();
        forwardBody = rawText;
      } else if (contentType.startsWith('application/x-www-form-urlencoded')) {
        // Forward form data as-is
        const rawText = await request.text();
        forwardBody = rawText;
      } else if (contentType.startsWith('multipart/form-data')) {
        // For multipart we can pass the original body (stream)
        forwardBody = request.body;
      } else {
        // Fallback – read as ArrayBuffer to avoid body lock issues
        const buffer = await request.arrayBuffer();
        forwardBody = buffer;
      }
    }

    // Make request to Bunny.net
    let response;
    try {
      response = await fetch(targetUrl, {
        method: method,
        headers: headers,
        body: forwardBody,
        signal: AbortSignal.timeout(300000), // 5 minute timeout for video operations
      });
    } catch (fetchError) {
      console.error('[Video Proxy Dynamic] Fetch error:', fetchError);
      return NextResponse.json({
        error: 'Proxy Error',
        message: `Connection error: ${fetchError.message}`,
        code: fetchError.code || 'CONNECTION_ERROR'
      }, { status: 502 });
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Video Proxy Dynamic] Error response (${response.status}): ${errorText}`);
      return new Response(errorText, { 
        status: response.status,
        headers: {
          'Content-Type': 'text/plain'
        }
      });
    }

    // Handle binary response for video content
    const responseContentType = response.headers.get('Content-Type');
    if (responseContentType && responseContentType.includes('application/octet-stream')) {
      const blob = await response.blob();
      return new Response(blob, {
        status: response.status,
        headers: {
          'Content-Type': responseContentType
        }
      });
    }

    // For JSON responses
    try {
      const data = await response.json();
      return NextResponse.json(data);
    } catch (e) {
      // If not JSON, return the raw response
      const text = await response.text();
      return new Response(text, {
        status: response.status,
        headers: {
          'Content-Type': 'text/plain'
        }
      });
    }
  } catch (error) {
    console.error('[Video Proxy Dynamic] Error:', error);
    return NextResponse.json({
      error: 'Internal server error', 
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
