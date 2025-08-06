import { NextRequest, NextResponse } from 'next/server';
import { BASE_URL } from '@/lib/bunny/constants';

export async function GET(request: NextRequest) {
  return handleProxyRequest(request);
}

export async function POST(request: NextRequest) {
  return handleProxyRequest(request);
}

export async function PUT(request: NextRequest) {
  return handleProxyRequest(request);
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

async function handleProxyRequest(request: NextRequest) {
  try {
    const url = new URL(request.url);
    
    // Extract path after /api/proxy/base
    const fullPath = url.pathname;
    const basePath = '/api/proxy/base';
    let targetPath = fullPath.replace(basePath, '');
    
    // If no path after base, check for path in search params
    if (!targetPath || targetPath === '/') {
      const pathParam = url.searchParams.get('path');
      if (pathParam) {
        targetPath = pathParam.startsWith('/') ? pathParam : `/${pathParam}`;
      }
    }
    
    const apiKey = request.headers.get('AccessKey') || request.headers.get('accesskey');
    const method = request.method;

    if (!targetPath || targetPath === '/') {
      return NextResponse.json({ error: 'Path parameter is required' }, { status: 400 });
    }

    if (!apiKey) {
      return NextResponse.json({ error: 'API key is required' }, { status: 401 });
    }

    // Clean target path
    if (!targetPath.startsWith('/')) {
      targetPath = `/${targetPath}`;
    }

    const targetUrl = `${BASE_URL}${targetPath}${url.search}`;
    console.log(`[Base Proxy] Forwarding ${method} request to ${targetUrl}`);

    // Clone the headers and create a new headers object
    const headers = new Headers();
    headers.set('AccessKey', apiKey);
    headers.set('Accept', 'application/json');
    
    // Log the headers we're sending
    console.log(`[Base Proxy DEBUG] Request headers:`, Object.fromEntries(headers.entries()));
    
    // Set appropriate content type for the request
    if (method !== 'GET') {
      headers.set('Content-Type', 'application/json');
    }
    
    // Direct connection to Bunny.net
    let response;
    try {
      response = await fetch(targetUrl, {
        method: method,
        headers: headers,
        body: method !== 'GET' ? request.body : undefined,
        // Add a longer timeout for requests
        signal: AbortSignal.timeout(180000), // 3 minute timeout
      });
      
      // Log the response details
      console.log(`[Base Proxy DEBUG] Response status: ${response.status}, headers:`, 
                Object.fromEntries(response.headers.entries()));
    } catch (fetchError) {
      console.error('[Base Proxy] Fetch error:', fetchError);
      return NextResponse.json({
        error: 'Proxy Error',
        message: `Connection error: ${fetchError.message}`,
        code: fetchError.code || 'CONNECTION_ERROR'
      }, { status: 502 });
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Base Proxy] Error response (${response.status}): ${errorText.substring(0, 200)}...`);
      
      // Try to parse as JSON, but fall back to text if it's not valid JSON
      let errorObject = { error: 'Failed to fetch from Bunny.net', details: errorText.substring(0, 500) };
      try {
        // Only try to parse as JSON if it doesn't look like HTML
        if (!errorText.trim().startsWith('<')) {
          errorObject = JSON.parse(errorText);
        }
      } catch (e) {
        // If parsing fails, use the text as is
      }
      
      return NextResponse.json(errorObject, { status: response.status });
    }

    // Get the content type to determine how to handle the response
    const contentType = response.headers.get('Content-Type') || '';
    console.log(`[Base Proxy DEBUG] Response content type: ${contentType}`);
    
    // Special handling for videolibrary endpoint to debug HTML response issue
    if (targetPath.includes('videolibrary')) {
      const rawText = await response.text();
      console.log(`[Base Proxy DEBUG] Raw videolibrary response (first 200 chars): ${rawText.substring(0, 200)}...`);
      
      // Check if it's HTML
      if (rawText.trim().startsWith('<!DOCTYPE') || rawText.trim().startsWith('<html')) {
        console.error('[Base Proxy] Received HTML instead of JSON from Bunny API');
        return NextResponse.json({
          error: 'Invalid API response',
          message: 'Received HTML instead of JSON. Check your API key and permissions.',
          details: rawText.substring(0, 500)
        }, { status: 502 });
      }
      
      // Try to parse as JSON
      try {
        const jsonData = JSON.parse(rawText);
        console.log('[Base Proxy DEBUG] Successfully parsed JSON response');
        return NextResponse.json(jsonData);
      } catch (e) {
        console.error('[Base Proxy] Failed to parse response as JSON:', e);
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
        console.error('[Base Proxy] Failed to parse JSON response:', e);
        const text = await response.text();
        return NextResponse.json({
          error: 'Invalid JSON response',
          details: text.substring(0, 500) // Truncate to avoid very large responses
        }, { status: 502 });
      }
    }
    
    // For text responses
    if (contentType.includes('text/')) {
      const text = await response.text();
      
      // Try to parse as JSON even if content type is not JSON
      try {
        const data = JSON.parse(text);
        return NextResponse.json(data);
      } catch (e) {
        // If not JSON, return a JSON wrapper for the text
        return NextResponse.json({
          text: text.substring(0, 1000), // Truncate long responses
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
    console.error('[Base Proxy] Error:', error);
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 