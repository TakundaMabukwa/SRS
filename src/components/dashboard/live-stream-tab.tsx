"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import FLVPlayer from "@/components/video/FLVPlayer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Video,
  Search,
  Grid3x3,
  List,
  RefreshCw,
  Activity,
  RadioTower,
  Shield,
  MonitorPlay,
  Wifi,
  WifiOff,
  PictureInPicture2,
  X,
  Camera,
  Loader2,
  Play,
  StopCircle,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { createPortal } from "react-dom";

type DbVehicle = {
  registration_number: string;
  fleet_number: string;
  cost_center: string;
  camera_sim_id: string;
};

type ChannelStream = {
  channelId: number;
  streamUrl: string | null;
  success: boolean;
  message?: string;
};

type ActiveVehicleStreams = {
  registration: string;
  fleetNumber: string;
  deviceId: string;
  channels: ChannelStream[];
};

type PinnedFeed = {
  deviceId: string;
  channel: number;
  vehicleName: string;
};

type StreamEntry = {
  id: string;
  deviceId: string;
  channel: number;
  vehicleName: string;
  streamUrl: string;
};

type LiveStreamTabProps = {
  selectedCostCenters?: string[];
};

const EPS_API = "/api/video-server";

function matchesCostCenterFilter(costCenter: string, selectedCostCenters: Set<string>) {
  if (selectedCostCenters.size === 0) return true;
  const normalized = String(costCenter || "").trim().toLowerCase().replace(/\s+/g, " ");
  if (!normalized) return selectedCostCenters.has("unassigned");
  return selectedCostCenters.has(normalized);
}

