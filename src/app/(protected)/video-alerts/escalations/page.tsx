'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { RefreshCw, ArrowUpCircle, Clock, Eye, ShieldAlert } from 'lucide-react'
import { cn } from '@/lib/utils'
import AlertsSubnav from '@/components/video-alerts/alerts-subnav'

type AlertItem = {
  id: string
  status?: string
  escalated?: boolean
  escalation_level?: number
  priority?: string
  alert_type?: string
  timestamp?: string
  escalated_at?: string
  escalated_to_name?: string
  escalation_reason?: string
  device_id?: string
}

const SLA_MINUTES = {
  critical: 10,
  high: 20,
  medium: 45,
  low: 90,
}

export default function EscalationsPage() {
  const router = useRouter()
  const [alerts, setAlerts] = useState<AlertItem[]>([])
  const [loading, setLoading] = useState(true)

  const fetchEscalations = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/video-server/alerts?limit=200')
      if (res.ok) {
        const data = await res.json()
        if (data.success && Array.isArray(data.alerts)) {
          const escalatedOnly = data.alerts.filter(
            (a: AlertItem) => a.status === 'escalated' || a.escalated || (a.escalation_level || 0) > 0
          )
          setAlerts(escalatedOnly)
        }
      }
    } catch (err) {
      console.error('Failed to fetch escalations', err)
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchEscalations()
    const interval = setInterval(fetchEscalations, 30000)
    return () => clearInterval(interval)
  }, [])

  const escalationsByPriority = useMemo(() => {
    return alerts.reduce((acc: Record<string, number>, alert) => {
      const key = alert.priority || 'low'
      acc[key] = (acc[key] || 0) + 1
      return acc
    }, {})
  }, [alerts])

  const getEscalationAgeMinutes = (a: AlertItem) => {
    const base = a.escalated_at || a.timestamp
    if (!base) return 0
    return Math.floor((Date.now() - new Date(base).getTime()) / 60000)
  }

  const isSlaBreached = (a: AlertItem) => {
    const limit = SLA_MINUTES[a.priority as keyof typeof SLA_MINUTES] || SLA_MINUTES.low
    return getEscalationAgeMinutes(a) > limit
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Escalation Console</h1>
          <p className="text-slate-600">Track escalated alerts, ownership, and SLA breaches</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.push('/video-alerts')}>
            Back to Control Center
          </Button>
          <Button onClick={fetchEscalations} disabled={loading}>
            <RefreshCw className={cn('w-4 h-4 mr-2', loading && 'animate-spin')} />
            Refresh
          </Button>
        </div>
      </div>

      <AlertsSubnav />

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card className="p-4 bg-white shadow-sm border-slate-200">
          <p className="text-sm text-gray-600">Total Escalated</p>
          <p className="text-2xl font-bold">{alerts.length}</p>
        </Card>
        <Card className="p-4 bg-white shadow-sm border-slate-200">
          <p className="text-sm text-gray-600">Critical</p>
          <p className="text-2xl font-bold text-red-600">{escalationsByPriority.critical || 0}</p>
        </Card>
        <Card className="p-4 bg-white shadow-sm border-slate-200">
          <p className="text-sm text-gray-600">High</p>
          <p className="text-2xl font-bold text-orange-600">{escalationsByPriority.high || 0}</p>
        </Card>
        <Card className="p-4 bg-white shadow-sm border-slate-200">
          <p className="text-sm text-gray-600">Medium</p>
          <p className="text-2xl font-bold text-yellow-600">{escalationsByPriority.medium || 0}</p>
        </Card>
        <Card className="p-4 bg-white shadow-sm border-slate-200">
          <p className="text-sm text-gray-600">SLA Breached</p>
          <p className="text-2xl font-bold text-purple-700">{alerts.filter(isSlaBreached).length}</p>
        </Card>
      </div>

      <Card className="p-4 bg-white shadow-sm border-slate-200">
        <div className="grid gap-3">
          {alerts.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No escalated alerts right now</p>
          ) : (
            alerts
              .sort((a, b) => getEscalationAgeMinutes(b) - getEscalationAgeMinutes(a))
              .map((alert) => {
                const breached = isSlaBreached(alert)
                return (
                  <div
                    key={alert.id}
                    className={cn(
                      'border rounded-lg p-4 flex items-center justify-between gap-4',
                      breached && 'border-red-300 bg-red-50'
                    )}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <ArrowUpCircle className="w-4 h-4 text-red-600" />
                        <span className="font-semibold truncate">{alert.alert_type || 'Escalated Alert'}</span>
                        <Badge variant="outline" className="capitalize">{alert.priority || 'low'}</Badge>
                        {breached && (
                          <Badge variant="destructive">SLA Breach</Badge>
                        )}
                      </div>
                      <div className="text-sm text-gray-600 flex items-center gap-4">
                        <span>Device: {alert.device_id || 'N/A'}</span>
                        <span>Level: {alert.escalation_level || 1}</span>
                        <span>Owner: {alert.escalated_to_name || 'Management Queue'}</span>
                      </div>
                      {alert.escalation_reason && (
                        <p className="text-xs text-gray-500 mt-1 truncate">Reason: {alert.escalation_reason}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="flex items-center text-sm text-gray-600 justify-end mb-2">
                        <Clock className="w-4 h-4 mr-1" />
                        {getEscalationAgeMinutes(alert)} min
                      </div>
                      <Button size="sm" onClick={() => router.push(`/video-alerts/${alert.id}`)}>
                        <Eye className="w-4 h-4 mr-2" />
                        Review
                      </Button>
                    </div>
                  </div>
                )
              })
          )}
        </div>
      </Card>

      <Card className="p-4 bg-white shadow-sm border-slate-200">
        <div className="flex items-center gap-2 mb-3">
          <ShieldAlert className="w-5 h-5 text-blue-600" />
          <h2 className="font-semibold">Escalation SLA Matrix</h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <div className="border rounded p-3">
            <p className="font-medium text-red-700">Critical</p>
            <p className="text-gray-600">Escalate within 10 minutes</p>
          </div>
          <div className="border rounded p-3">
            <p className="font-medium text-orange-700">High</p>
            <p className="text-gray-600">Escalate within 20 minutes</p>
          </div>
          <div className="border rounded p-3">
            <p className="font-medium text-yellow-700">Medium</p>
            <p className="text-gray-600">Escalate within 45 minutes</p>
          </div>
          <div className="border rounded p-3">
            <p className="font-medium text-blue-700">Low</p>
            <p className="text-gray-600">Escalate within 90 minutes</p>
          </div>
        </div>
      </Card>
    </div>
  )
}
