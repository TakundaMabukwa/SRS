import { NextRequest, NextResponse } from 'next/server';
import { getListenerBaseUrl } from '@/lib/backend-hubs';

export async function POST(req: NextRequest) {
  const videoBaseUrl = getListenerBaseUrl();
  
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