export default function LiveStreamTab({ selectedCostCenters = [] }: LiveStreamTabProps) {
  const supabase = createClient();
  const [vehicles, setVehicles] = useState<{ registration: string; fleetNumber: string; costCenter: string; deviceId: string | null; online: boolean }[]>([]);
  const [selectedDevices, setSelectedDevices] = useState<Set<string>>(new Set());
  const [activeStreams, setActiveStreams] = useState<Map<string, ActiveVehicleStreams>>(new Map());
  const [streamingChannels, setStreamingChannels] = useState<Map<string, ChannelStream[]>>(new Map());
  const [searchTerm, setSearchTerm] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [gridColumns, setGridColumns] = useState(4);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [streamLoading, setStreamLoading] = useState<Set<string>>(new Set());
  const [pinnedFeed, setPinnedFeed] = useState<PinnedFeed | null>(null);
  const [pipPosition, setPipPosition] = useState({ x: 24, y: 96 });
  const [isDraggingPip, setIsDraggingPip] = useState(false);
  const [viewportW, setViewportW] = useState(1200);
  const pipDragOffsetRef = useRef({ x: 0, y: 0 });
  const dbVehiclesRef = useRef<DbVehicle[] | null>(null);

  const fetchDbOnce = useCallback(async () => {
    if (dbVehiclesRef.current) return dbVehiclesRef.current;
    try {
      const { data } = await supabase
        .from("vehiclesc")
        .select("registration_number, fleet_number, cost_center, camera_sim_id");
      const rows = (data || []) as DbVehicle[];
      const unique = new Map<string, DbVehicle>();
      for (const r of rows) {
        const reg = (r.registration_number || "").trim().toUpperCase();
        if (!reg) continue;
        if (!unique.has(reg)) {
          unique.set(reg, { registration_number: reg, fleet_number: r.fleet_number || "", cost_center: r.cost_center || "", camera_sim_id: (r.camera_sim_id || "").trim() });
        }
      }
      dbVehiclesRef.current = Array.from(unique.values());
      return dbVehiclesRef.current;
    } catch {
      return dbVehiclesRef.current || [];
    }
  }, [supabase]);

  const loadVehicles = useCallback(async (background = false) => {
    if (!background) setLoading(true);
    else setRefreshing(true);

    try {
      const dbVehicles = await fetchDbOnce();

      const onlineRes = await fetch(`${EPS_API}/eps/stream/online`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: "{}",
        cache: "no-store", signal: AbortSignal.timeout(15000),
      }).catch(() => null);

      const regMap = new Map<string, { deviceId: string; online: boolean }>();
      if (onlineRes && onlineRes.ok) {
        const onlineData = await onlineRes.json();
        if (onlineData.success && onlineData.data?.devices) {
          for (const d of onlineData.data.devices) {
            if (!d.deviceId) continue;
            const plate = (d.plateName || "").trim();
            const parts = plate.split(" - ");
            const fleetNum = (parts[0] || "").trim();
            const regNum = (parts[1] || "").trim();
            if (fleetNum) {
              regMap.set(fleetNum.toUpperCase(), { deviceId: d.deviceId, online: d.online === true });
            }
            if (regNum) {
              regMap.set(regNum.toUpperCase(), { deviceId: d.deviceId, online: d.online === true });
            }
          }
        }
      }

      const built = dbVehicles.map((v) => {
        const fleetMatch = regMap.get((v.fleet_number || "").toUpperCase());
        const regMatch = regMap.get((v.registration_number || "").toUpperCase());
        const match = fleetMatch || regMatch;
        return {
          registration: v.registration_number,
          fleetNumber: v.fleet_number,
          costCenter: v.cost_center,
          deviceId: match ? match.deviceId : null,
          online: match ? match.online : false,
        };
      });

      setVehicles(built);
    } catch {
    } finally {
      if (!background) setLoading(false);
      else setRefreshing(false);
    }
  }, [fetchDbOnce]);

  useEffect(() => { loadVehicles(); }, [loadVehicles]);
  useEffect(() => {
    const update = () => setViewportW(window.innerWidth);
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  const selectedCostCenterSet = useMemo(
    () => new Set(selectedCostCenters.map((v) => v.trim().toLowerCase()).filter(Boolean)),
    [selectedCostCenters]
  );

  const filteredVehicles = useMemo(
    () => vehicles
      .filter((v) => matchesCostCenterFilter(v.costCenter, selectedCostCenterSet))
      .filter((v) =>
        !searchTerm ||
        v.registration.toLowerCase().includes(searchTerm.toLowerCase()) ||
        v.fleetNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (v.deviceId || "").toLowerCase().includes(searchTerm.toLowerCase())
      )
      .sort((a, b) => {
        if (a.online !== b.online) return a.online ? -1 : 1;
        return a.registration.localeCompare(b.registration);
      }),
    [vehicles, searchTerm, selectedCostCenterSet]
  );

  const startStream = async (deviceId: string) => {
    setStreamLoading((prev) => new Set(prev).add(deviceId));

    const next = new Set(selectedDevices);
    if (next.has(deviceId)) {
      next.delete(deviceId);
      setStreamingChannels(prev => { const m = new Map(prev); m.delete(deviceId); return m; });
      setSelectedDevices(next);
      setStreamLoading((prev) => { const s = new Set(prev); s.delete(deviceId); return s; });
      return;
    }

    next.add(deviceId);
    setSelectedDevices(next);

    try {
      const res = await fetch(`${EPS_API}/stream/debug/vehicle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceId }),
        cache: "no-store",
        signal: AbortSignal.timeout(30000),
      });
      const data = await res.json();
      const channels = data.data?.channels || data.channels || [];
      const parsed: ChannelStream[] = channels.map((ch: any) => ({
        channelId: ch.channelId,
        streamUrl: ch.streamUrl || null,
        success: ch.success === true,
        message: ch.message || (ch.success ? "OK" : "Offline"),
      }));
      setStreamingChannels(prev => { const m = new Map(prev); m.set(deviceId, parsed); return m; });
    } catch {
      setStreamingChannels(prev => { const m = new Map(prev); m.set(deviceId, []); return m; });
    } finally {
      setStreamLoading((prev) => { const s = new Set(prev); s.delete(deviceId); return s; });
    }
  };

  const stopStream = (deviceId: string) => {
    setSelectedDevices((prev) => {
      const next = new Set(prev);
      next.delete(deviceId);
      return next;
    });
    setStreamingChannels(prev => { const m = new Map(prev); m.delete(deviceId); return m; });
  };

  const streamEntries: StreamEntry[] = Array.from(selectedDevices).flatMap((deviceId) => {
    const vehicle = filteredVehicles.find((v) => v.deviceId === deviceId);
    if (!vehicle) return [];
    const channels = streamingChannels.get(deviceId) || [];
    return channels
      .filter((ch) => ch.success && ch.streamUrl)
      .map((ch) => ({
        id: `${deviceId}-${ch.channelId}`,
        deviceId,
        channel: ch.channelId,
        vehicleName: `${vehicle.fleetNumber} - ${vehicle.registration} Ch ${ch.channelId}`,
        streamUrl: ch.streamUrl!,
      }));
  });

  const onlineCount = useMemo(() => filteredVehicles.filter((v) => v.online).length, [filteredVehicles]);

  const renderVehicleCard = (vehicle: { registration: string; fleetNumber: string; deviceId: string | null; online: boolean }) => {
    const selected = selectedDevices.has(vehicle.deviceId || "");
    const channels = streamingChannels.get(vehicle.deviceId || "");
    const channelCount = channels?.filter(c => c.success).length || 0;
    const hasAttempted = channels !== undefined;
    const isLoading = streamLoading.has(vehicle.deviceId || "");
    const isDisabled = !vehicle.deviceId;
    const isWide = viewportW >= 1024;
    const compact = isWide && gridColumns > 4;
    const minimal = isWide && gridColumns > 6;

    return (
      <Card
        key={vehicle.registration}
        className={`overflow-hidden border transition-all ${
          selected
            ? "border-emerald-400 bg-emerald-50 shadow-md"
            : vehicle.online
              ? "border-slate-300 bg-white hover:shadow-sm"
              : "border-slate-200 bg-slate-50 opacity-75"
        }`}
      >
        <div className={minimal ? "p-1.5" : "p-3"}>
          <div className="flex items-center justify-between gap-1.5">
            <div className={`flex items-center gap-1.5 min-w-0 flex-1 ${minimal ? "" : "gap-2"}`}>
              <div className={`shrink-0 rounded-lg text-white ${minimal ? "p-1" : "p-2"} ${vehicle.online ? "bg-emerald-700" : "bg-slate-400"}`}>
                <Video className={minimal ? "h-3.5 w-3.5" : "h-5 w-5"} />
              </div>
              <div className="min-w-0 flex-1">
                <p className={`break-words font-bold leading-tight text-slate-900 ${minimal ? "text-[10px]" : "text-sm"}`}>
                  {vehicle.fleetNumber} - {vehicle.registration}
                </p>
              </div>
            </div>
            {!minimal && (
              <Badge
                variant={vehicle.online ? "default" : "outline"}
                className={`shrink-0 whitespace-nowrap ${vehicle.online ? "bg-emerald-600" : "border-slate-300 text-slate-500"}`}
              >
                {vehicle.online ? (
                  <><Wifi className="mr-1 h-3 w-3" /> Online</>
                ) : (
                  <><WifiOff className="mr-1 h-3 w-3" /> Offline</>
                )}
              </Badge>
            )}
            {minimal && (
              <div className={`shrink-0 h-2 w-2 rounded-full ${vehicle.online ? "bg-emerald-500" : "bg-slate-400"}`} />
            )}
          </div>
          {!compact && (
            <div className="mt-2.5 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 truncate text-xs text-slate-600">
                <Activity className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{selected && channelCount > 0
                  ? `${channelCount} channel(s) streaming`
                  : hasAttempted && channelCount === 0
                    ? "No streams available"
                    : isLoading
                      ? "Starting stream..."
                      : isDisabled
                        ? "Offline"
                        : "Tap to stream"}</span>
              </div>
              {selected ? (
                <Button
                  size="sm"
                  variant="destructive"
                  className="h-7 text-xs shrink-0"
                  onClick={() => stopStream(vehicle.deviceId!)}
                >
                  <StopCircle className="mr-1 h-3.5 w-3.5" />
                  Stop
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant={vehicle.online ? "default" : "outline"}
                  disabled={isDisabled || isLoading}
                  className={`h-7 text-xs shrink-0 ${
                    vehicle.online
                      ? "bg-emerald-700 hover:bg-emerald-800"
                      : "border-slate-300 text-slate-500"
                  }`}
                  onClick={() => vehicle.deviceId && startStream(vehicle.deviceId)}
                >
                  {isLoading ? (
                    <><Loader2 className="mr-1 h-3 w-3 animate-spin" /> Starting</>
                  ) : selected ? (
                    "Stop"
                  ) : (
                    <><Play className="mr-1 h-3 w-3" /> Stream</>
                  )}
                </Button>
              )}
            </div>
          )}
          {compact && (
            <div className="mt-1.5">
              {selected ? (
                <div className="flex flex-wrap gap-1">
                  {channels?.filter(c => c.success).map((ch) => (
                    <Badge key={ch.channelId} variant="secondary" className="text-[9px] px-1.5 py-0">
                      CH{ch.channelId}
                    </Badge>
                  ))}
                  <Button
                    size="sm"
                    variant="destructive"
                    className="h-5 text-[9px] px-1.5 ml-auto"
                    onClick={() => stopStream(vehicle.deviceId!)}
                  >
                    Stop
                  </Button>
                </div>
              ) : (
                <Button
                  size="sm"
                  variant={vehicle.online ? "default" : "outline"}
                  disabled={isDisabled || isLoading}
                  className={`h-6 text-[10px] w-full ${
                    vehicle.online
                      ? "bg-emerald-700 hover:bg-emerald-800"
                      : "border-slate-300 text-slate-500"
                  }`}
                  onClick={() => vehicle.deviceId && startStream(vehicle.deviceId)}
                >
                  {isLoading ? (
                    <><Loader2 className="mr-1 h-3 w-3 animate-spin" /> Starting</>
                  ) : (
                    <><Play className="mr-1 h-3 w-3" /> Stream</>
                  )}
                </Button>
              )}
            </div>
          )}
        </div>
      </Card>
    );
  };
  const renderVehicleTableSection = (title: string, sectionVehicles: typeof filteredVehicles) => {
    if (sectionVehicles.length === 0) return null;
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Camera className="h-4 w-4 text-slate-600" />
          <h4 className="text-base font-semibold text-slate-900">{title} ({sectionVehicles.length})</h4>
        </div>
        <Card className="overflow-hidden border-slate-200">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Vehicle</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Device ID</th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-slate-600">Status</th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-slate-600">Action</th>
              </tr>
            </thead>
            <tbody>
              {sectionVehicles.map((vehicle) => {
                const selected = selectedDevices.has(vehicle.deviceId || "");
                const isLoading = streamLoading.has(vehicle.deviceId || "");
                const isDisabled = !vehicle.deviceId;
                return (
                  <tr key={vehicle.registration} className="border-t hover:bg-slate-50">
                    <td className="max-w-0 px-4 py-3 font-medium text-slate-900">
                      <span className="block truncate">{vehicle.fleetNumber} - {vehicle.registration}</span>
                    </td>
                    <td className="max-w-0 px-4 py-3 font-mono text-xs text-slate-600"><span className="block truncate">{vehicle.deviceId || "N/A"}</span></td>
                    <td className="px-4 py-3 text-center">
                      <Badge
                        variant={vehicle.online ? "default" : "outline"}
                        className={vehicle.online ? "bg-emerald-600" : "border-slate-300 text-slate-500"}
                      >
                        {vehicle.online ? "Online" : "Offline"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {selected ? (
                        <Button size="sm" variant="destructive" className="h-7 text-xs" onClick={() => stopStream(vehicle.deviceId!)}>Stop</Button>
                      ) : (
                        <Button
                          size="sm"
                          variant={vehicle.online ? "default" : "outline"}
                          disabled={isDisabled || isLoading}
                          className={`h-7 text-xs ${vehicle.online ? "bg-emerald-700 hover:bg-emerald-800" : ""}`}
                          onClick={() => vehicle.deviceId && startStream(vehicle.deviceId)}
                        >
                          {isLoading ? "Starting..." : "Stream"}
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      </div>
    );
  };

  const streamGridStyle = useMemo(() => {
    const gap = 16;
    const minCardWidth = streamEntries.length <= 2 ? 400 : Math.max(280, Math.floor(viewportW / Math.min(streamEntries.length, gridColumns)));
    return { gridTemplateColumns: `repeat(auto-fill, minmax(${minCardWidth}px, 1fr))`, gap: `${gap}px` } as React.CSSProperties;
  }, [streamEntries.length, gridColumns, viewportW]);

  const gridStyle = useMemo(() => {
    const gap = 12;
    const containerPad = 48;
    const minCardWidth = Math.max(160, Math.floor((viewportW - containerPad - gap) / gridColumns));
    return { gridTemplateColumns: `repeat(auto-fill, minmax(${minCardWidth}px, 1fr))`, gap: `${gap}px` } as React.CSSProperties;
  }, [gridColumns, viewportW]);

  useEffect(() => {
    if (!isDraggingPip) return;
    const onMouseMove = (event: MouseEvent) => {
      const nextX = event.clientX - pipDragOffsetRef.current.x;
      const nextY = event.clientY - pipDragOffsetRef.current.y;
      const maxX = Math.max(0, window.innerWidth - 430);
      const maxY = Math.max(0, window.innerHeight - 120);
      setPipPosition({
        x: Math.min(Math.max(0, nextX), maxX),
        y: Math.min(Math.max(0, nextY), maxY),
      });
    };
    const onMouseUp = () => setIsDraggingPip(false);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => { window.removeEventListener("mousemove", onMouseMove); window.removeEventListener("mouseup", onMouseUp); };
  }, [isDraggingPip]);

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden border-slate-800 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-800 text-slate-100 shadow-xl">
        <div className="p-6 md:p-7">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300">
                <Shield className="h-3.5 w-3.5" />
                Vehicle Live Streaming
              </div>
              <h2 className="mt-3 text-3xl font-bold tracking-tight">Live Stream Control Room</h2>
              <p className="mt-1 text-sm text-slate-300">
                Stream live cameras from all available vehicles.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              <div className="rounded-lg border border-slate-700 bg-slate-900/70 px-4 py-3">
                <p className="text-[11px] uppercase tracking-wide text-slate-400">Total Vehicles</p>
                <p className="mt-1 text-2xl font-bold text-emerald-300">{filteredVehicles.length}</p>
              </div>
              <div className="rounded-lg border border-slate-700 bg-slate-900/70 px-4 py-3">
                <p className="text-[11px] uppercase tracking-wide text-slate-400">Online</p>
                <p className="mt-1 text-2xl font-bold text-cyan-300">{onlineCount}</p>
              </div>
              <div className="col-span-2 rounded-lg border border-slate-700 bg-slate-900/70 px-4 py-3 md:col-span-1">
                <p className="text-[11px] uppercase tracking-wide text-slate-400">Streaming</p>
                <p className="mt-1 text-2xl font-bold text-amber-300">{selectedDevices.size}</p>
              </div>
            </div>
          </div>
        </div>
      </Card>

      <Card className="border-slate-200 bg-white/90 p-4 shadow-sm backdrop-blur">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full lg:max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Search by registration, fleet or device ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-10 border-slate-300 bg-white pl-9"
            />
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {viewMode === "grid" && (
              <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-300 bg-white p-1">
                {[1, 2, 3, 4, 5, 6, 7, 8].map((cols) => (
                  <Button
                    key={cols}
                    variant={gridColumns === cols ? "default" : "outline"}
                    size="sm"
                    className={gridColumns === cols ? "bg-slate-900 text-white hover:bg-slate-800" : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"}
                    onClick={() => setGridColumns(cols)}
                  >
                    {cols}x{cols}
                  </Button>
                ))}
              </div>
            )}
            <Button
              variant="outline"
              size="icon"
              onClick={() => loadVehicles(true)}
              title="Refresh vehicles"
              className="border-slate-300"
              disabled={refreshing}
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            </Button>
            <div className="rounded-lg border border-slate-300 bg-white p-1">
              <Button
                variant={viewMode === "grid" ? "default" : "ghost"}
                size="icon"
                onClick={() => setViewMode("grid")}
                className={viewMode === "grid" ? "bg-slate-900 hover:bg-slate-800" : ""}
              >
                <Grid3x3 className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === "list" ? "default" : "ghost"}
                size="icon"
                onClick={() => setViewMode("list")}
                className={viewMode === "list" ? "bg-slate-900 hover:bg-slate-800" : ""}
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {selectedDevices.size > 0 && streamEntries.length > 0 && (
        <Card className="border-slate-200 bg-slate-950 p-4 shadow-lg">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2 text-slate-100">
              <MonitorPlay className="h-5 w-5 text-emerald-400" />
              <h3 className="text-lg font-semibold">Active Stream Wall</h3>
            </div>
            <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">
              {selectedDevices.size} vehicle(s) · {streamEntries.length} stream(s)
            </Badge>
          </div>
          <div className="grid" style={streamGridStyle}>
            {streamEntries
              .filter((e) => !pinnedFeed || e.id !== `${pinnedFeed.deviceId}-${pinnedFeed.channel}`)
              .map((entry) => (
              <div key={entry.id} className="relative overflow-hidden rounded-lg border border-slate-800 bg-slate-900">
                <div className="absolute bottom-2 right-2 z-20">
                  <Button
                    size="sm"
                    className="h-7 border border-cyan-400/40 bg-slate-950/80 px-2 text-[11px] text-cyan-300 hover:bg-slate-800"
                    variant="outline"
                    onClick={() => setPinnedFeed({ deviceId: entry.deviceId, channel: entry.channel, vehicleName: entry.vehicleName })}
                    title="Pin to PiP"
                  >
                    <PictureInPicture2 className="mr-1 h-3.5 w-3.5" />
                    PiP
                  </Button>
                </div>
                <FLVPlayer
                  streamUrl={entry.streamUrl}
                  channel={entry.channel}
                  vehicleName={entry.vehicleName}
                  onStop={() => stopStream(entry.deviceId)}
                />
              </div>
            ))}
          </div>
        </Card>
      )}

      {typeof document !== "undefined" && pinnedFeed && (() => {
        const entry = streamEntries.find(e => e.deviceId === pinnedFeed.deviceId && e.channel === pinnedFeed.channel);
        return entry ? createPortal(
          <div
            className="fixed z-[9999] min-h-[240px] min-w-[300px] max-h-[85vh] max-w-[90vw] resize overflow-hidden rounded-lg border border-cyan-400/40 bg-slate-900 shadow-2xl"
            style={{ left: pipPosition.x, top: pipPosition.y }}
          >
            <div
              className="flex cursor-move items-center justify-between border-b border-slate-700 bg-slate-950 px-3 py-2"
              onMouseDown={(event) => {
                setIsDraggingPip(true);
                pipDragOffsetRef.current = { x: event.clientX - pipPosition.x, y: event.clientY - pipPosition.y };
              }}
            >
              <div>
                <p className="text-[11px] uppercase tracking-wide text-cyan-300">PiP</p>
                <p className="text-xs font-semibold text-slate-100">{entry.vehicleName}</p>
              </div>
              <Button size="icon" variant="ghost" className="h-7 w-7 text-slate-300 hover:bg-slate-800 hover:text-white" onClick={() => setPinnedFeed(null)} title="Close PiP">
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="h-full">
              <FLVPlayer streamUrl={entry.streamUrl} channel={entry.channel} vehicleName={`${entry.vehicleName}`} onStop={() => { stopStream(entry.deviceId); setPinnedFeed(null); }} />
            </div>
          </div>,
          document.body
        ) : null;
      })()}

      <div>
        <div className="mb-4 flex items-center gap-2">
          <RadioTower className="h-5 w-5 text-slate-700" />
          <h3 className="text-lg font-semibold text-slate-900">Vehicle Overview</h3>
        </div>

        {loading ? (
          <Card className="p-8 text-center text-slate-600">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />
            Loading vehicles...
          </Card>
        ) : filteredVehicles.length === 0 ? (
          <Card className="p-8 text-center text-slate-500">No vehicles found</Card>
        ) : viewMode === "grid" ? (
          <div className="grid" style={gridStyle}>
            {filteredVehicles.map(renderVehicleCard)}
          </div>
        ) : (
          <div className="space-y-6">
            {renderVehicleTableSection("Online", filteredVehicles.filter((v) => v.online))}
            {renderVehicleTableSection("Offline", filteredVehicles.filter((v) => !v.online))}
          </div>
        )}
      </div>
    </div>
  );
}