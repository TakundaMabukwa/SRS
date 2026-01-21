"use client";

import React, { useState } from "react";
import { useVideoAlerts } from "@/context/video-alerts-context/context";
import { useRouter } from "next/navigation";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bell, AlertTriangle, AlertCircle, Info, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

export function NotificationBell() {
  const router = useRouter();
  const { alerts, loading } = useVideoAlerts();
  const [open, setOpen] = useState(false);

  // Filter for active notifications (new or escalated)
  const activeAlerts = alerts.filter(
    (a) => a.status === "new" || a.status === "escalated"
  );
  
  // Sort by priority (critical first) then date
  const sortedAlerts = [...activeAlerts].sort((a, b) => {
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
    const priorityDiff = (priorityOrder[a.severity] || 5) - (priorityOrder[b.severity] || 5);
    if (priorityDiff !== 0) return priorityDiff;
    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
  });

  const unreadCount = sortedAlerts.length;

  const handleAlertClick = (alertId: string) => {
    setOpen(false);
    router.push(`/video-alerts/${alertId}`);
  };

  const getIcon = (severity: string) => {
    switch (severity) {
      case "critical": return <AlertTriangle className="w-4 h-4 text-red-500" />;
      case "high": return <AlertCircle className="w-4 h-4 text-orange-500" />;
      default: return <Info className="w-4 h-4 text-blue-500" />;
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative text-slate-500 hover:text-slate-900">
          <Bell className={cn("w-5 h-5", unreadCount > 0 && "animate-pulse-once")} />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-[10px] font-bold text-white shadow-sm ring-1 ring-white">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h4 className="font-semibold text-sm">Notifications</h4>
          {unreadCount > 0 && (
            <Badge variant="secondary" className="text-xs">
              {unreadCount} New
            </Badge>
          )}
        </div>
        <ScrollArea className="h-[300px]">
          {sortedAlerts.length > 0 ? (
            <div className="flex flex-col">
              {sortedAlerts.map((alert) => (
                <button
                  key={alert.id}
                  className="flex items-start gap-3 w-full p-4 border-b hover:bg-slate-50 transition-colors text-left"
                  onClick={() => handleAlertClick(alert.id)}
                >
                  <div className={cn(
                    "mt-1 p-1.5 rounded-full shrink-0",
                    alert.severity === 'critical' ? 'bg-red-100' : 
                    alert.severity === 'high' ? 'bg-orange-100' : 'bg-blue-100'
                  )}>
                    {getIcon(alert.severity)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <p className="text-sm font-semibold text-slate-900 truncate pr-2">
                        {alert.title}
                      </p>
                      <span className="text-[10px] text-slate-500 shrink-0">
                        {format(new Date(alert.timestamp), "HH:mm")}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 truncate mb-1">
                      {alert.vehicle_registration} • {alert.driver_name}
                    </p>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={cn(
                        "text-[10px] px-1.5 py-0 h-4 font-normal border-0",
                        alert.severity === 'critical' ? 'bg-red-100 text-red-700' : 
                        alert.severity === 'high' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'
                      )}>
                        {alert.severity}
                      </Badge>
                      {alert.status === 'escalated' && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 font-normal bg-purple-100 text-purple-700 border-0">
                          Escalated
                        </Badge>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-[200px] text-slate-500">
              <CheckCircle2 className="w-8 h-8 mb-2 text-slate-300" />
              <p className="text-sm">No new alerts</p>
            </div>
          )}
        </ScrollArea>
        <div className="p-2 border-t bg-slate-50">
          <Button 
            variant="ghost" 
            size="sm" 
            className="w-full text-xs text-slate-600"
            onClick={() => {
              setOpen(false);
              router.push('/dashboard?tab=video-alerts');
            }}
          >
            View All Alerts
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
