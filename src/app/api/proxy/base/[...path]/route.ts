import { NextRequest, NextResponse } from 'next/server';
import { BASE_URL } from '@/lib/bunny/constants';

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

    const targetUrl = `${BASE_URL}${targetPath}${url.search}`;
    console.log(`[Base Proxy Dynamic] Forwarding ${method} request to ${targetUrl}`);

    // Set up headers
    const headers = new Headers();
    headers.set('AccessKey', apiKey);
    headers.set('Accept', 'application/json');
    
    if (method !== 'GET') {
      headers.set('Content-Type', 'application/json');
    }
    
    // Make request to Bunny.net
    let response;
    try {
      response = await fetch(targetUrl, {
        method: method,
        headers: headers,
        body: method !== 'GET' ? request.body : undefined,
        signal: AbortSignal.timeout(180000), // 3 minute timeout
      });
      
      console.log(`[Base Proxy Dynamic] Response status: ${response.status}`);
    } catch (fetchError) {
      console.error('[Base Proxy Dynamic] Fetch error:', fetchError);
      return NextResponse.json({
        error: 'Proxy Error',
        message: `Connection error: ${fetchError.message}`,
        code: fetchError.code || 'CONNECTION_ERROR'
      }, { status: 502 });
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Base Proxy Dynamic] Error response (${response.status}): ${errorText.substring(0, 200)}...`);
      
      let errorObject = { error: 'Failed to fetch from Bunny.net', details: errorText.substring(0, 500) };
      try {
        if (!errorText.trim().startsWith('<')) {
          errorObject = JSON.parse(errorText);
        }
      } catch (e) {
        // Use text as is
      }
      
      return NextResponse.json(errorObject, { status: response.status });
    }

    // Handle response based on content type
    const contentType = response.headers.get('Content-Type') || '';
    
    // Special handling for videolibrary endpoints
    if (targetPath.includes('videolibrary')) {
      const rawText = await response.text();
      
      if (rawText.trim().startsWith('<!DOCTYPE') || rawText.trim().startsWith('<html')) {
        console.error('[Base Proxy Dynamic] Received HTML instead of JSON from Bunny API');
        return NextResponse.json({
          error: 'Invalid API response',
          message: 'Received HTML instead of JSON. Check your API key and permissions.',
          details: rawText.substring(0, 500)
        }, { status: 502 });
      }
      
      try {
        const jsonData = JSON.parse(rawText);
        return NextResponse.json(jsonData);
      } catch (e) {
        console.error('[Base Proxy Dynamic] Failed to parse response as JSON:', e);
        return NextResponse.json({
          error: 'Invalid JSON in response',
          message: e instanceof Error ? e.message : 'Unknown parsing error',
          details: rawText.substring(0, 500)
        }, { status: 502 });
      }
    }
    
    // For JSON responses
    if (contentType.includes('application/json')) {
      try {
        const data = await response.json();
        return NextResponse.json(data);
      } catch (e) {
        console.error('[Base Proxy Dynamic] Failed to parse JSON response:', e);
        const text = await response.text();
        return NextResponse.json({
          error: 'Invalid JSON response',
          details: text.substring(0, 500)
        }, { status: 502 });
      }
    }
    
    // For text responses
    if (contentType.includes('text/')) {
      const text = await response.text();
      
      try {
        const data = JSON.parse(text);
        return NextResponse.json(data);
      } catch (e) {
        return NextResponse.json({
          text: text.substring(0, 1000),
          contentType
        });
      }
    }
    
    // For binary responses
    const blob = await response.blob();
    return new Response(blob, {
      status: response.status,
      headers: {
        'Content-Type': contentType
      }
    });
  } catch (error) {
    console.error('[Base Proxy Dynamic] Error:', error);
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
