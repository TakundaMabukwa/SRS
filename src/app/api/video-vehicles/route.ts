import { NextResponse } from 'next/server';

export async function GET() {
  const videoBaseUrl = process.env.NEXT_PUBLIC_VIDEO_BASE_URL || 'http://164.90.182.2:3000';
  
  try {
    const response = await fetch(`${videoBaseUrl}/api/vehicles`);
    
    if (!response.ok) {
      return NextResponse.json({ success: false, data: [] }, { status: response.status });
    }

    const data = await response.json();
    console.log('[Video Vehicles] Response from video server:', JSON.stringify(data, null, 2));
    return NextResponse.json(data);
  } catch (error) {
    console.error('Video vehicles fetch error:', error);
    return NextResponse.json({ success: false, data: [] }, { status: 500 });
  }
}
