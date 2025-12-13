"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useVideoAlerts } from "@/context/video-alerts-context/context";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Bell,
  AlertTriangle,
  AlertCircle,
  Info,
  Clock,
  Eye,
  CheckCircle2,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format, formatDistanceToNow } from "date-fns";

export default function AlertBellNotification() {
  const router = useRouter();
  const { alerts, unreadCount, fetchUnreadCount, acknowledgeAlert, fetchAlerts } = useVideoAlerts();
  const [open, setOpen] = useState(false);
  const [currentUser] = useState({ id: "user-1", name: "Current User" });

  // Fetch unread count on mount
  useEffect(() => {
    fetchUnreadCount(currentUser.id);
  }, []);

  // Auto-refresh unread count every 10 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchUnreadCount(currentUser.id);
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  // Get recent alerts (new, acknowledged, or escalated)
  const recentAlerts = alerts
    .filter((alert) => 
      alert.status === "new" || 
      alert.status === "acknowledged" || 
      alert.status === "escalated"
    )
    .slice(0, 10);

  const getSeverityConfig = (severity) => {
    const config = {
      critical: {
        icon: AlertTriangle,
        color: "text-red-600",
        bgColor: "bg-red-100",
      },
      high: {
        icon: AlertCircle,
        color: "text-orange-600",
        bgColor: "bg-orange-100",
      },
      medium: {
        icon: Info,
        color: "text-yellow-600",
        bgColor: "bg-yellow-100",
      },
      low: {
        icon: Info,
        color: "text-blue-600",
        bgColor: "bg-blue-100",
      },
      info: {
        icon: Info,
        color: "text-gray-600",
        bgColor: "bg-gray-100",
      },
    };
    return config[severity] || config.info;
  };

  const handleViewAlert = (alertId) => {
    setOpen(false);
    router.push(`/video-alerts/${alertId}`);
  };

  const handleViewAll = () => {
    setOpen(false);
    router.push("/video-alerts");
  };

  const handleAcknowledge = async (alertId, e) => {
    e.stopPropagation();
    await acknowledgeAlert(alertId, currentUser.id);
    fetchUnreadCount(currentUser.id);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
        >
          <Bell className={cn(
            "h-5 w-5",
            unreadCount > 0 && "animate-pulse text-red-600"
          )} />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-[400px] p-0"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div>
            <h3 className="font-semibold text-slate-900">Video Alerts</h3>
            <p className="text-xs text-slate-600 mt-0.5">
              {unreadCount} new alert{unreadCount !== 1 ? "s" : ""}
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleViewAll}
          >
            View All
          </Button>
        </div>

        {/* Alerts List */}
        <ScrollArea className="h-[400px]">
          {recentAlerts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4">
              <CheckCircle2 className="w-12 h-12 text-green-500 mb-3" />
              <p className="text-sm font-medium text-slate-900">All caught up!</p>
              <p className="text-xs text-slate-600 mt-1">No new alerts at the moment</p>
            </div>
          ) : (
            <div className="divide-y">
              {recentAlerts.map((alert) => {
                const severityConfig = getSeverityConfig(alert.severity);
                const SeverityIcon = severityConfig.icon;
                const isNew = alert.status === "new";

                return (
                  <div
                    key={alert.id}
                    className={cn(
                      "p-4 hover:bg-slate-50 cursor-pointer transition-colors relative",
                      isNew && "bg-purple-50/50"
                    )}
                    onClick={() => handleViewAlert(alert.id)}
                  >
                    {/* New indicator dot */}
                    {isNew && (
                      <div className="absolute top-4 right-4">
                        <span className="flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-purple-500"></span>
                        </span>
                      </div>
                    )}

                    <div className="flex gap-3">
                      {/* Icon */}
                      <div className={cn(
                        "flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center",
                        severityConfig.bgColor
                      )}>
                        <SeverityIcon className={cn("w-5 h-5", severityConfig.color)} />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <h4 className="font-medium text-sm text-slate-900 line-clamp-1">
                            {alert.title}
                          </h4>
                          {alert.escalated && (
                            <Badge
                              variant="outline"
                              className="bg-red-100 text-red-800 border-red-300 text-xs"
                            >
                              Escalated
                            </Badge>
                          )}
                        </div>

                        <p className="text-xs text-slate-600 mb-2 line-clamp-1">
                          {alert.vehicle_registration && `${alert.vehicle_registration} • `}
                          {alert.driver_name || "No driver assigned"}
                        </p>

                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1 text-xs text-slate-500">
                            <Clock className="w-3 h-3" />
                            {formatDistanceToNow(new Date(alert.timestamp), { addSuffix: true })}
                          </div>

                          {/* Action buttons */}
                          <div className="flex items-center gap-1">
                            {isNew && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => handleAcknowledge(alert.id, e)}
                                className="h-7 px-2 text-xs"
                              >
                                <CheckCircle2 className="w-3 h-3 mr-1" />
                                Ack
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-xs"
                            >
                              <Eye className="w-3 h-3 mr-1" />
                              View
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>

        {/* Footer */}
        {recentAlerts.length > 0 && (
          <>
            <Separator />
            <div className="p-3 bg-slate-50">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleViewAll}
                className="w-full"
              >
                View All Alerts
              </Button>
            </div>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
