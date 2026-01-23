import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const videoBaseUrl = process.env.NEXT_PUBLIC_VIDEO_BASE_URL || 'http://164.90.182.2:3000';
  
  // path will be like: ["221083633486", "1", "playlist.m3u8"]
  // We need to convert to: /api/stream/221083633486/1/playlist.m3u8
  const targetPath = path.join('/');
  const targetUrl = `${videoBaseUrl}/api/stream/${targetPath}`;
  
  console.log('[HLS Proxy] Request:', targetUrl);

  let retries = 3;
  while (retries > 0) {
    try {
      const response = await fetch(targetUrl, {
        cache: 'no-store',
        signal: AbortSignal.timeout(25000)
      });
      
      console.log('[HLS Proxy] Response:', response.status, response.statusText);
      
      if (!response.ok) {
        console.error('[HLS Proxy] Failed:', response.status, await response.text());
        return NextResponse.json(
          { error: 'Stream not found', url: targetUrl },
          { status: response.status }
        );
      }

      const data = await response.arrayBuffer();
      const contentType = response.headers.get('content-type') || 
        (targetPath.endsWith('.m3u8') ? 'application/vnd.apple.mpegurl' : 'video/mp2t');

      return new NextResponse(data, {
        status: 200,
        headers: {
          'Content-Type': contentType,
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
      });
    } catch (error: any) {
      retries--;
      if (retries === 0 || !error.message?.includes('socket')) {
        console.error('[HLS Proxy] Error:', error);
        return NextResponse.json(
          { error: 'Failed to fetch stream' },
          { status: 500 }
        );
      }
      console.log(`[HLS Proxy] Socket error, retrying... (${retries} left)`);
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
