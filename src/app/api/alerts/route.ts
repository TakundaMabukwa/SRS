import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const response = await fetch('http://164.90.182.2:3000/api/alerts');
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ success: false, alerts: [] }, { status: 500 });
  }
}
