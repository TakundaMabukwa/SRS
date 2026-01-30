'use client'

import { useState, useEffect, use } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ArrowLeft, Camera, Video, Clock, CheckCircle, AlertTriangle } from 'lucide-react'
import { useRouter } from 'next/navigation'
import NCRFormModal from '@/components/video-alerts/ncr-form-modal'

export default function AlertDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [alert, setAlert] = useState<any>(null)
  const [history, setHistory] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showNCRModal, setShowNCRModal] = useState(false)

  const fetchAlert = async () => {
    try {
      const [alertRes, historyRes] = await Promise.all([
        fetch(`/api/video-server/alerts/${id}`),
        fetch(`/api/video-server/alerts/${id}/history`)
      ])

      const alertData = await alertRes.json()
      const historyData = await historyRes.json()

      if (alertData.success) setAlert(alertData.alert)
      if (historyData.success) setHistory(historyData.history)
    } catch (error) {
      console.error('Failed to fetch alert:', error)
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchAlert()
  }, [id])

  const handleAcknowledge = async () => {
    try {
      const response = await fetch(`/api/video-server/alerts/${id}/acknowledge`, {
        method: 'POST'
      })
      if (response.ok) fetchAlert()
    } catch (error) {
      console.error('Failed to acknowledge:', error)
    }
  }

  const handleEscalate = async () => {
    try {
      const response = await fetch(`/api/video-server/alerts/${id}/escalate`, {
        method: 'POST'
      })
      if (response.ok) fetchAlert()
    } catch (error) {
      console.error('Failed to escalate:', error)
    }
  }

  if (loading || !alert) {
    return <div className="p-6">Loading...</div>
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'bg-red-100 text-red-800'
      case 'high': return 'bg-orange-100 text-orange-800'
      case 'medium': return 'bg-yellow-100 text-yellow-800'
      case 'low': return 'bg-blue-100 text-blue-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => router.back()}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{alert.alert_type}</h1>
            <p className="text-gray-600">Alert ID: {alert.id}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge className={getPriorityColor(alert.priority)}>
            {alert.priority.toUpperCase()}
          </Badge>
          <Badge variant="outline">{alert.status}</Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card className="p-6">
            <h3 className="font-semibold mb-4">Alert Details</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Device ID:</span>
                <p className="font-medium">{alert.device_id}</p>
              </div>
              <div>
                <span className="text-gray-600">Channel:</span>
                <p className="font-medium">{alert.channel}</p>
              </div>
              <div>
                <span className="text-gray-600">Timestamp:</span>
                <p className="font-medium">{new Date(alert.timestamp).toLocaleString()}</p>
              </div>
              <div>
                <span className="text-gray-600">Escalation Level:</span>
                <p className="font-medium">{alert.escalation_level}</p>
              </div>
            </div>
          </Card>

          <Tabs defaultValue="screenshots">
            <TabsList>
              <TabsTrigger value="screenshots">
                <Camera className="w-4 h-4 mr-2" />
                Screenshots
              </TabsTrigger>
              <TabsTrigger value="videos">
                <Video className="w-4 h-4 mr-2" />
                Videos (30s)
              </TabsTrigger>
              <TabsTrigger value="history">
                <Clock className="w-4 h-4 mr-2" />
                History
              </TabsTrigger>
            </TabsList>

            <TabsContent value="screenshots" className="space-y-4">
              {alert.metadata?.screenshots?.length > 0 ? (
                <div className="grid grid-cols-2 gap-4">
                  {alert.metadata.screenshots.map((screenshot: any) => (
                    <Card key={screenshot.id} className="overflow-hidden">
                      <img src={screenshot.storage_url} alt="Screenshot" className="w-full" />
                      <div className="p-2 text-xs text-gray-600">
                        {screenshot.camera_name} • {new Date(screenshot.timestamp).toLocaleString()}
                      </div>
                    </Card>
                  ))}
                </div>
              ) : (
                <Card className="p-8 text-center text-gray-500">No screenshots available</Card>
              )}
            </TabsContent>

            <TabsContent value="videos" className="space-y-4">
              {alert.metadata?.videoClips?.length > 0 ? (
                <div className="space-y-4">
                  {alert.metadata.videoClips.map((clip: any) => (
                    <Card key={clip.id} className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{clip.camera_name}</p>
                          <p className="text-sm text-gray-600">
                            {clip.clip_type === 'pre' ? '30s Before' : '30s After'} • {clip.duration}s
                          </p>
                        </div>
                        <Button size="sm">Play</Button>
                      </div>
                    </Card>
                  ))}
                </div>
              ) : (
                <Card className="p-8 text-center text-gray-500">
                  Video clips automatically recorded for priority alerts
                </Card>
              )}
            </TabsContent>

            <TabsContent value="history" className="space-y-4">
              {history.length > 0 ? (
                <div className="space-y-3">
                  {history.map((entry: any) => (
                    <Card key={entry.id} className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="w-2 h-2 bg-blue-500 rounded-full mt-2" />
                        <div className="flex-1">
                          <p className="font-medium capitalize">{entry.action.replace(/_/g, ' ')}</p>
                          <p className="text-sm text-gray-600">{entry.details}</p>
                          <p className="text-xs text-gray-500 mt-1">
                            {new Date(entry.timestamp).toLocaleString()} • {entry.user_name}
                          </p>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              ) : (
                <Card className="p-8 text-center text-gray-500">No history available</Card>
              )}
            </TabsContent>
          </Tabs>
        </div>

        <div className="space-y-4">
          <Card className="p-4">
            <h3 className="font-semibold mb-4">Actions</h3>
            <div className="space-y-2">
              {alert.status === 'new' && (
                <Button className="w-full" onClick={handleAcknowledge}>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Acknowledge
                </Button>
              )}
              {alert.status !== 'resolved' && (
                <>
                  <Button variant="outline" className="w-full" onClick={handleEscalate}>
                    <AlertTriangle className="w-4 h-4 mr-2" />
                    Escalate
                  </Button>
                  <Button variant="outline" className="w-full" onClick={() => setShowNCRModal(true)}>
                    Fill NCR Form
                  </Button>
                </>
              )}
            </div>
          </Card>
        </div>
      </div>

      <NCRFormModal
        isOpen={showNCRModal}
        onClose={() => setShowNCRModal(false)}
        driverInfo={{
          name: alert.metadata?.driver_name || 'Unknown Driver',
          fleetNumber: alert.metadata?.fleet_number || alert.device_id,
          department: alert.metadata?.department,
          timestamp: alert.timestamp,
          location: alert.metadata?.location
        }}
      />>
    </div>
  )
}
