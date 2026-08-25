"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { X, CheckCircle, AlertTriangle, Loader2, Shield, Square, CheckSquare, ArrowLeft, Clock, Video, Radio } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface ResolveAlertsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onResolved: () => void;
  deviceId: string;
  fleetNumber: string;
  registration: string;
  baseUrl?: string;
}

export function ResolveAlertsModal({
  isOpen,
  onClose,
  onResolved,
  deviceId,
  fleetNumber,
  registration,
  baseUrl = "/api/video-server",
}: ResolveAlertsModalProps) {
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [resolving, setResolving] = useState(false);
  const [resolvingIds, setResolvingIds] = useState<Set<string>>(new Set());

  const alertsWithKeys = useMemo(() => {
    return alerts.map((alert: any, index: number) => ({
      ...alert,
      _key: String(alert.group_id || alert.id || alert.last_alert_id || `alert-${index}`),
    }));
  }, [alerts]);

  const groupByType = useMemo(() => {
    const groups: Record<string, any[]> = {};
    alertsWithKeys.forEach((alert: any) => {
      const type = alert.source_type || "other";
      if (!groups[type]) groups[type] = [];
      groups[type].push(alert);
    });
    return groups;
  }, [alertsWithKeys]);

  const fetchAlerts = useCallback(async () => {
    if (!deviceId && !fleetNumber && !registration) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (fleetNumber) params.set('fleet', fleetNumber);
      if (registration) params.set('fleet', registration);
      const res = await fetch(`${baseUrl}/telematics/vehicle-alerts/${encodeURIComponent(deviceId || 'none')}?${params.toString()}`, {
        cache: "no-store",
        signal: AbortSignal.timeout(10000),
      });
      const data = await res.json();
      const groups = Array.isArray(data?.alerts) ? data.alerts : [];
      setAlerts(groups);
      setSelectedIds(new Set(groups.map((a: any, i: number) => String(a.group_id || a.id || a.last_alert_id || `alert-${i}`))));
    } catch {
      setAlerts([]);
    } finally {
      setLoading(false);
    }
  }, [deviceId, fleetNumber, registration, baseUrl]);

  useEffect(() => {
    if (isOpen && (deviceId || fleetNumber || registration)) {
      setSelectedIds(new Set());
      fetchAlerts();
    }
  }, [isOpen, deviceId, fleetNumber, registration, fetchAlerts]);

  const toggleSelect = useCallback((key: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    setSelectedIds((prev) => {
      if (prev.size === alertsWithKeys.length) return new Set();
      return new Set(alertsWithKeys.map((a) => a._key));
    });
  }, [alertsWithKeys]);

  const resolveAlert = useCallback(
    async (alertKey: string) => {
      setResolvingIds((prev) => new Set(prev).add(alertKey));
      try {
        const res = await fetch(`${baseUrl}/alerts/${encodeURIComponent(alertKey)}/close`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-internal-key": "srs-internal-2026" },
          body: JSON.stringify({ closureType: "resolved", notes: "Bulk resolved from resolve modal" }),
        });
        const data = await res.json();
        return data.success === true;
      } catch {
        return false;
      } finally {
        setResolvingIds((prev) => {
          const next = new Set(prev);
          next.delete(alertKey);
          return next;
        });
      }
    },
    [baseUrl]
  );

  const handleResolveSelected = useCallback(async () => {
    if (selectedIds.size === 0) {
      toast.warning("No alerts selected");
      return;
    }
    setResolving(true);
    let resolved = 0;
    let failed = 0;
    const ids = Array.from(selectedIds);

    for (let i = 0; i < ids.length; i += 5) {
      const batch = ids.slice(i, i + 5);
      const results = await Promise.all(batch.map((id) => resolveAlert(id)));
      resolved += results.filter(Boolean).length;
      failed += results.filter((r) => !r).length;
    }

    setResolving(false);
    if (resolved > 0) {
      toast.success(`${resolved} alert${resolved !== 1 ? "s" : ""} resolved${failed > 0 ? ` (${failed} failed)` : ""}`);
      setSelectedIds(new Set());
      onResolved();
      fetchAlerts();
    } else {
      toast.error("Failed to resolve alerts");
    }
  }, [selectedIds, resolveAlert, onResolved, fetchAlerts]);

  const handleResolveAll = useCallback(async () => {
    if (alertsWithKeys.length === 0) return;
    setResolving(true);
    let resolved = 0;
    let failed = 0;
    const ids = alertsWithKeys.map((a) => a._key);

    for (let i = 0; i < ids.length; i += 5) {
      const batch = ids.slice(i, i + 5);
      const results = await Promise.all(batch.map((id) => resolveAlert(id)));
      resolved += results.filter(Boolean).length;
      failed += results.filter((r) => !r).length;
    }

    setResolving(false);
    if (resolved > 0) {
      toast.success(`${resolved} alert${resolved !== 1 ? "s" : ""} resolved${failed > 0 ? ` (${failed} failed)` : ""}`);
      setSelectedIds(new Set());
      onResolved();
      fetchAlerts();
    } else {
      toast.error("Failed to resolve alerts");
    }
  }, [alertsWithKeys, resolveAlert, onResolved, fetchAlerts]);

  const severityColor = (sev: string) => {
    switch (sev?.toLowerCase()) {
      case "critical": return "bg-red-100 text-red-800 border-red-300";
      case "high": return "bg-orange-100 text-orange-800 border-orange-300";
      case "medium": return "bg-yellow-100 text-yellow-800 border-yellow-300";
      case "low": return "bg-blue-100 text-blue-800 border-blue-300";
      default: return "bg-slate-100 text-slate-800 border-slate-300";
    }
  };

  const formatTimestamp = (ts: string) => {
    if (!ts) return null;
    const d = new Date(ts);
    return `${d.toLocaleDateString("en-ZA", { day: "2-digit", month: "short" })} ${d.toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" })}`;
  };

  const alertTypeName = (type: string) => {
    const map: Record<string, string> = {
      exceptionEvent: "Exception Event",
      zoneBreach: "Zone Breach",
      speeding: "Speeding",
      harshDriving: "Harsh Driving",
      seatBelt: "Seat Belt",
      closeProximity: "Close Proximity",
      laneShift: "Lane Shift",
      occlusion: "Occlusion",
      tow: "Tow",
      idle: "Idle",
    };
    return map[type] || type?.replace(/([A-Z])/g, " $1").replace(/_/g, " ")?.trim() || "Alert";
  };

  if (!isOpen) return null;

  const allSelected = selectedIds.size === alertsWithKeys.length && alertsWithKeys.length > 0;
  const someSelected = selectedIds.size > 0 && selectedIds.size < alertsWithKeys.length;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="flex w-full max-w-2xl max-h-[85vh] flex-col overflow-hidden rounded-2xl border border-slate-300 bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-gradient-to-r from-slate-950 via-slate-900 to-red-950 px-4 py-3">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" className="h-7 border-white/20 bg-white/10 px-2 text-white hover:bg-white/20 hover:text-white" onClick={onClose}>
              <ArrowLeft className="w-3.5 h-3.5" />
            </Button>
            <div>
              <h2 className="text-sm font-bold text-white">Resolve Alerts</h2>
              <p className="text-[11px] text-white/70">
                {fleetNumber || registration ? `${fleetNumber || "—"} ${registration ? `(${registration})` : ""}` : deviceId}
              </p>
            </div>
          </div>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-white/70 hover:text-white" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Toolbar */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-2">
          <div className="flex items-center gap-2">
            <button
              className="flex items-center gap-1.5 text-xs text-slate-600 hover:text-slate-900"
              onClick={toggleSelectAll}
            >
              {allSelected ? (
                <CheckSquare className="w-4 h-4 text-blue-600" />
              ) : someSelected ? (
                <div className="relative flex h-4 w-4 items-center justify-center">
                  <Square className="w-4 h-4 text-slate-400 absolute" />
                  <div className="h-2 w-2 bg-blue-600 rounded-sm" />
                </div>
              ) : (
                <Square className="w-4 h-4 text-slate-400" />
              )}
              {allSelected ? "Deselect All" : "Select All"}
            </button>
            <span className="text-[11px] text-slate-400">|</span>
            <span className="text-[11px] text-slate-500">
              {selectedIds.size} of {alertsWithKeys.length} selected
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              className="h-7 bg-emerald-600 px-3 text-xs text-white hover:bg-emerald-700"
              disabled={resolving || selectedIds.size === 0}
              onClick={handleResolveSelected}
            >
              {resolving ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <CheckCircle className="w-3 h-3 mr-1" />}
              Resolve Selected ({selectedIds.size})
            </Button>
            <Button
              size="sm"
              className="h-7 bg-red-600 px-3 text-xs text-white hover:bg-red-700"
              disabled={resolving || alertsWithKeys.length === 0}
              onClick={handleResolveAll}
            >
              {resolving ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Shield className="w-3 h-3 mr-1" />}
              Resolve All ({alertsWithKeys.length})
            </Button>
          </div>
        </div>

        {/* Alert List */}
        <div className="flex-1 overflow-y-auto p-3 min-h-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
              <span className="ml-2 text-sm text-slate-500">Loading alerts...</span>
            </div>
          ) : alertsWithKeys.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <CheckCircle className="w-10 h-10 text-emerald-400 mb-3" />
              <p className="text-sm font-medium text-slate-700">No active alerts</p>
              <p className="text-xs text-slate-500 mt-1">All alerts for this vehicle have been resolved.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {Object.entries(groupByType).map(([type, typeAlerts]) => (
                <div key={`group-${type}`}>
                  <div className="flex items-center gap-2 mb-1.5 px-1">
                    <div className="flex items-center gap-1">
                      {type === "video" ? (
                        <Video className="w-3 h-3 text-purple-600" />
                      ) : (
                        <Radio className="w-3 h-3 text-blue-600" />
                      )}
                      <Badge variant="outline" className={cn(
                        "text-[10px] px-1.5 py-0 font-semibold uppercase",
                        type === "video" ? "border-purple-300 text-purple-700" : "border-blue-300 text-blue-700"
                      )}>
                        {type}
                      </Badge>
                    </div>
                    <span className="text-[10px] text-slate-400">{typeAlerts.length} alert{typeAlerts.length !== 1 ? "s" : ""}</span>
                  </div>
                  <div className="space-y-1">
                    {typeAlerts.map((alert: any) => {
                      const isSelected = selectedIds.has(alert._key);
                      const isResolvingThis = resolvingIds.has(alert._key);
                      return (
                        <Card
                          key={alert._key}
                          className={cn(
                            "flex items-start gap-2.5 px-3 py-2 transition-all cursor-pointer",
                            isSelected ? "border-blue-300 bg-blue-50/50 ring-1 ring-blue-200" : "border-slate-200 bg-white hover:bg-slate-50",
                            isResolvingThis && "opacity-60"
                          )}
                          onClick={() => !isResolvingThis && toggleSelect(alert._key)}
                        >
                          <div className="mt-0.5 flex-shrink-0">
                            {isResolvingThis ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
                            ) : isSelected ? (
                              <CheckSquare className="w-3.5 h-3.5 text-blue-600" />
                            ) : (
                              <Square className="w-3.5 h-3.5 text-slate-300" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-[11px] font-semibold text-slate-900">
                                {alert.alarm_text || alertTypeName(alert.alarm_type || alert.alert_type || "alert")}
                              </span>
                              <Badge className={cn("text-[9px] px-1 py-0 border", severityColor(alert.severity || "medium"))}>
                                {(alert.severity || "medium").toUpperCase()}
                              </Badge>
                              {alert.count > 1 && (
                                <Badge variant="outline" className="text-[9px] px-1 py-0 text-orange-600 border-orange-300">
                                  {alert.count}x
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-3 mt-0.5 text-[10px] text-slate-500">
                              <span className="font-medium text-slate-600">{alertTypeName(alert.alarm_type || alert.alert_type)}</span>
                              {alert.device_name && <span>{alert.device_name}</span>}
                              {alert.last_alert_ts && (
                                <span className="flex items-center gap-0.5">
                                  <Clock className="w-2.5 h-2.5" />
                                  {formatTimestamp(alert.last_alert_ts)}
                                </span>
                              )}
                            </div>
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end border-t border-slate-200 bg-slate-50 px-4 py-2.5">
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
