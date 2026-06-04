'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { RefreshCw, Camera, Image as ImageIcon, Video, Download } from 'lucide-react'
import AlertsSubnav from '@/components/video-alerts/alerts-subnav'

const ALERT_TYPE_MAP: Record<string, string> = {
  fatigueWarn: 'Fatigue', fatigueAlarm: 'Fatigue',
  handheldPhoneCall: 'Cellphone', seatBelt: 'Seatbelt',
  laneShift: 'Lane deviation', closeProximity: 'Tailgating',
  bang: 'Crash', hardBraking: 'Rollover',
  driverNotDetected: 'Driver not in view',
  forwardCollisionWarning: 'Forward collision',
  pedestrianBang: 'Pedestrian collision', overtime: 'Overtime',
  speed: 'Overspeeding', powerCut: 'Battery Disconnection',
  occlusion: 'Camera occlusion', sos: 'Panic Alert',
}

const PAGE_SIZE = 24

export default function ScreenshotsPage() {
  const [files, setFiles] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [apiError, setApiError] = useState(false)
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [typeFilter, setTypeFilter] = useState('')
  const [alertTypes, setAlertTypes] = useState<{ alarmType: string; alarmName: string }[]>([])

  const fetchAlertTypes = useCallback(async () => {
    try {
      const res = await fetch('/api/video-server/eps/alerts/types')
      if (res.ok) {
        const data = await res.json()
        if (data.success && Array.isArray(data.data)) {
          setAlertTypes(data.data)
        }
      }
    } catch {}
  }, [])

  const fetchScreenshots = useCallback(async (p = 1) => {
    setLoading(true)
    setApiError(false)
    try {
      const body: any = { pageSize: PAGE_SIZE, pageIndex: p }
      if (typeFilter) body.alarmType = typeFilter
      const res = await fetch('/api/video-server/eps/alerts/files/page', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error('API failed')
      const data = await res.json()
      if (data.success && Array.isArray(data.data?.records)) {
        setFiles(data.data.records)
        setTotal(data.data.total || 0)
        setPage(p)
        setLastRefresh(new Date())
      } else {
        throw new Error('Invalid response')
      }
    } catch {
      setApiError(true)
    } finally {
      setLoading(false)
    }
  }, [typeFilter])

  useEffect(() => {
    fetchAlertTypes()
  }, [fetchAlertTypes])

  useEffect(() => {
    fetchScreenshots(1)
  }, [fetchScreenshots])

  const proxyUrl = (url: string) =>
    url ? `/api/video-server/eps/stream/stream/proxy?url=${encodeURIComponent(url)}` : ''

  const totalPages = Math.ceil(total / PAGE_SIZE)

  if (apiError && !loading && files.length === 0) {
    return (
      <div className="p-6 h-screen flex items-center justify-center">
        <Card className="p-8 max-w-md text-center">
          <Camera className="w-16 h-16 mx-auto text-red-500 mb-4" />
          <h2 className="text-2xl font-bold mb-2">Screenshot Server Unavailable</h2>
          <p className="text-gray-600 mb-6">Unable to connect to the EPS streaming server</p>
          <Button onClick={() => fetchScreenshots(1)}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Retry Connection
          </Button>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Screenshot Gallery</h1>
          <p className="text-slate-600">
            Alert images from EPS streaming server &bull; {total} files &bull; Last refresh: {lastRefresh.toLocaleTimeString()}
          </p>
        </div>
        <Button onClick={() => fetchScreenshots(page)} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <AlertsSubnav />

      <div className="flex flex-wrap items-center gap-3">
        <select
          value={typeFilter}
          onChange={(e) => { setTypeFilter(e.target.value) }}
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
        >
          <option value="">All alert types</option>
          {alertTypes.map((t) => (
            <option key={t.alarmType} value={t.alarmType}>{t.alarmName || t.alarmType}</option>
          ))}
        </select>
        <span className="text-sm text-slate-500">{total} files total</span>
      </div>

      {loading && files.length === 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Card key={i} className="overflow-hidden animate-pulse border-slate-200">
              <div className="aspect-video bg-slate-200" />
              <div className="p-3 space-y-2">
                <div className="h-3 bg-slate-200 rounded w-2/3" />
                <div className="h-2 bg-slate-200 rounded w-1/2" />
              </div>
            </Card>
          ))}
        </div>
      ) : files.length === 0 ? (
        <Card className="p-12 text-center bg-white shadow-sm border-slate-200">
          <Camera className="w-16 h-16 mx-auto text-gray-300 mb-4" />
          <p className="text-gray-500">No screenshots available</p>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {files.map((file, idx) => {
              const displayType = ALERT_TYPE_MAP[file.alarmType] || file.alarmType
              const time = file.alarmTime ? new Date(file.alarmTime).toLocaleString() : ''
              const isVideo = file.fileType === "02" || file.fileUrl?.match(/\.(mp4|flv|avi|mov)$/i)
              return (
                <Card key={file.alarmId || idx} className="overflow-hidden group border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                  <div className="relative aspect-video bg-gray-900 flex items-center justify-center">
                    {isVideo ? (
                      <video
                        className="w-full h-full object-contain"
                        src={proxyUrl(file.fileUrl)}
                        controls
                        preload="metadata"
                      />
                    ) : (
                      <img
                        src={proxyUrl(file.fileUrl)}
                        alt={`${file.deviceName} - ${displayType}`}
                        className="w-full h-full object-contain"
                        loading="lazy"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                          (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden')
                        }}
                      />
                    )}
                    <div className="hidden absolute inset-0 flex items-center justify-center text-slate-500">
                      <ImageIcon className="w-8 h-8" />
                    </div>
                    <div className="absolute top-2 right-2">
                      <Badge variant="secondary" className="text-[10px] bg-black/60 text-white border-0">
                        {isVideo ? <><Video className="w-3 h-3 mr-1" /> Video</> : <><ImageIcon className="w-3 h-3 mr-1" /> Image</>}
                      </Badge>
                    </div>
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="absolute bottom-0 left-0 right-0 p-3">
                        <a
                          href={proxyUrl(file.fileUrl)}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center justify-center w-full rounded-md bg-white/90 px-3 py-2 text-xs font-medium text-slate-900 hover:bg-white"
                        >
                          <Download className="w-3 h-3 mr-1" />
                          {isVideo ? 'Play Video' : 'Open Image'}
                        </a>
                      </div>
                    </div>
                  </div>
                  <div className="p-3 bg-white">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-sm truncate">{file.deviceName || 'Unknown'}</span>
                      <Badge variant="outline" className="text-[10px]">{displayType}</Badge>
                    </div>
                    <div className="text-xs text-gray-500">
                      <div>ID: {file.deviceId || 'N/A'}</div>
                      {file.fileSize && <div>{Math.round(file.fileSize / 1024)} KB</div>}
                      <div>{time}</div>
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-4">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => fetchScreenshots(page - 1)}
              >
                Previous
              </Button>
              <span className="text-sm text-slate-600">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => fetchScreenshots(page + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
