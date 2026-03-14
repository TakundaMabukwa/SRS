"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useVideoAlerts } from "@/context/video-alerts-context/context";
import { useAlertPolling } from "@/hooks/use-alert-polling";
import { useVideoWebSocket } from "@/hooks/use-video-websocket";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertTriangle,
  Clock,
  RefreshCw,
  Search,
  LayoutList, 
  LayoutGrid, 
  Siren,
  Video,
  Camera,
  User,
  ChevronRight,
  Bell,
  ShieldAlert,
  MinusCircle,
  Signal
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format, differenceInHours } from "date-fns";

type VideoAlertsDashboardTabProps = {
  onOpenAlertDetail?: (alert: any, trip?: any) => Promise<any> | any;
};

export default function VideoAlertsDashboardTab({ onOpenAlertDetail }: VideoAlertsDashboardTabProps) {
  const router = useRouter();
  const { filters, loading } = useVideoAlerts();
  const videoProxyBase = "/api/video-server";
  const alertStats = useAlertPolling();
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("all"); 
  const [viewMode, setViewMode] = useState<"grid" | "list">("list");
  const [levelFilter, setLevelFilter] = useState<"all" | "critical" | "high" | "medium" | "low">("all");
  const [boardLevelFilter, setBoardLevelFilter] = useState<"all" | "critical" | "high" | "medium" | "low" | null>(null);
  const [sourceAlerts, setSourceAlerts] = useState<any[]>([]);
  const [realtimeAlerts, setRealtimeAlerts] = useState<any[]>([]);

  const normalizeAlert = useCallback((incoming: any) => {
    if (!incoming || typeof incoming !== "object") return null;

    const id = String(incoming.id || incoming.alert_id || incoming.alertId || "").trim();
    const title = String(incoming.title || incoming.type || incoming.alert_type || "Alert").trim();
    const severity = String(incoming.severity || incoming.priority || "low").toLowerCase();
    const vehicle = String(
      incoming.vehicle_registration ||
        incoming.vehicle_reg ||
        incoming.registration ||
        incoming.fleet_number ||
        incoming.device_id ||
        incoming.vehicleId ||
        incoming.vehicle_id ||
        "N/A"
    ).trim();

    return {
      ...incoming,
      id: id || `${vehicle}-${title}-${incoming.timestamp || incoming.created_at || Date.now()}`,
      title,
      alert_type: incoming.alert_type || incoming.type || title.toLowerCase().replace(/\s+/g, "_"),
      severity,
      priority: severity,
      status: String(incoming.status || "new").toLowerCase(),
      vehicle_registration: vehicle,
      driver_name: incoming.driver_name || incoming.driver || "Unknown",
      timestamp: incoming.timestamp || incoming.created_at || incoming.alert_timestamp || new Date().toISOString(),
    };
  }, []);

  const dedupeByIdAndSort = useCallback((items: any[]) => {
    const byId = new Map<string, any>();
    for (const item of items) {
      const normalized = normalizeAlert(item);
      if (!normalized) continue;
      byId.set(String(normalized.id), { ...(byId.get(String(normalized.id)) || {}), ...normalized });
    }
    return Array.from(byId.values()).sort(
      (a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }, [normalizeAlert]);

  const fetchTripRoutingStyleAlerts = useCallback(async () => {
    try {
      const res = await fetch(`${videoProxyBase}/alerts/active`, { cache: "no-store" });
      if (!res.ok) return;

      const json = await res.json();
      const activeList = Array.isArray(json?.alerts)
        ? json.alerts
        : Array.isArray(json?.data?.alerts)
          ? json.data.alerts
          : Array.isArray(json?.data)
            ? json.data
            : [];

      setSourceAlerts(dedupeByIdAndSort(activeList));
    } catch (error) {
      console.error("Failed to fetch video alerts board data:", error);
    }
  }, [dedupeByIdAndSort, videoProxyBase]);

  useEffect(() => {
    fetchTripRoutingStyleAlerts();
  }, [fetchTripRoutingStyleAlerts, filters]);

  useEffect(() => {
    const interval = setInterval(() => {
      fetchTripRoutingStyleAlerts();
    }, 30000);

    return () => clearInterval(interval);
  }, [fetchTripRoutingStyleAlerts]);

  const normalizeRealtimeAlert = useCallback((incoming: any) => normalizeAlert(incoming), [normalizeAlert]);

  const handleRealtimeMessage = useCallback((data: any) => {
    const eventType = String(data?.type || "").toLowerCase();
    const payloadAlert = normalizeRealtimeAlert(data?.alert || data?.data);

    if (!payloadAlert) {
      if (eventType === "new-alert" || eventType === "alert-created" || eventType === "alert-media-updated") {
        fetchTripRoutingStyleAlerts();
      }
      return;
    }

    setRealtimeAlerts((prev) => dedupeByIdAndSort([payloadAlert, ...prev]));

    if (
      eventType === "alert-status-changed" ||
      eventType === "alert-resolved" ||
      eventType === "alert-updated" ||
      eventType === "alert-escalated" ||
      eventType === "video-clip-ready" ||
      eventType === "screenshot-received" ||
      eventType === "screenshot-linked" ||
      eventType === "alert-media-updated"
    ) {
      fetchTripRoutingStyleAlerts();
    }
  }, [dedupeByIdAndSort, fetchTripRoutingStyleAlerts, normalizeRealtimeAlert]);

  useVideoWebSocket(handleRealtimeMessage);

  const getAlertLevel = (alert: any): "critical" | "high" | "medium" | "low" => {
    const raw = String(alert?.severity || alert?.priority || "").toLowerCase();
    if (raw === "critical") return "critical";
    if (raw === "high") return "high";
    if (raw === "medium") return "medium";
    return "low";
  };

  const mergedAlerts = useMemo(() => dedupeByIdAndSort([
    ...realtimeAlerts,
    ...sourceAlerts,
  ]), [dedupeByIdAndSort, realtimeAlerts, sourceAlerts]);

  const groupedAlerts = useMemo(() => {
    const groups = new Map<string, any>();

    for (const alert of mergedAlerts) {
      const normalized = normalizeAlert(alert);
      if (!normalized) continue;
      const level = getAlertLevel(normalized);
      const titleKey = String(normalized.title || normalized.alert_type || "Alert").trim().toLowerCase();
      const vehicleKey = String(normalized.vehicle_registration || normalized.vehicleId || normalized.device_id || "N/A").trim().toLowerCase();
      const groupKey = `${level}|${titleKey}|${vehicleKey}`;
      const existing = groups.get(groupKey);

      if (!existing) {
        groups.set(groupKey, {
          ...normalized,
          count: 1,
          groupedIds: [normalized.id],
          latestTimestamp: normalized.timestamp,
        });
        continue;
      }

      const nextCount = Number(existing.count || 1) + 1;
      const existingTs = new Date(existing.latestTimestamp || existing.timestamp || 0).getTime();
      const currentTs = new Date(normalized.timestamp || 0).getTime();
      const latestBase = currentTs >= existingTs ? normalized : existing;
      groups.set(groupKey, {
        ...existing,
        ...latestBase,
        count: nextCount,
        groupedIds: Array.from(new Set([...(existing.groupedIds || []), normalized.id])),
        latestTimestamp: currentTs >= existingTs ? normalized.timestamp : existing.latestTimestamp,
      });
    }

    return Array.from(groups.values()).sort((a: any, b: any) => new Date(b.latestTimestamp || b.timestamp || 0).getTime() - new Date(a.latestTimestamp || a.timestamp || 0).getTime());
  }, [mergedAlerts, normalizeAlert]);

  // Calculate statistics from alerts
  const calculatedStats = {
    critical_alerts: groupedAlerts.filter(a => getAlertLevel(a) === 'critical' && !['closed', 'resolved'].includes(a.status)).length,
    high_alerts: groupedAlerts.filter(a => getAlertLevel(a) === 'high' && !['closed', 'resolved'].includes(a.status)).length,
    medium_alerts: groupedAlerts.filter(a => getAlertLevel(a) === 'medium' && !['closed', 'resolved'].includes(a.status)).length,
    low_alerts: groupedAlerts.filter(a => getAlertLevel(a) === 'low' && !['closed', 'resolved'].includes(a.status)).length,
    total_alerts: groupedAlerts.filter(a => !['closed', 'resolved'].includes(a.status)).length,
    resolved_today: groupedAlerts.filter(a => {
      if (!['closed', 'resolved'].includes(a.status)) return false;
      const today = new Date().toDateString();
      const resolvedDate = new Date(a.resolved_at || a.closed_at || a.updated_at).toDateString();
      return today === resolvedDate;
    }).length,
  };

  const displayStats = calculatedStats;

  const handleRefresh = () => {
    fetchTripRoutingStyleAlerts();
  };

  const handleViewAlert = async (alert: any) => {
    if (onOpenAlertDetail) {
      await onOpenAlertDetail(alert, null);
      return;
    }
    if (alert?.id) {
      router.push(`/video-alerts/${alert.id}`);
    }
  };

  // Helper for "Unattended" logic (24h+)
  const isUnattended = (alert: any) => {
    if (alert.status === 'closed' || alert.status === 'resolved') return false;
    const diff = differenceInHours(new Date(), new Date(alert.timestamp));
    return diff >= 24;
  };

  // Filtering
  const filteredAlerts = groupedAlerts.filter((alert: any) => {
    // 1. Tab Filter
    if (activeTab === 'unattended') {
      if (!isUnattended(alert)) return false;
    } else if (activeTab === 'history') {
      if (!['closed', 'resolved'].includes(alert.status)) return false;
    } else if (activeTab !== 'all') {
      if (alert.status !== activeTab) return false;
    }

    // 2. Search
    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      const matchesSearch = (
        alert.title?.toLowerCase().includes(s) ||
        alert.vehicle_registration?.toLowerCase().includes(s) ||
        alert.driver_name?.toLowerCase().includes(s) ||
        alert.id?.toLowerCase().includes(s)
      );
      if (!matchesSearch) return false;
    }

    if (levelFilter !== 'all' && getAlertLevel(alert) !== levelFilter) {
      return false;
    }

    return true;
  });

  const criticalCount = calculatedStats.critical_alerts || 0;
  const highCount = calculatedStats.high_alerts || 0;
  const mediumCount = calculatedStats.medium_alerts || 0;
  const lowCount = calculatedStats.low_alerts || 0;
  const allOpenCount = displayStats?.total_alerts || 0;

  // Render Helpers
  const getSeverityColor = (severity: string) => {
    switch (severity.toLowerCase()) {
      case 'critical': return 'text-rose-700 bg-rose-100 border-rose-200';
      case 'high': return 'text-red-600 bg-red-100 border-red-200';
      case 'medium': return 'text-yellow-600 bg-yellow-100 border-yellow-200';
      default: return 'text-blue-600 bg-blue-100 border-blue-200';
    }
  };

  const getLevelMeta = (level: "all" | "critical" | "high" | "medium" | "low") => {
    switch (level) {
      case "critical":
        return {
          label: "Critical Alerts",
          value: criticalCount,
          description: "Immediate operator attention required",
          cardClass: "border-l-rose-600",
          iconWrapClass: "bg-rose-100",
          iconClass: "text-rose-700",
          activeClass: "ring-2 ring-rose-300 bg-rose-50"
        };
      case "high":
        return {
          label: "High Alerts",
          value: highCount,
          description: "Urgent alerts needing fast action",
          cardClass: "border-l-red-500",
          iconWrapClass: "bg-red-100",
          iconClass: "text-red-600",
          activeClass: "ring-2 ring-red-300 bg-red-50"
        };
      case "medium":
        return {
          label: "Medium Alerts",
          value: mediumCount,
          description: "Important alerts under review",
          cardClass: "border-l-amber-500",
          iconWrapClass: "bg-amber-100",
          iconClass: "text-amber-600",
          activeClass: "ring-2 ring-amber-300 bg-amber-50"
        };
      case "low":
        return {
          label: "Low Alerts",
          value: lowCount,
          description: "Lower-priority alerts for monitoring",
          cardClass: "border-l-blue-500",
          iconWrapClass: "bg-blue-100",
          iconClass: "text-blue-600",
          activeClass: "ring-2 ring-blue-300 bg-blue-50"
        };
      default:
        return {
          label: "All Open Alerts",
          value: allOpenCount,
          description: "All active alerts in the queue",
          cardClass: "border-l-emerald-500",
          iconWrapClass: "bg-emerald-100",
          iconClass: "text-emerald-600",
          activeClass: "ring-2 ring-emerald-300 bg-emerald-50"
        };
    }
  };

  const levelCards: Array<{ key: "all" | "critical" | "high" | "medium" | "low"; icon: React.ReactNode }> = [
    { key: "critical", icon: <AlertTriangle className="w-5 h-5" /> },
    { key: "high", icon: <ShieldAlert className="w-5 h-5" /> },
    { key: "medium", icon: <Siren className="w-5 h-5" /> },
    { key: "low", icon: <MinusCircle className="w-5 h-5" /> },
    { key: "all", icon: <Signal className="w-5 h-5" /> },
  ];

  const boardColumns = [
    {
      key: "critical",
      title: "Critical",
      description: "Immediate action required",
      alerts: filteredAlerts.filter((alert: any) => getAlertLevel(alert) === "critical"),
      className: "border-t-rose-500",
    },
    {
      key: "high",
      title: "High",
      description: "Urgent alerts",
      alerts: filteredAlerts.filter((alert: any) => getAlertLevel(alert) === "high"),
      className: "border-t-red-400",
    },
    {
      key: "medium",
      title: "Medium",
      description: "Important alerts",
      alerts: filteredAlerts.filter((alert: any) => getAlertLevel(alert) === "medium"),
      className: "border-t-amber-400",
    },
    {
      key: "low",
      title: "Low",
      description: "Monitor and review",
      alerts: filteredAlerts.filter((alert: any) => getAlertLevel(alert) === "low"),
      className: "border-t-blue-400",
    },
  ];

  const severityTableColumns = [
    {
      key: "critical",
      title: "Critical",
      className: "bg-rose-50/60",
      alerts: filteredAlerts.filter((alert: any) => getAlertLevel(alert) === "critical"),
    },
    {
      key: "high",
      title: "High",
      className: "bg-red-50/60",
      alerts: filteredAlerts.filter((alert: any) => getAlertLevel(alert) === "high"),
    },
    {
      key: "medium",
      title: "Medium",
      className: "bg-amber-50/60",
      alerts: filteredAlerts.filter((alert: any) => getAlertLevel(alert) === "medium"),
    },
    {
      key: "low",
      title: "Low",
      className: "bg-blue-50/60",
      alerts: filteredAlerts.filter((alert: any) => getAlertLevel(alert) === "low"),
    },
  ];

  const severityTableRowCount = Math.max(0, ...severityTableColumns.map((column) => column.alerts.length));

  const renderAlertBoardRow = (alert: any) => {
    const vehicleLabel = alert?.vehicle_registration || alert?.vehicleId || alert?.device_id || "N/A";
    const alertLabel = alert?.title || alert?.alert_type || alert?.type || "Alert";

    return (
      <div key={alert.id} className="rounded-md border border-slate-200 bg-white px-2.5 py-2 shadow-sm">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="truncate text-[13px] font-semibold leading-4 text-slate-900">
              {alertLabel} ({vehicleLabel})
            </div>
            <div className="mt-1 flex items-center gap-1.5">
              {Number(alert?.count || 1) > 1 ? (
                <Badge variant="secondary" className="rounded-full px-1.5 py-0 text-[10px] font-semibold">
                  x{alert.count}
                </Badge>
              ) : null}
            </div>
            <div className="mt-1 text-[10px] uppercase tracking-wide text-slate-400">
              {String(alert?.status || "new")}
            </div>
            <div className="mt-1 text-[11px] leading-4 text-slate-500">
              {alert?.timestamp ? format(new Date(alert.timestamp), "MMM dd, HH:mm") : "Unknown time"}
            </div>
          </div>
          <Badge variant="outline" className={cn("shrink-0 capitalize text-[10px] font-semibold", getSeverityColor(getAlertLevel(alert)))}>
            {getAlertLevel(alert)}
          </Badge>
        </div>
        <div className="mt-2 flex justify-end">
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-[11px]"
            onClick={(e) => {
              e.stopPropagation();
              handleViewAlert(alert);
            }}
          >
            Action Alert
          </Button>
        </div>
      </div>
    );
  };

  const renderSeverityTableCell = (alert: any, severityKey: string) => {
    if (!alert) {
      return (
        <div className="rounded-lg border border-dashed border-slate-200 bg-white/70 px-3 py-5 text-center text-xs text-slate-400">
          No alerts
        </div>
      );
    }

    return (
        <div
        className="rounded-md border border-slate-200 bg-white px-2.5 py-2 shadow-sm transition-colors hover:bg-slate-50"
        onClick={() => handleViewAlert(alert)}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="truncate text-[13px] font-semibold leading-4 text-slate-900">
              {alert.title} ({alert.vehicle_registration || "N/A"})
            </div>
            <div className="mt-0.5 text-[11px] leading-4 text-slate-500 capitalize">
              {(alert.alert_type || "alert").replace(/_/g, " ")}
            </div>
            <div className="mt-0.5 text-[10px] uppercase tracking-wide text-slate-400">
              {alert.status || "new"}
            </div>
            {Number(alert?.count || 1) > 1 ? (
              <div className="mt-0.5 text-[11px] font-semibold text-slate-600">Repeated x{alert.count}</div>
            ) : null}
          </div>
          <Badge
            variant="outline"
            className={cn("shrink-0 capitalize text-[10px] font-semibold", getSeverityColor(severityKey))}
          >
            {severityKey}
          </Badge>
        </div>

        <div className="mt-2 grid grid-cols-2 gap-2 text-[11px]">
          <div>
            <div className="text-[10px] uppercase tracking-wide text-slate-400">Target</div>
            <div className="truncate font-mono font-semibold text-slate-900">{alert.vehicle_registration || "N/A"}</div>
            <div className="truncate text-slate-500">{alert.driver_name || "Unknown"}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wide text-slate-400">Time</div>
            <div className="text-slate-900">{format(new Date(alert.timestamp), "MMM dd")}</div>
            <div className="text-slate-500">{format(new Date(alert.timestamp), "HH:mm")}</div>
          </div>
        </div>

        <div className="mt-2 flex justify-end">
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-[11px]"
            onClick={(e) => {
              e.stopPropagation();
              handleViewAlert(alert);
            }}
          >
            Action Alert
          </Button>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col space-y-4 animate-in fade-in duration-500">
      
      {/* Bell Notification */}
      <div className="flex justify-between items-center gap-2">
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => router.push('/video-alerts/management')}>
            Management
          </Button>
          <Button variant="outline" size="sm" onClick={() => router.push('/video-alerts/unattended')}>
            Unattended
          </Button>
          <Button variant="outline" size="sm" onClick={() => router.push('/video-alerts/escalations')}>
            Escalations
          </Button>
          <Button variant="outline" size="sm" onClick={() => router.push('/video-alerts/flooding')}>
            Flooding
          </Button>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          className="relative"
          onClick={() => router.push('/video-alerts')}
        >
          <Bell className="w-4 h-4" />
          {alertStats.newCount > 0 && (
            <Badge className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center p-0 bg-red-500">
              {alertStats.newCount}
            </Badge>
          )}
        </Button>
      </div>
      
      {/* Top Stats Row - alert level filters */}
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-5">
        {levelCards.map(({ key, icon }) => {
          const meta = getLevelMeta(key);
          const isActive = boardLevelFilter === key;
          return (
            <Card
              key={key}
              className={cn(
                "p-3 border-l-4 bg-white shadow-sm transition-all cursor-pointer hover:shadow-md",
                meta.cardClass,
                isActive && meta.activeClass
              )}
              onClick={() => {
                if (boardLevelFilter === key) {
                  setBoardLevelFilter(null);
                  setLevelFilter("all");
                  return;
                }
                setBoardLevelFilter(key);
                setLevelFilter(key);
              }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-500">{meta.label}</p>
                  <h3 className="text-xl font-bold leading-6 text-slate-900">{meta.value}</h3>
                </div>
                <div className={cn("p-1.5 rounded-full", meta.iconWrapClass, key === "high" && "animate-pulse")}>
                  <span className={cn("scale-90", meta.iconClass)}>{icon}</span>
                </div>
              </div>
              <div className="mt-1 text-[11px] leading-4 text-slate-400">{meta.description}</div>
            </Card>
          );
        })}
      </div>

      {/* Toolbar */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
        
        {/* Tabs */}
        <div className="flex flex-wrap gap-2">
           <Button 
             variant={activeTab === 'all' ? 'default' : 'outline'} 
             size="sm" 
             onClick={() => setActiveTab('all')}
             className="rounded-full"
           >
             All
           </Button>
           <Button 
             variant={activeTab === 'new' ? 'default' : 'outline'} 
             size="sm" 
             onClick={() => setActiveTab('new')}
             className={cn("rounded-full", activeTab === 'new' && "bg-purple-600 hover:bg-purple-700")}
           >
             New
           </Button>
            <Button 
              variant={activeTab === 'unattended' ? 'default' : 'outline'} 
              size="sm" 
              onClick={() => setActiveTab('unattended')}
              className={cn("rounded-full", activeTab === 'unattended' && "bg-orange-600 hover:bg-orange-700")}
            >
              Unattended
            </Button>
           <Button 
             variant={activeTab === 'history' ? 'default' : 'outline'} 
             size="sm" 
             onClick={() => setActiveTab('history')}
             className="rounded-full"
           >
             History
           </Button>
        </div>

        {/* Right Side Tools */}
        <div className="flex items-center gap-2 w-full lg:w-auto">
          <div className="relative flex-1 lg:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input 
              placeholder="Search vehicle, ID..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 bg-white"
            />
          </div>
          
          <div className="flex items-center bg-white border rounded-lg p-1 shadow-sm">
             <Button
               variant={viewMode === 'list' ? 'secondary' : 'ghost'}
               size="icon"
               className="h-8 w-8"
               onClick={() => setViewMode('list')}
             >
               <LayoutList className="h-4 w-4" />
             </Button>
             <Button
               variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
               size="icon"
               className="h-8 w-8"
               onClick={() => setViewMode('grid')}
             >
               <LayoutGrid className="h-4 w-4" />
             </Button>
          </div>

          <Button variant="outline" size="icon" onClick={handleRefresh} title="Refresh Data">
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          </Button>
        </div>
      </div>

      {/* Main Content Area */}
      {filteredAlerts.length === 0 ? (
        <div className="text-center py-20 bg-slate-50 rounded-xl border border-slate-200 border-dashed">
          <div className="mx-auto bg-white p-4 rounded-full w-20 h-20 flex items-center justify-center shadow-sm mb-4">
            <Search className="h-8 w-8 text-slate-300" />
          </div>
          <h3 className="text-lg font-medium text-slate-900">No alerts found</h3>
          <p className="text-slate-500">Try adjusting your filters or search terms.</p>
          <Button variant="link" onClick={() => { setActiveTab('all'); setLevelFilter('all'); setBoardLevelFilter(null); setSearchTerm(''); }} className="mt-2">
            Clear all filters
          </Button>
        </div>
      ) : (
        boardLevelFilter !== null ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <div>
                <div className="text-sm font-semibold text-slate-900">
                  {getLevelMeta(boardLevelFilter).label} board
                </div>
                <div className="text-xs text-slate-500">
                  Severity table view fed by websocket + API for all vehicles
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setBoardLevelFilter(null);
                  setLevelFilter("all");
                }}
              >
                Back to table
              </Button>
            </div>

          <div className="grid grid-cols-1 gap-3 xl:grid-cols-4">
              {boardColumns.map((column) => (
                <div key={column.key} className={cn("rounded-xl border border-slate-200 bg-slate-50 p-2.5", column.className)}>
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <div>
                      <div className="text-[13px] font-semibold text-slate-900">{column.title}</div>
                      <div className="text-[11px] text-slate-500">{column.description}</div>
                    </div>
                    <Badge variant="secondary" className="rounded-full px-2 py-0.5 text-xs">
                      {column.alerts.length}
                    </Badge>
                  </div>

                  <div className="space-y-1.5">
                    {column.alerts.length > 0 ? (
                      column.alerts.map((alert: any) => renderAlertBoardRow(alert))
                    ) : (
                      <div className="rounded-md border border-dashed border-slate-200 bg-white px-2 py-4 text-center text-[11px] text-slate-400">
                        No alerts
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredAlerts.map((alert: any) => (
              <Card 
                key={alert.id} 
                className="overflow-hidden hover:shadow-lg transition-all duration-300 group cursor-pointer border-slate-200"
                onClick={() => handleViewAlert(alert)}
              >
                {/* Image/Video Header Section */}
                <div className="relative aspect-video bg-slate-900">
                  {alert.screenshots?.[0]?.url ? (
                    <img 
                      src={alert.screenshots[0].url} 
                      alt="Alert Snapshot" 
                      className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-600">
                      <Camera className="h-12 w-12 opacity-20" />
                    </div>
                  )}
                  
                   {/* Overlay Badges */}
                   <div className="absolute top-3 right-3 flex gap-2">
                     <Badge className={cn("shadow-sm capitalize", getSeverityColor(getAlertLevel(alert)))}>
                       {getAlertLevel(alert)}
                     </Badge>
                   </div>
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-4">
                     <div className="flex items-center justify-between text-white">
                       <span className="font-mono text-sm font-bold tracking-wider">
                         {alert.vehicle_registration || "NO-PLATE"}
                       </span>
                       <span className="text-xs font-medium opacity-80 flex items-center gap-1">
                         <Clock className="w-3 h-3" />
                         {format(new Date(alert.timestamp), "HH:mm")}
                       </span>
                     </div>
                  </div>
                </div>

                {/* Card Body */}
                <div className="p-4 bg-white">
                  <div className="flex justify-between items-start mb-3">
                     <div>
                       <h4 className="font-semibold text-slate-900 line-clamp-1">{alert.title}</h4>
                       <p className="text-xs text-slate-500 uppercase tracking-wide mt-1">{alert.alert_type?.replace(/_/g, ' ')}</p>
                     </div>
                     <Badge variant="outline" className={cn(
                       "capitalize font-semibold",
                       alert.status === 'new' ? "border-purple-300 text-purple-700 bg-purple-50" : 
                       alert.status === 'escalated' ? "border-red-300 text-red-700 bg-red-50" :
                       alert.status === 'investigating' ? "border-blue-300 text-blue-700 bg-blue-50" :
                       "border-slate-200 text-slate-600"
                     )}>
                       {alert.status}
                     </Badge>
                  </div>
                  
                  <div className="space-y-2 mb-4">
                    <div className="flex items-center text-xs text-slate-600">
                       <User className="w-3.5 h-3.5 mr-2 text-slate-400" />
                       {alert.driver_name || "Unknown Driver"}
                    </div>
                    {isUnattended(alert) && (
                      <div className="flex items-center text-xs text-orange-600 bg-orange-50 px-2 py-1 rounded w-fit">
                         <AlertTriangle className="w-3.5 h-3.5 mr-1" />
                         Unattended for {differenceInHours(new Date(), new Date(alert.timestamp))}h
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                     <div className="text-xs text-slate-400">
                        ID: {alert.id.slice(0,8)}
                     </div>
                     <Button size="sm" variant="ghost" className="h-8 text-xs hover:bg-slate-100 hover:text-blue-600">
                       Action Alert <ChevronRight className="w-3 h-3 ml-1" />
                     </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
             <Table>
                <TableHeader>
                   <TableRow className="bg-slate-50 hover:bg-slate-50">
                      {severityTableColumns.map((column) => (
                        <TableHead key={column.key} className={cn("min-w-[260px] px-2 py-2 border-l border-slate-200 first:border-l-0", column.className)}>
                          <div className="flex items-center justify-between">
                            <span className="text-[13px] font-semibold text-slate-900">{column.title}</span>
                            <Badge variant="secondary" className="rounded-full px-2 py-0.5 text-xs">
                              {column.alerts.length}
                            </Badge>
                          </div>
                        </TableHead>
                      ))}
                   </TableRow>
                </TableHeader>
                <TableBody>
                  {Array.from({ length: severityTableRowCount }).map((_, rowIndex) => (
                    <TableRow key={`severity-row-${rowIndex}`} className="align-top hover:bg-transparent">
                      {severityTableColumns.map((column) => (
                        <TableCell
                          key={`${column.key}-${rowIndex}`}
                          className={cn("align-top p-2 border-l border-slate-200 first:border-l-0", column.className)}
                        >
                          {renderSeverityTableCell(column.alerts[rowIndex], column.key)}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
             </Table>
          </div>
        )
      )}
    </div>
  );
}

