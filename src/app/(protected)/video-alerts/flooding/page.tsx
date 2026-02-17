'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { RefreshCw, Siren, AlertTriangle, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import AlertsSubnav from '@/components/video-alerts/alerts-subnav'

type AlertItem = {
  id: string
  alert_type?: string
  priority?: string
  status?: string
  timestamp?: string
}

const WINDOW_MINUTES = 15

export default function FloodingPage() {
  const router = useRouter()
  const [alerts, setAlerts] = useState<AlertItem[]>([])
  const [loading, setLoading] = useState(true)
  const [threshold, setThreshold] = useState(12)

  const fetchAlerts = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/video-server/alerts?limit=300')
      if (res.ok) {
        const data = await res.json()
        if (data.success && Array.isArray(data.alerts)) {
          setAlerts(data.alerts)
        }
      }
    } catch (err) {
      console.error('Failed to fetch alerts', err)
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchAlerts()
    const interval = setInterval(fetchAlerts, 30000)
    return () => clearInterval(interval)
  }, [])

  const recentAlerts = useMemo(() => {
    const cutoff = Date.now() - WINDOW_MINUTES * 60 * 1000
    return alerts.filter((a) => {
      if (!a.timestamp) return false
      return new Date(a.timestamp).getTime() >= cutoff
    })
  }, [alerts])

  const byType = useMemo(() => {
    const groups: Record<string, AlertItem[]> = {}
    for (const alert of recentAlerts) {
      const type = alert.alert_type || 'unknown'
      if (!groups[type]) groups[type] = []
      groups[type].push(alert)
    }
    return Object.entries(groups)
      .map(([type, items]) => ({ type, count: items.length, items }))
      .sort((a, b) => b.count - a.count)
  }, [recentAlerts])

  const floodDetected = recentAlerts.length >= threshold

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Alert Flooding Monitor</h1>
          <p className="text-slate-600">Burst detection for high-volume alert windows ({WINDOW_MINUTES} minutes)</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.push('/video-alerts')}>
            Back to Control Center
          </Button>
          <Button onClick={fetchAlerts} disabled={loading}>
            <RefreshCw className={cn('w-4 h-4 mr-2', loading && 'animate-spin')} />
            Refresh
          </Button>
        </div>
      </div>

      <AlertsSubnav />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className={cn('p-4 bg-white shadow-sm border-slate-200', floodDetected && 'border-red-300 bg-red-50')}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Flood Status</p>
              <p className={cn('text-2xl font-bold', floodDetected ? 'text-red-700' : 'text-green-700')}>
                {floodDetected ? 'Active' : 'Normal'}
              </p>
            </div>
            <Siren className={cn('w-8 h-8', floodDetected ? 'text-red-600' : 'text-green-600')} />
          </div>
        </Card>

        <Card className="p-4 bg-white shadow-sm border-slate-200">
          <p className="text-sm text-gray-600">Alerts In Window</p>
          <p className="text-2xl font-bold">{recentAlerts.length}</p>
        </Card>

        <Card className="p-4 bg-white shadow-sm border-slate-200">
          <p className="text-sm text-gray-600">Flood Threshold</p>
          <div className="flex items-center gap-2 mt-2">
            <input
              type="number"
              min={3}
              max={60}
              value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value))}
              className="w-20 border rounded px-2 py-1"
            />
            <span className="text-sm text-gray-500">alerts</span>
          </div>
        </Card>

        <Card className="p-4 bg-white shadow-sm border-slate-200">
          <p className="text-sm text-gray-600">Open Alerts</p>
          <p className="text-2xl font-bold">
            {alerts.filter((a) => !['closed', 'resolved'].includes(a.status || '')).length}
          </p>
        </Card>
      </div>

      {floodDetected && (
        <Card className="p-4 border-red-300 bg-red-50">
          <div className="flex items-center gap-2 text-red-700 font-semibold mb-2">
            <AlertTriangle className="w-5 h-5" />
            Flood Condition Triggered
          </div>
          <p className="text-sm text-red-700">
            Current window has {recentAlerts.length} alerts, above threshold {threshold}. Escalation team should be notified.
          </p>
        </Card>
      )}

      <Card className="p-4 bg-white shadow-sm border-slate-200">
        <h2 className="font-semibold mb-4">Alert Types In Current Window</h2>
        <div className="space-y-2">
          {byType.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No alerts in the last {WINDOW_MINUTES} minutes</p>
          ) : (
            byType.map((row) => (
              <div key={row.type} className="flex items-center justify-between border rounded p-3">
                <div className="min-w-0">
                  <p className="font-medium truncate">{row.type}</p>
                  <p className="text-xs text-gray-500">Recent events in this burst window</p>
                </div>
                <Badge variant={row.count >= Math.ceil(threshold / 2) ? 'destructive' : 'outline'}>
                  {row.count}
                </Badge>
              </div>
            ))
          )}
        </div>
      </Card>

      <Card className="p-4 bg-white shadow-sm border-slate-200">
        <div className="flex items-center gap-2 mb-3">
          <Clock className="w-5 h-5 text-blue-600" />
          <h2 className="font-semibold">Operational Guidance</h2>
        </div>
        <ul className="text-sm text-gray-700 space-y-1">
          <li>Prioritize critical and high alerts first during flooding.</li>
          <li>Use escalation console when unresolved queue grows above SLA targets.</li>
          <li>Assign one operator per dominant alert type to reduce triage time.</li>
        </ul>
      </Card>
    </div>
  )
}
