import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const videoBaseUrl = process.env.NEXT_PUBLIC_VIDEO_BASE_URL || 'http://164.90.182.2:3000';
  
  const targetPath = path.join('/');
  const targetUrl = `${videoBaseUrl}/api/stream/${targetPath}`;
  
  console.log('HLS Proxy Request:', targetUrl);

  try {
    const response = await fetch(targetUrl);
    
    console.log('HLS Proxy Response:', response.status, response.statusText);
    
    if (!response.ok) {
      return NextResponse.json(
        { error: 'Stream not found', url: targetUrl },
        { status: response.status }
      );
    }

    const data = await response.arrayBuffer();
    const contentType = response.headers.get('content-type') || 'application/vnd.apple.mpegurl';

    return new NextResponse(data, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Cache-Control': 'no-cache',
      },
    });
  } catch (error) {
    console.error('HLS proxy error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stream' },
      { status: 500 }
    );
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
