import { NextRequest } from 'next/server'
import { resolveVideoServerProxyBase } from '@/lib/backend-hubs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path: pathArray } = await params
  const path = pathArray.join('/')
  const searchParams = request.nextUrl.searchParams.toString()
  const target = resolveVideoServerProxyBase(pathArray)
  const url = `${target.baseUrl}/api/${path}${searchParams ? `?${searchParams}` : ''}`
  const lowerPath = `/${path}`.toLowerCase()
  const isDirectMediaRequest =
    /\/file(?:$|\?)/i.test(lowerPath) ||
    /\.(mp4|m3u8|ts|m4s|jpg|jpeg|png|webp)(?:$|\?)/i.test(lowerPath)

  if (isDirectMediaRequest) {
    return Response.redirect(url, 307)
  }

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
    const message = error instanceof Error ? error.message : String(error)
    return Response.json(
      {
        success: false,
        message: `Failed to fetch from ${target.name}`,
        error: message,
        target: target.name,
        targetUrl: url
      },
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
  const target = resolveVideoServerProxyBase(pathArray)
  const url = `${target.baseUrl}/api/${path}`
  const body = await request.json()

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    const data = await response.json()
    return Response.json(data, { status: response.status })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return Response.json(
      {
        success: false,
        message: `Failed to post to ${target.name}`,
        error: message,
        target: target.name,
        targetUrl: url
      },
      { status: 500 }
    )
  }
}
