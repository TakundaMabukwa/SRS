import { NextRequest } from 'next/server'

const EPS_API = process.env.NEXT_PUBLIC_EPS_STREAMING_SERVER || 'http://localhost:3002'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const pageSize = body.pageSize || 24
    const pageIndex = body.pageIndex || 1

    // 1. Get all devices from network endpoint
    const netRes = await fetch(`${EPS_API}/api/stream/network`, {
      cache: 'no-store',
    })
    if (!netRes.ok) {
      return Response.json({ success: false, message: 'Failed to fetch devices' }, { status: 502 })
    }
    const netData = await netRes.json()
    const devices = netData.data?.devices || []
    const deviceIds = devices.map((d: any) => d.deviceId).filter(Boolean).join(',')

    if (!deviceIds) {
      return Response.json({ success: true, data: { records: [], total: 0 } })
    }

    // 2. Fetch gallery screenshots for all devices
    const now = new Date()
    const end = now.toISOString().replace('T', ' ').slice(0, 19)
    const start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().replace('T', ' ').slice(0, 19)

    const galleryRes = await fetch(`${EPS_API}/api/gallery/files/page`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pageSize: 500,
        pageIndex: 1,
        deviceIds,
        startTime: start,
        endTime: end,
        queryType: 'Device',
      }),
      cache: 'no-store',
    })
    if (!galleryRes.ok) {
      return Response.json({ success: false, message: 'Failed to fetch gallery files' }, { status: 502 })
    }
    const galleryData = await galleryRes.json()
    const allFiles = galleryData.data?.files || []

    // 3. Transform to the format the screenshots UI expects
    const records = allFiles.map((f: any, idx: number) => ({
      alarmId: f.id || `gallery-${idx}`,
      deviceName: f.deviceName || '',
      deviceId: f.deviceId || '',
      fileUrl: f.fileUrl || '',
      fileType: f.fileType || '00',
      alarmType: f.channelName || `CH${f.channelId || 1}`,
      alarmTime: f.createTime || '',
      fileSize: f.fileSize || 0,
      channelId: f.channelId || 1,
      channelName: f.channelName || '',
    }))

    const total = records.length
    const startIdx = (pageIndex - 1) * pageSize
    const paged = records.slice(startIdx, startIdx + pageSize)

    return Response.json({
      success: true,
      data: { records: paged, total },
    })
  } catch (e: any) {
    return Response.json({ success: false, message: e.message }, { status: 500 })
  }
}
