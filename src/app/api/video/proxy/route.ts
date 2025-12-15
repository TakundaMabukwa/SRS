import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const url = request.nextUrl.searchParams.get('url');
    
    if (!url) {
      return NextResponse.json(
        { error: 'URL parameter is required' },
        { status: 400 }
      );
    }

    // Fetch the video stream
    const response = await fetch(url, {
      headers: {
        'Accept': '*/*',
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch video stream' },
        { status: response.status }
      );
    }

    // Get the content type from the response
    const contentType = response.headers.get('content-type') || 'video/x-flv';

    // Stream the response
    return new NextResponse(response.body, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    console.error('Error proxying video stream:', error);
    return NextResponse.json(
      { error: 'Failed to proxy video stream' },
      { status: 500 }
    );
  }
}
