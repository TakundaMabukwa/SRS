import { NextRequest } from 'next/server'

const RAW_VIDEO_SERVER_URL =
  process.env.VIDEO_BASE_URL ||
  process.env.NEXT_PUBLIC_VIDEO_BASE_URL ||
  'http://localhost:3000'

const VIDEO_SERVER_URL = (() => {
  const trimmed = RAW_VIDEO_SERVER_URL.trim().replace(/\/+$/, '')
  // Allow env values with or without /api suffix.
  return trimmed.replace(/\/api$/i, '')
})()
export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path: pathArray } = await params
  const path = pathArray.join('/')
  const searchParams = request.nextUrl.searchParams.toString()
  const url = `${VIDEO_SERVER_URL}/api/${path}${searchParams ? `?${searchParams}` : ''}`

  try {
    const forwardedHeaders: Record<string, string> = {}
    const range = request.headers.get('range')
    if (range) forwardedHeaders['range'] = range

    const response = await fetch(url, {
      method: 'GET',
      headers: forwardedHeaders,
      cache: 'no-store',
      next: { revalidate: 0 },
    })

    const contentType = response.headers.get('content-type') || ''

    if (contentType.includes('application/json')) {
      const data = await response.json()
      return Response.json(data, {
        status: response.status,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          Pragma: 'no-cache',
          Expires: '0'
        }
      })
    }

    const body = await response.arrayBuffer()
    const passHeaders = new Headers()
    const passThroughKeys = [
      'content-type',
      'content-length',
      'content-disposition',
      'cache-control',
      'accept-ranges',
      'content-range',
      'etag',
      'last-modified'
    ]
    passThroughKeys.forEach((key) => {
      const value = response.headers.get(key)
      if (value) passHeaders.set(key, value)
    })

    return new Response(body, {
      status: response.status,
      headers: passHeaders
    })
  } catch (error) {
    return Response.json(
      { success: false, error: 'Failed to fetch from video server' },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path: pathArray } = await params
  const path = pathArray.join('/')
  const url = `${VIDEO_SERVER_URL}/api/${path}`

  try {
    // Safely parse JSON body, handle empty or missing body
    let body = {}
    const contentType = request.headers.get('content-type') || ''
    const contentLength = request.headers.get('content-length')
    
    if (contentType.includes('application/json') && contentLength && parseInt(contentLength) > 0) {
      try {
        body = await request.json()
      } catch (parseError) {
        console.warn('Failed to parse request body as JSON:', parseError)
        body = {}
      }
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    const contentTypeResponse = response.headers.get('content-type') || ''
    
    // Handle both JSON and non-JSON responses
    if (contentTypeResponse.includes('application/json')) {
      const data = await response.json()
      return Response.json(data, { status: response.status })
    } else {
      // For non-JSON responses (like images), return as-is
      const arrayBuffer = await response.arrayBuffer()
      const passHeaders = new Headers()
      const passThroughKeys = ['content-type', 'content-length', 'cache-control', 'content-disposition']
      passThroughKeys.forEach((key) => {
        const value = response.headers.get(key)
        if (value) passHeaders.set(key, value)
      })
      return new Response(arrayBuffer, {
        status: response.status,
        headers: passHeaders
      })
    }
  } catch (error) {
    console.error('Video server POST error:', error)
    return Response.json(
      { success: false, error: 'Failed to post to video server', details: String(error) },
      { status: 500 }
    )
  }
}
