"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { X, CheckCircle, AlertTriangle, Loader2, Shield, Check, Square, CheckSquare, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface AlertGroup {
  group_id: string;
  source_type: "telematics" | "video";
  severity: string;
  alert_type: string;
  first_seen: string;
  last_seen: string;
  unresolved_count: number;
  group_key: string;
}

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
  const [alerts, setAlerts] = useState<AlertGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [resolving, setResolving] = useState(false);
  const [resolvingIds, setResolvingIds] = useState<Set<string>>(new Set());

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
      // Auto-select all on load
      setSelectedIds(new Set(groups.map((a: AlertGroup) => a.group_id)));
    } catch {
      setAlerts([]);
    } finally {
      setLoading(false);
    }
  }, [deviceId, baseUrl]);

  useEffect(() => {
    if (isOpen && deviceId) {
      setSelectedIds(new Set());
      fetchAlerts();
    }
  }, [isOpen, deviceId, fetchAlerts]);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    setSelectedIds((prev) => {
      if (prev.size === alerts.length) return new Set();
      return new Set(alerts.map((a) => a.group_id));
    });
  }, [alerts]);

  const resolveAlert = useCallback(
    async (groupId: string) => {
      setResolvingIds((prev) => new Set(prev).add(groupId));
      try {
        const res = await fetch(`${baseUrl}/alerts/${encodeURIComponent(groupId)}/close`, {
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
          next.delete(groupId);
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

    // Resolve in parallel batches of 5
    for (let i = 0; i < ids.length; i += 5) {
      const batch = ids.slice(i, i + 5);
      const results = await Promise.all(batch.map((id) => resolveAlert(id)));
      resolved += results.filter(Boolean).length;
      failed += results.filter((r) => !r).length;
    }

    setResolving(false);
    if (resolved > 0) {
      toast.success(`${resolved} alert${resolved !== 1 ? "s" : ""} resolved${failed > 0 ? ` (${failed} failed)` : ""}`);
      onResolved();
      fetchAlerts();
    } else {
      toast.error("Failed to resolve alerts");
    }
  }, [selectedIds, resolveAlert, onResolved, fetchAlerts]);

  const handleResolveAll = useCallback(async () => {
    if (alerts.length === 0) return;
    setResolving(true);
    let resolved = 0;
    let failed = 0;
    const ids = alerts.map((a) => a.group_id);

    for (let i = 0; i < ids.length; i += 5) {
      const batch = ids.slice(i, i + 5);
      const results = await Promise.all(batch.map((id) => resolveAlert(id)));
      resolved += results.filter(Boolean).length;
      failed += results.filter((r) => !r).length;
    }

    setResolving(false);
    if (resolved > 0) {
      toast.success(`${resolved} alert${resolved !== 1 ? "s" : ""} resolved${failed > 0 ? ` (${failed} failed)` : ""}`);
      onResolved();
      fetchAlerts();
    } else {
      toast.error("Failed to resolve alerts");
    }
  }, [alerts, resolveAlert, onResolved, fetchAlerts]);

  const severityColor = (sev: string) => {
    switch (sev?.toLowerCase()) {
      case "critical": return "bg-red-100 text-red-800 border-red-300";
      case "high": return "bg-orange-100 text-orange-800 border-orange-300";
      case "medium": return "bg-yellow-100 text-yellow-800 border-yellow-300";
      case "low": return "bg-blue-100 text-blue-800 border-blue-300";
      default: return "bg-slate-100 text-slate-800 border-slate-300";
    }
  };

  if (!isOpen) return null;

  const allSelected = selectedIds.size === alerts.length && alerts.length > 0;
  const someSelected = selectedIds.size > 0 && selectedIds.size < alerts.length;

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
              {selectedIds.size} of {alerts.length} selected
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
              disabled={resolving || alerts.length === 0}
              onClick={handleResolveAll}
            >
              {resolving ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Shield className="w-3 h-3 mr-1" />}
              Resolve All ({alerts.length})
            </Button>
          </div>
        </div>

        {/* Alert List */}
        <div className="flex-1 overflow-y-auto p-3">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
              <span className="ml-2 text-sm text-slate-500">Loading alerts...</span>
            </div>
          ) : alerts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <CheckCircle className="w-10 h-10 text-emerald-400 mb-3" />
              <p className="text-sm font-medium text-slate-700">No active alerts</p>
              <p className="text-xs text-slate-500 mt-1">All alerts for this vehicle have been resolved.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {alerts.map((alert) => {
                const isSelected = selectedIds.has(alert.group_id);
                const isResolvingThis = resolvingIds.has(alert.group_id);
                return (
                  <Card
                    key={alert.group_id}
                    className={cn(
                      "flex items-start gap-3 p-3 transition-all cursor-pointer",
                      isSelected ? "border-blue-300 bg-blue-50/50 ring-1 ring-blue-200" : "border-slate-200 bg-white hover:bg-slate-50",
                      isResolvingThis && "opacity-60"
                    )}
                    onClick={() => !isResolvingThis && toggleSelect(alert.group_id)}
                  >
                    <div className="mt-0.5 flex-shrink-0">
                      {isResolvingThis ? (
                        <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                      ) : isSelected ? (
                        <CheckSquare className="w-4 h-4 text-blue-600" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-300" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge className={cn("text-[10px] px-1.5 py-0 border", severityColor(alert.severity))}>
                          <AlertTriangle className="w-2.5 h-2.5 mr-0.5" />
                          {alert.severity?.toUpperCase()}
                        </Badge>
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                          {alert.source_type}
                        </Badge>
                        {alert.unresolved_count > 1 && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-orange-600 border-orange-300">
                            {alert.unresolved_count}×
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs font-medium text-slate-800 truncate">
                        {alert.alert_type?.replace(/_/g, " ")}
                      </p>
                      <div className="flex items-center gap-3 mt-1 text-[10px] text-slate-500">
                        <span>First: {alert.first_seen ? new Date(alert.first_seen).toLocaleString() : "—"}</span>
                        <span>Last: {alert.last_seen ? new Date(alert.last_seen).toLocaleString() : "—"}</span>
                      </div>
                    </div>
                  </Card>
                );
              })}
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
