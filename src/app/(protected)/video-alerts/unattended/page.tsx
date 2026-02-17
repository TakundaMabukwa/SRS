'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { AlertTriangle, Clock, RefreshCw, Eye } from 'lucide-react'
import { cn } from '@/lib/utils'
import AlertsSubnav from '@/components/video-alerts/alerts-subnav'

export default function UnattendedAlertsPage() {
  const router = useRouter()
  const [alerts, setAlerts] = useState([])
  const [loading, setLoading] = useState(true)
  const [threshold, setThreshold] = useState(30)

  const fetchUnattended = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/video-server/alerts/unattended?minutes=${threshold}`)
      if (res.ok) {
        const data = await res.json()
        if (data.success) {
          setAlerts(data.unattendedAlerts || [])
        }
      }
    } catch (err) {
      console.error(err)
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchUnattended()
    const interval = setInterval(fetchUnattended, 60000)
    return () => clearInterval(interval)
  }, [threshold])

  const priorityColor = (p) => ({
    critical: 'bg-red-500',
    high: 'bg-orange-500',
    medium: 'bg-yellow-500',
    low: 'bg-blue-500'
  }[p] || 'bg-gray-500')

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Unattended Alerts</h1>
          <p className="text-slate-600">Alerts not actioned within {threshold} minutes</p>
        </div>
        <div className="flex gap-2">
          <select 
            value={threshold} 
            onChange={(e) => setThreshold(Number(e.target.value))}
            className="border rounded px-3 py-2"
          >
            <option value={15}>15 minutes</option>
            <option value={30}>30 minutes</option>
            <option value={60}>60 minutes</option>
          </select>
          <Button onClick={fetchUnattended} disabled={loading}>
            <RefreshCw className={cn('w-4 h-4 mr-2', loading && 'animate-spin')} />
            Refresh
          </Button>
        </div>
      </div>

      <AlertsSubnav />

      {alerts.length === 0 ? (
        <Card className="p-12 text-center bg-white shadow-sm border-slate-200">
          <Clock className="w-16 h-16 mx-auto text-green-500 mb-4" />
          <h2 className="text-xl font-bold mb-2">All Caught Up!</h2>
          <p className="text-gray-600">No unattended alerts at this time</p>
        </Card>
      ) : (
        <div className="grid gap-4">
          {alerts.map(alert => (
            <Card key={alert.id} className="p-4 hover:shadow-lg transition-shadow border-slate-200 bg-white shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={cn('w-3 h-3 rounded-full', priorityColor(alert.priority))} />
                  <div>
                    <h3 className="font-bold">{alert.alert_type}</h3>
                    <p className="text-sm text-gray-600">Device: {alert.device_id}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <Badge variant="destructive" className="mb-1">
                      <AlertTriangle className="w-3 h-3 mr-1" />
                      {alert.minutes_unattended} min unattended
                    </Badge>
                    <p className="text-xs text-gray-500">{alert.status}</p>
                  </div>
                  <Button onClick={() => router.push(`/video-alerts/${alert.id}`)}>
                    <Eye className="w-4 h-4 mr-2" />
                    View
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
