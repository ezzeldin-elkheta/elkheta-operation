import { NextRequest, NextResponse } from 'next/server';
import { VIDEO_BASE_URL } from '@/lib/bunny/constants';

export async function GET(request: NextRequest) {
  return handleProxyRequest(request);
}

export async function PUT(request: NextRequest) {
  return handleProxyRequest(request);
}

async function handleProxyRequest(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const path = url.pathname.replace('/api/proxy/video', '');
    const apiKey = request.headers.get('AccessKey') || request.headers.get('accesskey');
    const method = request.method;

    if (!path) {
      return NextResponse.json({ error: 'Path parameter is required' }, { status: 400 });
    }

    if (!apiKey) {
      return NextResponse.json({ error: 'API key is required' }, { status: 401 });
    }

    const targetUrl = `${VIDEO_BASE_URL}${path}${url.search}`;
    console.log(`[Video Proxy] Forwarding ${method} request to ${targetUrl}`);

    // Clone the headers and create a new headers object
    const headers = new Headers();
    headers.set('AccessKey', apiKey);
    headers.set('Accept', '*/*');
    
    // Copy content type if it exists
    const contentType = request.headers.get('Content-Type');
    if (contentType) {
      headers.set('Content-Type', contentType);
    }

    // Prepare request body similarly to ensure proper forwarding (see dynamic route for rationale)
    let forwardBody: BodyInit | undefined = undefined;
    if (method !== 'GET') {
      const cType = request.headers.get('Content-Type') || '';
      if (cType.startsWith('application/json')) {
        forwardBody = await request.text();
      } else if (cType.startsWith('application/x-www-form-urlencoded')) {
        forwardBody = await request.text();
      } else if (cType.startsWith('multipart/form-data')) {
        forwardBody = request.body;
      } else {
        forwardBody = await request.arrayBuffer();
      }
    }

    // Direct connection to Bunny.net
    let response;
    try {
      response = await fetch(targetUrl, {
        method: method,
        headers: headers,
        body: forwardBody,
        // Add a longer timeout for large uploads
        signal: AbortSignal.timeout(300000), // 5 minute timeout
      });
    } catch (fetchError) {
      console.error('[Video Proxy] Fetch error:', fetchError);
      return NextResponse.json({
        error: 'Proxy Error',
        message: `Connection error: ${fetchError.message}`,
        code: fetchError.code || 'CONNECTION_ERROR'
      }, { status: 502 });
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Video Proxy] Error response (${response.status}): ${errorText}`);
      return new Response(errorText, { 
        status: response.status,
        headers: {
          'Content-Type': 'text/plain'
        }
      });
    }

    // Handle binary response for video content
    const contentTypeResponse = response.headers.get('Content-Type');
    if (contentTypeResponse && contentTypeResponse.includes('application/octet-stream')) {
      const blob = await response.blob();
      return new Response(blob, {
        status: response.status,
        headers: {
          'Content-Type': contentTypeResponse
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
    console.error('[Video Proxy] Error:', error);
    return NextResponse.json({
      error: 'Internal server error', 
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 