import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const baseUrl = process.env.NEXT_PUBLIC_CRTACK_VEHICLE_API_ENDPOINT || 'http://64.227.126.176:3001/api/ctrack/data'

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000)

    const response = await fetch(baseUrl, {
      signal: controller.signal,
      headers: { 'Accept': 'application/json' },
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      return NextResponse.json({ error: 'Failed to fetch CTrack data' }, { status: response.status })
    }

    const data = await response.json()
    return NextResponse.json(data)

  } catch (error: any) {
    if (error.name === 'AbortError') {
      return NextResponse.json({ error: 'Connection timeout' }, { status: 504 })
    }
    return NextResponse.json({ error: 'Failed to connect to CTrack service' }, { status: 500 })
  }
}
