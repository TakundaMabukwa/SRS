import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const videoBaseUrl = process.env.NEXT_PUBLIC_VIDEO_BASE_URL || 'http://164.90.182.2:3000';
  
  try {
    const body = await req.json();
    const { vehicleId, channel } = body;
    
    const response = await fetch(`${videoBaseUrl}/api/vehicles/${vehicleId}/start-live`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channel })
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Start stream error:', error);
    return NextResponse.json({ success: false, error: 'Failed to start stream' }, { status: 500 });
  }
}
