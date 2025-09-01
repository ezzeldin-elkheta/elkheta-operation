import { NextRequest, NextResponse } from 'next/server';
import { BASE_URL } from '@/lib/bunny/constants';

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const path = url.pathname.replace('/api/proxy/base', '');
    const apiKey = request.headers.get('AccessKey') || request.headers.get('accesskey');

    if (!path) {
      return NextResponse.json({ error: 'Path parameter is required' }, { status: 400 });
    }

    if (!apiKey) {
      return NextResponse.json({ error: 'API key is required' }, { status: 401 });
    }

    const targetUrl = `${BASE_URL}${path}${url.search}`;
    console.log(`[Proxy] Forwarding request to ${targetUrl}`);

    const response = await fetch(targetUrl, {
      headers: {
        'AccessKey': apiKey,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Connection': 'keep-alive'
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Proxy] Error response (${response.status}): ${errorText}`);
      return NextResponse.json(
        { error: 'Failed to fetch from Bunny.net', details: errorText },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('[Proxy] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 