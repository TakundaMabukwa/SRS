import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const videoServerUrl = process.env.NEXT_PUBLIC_VIDEO_SERVER_BASE_URL;

    if (!videoServerUrl) {
      return NextResponse.json(
        { error: 'Video server URL not configured' },
        { status: 500 }
      );
    }

    const response = await fetch(`${videoServerUrl}/api/stream/network`, {
      method: 'GET',
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Error proxying video streams request:', error);
    return NextResponse.json(
      { error: 'Failed to fetch video streams' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const videoServerUrl = process.env.NEXT_PUBLIC_VIDEO_SERVER_BASE_URL;

    if (!videoServerUrl) {
      return NextResponse.json(
        { error: 'Video server URL not configured' },
        { status: 500 }
      );
    }

    const response = await fetch(`${videoServerUrl}/api/stream/vehicles/streams`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Error proxying video streams request:', error);
    return NextResponse.json(
      { error: 'Failed to fetch video streams' },
      { status: 500 }
    );
  }
}
