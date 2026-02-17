'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import AlertsSubnav from '@/components/video-alerts/alerts-subnav'
import {
  AlertTriangle,
  Clock,
  CheckCircle,
  RefreshCw,
  Eye,
  ArrowUpCircle,
  Camera,
  MapPin,
  User,
  Car,
  ShieldAlert
} from 'lucide-react'
import { cn } from '@/lib/utils'

export default function VideoAlertsPage() {
  const router = useRouter()
  const videoBaseUrl = process.env.NEXT_PUBLIC_VIDEO_BASE_URL || 'configured video server'
  const [alerts, setAlerts] = useState({ critical: [], high: [], medium: [], low: [] })
  const [screenshots, setScreenshots] = useState([])
  const [selectedAlert, setSelectedAlert] = useState(null)
  const [loading, setLoading] = useState(true)
  const [apiError, setApiError] = useState(false)
  const [notes, setNotes] = useState('')
  const [activeTab, setActiveTab] = useState('alerts')
  const [currentUser] = useState({ id: 'user-1', name: 'Controller' })

  const fetchAlerts = async () => {
    try {
      const res = await fetch('/api/video-server/alerts', { signal: AbortSignal.timeout(10000) })
      if (res.ok) {
        const data = await res.json()
        if (data.success && data.alerts) {
          const grouped = { critical: [], high: [], medium: [], low: [] }
          data.alerts.forEach(alert => {
            const priority = alert.priority || 'low'
            if (grouped[priority]) grouped[priority].push(alert)
          })
          setAlerts(grouped)
          setApiError(false)
          return
        }
      }
      throw new Error('API failed')
    } catch (err) {
      console.error('Failed to fetch alerts:', err)
      setApiError(true)
    }
  }

  const fetchScreenshots = async () => {
    try {
      const res = await fetch('/api/video-server/screenshots/recent?minutes=30', { signal: AbortSignal.timeout(10000) })
      if (res.ok) {
        const data = await res.json()
        if (data.success && data.screenshots) {
          setScreenshots(data.screenshots)
          return
        }
      }
    } catch (err) {
      console.error('Failed to fetch screenshots:', err)
    }
  }

  useEffect(() => {
    const init = async () => {
      setLoading(true)
      setApiError(false)
      await fetchAlerts()
      await fetchScreenshots()
      setLoading(false)
    }
    init()
    const interval = setInterval(() => {
      fetchAlerts()
      fetchScreenshots()
    }, 30000)
    return () => clearInterval(interval)
  }, [])

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <RefreshCw className="w-12 h-12 mx-auto mb-4 animate-spin text-blue-600" />
          <p className="text-gray-600">Loading video alerts...</p>
        </div>
      </div>
    )
  }

  if (apiError) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <Card className="p-8 max-w-md text-center">
          <AlertTriangle className="w-16 h-16 mx-auto mb-4 text-red-500" />
          <h2 className="text-2xl font-bold mb-2">Video Server Unavailable</h2>
          <p className="text-gray-600 mb-6">Unable to connect to the video alert server at {videoBaseUrl}</p>
          <Button onClick={() => window.location.reload()}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Retry Connection
          </Button>
        </Card>
      </div>
    )
  }

  const handleAction = async (alertId, action) => {
    setLoading(true)
    try {
      if (action === 'acknowledge') {
        await fetch(`/api/video-server/alerts/${alertId}/acknowledge`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ acknowledgedBy: currentUser.id })
        })
      } else if (action === 'resolve') {
        if (notes.length < 10) {
          alert('Please enter at least 10 characters in notes')
          setLoading(false)
          return
        }
        await fetch(`/api/video-server/alerts/${alertId}/resolve-with-notes`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ notes, resolvedBy: currentUser.id })
        })
        setSelectedAlert(null)
        setNotes('')
      } else if (action === 'escalate') {
        await fetch(`/api/video-server/alerts/${alertId}/escalate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason: 'Escalated by controller' })
        })
      }
      fetchAlerts()
    } catch (err) {
      console.error(err)
    }
    setLoading(false)
  }

  const allAlerts = [...alerts.critical, ...alerts.high, ...alerts.medium, ...alerts.low]
  const escalatedCount = allAlerts.filter((a) => a.status === 'escalated' || a.escalated).length
  const unattendedCount = allAlerts.filter((a) => {
    if (['closed', 'resolved'].includes(a.status)) return false
    const ageMs = Date.now() - new Date(a.timestamp).getTime()
    return ageMs >= 30 * 60 * 1000
  }).length

  const priorityColor = (p) => ({
    critical: 'bg-red-500',
    high: 'bg-orange-500',
    medium: 'bg-yellow-500',
    low: 'bg-blue-500'
  }[p] || 'bg-gray-500')

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <div className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Alert Control Center</h1>
          <p className="text-sm text-gray-600">Monitor, investigate, escalate, and close alerts from one workspace</p>
        </div>
        <Button onClick={() => { fetchAlerts(); fetchScreenshots() }} disabled={loading}>
          <RefreshCw className={cn('w-4 h-4 mr-2', loading && 'animate-spin')} />
          Refresh
        </Button>
      </div>

      <div className="px-6 pt-3">
        <AlertsSubnav />
      </div>

      <div className="bg-white border-b px-6 py-3 grid grid-cols-2 md:grid-cols-6 gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
            <AlertTriangle className="w-6 h-6 text-red-600" />
          </div>
          <div>
            <p className="text-2xl font-bold">{alerts.critical?.length || 0}</p>
            <p className="text-xs text-gray-600">Critical</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
            <Clock className="w-6 h-6 text-orange-600" />
          </div>
          <div>
            <p className="text-2xl font-bold">{alerts.high?.length || 0}</p>
            <p className="text-xs text-gray-600">High</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
            <Clock className="w-6 h-6 text-yellow-600" />
          </div>
          <div>
            <p className="text-2xl font-bold">{alerts.medium?.length || 0}</p>
            <p className="text-xs text-gray-600">Medium</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
            <CheckCircle className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <p className="text-2xl font-bold">{alerts.low?.length || 0}</p>
            <p className="text-xs text-gray-600">Low</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-amber-100 rounded-lg flex items-center justify-center">
            <Clock className="w-6 h-6 text-amber-600" />
          </div>
          <div>
            <p className="text-2xl font-bold">{unattendedCount}</p>
            <p className="text-xs text-gray-600">Unattended 30m+</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
            <ShieldAlert className="w-6 h-6 text-purple-600" />
          </div>
          <div>
            <p className="text-2xl font-bold">{escalatedCount}</p>
            <p className="text-xs text-gray-600">Escalated</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
          <div className="bg-white border-b px-6">
            <TabsList>
              <TabsTrigger value="alerts">Alerts ({allAlerts.length})</TabsTrigger>
              <TabsTrigger value="screenshots">Screenshots ({screenshots.length})</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="alerts" className="flex-1 overflow-hidden m-0">
            <div className="h-full grid grid-cols-2 gap-0">
              <div className="border-r overflow-y-auto">
                {allAlerts.length === 0 ? (
                  <div className="p-12 text-center text-gray-500">
                    <CheckCircle className="w-16 h-16 mx-auto mb-4 text-green-500" />
                    <p>No active alerts</p>
                  </div>
                ) : (
                  <div className="divide-y">
                    {allAlerts.map(alert => (
                      <div
                        key={alert.id}
                        onClick={() => setSelectedAlert(alert)}
                        className={cn(
                          'p-4 cursor-pointer hover:bg-gray-50 transition-colors',
                          selectedAlert?.id === alert.id && 'bg-blue-50 border-l-4 border-l-blue-500'
                        )}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <div className={cn('w-3 h-3 rounded-full', priorityColor(alert.priority))} />
                            <span className="font-semibold">{alert.alert_type}</span>
                          </div>
                          <Badge variant="outline" className="text-xs">{alert.status}</Badge>
                        </div>
                        <div className="text-sm text-gray-600">
                          <p>Device: {alert.device_id || alert.vehicleId}</p>
                          {alert.metadata?.drivingBehavior && (
                            <div className="flex gap-2 mt-1">
                              {alert.metadata.drivingBehavior.fatigue && (
                                <Badge variant="destructive" className="text-xs">Fatigue {alert.metadata.drivingBehavior.fatigueLevel}</Badge>
                              )}
                              {alert.metadata.drivingBehavior.phoneCall && (
                                <Badge className="bg-orange-500 text-xs">Phone</Badge>
                              )}
                              {alert.metadata.drivingBehavior.smoking && (
                                <Badge className="bg-yellow-500 text-xs">Smoking</Badge>
                              )}
                            </div>
                          )}
                          <p className="text-xs text-gray-400">{new Date(alert.timestamp).toLocaleString()}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="overflow-y-auto bg-gray-50">
                {!selectedAlert ? (
                  <div className="h-full flex items-center justify-center text-gray-400">
                    <div className="text-center">
                      <Eye className="w-16 h-16 mx-auto mb-4 opacity-20" />
                      <p>Select an alert to view details</p>
                    </div>
                  </div>
                ) : (
                  <div className="p-6 space-y-4">
                    <div className="flex items-center gap-2">
                      <Badge className={cn('text-white', priorityColor(selectedAlert.priority))}>
                        {selectedAlert.priority.toUpperCase()}
                      </Badge>
                      <Badge variant="outline">{selectedAlert.status}</Badge>
                    </div>

                    {selectedAlert.screenshots?.length > 0 && (
                      <Card className="p-4">
                        <h3 className="font-semibold mb-3 flex items-center gap-2">
                          <Camera className="w-4 h-4" />
                          Screenshots
                        </h3>
                        <div className="grid grid-cols-2 gap-2">
                          {selectedAlert.screenshots.map((ss, i) => (
                            <img key={i} src={ss.url} alt="" className="w-full rounded border" />
                          ))}
                        </div>
                      </Card>
                    )}

                    <Card className="p-4 space-y-3">
                      <h3 className="font-semibold">Details</h3>
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center gap-2">
                          <Car className="w-4 h-4 text-gray-400" />
                          <span>{selectedAlert.vehicle_registration || selectedAlert.vehicleId || 'N/A'}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-gray-400" />
                          <span>{selectedAlert.driver_name || 'N/A'}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-gray-400" />
                          <span>{selectedAlert.location?.address || `${selectedAlert.location?.latitude?.toFixed(4)}, ${selectedAlert.location?.longitude?.toFixed(4)}` || 'N/A'}</span>
                        </div>
                      </div>
                      
                      {selectedAlert.metadata?.drivingBehavior && (
                        <div className="pt-3 border-t">
                          <h4 className="font-semibold text-xs mb-2">Driving Behavior</h4>
                          <div className="space-y-1 text-xs">
                            {selectedAlert.metadata.drivingBehavior.fatigue && (
                              <div className="flex items-center gap-2 text-red-600">
                                <span className="w-2 h-2 bg-red-600 rounded-full" />
                                Fatigue Detected (Level: {selectedAlert.metadata.drivingBehavior.fatigueLevel})
                              </div>
                            )}
                            {selectedAlert.metadata.drivingBehavior.phoneCall && (
                              <div className="flex items-center gap-2 text-orange-600">
                                <span className="w-2 h-2 bg-orange-600 rounded-full" />
                                Phone Call Detected
                              </div>
                            )}
                            {selectedAlert.metadata.drivingBehavior.smoking && (
                              <div className="flex items-center gap-2 text-yellow-600">
                                <span className="w-2 h-2 bg-yellow-600 rounded-full" />
                                Smoking Detected
                              </div>
                            )}
                            {!selectedAlert.metadata.drivingBehavior.fatigue && !selectedAlert.metadata.drivingBehavior.phoneCall && !selectedAlert.metadata.drivingBehavior.smoking && (
                              <span className="text-gray-500">No behavior issues</span>
                            )}
                          </div>
                        </div>
                      )}
                      
                      {selectedAlert.metadata?.videoAlarms && (
                        <div className="pt-3 border-t">
                          <h4 className="font-semibold text-xs mb-2">Video Alarms</h4>
                          <div className="space-y-1 text-xs">
                            {selectedAlert.metadata.videoAlarms.videoSignalLoss && (
                              <div className="text-red-600">• Signal Loss (Ch: {selectedAlert.metadata.signalLossChannels?.join(', ')})</div>
                            )}
                            {selectedAlert.metadata.videoAlarms.storageFailure && (
                              <div className="text-red-600">• Storage Failure</div>
                            )}
                            {selectedAlert.metadata.videoAlarms.videoSignalBlocking && (
                              <div className="text-orange-600">• Signal Blocking</div>
                            )}
                          </div>
                        </div>
                      )}
                    </Card>

                    <Card className="p-4 space-y-3">
                      <h3 className="font-semibold">Actions</h3>
                      
                      {selectedAlert.status === 'new' && (
                        <Button 
                          className="w-full" 
                          onClick={() => handleAction(selectedAlert.id, 'acknowledge')}
                          disabled={loading}
                        >
                          <CheckCircle className="w-4 h-4 mr-2" />
                          Acknowledge
                        </Button>
                      )}

                      {['new', 'acknowledged'].includes(selectedAlert.status) && (
                        <div className="space-y-2">
                          <Textarea
                            placeholder="Enter resolution notes (minimum 10 characters)..."
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            rows={4}
                          />
                          <p className="text-xs text-gray-500">{notes.length} characters</p>
                          <Button 
                            className="w-full bg-green-600 hover:bg-green-700" 
                            onClick={() => handleAction(selectedAlert.id, 'resolve')}
                            disabled={loading || notes.length < 10}
                          >
                            <CheckCircle className="w-4 h-4 mr-2" />
                            Resolve & Close
                          </Button>
                        </div>
                      )}

                      <Button 
                        variant="ghost" 
                        onClick={() => handleAction(selectedAlert.id, 'escalate')}
                        disabled={loading}
                      >
                        <ArrowUpCircle className="w-4 h-4 mr-2" />
                        Escalate
                      </Button>
                      <Button 
                        variant="outline"
                        className="text-red-600 hover:bg-red-50"
                        onClick={async () => {
                          if (confirm('Mark this as a false alert?')) {
                            try {
                              await fetch(`/api/video-server/alerts/${selectedAlert.id}/mark-false`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ reason: 'False alert', markedBy: currentUser.name })
                              })
                              fetchAlerts()
                            } catch (err) {
                              console.error(err)
                            }
                          }
                        }}
                      >
                        False Alert
                      </Button>
                      <Button 
                        variant="outline"
                        onClick={() => router.push(`/video-alerts/${selectedAlert.id}`)}
                      >
                        <Eye className="w-4 h-4 mr-2" />
                        Full View
                      </Button>
                    </Card>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="screenshots" className="flex-1 overflow-y-auto m-0 p-6">
            {screenshots.length === 0 ? (
              <div className="h-full flex items-center justify-center text-gray-400">
                <div className="text-center">
                  <Camera className="w-16 h-16 mx-auto mb-4 opacity-20" />
                  <p>No recent screenshots</p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-4 gap-4">
                {screenshots.map(ss => (
                  <Card key={ss.id} className="overflow-hidden">
                    <img src={ss.storage_url} alt="" className="w-full aspect-video object-cover" />
                    <div className="p-2 text-xs">
                      <p className="font-semibold">{ss.device_id}</p>
                      <p className="text-gray-500">Ch {ss.channel}</p>
                      <p className="text-gray-400">{new Date(ss.timestamp).toLocaleString()}</p>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
