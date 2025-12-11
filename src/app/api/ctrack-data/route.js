import { NextResponse } from 'next/server'

export async function GET(request) {
  try {
    const url = process.env.NEXT_PUBLIC_CRTACK_VEHICLE_API_ENDPOINT
    
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 15000)
    
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store'
    })
    
    clearTimeout(timeoutId)
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`)
    }
    
    const data = await response.json()
    return NextResponse.json(data)
    
  } catch (error) {
    console.error('Error fetching CTrack data:', error)
    
    return NextResponse.json(
      { 
        message: 'Failed to fetch CTrack data',
        vehicles: [],
        error: error.message 
      },
      { status: 500 }
    )
  }
}
