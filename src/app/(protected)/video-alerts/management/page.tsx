'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AlertTriangle, Clock, CheckCircle, RefreshCw } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useVideoWebSocket } from '@/hooks/use-video-websocket'
import AlertsSubnav from '@/components/video-alerts/alerts-subnav'

export default function AlertManagementPage() {
  const router = useRouter()
  const [alerts, setAlerts] = useState<any>({ critical: [], high: [], medium: [], low: [] })
  const [loading, setLoading] = useState(true)
  const [selectedPriority, setSelectedPriority] = useState('all')

  useVideoWebSocket((data) => {
    if (data.type === 'new-alert' || data.type === 'alert-status-changed') {
      fetchAlerts()
    }
  })

  const fetchAlerts = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/video-server/alerts/by-priority')
      const data = await response.json()
      if (data.success) {
        setAlerts(data.alertsByPriority)
      }
    } catch (error) {
      console.error('Failed to fetch alerts:', error)
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchAlerts()
    const interval = setInterval(fetchAlerts, 30000)
    return () => clearInterval(interval)
  }, [])

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'bg-red-100 text-red-800 border-red-300'
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-300'
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-300'
      case 'low': return 'bg-blue-100 text-blue-800 border-blue-300'
      default: return 'bg-gray-100 text-gray-800 border-gray-300'
    }
  }

  const allAlerts = [...alerts.critical, ...alerts.high, ...alerts.medium, ...alerts.low]
  const displayAlerts = selectedPriority === 'all' ? allAlerts : alerts[selectedPriority] || []

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Alert Management</h1>
          <p className="text-slate-600">Priority queue optimized for real-time triage</p>
        </div>
        <Button onClick={fetchAlerts} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <AlertsSubnav />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 border-l-4 border-l-red-500 bg-white shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">Critical</p>
              <p className="text-2xl font-bold">{alerts.critical?.length || 0}</p>
            </div>
            <AlertTriangle className="w-8 h-8 text-red-500" />
          </div>
        </Card>
        <Card className="p-4 border-l-4 border-l-orange-500 bg-white shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">High</p>
              <p className="text-2xl font-bold">{alerts.high?.length || 0}</p>
            </div>
            <Clock className="w-8 h-8 text-orange-500" />
          </div>
        </Card>
        <Card className="p-4 border-l-4 border-l-yellow-500 bg-white shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">Medium</p>
              <p className="text-2xl font-bold">{alerts.medium?.length || 0}</p>
            </div>
            <Clock className="w-8 h-8 text-yellow-500" />
          </div>
        </Card>
        <Card className="p-4 border-l-4 border-l-blue-500 bg-white shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">Low</p>
              <p className="text-2xl font-bold">{alerts.low?.length || 0}</p>
            </div>
            <CheckCircle className="w-8 h-8 text-blue-500" />
          </div>
        </Card>
      </div>

      <Tabs value={selectedPriority} onValueChange={setSelectedPriority}>
        <TabsList className="bg-slate-100">
          <TabsTrigger value="all">All ({allAlerts.length})</TabsTrigger>
          <TabsTrigger value="critical">Critical ({alerts.critical?.length || 0})</TabsTrigger>
          <TabsTrigger value="high">High ({alerts.high?.length || 0})</TabsTrigger>
          <TabsTrigger value="medium">Medium ({alerts.medium?.length || 0})</TabsTrigger>
          <TabsTrigger value="low">Low ({alerts.low?.length || 0})</TabsTrigger>
        </TabsList>

        <TabsContent value={selectedPriority} className="space-y-4 mt-4">
          {displayAlerts.length === 0 ? (
            <Card className="p-8 text-center text-gray-500">
              No alerts in this category
            </Card>
          ) : (
            displayAlerts.map((alert: any) => (
              <Card
                key={alert.id}
                className="p-4 cursor-pointer hover:shadow-lg transition-shadow"
                onClick={() => router.push(`/video-alerts/${alert.id}`)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <Badge className={getPriorityColor(alert.priority)}>
                        {alert.priority.toUpperCase()}
                      </Badge>
                      <Badge variant="outline">{alert.status}</Badge>
                      <span className="font-semibold">{alert.alert_type}</span>
                    </div>
                    <div className="text-sm text-gray-600">
                      <span>Device: {alert.device_id}</span>
                      <span className="mx-2">•</span>
                      <span>{new Date(alert.timestamp).toLocaleString()}</span>
                    </div>
                  </div>
                  <Button variant="outline" size="sm">
                    View Details
                  </Button>
                </div>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
