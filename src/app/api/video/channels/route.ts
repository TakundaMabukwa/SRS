import { NextRequest, NextResponse } from 'next/server';
import { getListenerBaseUrl } from '@/lib/backend-hubs';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const videoServerUrl = getListenerBaseUrl();

    const response = await fetch(`${videoServerUrl}/api/stream/debug/vehicle`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Error fetching vehicle channels:', error);
    return NextResponse.json(
      { error: 'Failed to fetch vehicle channels' },
      { status: 500 }
    );
  }
}
