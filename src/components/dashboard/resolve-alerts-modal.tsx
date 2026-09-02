"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { X, CheckCircle, Loader2, Shield, Square, CheckSquare, ArrowLeft, Clock, Video, Radio, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { DriverDropdown } from "@/components/ui/driver-dropdown";

interface ResolveAlertsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onResolved: () => void;
  deviceId: string;
  fleetNumber: string;
  registration: string;
  baseUrl?: string;
  currentAlertId?: string;
  drivers?: Array<{ id: string; first_name: string; surname: string; fleet_number?: string | null; cell_number?: string | null; assigned_vehicle?: { registration_number?: string } | null }>;
  onDriverAssign?: (driverId: string, driverName: string, fleetNumber?: string) => void;
}

export function ResolveAlertsModal({
  isOpen,
  onClose,
  onResolved,
  deviceId,
  fleetNumber,
  registration,
  baseUrl = "/api/video-server",
  currentAlertId,
  drivers = [],
  onDriverAssign,
}: ResolveAlertsModalProps) {
  const [telematicsAlerts, setTelematicsAlerts] = useState<any[]>([]);
  const [videoAlerts, setVideoAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [resolving, setResolving] = useState(false);
  const [resolvingIds, setResolvingIds] = useState<Set<string>>(new Set());
  const [selectedDriverId, setSelectedDriverId] = useState<string>("");
  const [selectedDriverName, setSelectedDriverName] = useState<string>("");
  const [notesMap, setNotesMap] = useState<Record<string, string>>({});
  const fetchActiveRef = useRef(0);

  const alertTypeName = (type: string) => {
    const map: Record<string, string> = {
      exceptionEvent: "Exception Event", zoneBreach: "Zone Breach", speeding: "Speeding",
      harshDriving: "Harsh Driving", seatBelt: "Seat Belt", closeProximity: "Close Proximity",
      laneShift: "Lane Shift", occlusion: "Occlusion", tow: "Tow", idle: "Idle",
      forwardCollisionWarning: "Forward Collision", highRiskZoneEntry: "High Risk Zone Entry",
    };
    return map[type] || type?.replace(/([A-Z])/g, " $1").replace(/_/g, " ")?.trim() || "Alert";
  };

  const allAlerts = useMemo(() => {
    const merged: any[] = [];

    telematicsAlerts.forEach((a) => {
      merged.push({
        ...a,
        _resolveId: a.last_alert_id || String(a.id),
        _source: "telematics",
        _key: `tel-${a.group_key || a.id}`,
        _displayName: a.alarm_text || a.alarm_type || "Alert",
        _typeName: alertTypeName(a.alarm_type),
        _vehicleName: a.device_name || "",
        _count: a.count || 1,
        _timestamp: a.last_alert_ts || a.updated_at || a.created_at,
        _severity: a.severity || "medium",
      });
    });

    videoAlerts.forEach((a) => {
      merged.push({
        ...a,
        _resolveId: String(a.id),
        _source: "video",
        _key: `vid-${a.id}`,
        _displayName: a.title || a.alert_type || "Alert",
        _typeName: alertTypeName(a.alert_type),
        _vehicleName: a.vehicle_registration || "",
        _count: a.count || 1,
        _timestamp: a.last_occurrence || a.timestamp || a.created_at,
        _severity: a.severity || "medium",
      });
    });

    return merged.sort((a, b) => new Date(b._timestamp || 0).getTime() - new Date(a._timestamp || 0).getTime());
  }, [telematicsAlerts, videoAlerts]);

  const groupBySource = useMemo(() => {
    const groups: Record<string, any[]> = {};
    allAlerts.forEach((alert) => {
      const src = alert._source || "other";
      if (!groups[src]) groups[src] = [];
      groups[src].push(alert);
    });
    return groups;
  }, [allAlerts]);

  const fetchAlerts = useCallback(async () => {
    if (!deviceId && !fleetNumber && !registration) return;
    const fetchId = ++fetchActiveRef.current;
    setLoading(true);
    try {
      const fetchTelematics = async () => {
        try {
          const params = new URLSearchParams();
          if (fleetNumber) params.set('fleet', fleetNumber);
          if (registration) params.set('fleet', registration);
          const res = await fetch(`${baseUrl}/telematics/vehicle-alerts/${encodeURIComponent(deviceId || 'none')}?${params.toString()}`, {
            cache: "no-store",
            signal: AbortSignal.timeout(20000),
          });
          const data = await res.json();
          return Array.isArray(data?.alerts) ? data.alerts : [];
        } catch { return []; }
      };

      const fetchVideo = async () => {
        try {
          const res = await fetch(`${baseUrl}/eps/alerts/active?limit=2000`, {
            cache: "no-store",
            signal: AbortSignal.timeout(20000),
          });
          let json: any;
          const contentType = res.headers.get("content-type") || "";
          const text = await res.text();
          if (contentType.toLowerCase().includes("application/json") && text) {
            try { json = JSON.parse(text); } catch { return []; }
          } else { return []; }

          const all: any[] = Array.isArray(json?.alerts)
            ? json.alerts
            : Array.isArray(json?.data?.alerts)
              ? json.data.alerts
              : Array.isArray(json?.data)
                ? json.data
                : [];

          const deviceNorm = deviceId?.trim().toLowerCase();
          const fleetNorm = fleetNumber?.trim().toLowerCase();
          const regNorm = registration?.trim().toLowerCase();

          return all.filter((a: any) => {
            const aSource = String(a?.source_type || a?.source || "").trim().toLowerCase();
            if (aSource !== "video") return false;
            const aDevice = String(a.device_id || a.vehicleId || a.deviceId || "").trim().toLowerCase();
            const aFleet = String(a.fleet_number || a.fleetNumber || "").trim().toLowerCase();
            const aReg = String(a.vehicle_registration || a.plate || a.registration || "").trim().toLowerCase();
            if (deviceNorm && aDevice && aDevice === deviceNorm) return true;
            if (fleetNorm && aFleet && aFleet === fleetNorm) return true;
            if (fleetNorm && aFleet && aFleet.includes(fleetNorm)) return true;
            if (regNorm && aReg && aReg.includes(regNorm)) return true;
            if (fleetNorm && aFleet && fleetNorm.includes(aFleet)) return true;
            return false;
          });
        } catch { return []; }
      };

      const [tel, vid] = await Promise.all([fetchTelematics(), fetchVideo()]);
      if (fetchId !== fetchActiveRef.current) return;
      setTelematicsAlerts(tel);
      setVideoAlerts(vid);

      const allKeys = [
        ...tel.map((a: any) => `tel-${a.group_key || a.id}`),
        ...vid.map((a: any) => `vid-${a.id}`),
      ];
      setSelectedIds(new Set(allKeys));
    } catch {
      if (fetchId !== fetchActiveRef.current) return;
      setTelematicsAlerts([]);
      setVideoAlerts([]);
    } finally {
      if (fetchId === fetchActiveRef.current) setLoading(false);
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
      if (prev.size === allAlerts.length) return new Set();
      return new Set(allAlerts.map((a) => a._key));
    });
  }, [allAlerts]);

  const resolveBulk = useCallback(async (ids: string[], alertKeys: string[]) => {
    let resolved = 0;
    for (let i = 0; i < ids.length; i++) {
      const id = ids[i];
      const key = alertKeys[i] || id;
      const note = notesMap[key] || "Bulk resolved from resolve modal";
      try {
        const res = await fetch(`${baseUrl}/alerts/${encodeURIComponent(id)}/close`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-internal-key": "srs-internal-2026" },
          body: JSON.stringify({ closureType: "resolved", notes: note, userId: "dashboard_user" }),
        });
        const data = await res.json();
        if (data.success) resolved++;
      } catch { /* skip */ }
    }
    return resolved;
  }, [baseUrl, notesMap]);

  const handleResolveSelected = useCallback(async () => {
    if (selectedIds.size === 0) { toast.warning("No alerts selected"); return; }
    setResolving(true);
    const toResolve = allAlerts.filter((a) => selectedIds.has(a._key));
    const ids = toResolve.map((a) => a._resolveId).filter(Boolean);
    const keys = toResolve.map((a) => a._key);

    const resolved = await resolveBulk(ids, keys);

    setResolving(false);
    setResolvingIds(new Set());
    if (resolved > 0) {
      toast.success(`${resolved} alert${resolved !== 1 ? "s" : ""} resolved`);
      onResolved();
    } else {
      toast.error("Failed to resolve alerts");
    }
  }, [selectedIds, allAlerts, resolveBulk, onResolved]);

  const handleResolveAll = useCallback(async () => {
    if (allAlerts.length === 0) return;
    setResolving(true);
    const ids = allAlerts.map((a) => a._resolveId).filter(Boolean);
    const keys = allAlerts.map((a) => a._key);

    const resolved = await resolveBulk(ids, keys);

    setResolving(false);
    setResolvingIds(new Set());
    if (resolved > 0) {
      toast.success(`${resolved} alert${resolved !== 1 ? "s" : ""} resolved`);
      onResolved();
    } else {
      toast.error("Failed to resolve alerts");
    }
  }, [allAlerts, resolveBulk, onResolved]);

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


  if (!isOpen) return null;

  const allSelected = selectedIds.size === allAlerts.length && allAlerts.length > 0;
  const someSelected = selectedIds.size > 0 && selectedIds.size < allAlerts.length;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="flex w-full max-w-2xl max-h-[85vh] flex-col rounded-2xl border border-slate-300 bg-white shadow-2xl">
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
            <button className="flex items-center gap-1.5 text-xs text-slate-600 hover:text-slate-900" onClick={toggleSelectAll}>
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
              {selectedIds.size} of {allAlerts.length} selected
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" className="h-7 bg-emerald-600 px-3 text-xs text-white hover:bg-emerald-700"
              disabled={resolving || selectedIds.size === 0} onClick={handleResolveSelected}>
              {resolving ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <CheckCircle className="w-3 h-3 mr-1" />}
              Resolve Selected ({selectedIds.size})
            </Button>
            <Button size="sm" className="h-7 bg-red-600 px-3 text-xs text-white hover:bg-red-700"
              disabled={resolving || allAlerts.length === 0} onClick={handleResolveAll}>
              {resolving ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Shield className="w-3 h-3 mr-1" />}
              Resolve All ({allAlerts.length})
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
          ) : allAlerts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <CheckCircle className="w-10 h-10 text-emerald-400 mb-3" />
              <p className="text-sm font-medium text-slate-700">No active alerts</p>
              <p className="text-xs text-slate-500 mt-1">All alerts for this vehicle have been resolved.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {Object.entries(groupBySource).map(([source, sourceAlerts]) => (
                <div key={`group-${source}`}>
                  <div className="flex items-center gap-2 mb-1.5 px-1">
                    {source === "video" ? (
                      <Video className="w-3 h-3 text-purple-600" />
                    ) : (
                      <Radio className="w-3 h-3 text-blue-600" />
                    )}
                    <Badge variant="outline" className={cn(
                      "text-[10px] px-1.5 py-0 font-semibold uppercase",
                      source === "video" ? "border-purple-300 text-purple-700" : "border-blue-300 text-blue-700"
                    )}>
                      {source}
                    </Badge>
                    <span className="text-[10px] text-slate-400">{sourceAlerts.length} alert{sourceAlerts.length !== 1 ? "s" : ""}</span>
                  </div>
                  <div className="space-y-1">
                    {sourceAlerts.map((alert: any) => {
                      const isSelected = selectedIds.has(alert._key);
                      const isResolvingThis = resolvingIds.has(alert._key);
                      const isCurrent = String(alert._resolveId) === String(currentAlertId);
                      return (
                        <Card
                          key={alert._key}
                          className={cn(
                            "flex items-start gap-2.5 px-3 py-2 transition-all cursor-pointer",
                            isCurrent ? "border-emerald-400 bg-emerald-50/80 ring-2 ring-emerald-300 shadow-sm" : isSelected ? "border-blue-300 bg-blue-50/50 ring-1 ring-blue-200" : "border-slate-200 bg-white hover:bg-slate-50",
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
                              {isCurrent && <Star className="w-3 h-3 text-emerald-600 fill-emerald-500" />}
                              {isCurrent && <span className="text-[9px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">ACTIVE</span>}
                              <span className="text-[11px] font-semibold text-slate-900">{alert._displayName}</span>
                              <Badge className={cn("text-[9px] px-1 py-0 border", severityColor(alert._severity))}>
                                {alert._severity?.toUpperCase()}
                              </Badge>
                              {alert._count > 1 && (
                                <Badge variant="outline" className="text-[9px] px-1 py-0 text-orange-600 border-orange-300">
                                  {alert._count}x
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-3 mt-0.5 text-[10px] text-slate-500">
                              <span className="font-medium text-slate-600">{alert._typeName}</span>
                              {alert._vehicleName && <span>{alert._vehicleName}</span>}
                              {alert._timestamp && (
                                <span className="flex items-center gap-0.5">
                                  <Clock className="w-2.5 h-2.5" />
                                  {formatTimestamp(alert._timestamp)}
                                </span>
                              )}
                            </div>
                          </div>
                        </Card>
                        {isSelected && (
                          <div className="ml-7 mt-1">
                            <textarea
                              className="w-full rounded border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-700 placeholder:text-slate-400 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400 resize-none"
                              rows={2}
                              placeholder="Add a note for this alert (optional)..."
                              value={notesMap[alert._key] || ""}
                              onChange={(e) => setNotesMap((prev) => ({ ...prev, [alert._key]: e.target.value }))}
                              onClick={(e) => e.stopPropagation()}
                            />
                          </div>
                        )}
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-4 py-2.5">
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-500">Assign Driver:</span>
            <div className="w-48">
              <DriverDropdown
                value={selectedDriverId}
                onChange={(driverId: string) => {
                  setSelectedDriverId(driverId);
                  const driver = drivers.find(d => d.id === driverId);
                  if (driver) {
                    const name = `${driver.first_name} ${driver.surname}`.trim();
                    setSelectedDriverName(name);
                    if (onDriverAssign) onDriverAssign(driverId, name, driver.fleet_number || undefined);
                  }
                }}
                drivers={drivers as any}
                placeholder="Select driver (optional)"
                onOpen={() => {}}
              />
            </div>
          </div>
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={onClose}>Close</Button>
        </div>
      </div>
    </div>
  );
}
