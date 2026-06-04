'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { RefreshCw, AlertTriangle, Camera, MapPin, Clock, Car, ExternalLink, ChevronDown, ChevronRight, Users, X, Video } from 'lucide-react'
import AlertsSubnav from '@/components/video-alerts/alerts-subnav'
import { cn } from '@/lib/utils'

const ALERT_CONFIG: Record<string, { label: string; severity: 'critical' | 'high' | 'medium' | 'low' }> = {
  sos: { label: 'Panic Alert', severity: 'critical' },
  bang: { label: 'Crash', severity: 'critical' },
  pedestrianBang: { label: 'Pedestrian Collision', severity: 'critical' },
  speed: { label: 'Overspeeding', severity: 'high' },
  hardBraking: { label: 'Rollover', severity: 'high' },
  fatigueAlarm: { label: 'Fatigue', severity: 'high' },
  forwardCollisionWarning: { label: 'Forward Collision', severity: 'high' },
  fatigueWarn: { label: 'Fatigue', severity: 'medium' },
  handheldPhoneCall: { label: 'Cellphone', severity: 'medium' },
  laneShift: { label: 'Lane Deviation', severity: 'medium' },
  closeProximity: { label: 'Tailgating', severity: 'medium' },
  seatBelt: { label: 'Seatbelt', severity: 'low' },
  driverNotDetected: { label: 'Driver Not in View', severity: 'low' },
  overtime: { label: 'Overtime', severity: 'low' },
  powerCut: { label: 'Battery Disconnection', severity: 'medium' },
  occlusion: { label: 'Camera Occlusion', severity: 'low' },
}

const SEVERITY_COLORS = {
  critical: 'bg-red-500',
  high: 'bg-orange-500',
  medium: 'bg-yellow-500',
  low: 'bg-blue-500',
}

interface DeviceInfo {
  deviceId: string
  deviceName: string
}

