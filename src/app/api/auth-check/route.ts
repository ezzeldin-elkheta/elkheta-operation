import { NextRequest, NextResponse } from 'next/server';

// This endpoint helps check authentication and environment configuration
export async function GET(request: NextRequest) {
  try {
    console.log('[Auth Check] Checking authentication configuration');
    
    // Check for API key in headers
    const authHeader = request.headers.get('AccessKey') || 
                      request.headers.get('accesskey') || 
                      request.headers.get('Access-Key') ||
                      request.headers.get('access-key');
    
    // Check environment variable
    const envApiKey = process.env.VITE_BUNNY_API_KEY;
    
    const response = {
      hasHeaderApiKey: !!authHeader,
      hasEnvApiKey: !!envApiKey,
      envApiKeyLength: envApiKey ? envApiKey.length : 0,
      headerApiKeyLength: authHeader ? authHeader.length : 0,
      availableHeaders: Object.keys(Object.fromEntries(request.headers.entries())),
      timestamp: new Date().toISOString()
    };
    
    console.log('[Auth Check] Configuration:', response);
    
    return NextResponse.json(response);
  } catch (error) {
    console.error('[Auth Check] Error:', error);
    return NextResponse.json({
      error: 'Failed to check authentication',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { apiKey } = body;
    
    if (!apiKey) {
      return NextResponse.json({
        error: 'API key is required'
      }, { status: 400 });
    }
    
    // Test the API key with a simple request
    console.log('[Auth Check] Testing API key:', apiKey.substring(0, 8) + '...');
    
    const testResponse = await fetch('https://api.bunny.net/videolibrary?page=1&perPage=1', {
      method: 'GET',
      headers: {
        'AccessKey': apiKey,
        'Accept': 'application/json'
      },
      signal: AbortSignal.timeout(10000) // 10 second timeout
    });
    
    const result: any = {
      isValid: testResponse.ok,
      status: testResponse.status,
      statusText: testResponse.statusText,
      timestamp: new Date().toISOString()
    };
    
    if (!testResponse.ok) {
      const errorText = await testResponse.text();
      result.error = errorText;
      console.log('[Auth Check] API key test failed:', result);
    } else {
      console.log('[Auth Check] API key test successful');
    }
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('[Auth Check] Test error:', error);
    return NextResponse.json({
      error: 'Failed to test API key',
      details: error instanceof Error ? error.message : 'Unknown error',
      isValid: false
    }, { status: 500 });
  }
}
