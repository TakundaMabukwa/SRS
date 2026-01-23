'use client'

import { useState, useEffect } from 'react'
import { Bell, Clock, Car, User } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useVideoAlerts } from '@/context/video-alerts-context/context'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'

export default function VideoAlertBell() {
  const router = useRouter()
  const { alerts } = useVideoAlerts()
  const [unreadCount, setUnreadCount] = useState(0)

  const recentAlerts = alerts.filter(a => a.status === 'new').slice(0, 5)

  useEffect(() => {
    setUnreadCount(recentAlerts.length)
  }, [recentAlerts.length])

  const handleViewAlert = (alertId: string) => {
    router.push(`/video-alerts/${alertId}`)
  }

  const handleViewAll = () => {
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
                className="cursor-pointer p-3 hover:bg-slate-50"
              >
                <div className="flex flex-col gap-2 w-full">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm">{alert.title}</span>
                    <Badge variant={alert.severity === 'critical' ? 'destructive' : alert.severity === 'high' ? 'default' : 'secondary'} className="text-xs">
                      {alert.severity}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-600">
                    <Car className="w-3 h-3" />
                    <span className="font-mono">{alert.vehicle_registration}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-600">
                    <User className="w-3 h-3" />
                    <span>{alert.driver_name}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <Clock className="w-3 h-3" />
                    <span>{format(new Date(alert.timestamp), 'MMM dd, HH:mm')}</span>
                  </div>
                </div>
              </DropdownMenuItem>
            ))}
            <DropdownMenuItem
              onClick={handleViewAll}
              className="cursor-pointer border-t font-medium text-center justify-center"
            >
              View All Alerts
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
