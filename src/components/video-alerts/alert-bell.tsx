'use client'

import { useState, useEffect } from 'react'
import { Bell } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useVideoWebSocket } from '@/hooks/use-video-websocket'
import { useRouter } from 'next/navigation'

export default function VideoAlertBell() {
  const router = useRouter()
  const [unreadCount, setUnreadCount] = useState(0)
  const [recentAlerts, setRecentAlerts] = useState<any[]>([])

  useVideoWebSocket((data) => {
    if (data.type === 'new-alert' || data.type === 'alert-escalated') {
      setUnreadCount(prev => prev + 1)
      setRecentAlerts(prev => [data.alert, ...prev].slice(0, 5))
      
      if (data.alert?.priority === 'critical') {
        const audio = new Audio('/alert-sound.mp3')
        audio.play().catch(() => {})
      }
    }
  })

  const handleViewAlert = (alertId: string) => {
    setUnreadCount(prev => Math.max(0, prev - 1))
    router.push(`/video-alerts/${alertId}`)
  }

  const handleViewAll = () => {
    setUnreadCount(0)
    router.push('/video-alerts')
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge 
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 bg-red-500"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <div className="p-2 font-semibold border-b">Video Alerts</div>
        {recentAlerts.length === 0 ? (
          <div className="p-4 text-center text-sm text-gray-500">
            No new alerts
          </div>
        ) : (
          <>
            {recentAlerts.map((alert) => (
              <DropdownMenuItem
                key={alert.id}
                onClick={() => handleViewAlert(alert.id)}
                className="cursor-pointer"
              >
                <div className="flex flex-col gap-1 w-full">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">{alert.alert_type}</span>
                    <Badge variant={alert.priority === 'critical' ? 'destructive' : 'default'}>
                      {alert.priority}
                    </Badge>
                  </div>
                  <span className="text-xs text-gray-500">
                    {new Date(alert.timestamp).toLocaleString()}
                  </span>
                </div>
              </DropdownMenuItem>
            ))}
            <DropdownMenuItem
              onClick={handleViewAll}
              className="cursor-pointer border-t font-medium text-center"
            >
              View All Alerts
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
