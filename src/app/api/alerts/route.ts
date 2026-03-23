import { NextResponse } from 'next/server';
import { getAlertHubBaseUrl } from '@/lib/backend-hubs';

export async function GET() {
  try {
    const baseUrl = getAlertHubBaseUrl()
    const response = await fetch(`${baseUrl}/api/alerts`);
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ success: false, alerts: [] }, { status: 500 });
  }
}
