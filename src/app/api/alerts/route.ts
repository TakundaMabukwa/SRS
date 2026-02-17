import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_VIDEO_BASE_URL || 'http://localhost:3000'
    const response = await fetch(`${baseUrl}/api/alerts`);
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ success: false, alerts: [] }, { status: 500 });
  }
}
