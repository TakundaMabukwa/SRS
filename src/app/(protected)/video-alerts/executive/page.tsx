'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { RefreshCw, TrendingUp, AlertTriangle, CheckCircle, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function ExecutiveDashboardPage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [days, setDays] = useState(30)

  const fetchDashboard = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/video-server/dashboard/executive?days=${days}`)
      if (res.ok) {
        const result = await res.json()
        if (result.success) {
          setData(result.data)
        }
      }
    } catch (err) {
      console.error(err)
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchDashboard()
  }, [days])

  if (loading || !data) {
    return (
      <div className="p-6 flex items-center justify-center h-screen">
        <RefreshCw className="w-12 h-12 animate-spin text-blue-600" />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Executive Dashboard</h1>
          <p className="text-gray-600">Last {days} days analytics</p>
        </div>
        <div className="flex gap-2">
          <select 
            value={days} 
            onChange={(e) => setDays(Number(e.target.value))}
            className="border rounded px-3 py-2"
          >
            <option value={7}>7 days</option>
            <option value={30}>30 days</option>
            <option value={90}>90 days</option>
          </select>
          <Button onClick={fetchDashboard} disabled={loading}>
            <RefreshCw className={cn('w-4 h-4 mr-2', loading && 'animate-spin')} />
            Refresh
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <Card className="p-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Avg Response Time</p>
              <p className="text-2xl font-bold">{data.avgResponseTimeSeconds}s</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Escalation Rate</p>
              <p className="text-2xl font-bold">{data.escalationRate}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Resolution Rate</p>
              <p className="text-2xl font-bold">{data.resolutionRate}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
              <Clock className="w-6 h-6 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Alerts</p>
              <p className="text-2xl font-bold">
                {data.alertsByPriority?.reduce((sum, item) => sum + item.count, 0) || 0}
              </p>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <Card className="p-6">
          <h2 className="text-xl font-bold mb-4">Alerts by Priority</h2>
          <div className="space-y-3">
            {data.alertsByPriority?.map(item => (
              <div key={item.priority} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={cn('w-3 h-3 rounded-full', {
                    'bg-red-500': item.priority === 'critical',
                    'bg-orange-500': item.priority === 'high',
                    'bg-yellow-500': item.priority === 'medium',
                    'bg-blue-500': item.priority === 'low'
                  })} />
                  <span className="capitalize">{item.priority}</span>
                </div>
                <span className="font-bold">{item.count}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-xl font-bold mb-4">Alerts by Type</h2>
          <div className="space-y-3">
            {data.alertsByType?.slice(0, 5).map(item => (
              <div key={item.alert_type} className="flex items-center justify-between">
                <span className="text-sm">{item.alert_type}</span>
                <span className="font-bold">{item.count}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}