export default function EpsAlertMonitorPage() {
  const [alerts, setAlerts] = useState<any[]>([])
  const [devices, setDevices] = useState<DeviceInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [apiError, setApiError] = useState(false)
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())
  const [typeFilter, setTypeFilter] = useState('')
  const [alertTypes, setAlertTypes] = useState<{ alarmType: string; alarmName: string }[]>([])
  const [detailAlert, setDetailAlert] = useState<any | null>(null)
  const [detailFiles, setDetailFiles] = useState<any[]>([])
  const [detailLoading, setDetailLoading] = useState(false)
  const [showUnassigned, setShowUnassigned] = useState(false)

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

  const fetchDevices = useCallback(async () => {
    try {
      const res = await fetch('/api/video-server/eps/alerts/devices')
      if (res.ok) {
        const data = await res.json()
        if (data.success && Array.isArray(data.data?.records)) {
          setDevices(data.data.records.map((d: any) => ({
            deviceId: d.id || d.deviceId,
            deviceName: d.name || d.deviceName || d.id,
          })))
        }
      }
    } catch {}
  }, [])

  const fetchAlerts = useCallback(async () => {
    setLoading(true)
    setApiError(false)
    try {
      const res = await fetch('/api/video-server/eps/alerts/feed?pageSize=200&pageIndex=1')
      if (!res.ok) throw new Error('API failed')
      const data = await res.json()
      if (data.success && Array.isArray(data.data?.records)) {
        let alerts = data.data.records
        if (typeFilter) {
          alerts = alerts.filter((a: any) => a.alarmType === typeFilter)
        }
        setAlerts(alerts)
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

  const fetchDetailFiles = useCallback(async (record: any) => {
    if (!record.id && !record.alarmId) { setDetailLoading(false); return }
    const alarmId = record.alarmId || record.id
    setDetailLoading(true)
    try {
      const res = await fetch(`/api/video-server/eps/alerts/files/${alarmId}`)
      if (res.ok) {
        const data = await res.json()
        if (data.success && Array.isArray(data.data)) {
          setDetailFiles(data.data)
          setDetailLoading(false)
          return
        }
      }
    } catch {}
    setDetailFiles([])
    setDetailLoading(false)
  }, [])

  useEffect(() => {
    fetchAlertTypes()
    fetchDevices()
    fetchAlerts()
  }, [fetchAlerts])

  const proxyUrl = (url: string) =>
    url ? `/api/video-server/eps/stream/stream/proxy?url=${encodeURIComponent(url)}` : ''

  const config = (type: string) => ALERT_CONFIG[type] || { label: type, severity: 'low' as const }

  const handleViewDetail = (alert: any) => {
    setDetailAlert(alert)
    setDetailFiles([])
    setDetailLoading(true)
    fetchDetailFiles(alert)
  }

  const { vehicleGroups, unassignedDevices } = useMemo(() => {
    const latestByDevice = new Map<string, any>()
    for (const alert of alerts) {
      const deviceId = alert.deviceId
      if (!deviceId) continue
      const existing = latestByDevice.get(deviceId)
      if (!existing || new Date(alert.alarmTs) > new Date(existing.alarmTs)) {
        latestByDevice.set(deviceId, alert)
      }
    }

    const withAlerts: any[] = []
    const withoutAlerts: DeviceInfo[] = []
    const seenDeviceIds = new Set<string>()

    for (const [deviceId, alert] of latestByDevice.entries()) {
      withAlerts.push(alert)
      seenDeviceIds.add(deviceId)
    }

    for (const device of devices) {
      if (!seenDeviceIds.has(device.deviceId)) {
        withoutAlerts.push(device)
      }
    }

    withAlerts.sort((a, b) => new Date(b.alarmTs).getTime() - new Date(a.alarmTs).getTime())

    return { vehicleGroups: withAlerts, unassignedDevices: withoutAlerts }
  }, [alerts, devices])

  if (apiError && !loading && alerts.length === 0) {
    return (
      <div className="p-6 h-screen flex items-center justify-center">
        <Card className="p-8 max-w-md text-center">
          <AlertTriangle className="w-16 h-16 mx-auto text-red-500 mb-4" />
          <h2 className="text-2xl font-bold mb-2">EPS Alert Server Unavailable</h2>
          <p className="text-gray-600 mb-6">Unable to connect to the EPS streaming server</p>
          <Button onClick={() => fetchAlerts()}>
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
          <h1 className="text-3xl font-bold text-slate-900">EPS Alert Monitor</h1>
          <p className="text-slate-600">
            Alerts grouped by vehicle &bull; {vehicleGroups.length} vehicles with alerts &bull; Last refresh: {lastRefresh.toLocaleTimeString()}
          </p>
        </div>
        <Button onClick={() => fetchAlerts()} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <AlertsSubnav />

      <div className="flex flex-wrap items-center gap-3">
        <select
          value={typeFilter}
          onChange={(e) => { setTypeFilter(e.target.value); setDetailAlert(null) }}
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
        >
          <option value="">All alert types</option>
          {alertTypes.map((t) => (
            <option key={t.alarmType} value={t.alarmType}>{t.alarmName || t.alarmType}</option>
          ))}
        </select>
        <span className="text-sm text-slate-500">{alerts.length} total alerts, {vehicleGroups.length} vehicles</span>
      </div>

      {loading && alerts.length === 0 ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="p-4 animate-pulse border-slate-200">
              <div className="flex gap-3">
                <div className="w-10 h-10 rounded-full bg-slate-200" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-slate-200 rounded w-1/3" />
                  <div className="h-3 bg-slate-200 rounded w-1/2" />
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <>
          {vehicleGroups.length === 0 && unassignedDevices.length === 0 ? (
            <Card className="p-12 text-center bg-white shadow-sm border-slate-200">
              <AlertTriangle className="w-16 h-16 mx-auto text-gray-300 mb-4" />
              <p className="text-gray-500">No alerts found</p>
            </Card>
          ) : (
            <div className="space-y-2">
              {vehicleGroups.map((alert) => {
                const cfg = config(alert.alarmType)
                const time = alert.alarmTs ? new Date(alert.alarmTs).toLocaleString() : ''
                const alertCount = alerts.filter(a => a.deviceId === alert.deviceId).length
                return (
                  <Card
                    key={alert.deviceId}
                    className="p-3 cursor-pointer transition-colors border border-slate-200 hover:border-slate-300 hover:shadow-sm"
                    onClick={() => handleViewDetail(alert)}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-sm font-bold text-slate-600">
                        {cfg.label.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={cn('w-2.5 h-2.5 rounded-full', SEVERITY_COLORS[cfg.severity])} />
                          <span className="font-semibold text-sm">{alert.deviceName || alert.deviceId || 'Unknown'}</span>
                          <Badge variant="outline" className="text-[10px]">{cfg.label}</Badge>
                          {alertCount > 1 && (
                            <Badge variant="secondary" className="text-[10px]">+{alertCount - 1} more</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-600">
                          <Car className="w-3 h-3" />
                          <span>ID: {alert.deviceId}</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
                          <Clock className="w-3 h-3" />
                          <span>{time}</span>
                        </div>
                        {alert.lat && alert.lon && (
                          <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
                            <MapPin className="w-3 h-3" />
                            <span>{Number(alert.lat).toFixed(4)}, {Number(alert.lon).toFixed(4)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </Card>
                )
              })}

              {unassignedDevices.length > 0 && (
                <div className="border-t pt-3 mt-4">
                  <button
                    onClick={() => setShowUnassigned(!showUnassigned)}
                    className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 w-full text-left py-2"
                  >
                    {showUnassigned ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    <Users className="w-4 h-4" />
                    <span className="font-medium">Unassigned</span>
                    <Badge variant="secondary" className="text-[10px]">{unassignedDevices.length} vehicles</Badge>
                  </button>
                  {showUnassigned && (
                    <div className="space-y-1 mt-2">
                      {unassignedDevices.map((device) => (
                        <Card key={device.deviceId} className="p-2 border-slate-200">
                          <div className="flex items-center gap-2 text-sm">
                            <Car className="w-3.5 h-3.5 text-slate-400" />
                            <span className="font-medium">{device.deviceName || device.deviceId}</span>
                            <span className="text-xs text-slate-400 ml-auto">ID: {device.deviceId}</span>
                          </div>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {detailAlert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => { setDetailAlert(null); setDetailFiles([]) }}>
          <div className="max-w-2xl w-full bg-white rounded-xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-slate-200">
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-sm font-bold text-slate-600">
                  {config(detailAlert.alarmType).label.charAt(0)}
                </div>
                <div>
                  <h3 className="font-bold text-slate-900">{config(detailAlert.alarmType).label}</h3>
                  <p className="text-sm text-slate-500">{detailAlert.deviceName || detailAlert.deviceId}</p>
                </div>
                <Badge className={cn('text-white text-xs', SEVERITY_COLORS[config(detailAlert.alarmType).severity])}>
                  {config(detailAlert.alarmType).severity.toUpperCase()}
                </Badge>
              </div>
              <Button variant="ghost" size="icon" onClick={() => { setDetailAlert(null); setDetailFiles([]) }}>
                <X className="w-5 h-5" />
              </Button>
            </div>

            <div className="p-4 space-y-4 overflow-y-auto">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="font-medium text-slate-600">Device:</span> {detailAlert.deviceName || detailAlert.deviceId}</div>
                <div><span className="font-medium text-slate-600">Time:</span> {detailAlert.alarmTs ? new Date(detailAlert.alarmTs).toLocaleString() : '-'}</div>
                <div><span className="font-medium text-slate-600">Type:</span> {config(detailAlert.alarmType).label} ({detailAlert.alarmType})</div>
                <div>
                  <span className="font-medium text-slate-600">Location:</span>{' '}
                  {detailAlert.lat && detailAlert.lon ? (
                    <a
                      href={`https://www.openstreetmap.org/?mlat=${detailAlert.lat}&mlon=${detailAlert.lon}#map=15/${detailAlert.lat}/${detailAlert.lon}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-blue-600 text-xs inline-flex items-center gap-1"
                    >
                      {Number(detailAlert.lat).toFixed(4)}, {Number(detailAlert.lon).toFixed(4)}
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  ) : '-'}
                </div>
              </div>

              {detailAlert.alarmText && (
                <div className="text-sm bg-slate-50 rounded-lg p-3 border border-slate-200">
                  <span className="font-medium text-slate-600">Details:</span>
                  <p className="text-slate-700 mt-1">{detailAlert.alarmText}</p>
                </div>
              )}

              <div className="border-t border-slate-200 pt-4">
                <h4 className="font-semibold text-slate-900 mb-2 flex items-center gap-2">
                  <Camera className="w-4 h-4" />
                  Media Files ({detailFiles.length})
                </h4>
                {detailLoading ? (
                  <div className="flex items-center gap-2 text-sm text-slate-500 py-8 justify-center">
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Loading files...
                  </div>
                ) : detailFiles.length === 0 ? (
                  <div className="text-sm text-slate-400 py-8 text-center bg-slate-50 rounded-lg border border-dashed border-slate-200">
                    No media available for this alert
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    {detailFiles.map((file, idx) => (
                      <div key={idx} className="rounded-lg border border-slate-200 overflow-hidden bg-slate-50">
                        {file.fileType === "02" || file.fileUrl?.match(/\.(mp4|flv|avi|mov)$/i) ? (
                          <video
                            className="w-full aspect-video bg-slate-900"
                            src={proxyUrl(file.fileUrl)}
                            controls
                            autoPlay
                          />
                        ) : file.fileUrl?.match(/\.(jpg|jpeg|png|gif|webp)$/i) || !file.fileType || file.fileType === "01" ? (
                          <>
                            <div className="relative group">
                              <img
                                className="w-full object-contain max-h-80"
                                src={proxyUrl(file.fileUrl)}
                                alt={`Alert media ${idx + 1}`}
                              />
                              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <a
                                  href={proxyUrl(file.fileUrl)}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-white text-xs bg-white/20 px-3 py-1 rounded"
                                >
                                  Open full size
                                </a>
                              </div>
                            </div>
                            <div className="px-2 py-1 text-[10px] text-slate-500 border-t border-slate-200 flex justify-between">
                              <span>{file.fileType || 'image'}</span>
                              {file.fileSize ? <span>{Math.round(file.fileSize / 1024)} KB</span> : null}
                            </div>
                          </>
                        ) : file.fileUrl ? (
                          <div className="p-4 text-sm text-center">
                            <a
                              href={proxyUrl(file.fileUrl)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 underline inline-flex items-center gap-1"
                            >
                              <Video className="w-4 h-4" />
                              Download file {file.fileSize ? `(${Math.round(file.fileSize / 1024)} KB)` : ''}
                            </a>
                          </div>
                        ) : (
                          <div className="p-4 text-sm text-slate-400 text-center">File URL unavailable</div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
