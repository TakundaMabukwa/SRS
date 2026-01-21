import { NextRequest } from 'next/server'

const VIDEO_SERVER_URL = process.env.NEXT_PUBLIC_VIDEO_BASE_URL || 'http://localhost:3000'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path: pathArray } = await params
  const path = pathArray.join('/')
  const searchParams = request.nextUrl.searchParams.toString()
  const url = `${VIDEO_SERVER_URL}/api/${path}${searchParams ? `?${searchParams}` : ''}`

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    const data = await response.json()
    return Response.json(data, { status: response.status })
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
    return Response.json(
      { success: false, error: 'Failed to post to video server' },
      { status: 500 }
    )
  }
}
