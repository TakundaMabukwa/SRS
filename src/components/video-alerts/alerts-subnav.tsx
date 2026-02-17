'use client'

import { usePathname, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { AlertTriangle, Camera, Clock, BarChart3, ShieldAlert, Siren, LayoutDashboard } from 'lucide-react'

const NAV_ITEMS = [
  { label: 'Control Center', href: '/video-alerts', icon: AlertTriangle },
  { label: 'Management', href: '/video-alerts/management', icon: LayoutDashboard },
  { label: 'Unattended', href: '/video-alerts/unattended', icon: Clock },
  { label: 'Screenshots', href: '/video-alerts/screenshots', icon: Camera },
  { label: 'Executive', href: '/video-alerts/executive', icon: BarChart3 },
  { label: 'Escalations', href: '/video-alerts/escalations', icon: ShieldAlert },
  { label: 'Flooding', href: '/video-alerts/flooding', icon: Siren },
]

export default function AlertsSubnav() {
  const pathname = usePathname()
  const router = useRouter()

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-2 shadow-sm">
      <div className="flex flex-wrap gap-2">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href
          return (
            <Button
              key={item.href}
              size="sm"
              variant={isActive ? 'default' : 'outline'}
              onClick={() => router.push(item.href)}
              className={cn(
                'rounded-full',
                isActive && 'bg-slate-900 hover:bg-slate-800'
              )}
            >
              <Icon className="w-4 h-4 mr-2" />
              {item.label}
            </Button>
          )
        })}
      </div>
    </div>
  )
}
