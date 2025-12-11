import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const endpoint = searchParams.get('endpoint')
  const plate = searchParams.get('plate')
  const driver = searchParams.get('driver')

  const baseUrl = process.env.NEXT_PUBLIC_VEHICLE_API_ENDPOINT || 'http://64.227.138.235:3000/api/eps-vehicles'

  let url = baseUrl
  if (endpoint === 'by-plate' && plate) {
    url = `${baseUrl}?plate=${encodeURIComponent(plate)}`
  } else if (endpoint === 'by-driver' && driver) {
    url = `${baseUrl}?driver=${encodeURIComponent(driver)}`
  }

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 20000)

      const response = await fetch(url, {
        signal: controller.signal,
        headers: { 'Accept': 'application/json', 'Connection': 'close' },
      })

      clearTimeout(timeoutId)
      const data = await response.json()
      return NextResponse.json(data, { status: response.status })

    } catch (error: any) {
      if (attempt === 3) {
        return NextResponse.json({ error: 'Failed to connect', data: [] }, { status: 500 })
      }
      await new Promise(resolve => setTimeout(resolve, 500))
    }
  }

  return NextResponse.json({ error: 'Failed after retries', data: [] }, { status: 500 })
}
