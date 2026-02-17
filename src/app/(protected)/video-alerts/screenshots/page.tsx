'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { RefreshCw, Download, Camera } from 'lucide-react'
import { useVideoWebSocket } from '@/hooks/use-video-websocket'
import AlertsSubnav from '@/components/video-alerts/alerts-subnav'

export default function ScreenshotsPage() {
  const videoBaseUrl = process.env.NEXT_PUBLIC_VIDEO_BASE_URL || 'configured video server'
  const [screenshots, setScreenshots] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [apiError, setApiError] = useState(false)
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())

  useVideoWebSocket((data) => {
    if (data.type === 'screenshot-received') {
      setScreenshots(prev => [data.image, ...prev])
    }
  })

  const fetchScreenshots = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/video-server/screenshots/recent?minutes=30')
      if (response.ok) {
        const data = await response.json()
        if (data.success && data.screenshots) {
          setScreenshots(data.screenshots)
          setLastRefresh(new Date())
          setApiError(false)
          setLoading(false)
          return
        }
      }
      throw new Error('API failed')
    } catch (error) {
      setApiError(true)
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchScreenshots()
    const interval = setInterval(fetchScreenshots, 30000)
    return () => clearInterval(interval)
  }, [])

  if (apiError) {
    return (
      <div className="p-6 h-screen flex items-center justify-center">
        <Card className="p-8 max-w-md text-center">
          <Camera className="w-16 h-16 mx-auto text-red-500 mb-4" />
          <h2 className="text-2xl font-bold mb-2">Video Server Unavailable</h2>
          <p className="text-gray-600 mb-6">Unable to connect to the video server at {videoBaseUrl}</p>
          <Button onClick={fetchScreenshots}>
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
            Auto-refreshes every 30 seconds • Last refresh: {lastRefresh.toLocaleTimeString()}
          </p>
        </div>
        <Button onClick={fetchScreenshots} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh Now
        </Button>
      </div>

      <AlertsSubnav />

      {screenshots.length === 0 ? (
        <Card className="p-12 text-center bg-white shadow-sm border-slate-200">
          <Camera className="w-16 h-16 mx-auto text-gray-300 mb-4" />
          <p className="text-gray-500">No screenshots available</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {screenshots.map((screenshot) => (
            <Card key={screenshot.id} className="overflow-hidden group border-slate-200 shadow-sm hover:shadow-md transition-shadow">
              <div className="relative aspect-video bg-gray-900">
                <img
                  src={screenshot.storage_url}
                  alt={`${screenshot.camera_name} - ${screenshot.device_id}`}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="absolute bottom-0 left-0 right-0 p-3">
                    <Button
                      size="sm"
                      variant="secondary"
                      className="w-full"
                      onClick={() => window.open(screenshot.storage_url, '_blank')}
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Download
                    </Button>
                  </div>
                </div>
              </div>
              <div className="p-3 bg-white">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-sm">{screenshot.camera_name}</span>
                  <span className="text-xs text-gray-500">Ch {screenshot.channel}</span>
                </div>
                <div className="text-xs text-gray-600">
                  <div>Device: {screenshot.device_id}</div>
                  <div>{new Date(screenshot.timestamp).toLocaleString()}</div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
