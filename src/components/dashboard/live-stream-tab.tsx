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
} from "lucide-react";

type LocalVehicle = {
  plateName: string;
  deviceId: string;
  cameras: number;
};

type ChannelStream = {
  channelId: number;
  streamUrl: string | null;
  success: boolean;
  message?: string;
};

type ActiveVehicleStreams = {
  plateName: string;
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

const LOCAL_VIDEO_SERVER = "http://localhost:3002";

function matchesCostCenterFilter(_costCenter: string | undefined, _selectedCostCenters: Set<string>) {
  return true;
}

export default function LiveStreamTab({ selectedCostCenters = [] }: LiveStreamTabProps) {
  const [vehicles, setVehicles] = useState<LocalVehicle[]>([]);
  const [selectedDevices, setSelectedDevices] = useState<Set<string>>(new Set());
  const [activeStreams, setActiveStreams] = useState<Map<string, ActiveVehicleStreams>>(new Map());
  const [streamingChannels, setStreamingChannels] = useState<Map<string, ChannelStream[]>>(new Map());
  const [searchTerm, setSearchTerm] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [gridColumns, setGridColumns] = useState(4);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pinnedFeed, setPinnedFeed] = useState<PinnedFeed | null>(null);
  const [pipPosition, setPipPosition] = useState({ x: 24, y: 96 });
  const [isDraggingPip, setIsDraggingPip] = useState(false);
  const pipDragOffsetRef = useRef({ x: 0, y: 0 });

  const fetchAllVehicles = useCallback(async () => {
    try {
      const res = await fetch(`${LOCAL_VIDEO_SERVER}/api/stream/network`, { cache: "no-store" });
      const data = await res.json();
      if (data.success && data.data?.devices) {
        return data.data.devices.map((d: any) => ({
          plateName: d.plateName || "Unknown",
          deviceId: d.deviceId || d.id,
          cameras: d.cameras || 2,
        })) as LocalVehicle[];
      }
      return [];
    } catch {
      return [];
    }
  }, []);

  const fetchChannelsForDevice = useCallback(async (deviceId: string) => {
    try {
      const res = await fetch(`${LOCAL_VIDEO_SERVER}/api/stream/debug/vehicle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceId }),
        cache: "no-store",
      });
      const data = await res.json();
      const channels = data.data?.channels || data.channels || [];
      return channels
        .map((ch: any) => ({
          channelId: ch.channelId,
          streamUrl: ch.streamUrl || null,
          success: ch.success === true,
          message: ch.message || (ch.success ? 'OK' : 'Offline'),
        })) as ChannelStream[];
    } catch {
      return [];
    }
  }, []);

  const loadVehicles = useCallback(async (background = false) => {
    if (!background) setLoading(true);
    else setRefreshing(true);

    const allVehicles = await fetchAllVehicles();
    setVehicles(allVehicles);

    if (!background) setLoading(false);
    else setRefreshing(false);
  }, [fetchAllVehicles]);

  useEffect(() => { loadVehicles(); }, [loadVehicles]);

  const selectedCostCenterSet = useMemo(
    () => new Set(selectedCostCenters.map((v) => v.trim().toLowerCase()).filter(Boolean)),
    [selectedCostCenters]
  );

  const filteredVehicles = useMemo(
    () => vehicles
      .filter((v) =>
        !searchTerm ||
        v.plateName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        v.deviceId.toLowerCase().includes(searchTerm.toLowerCase())
      )
      .sort((a, b) => a.plateName.localeCompare(b.plateName)),
    [vehicles, searchTerm]
  );

  const toggleDevice = async (deviceId: string) => {
    const next = new Set(selectedDevices);
    if (next.has(deviceId)) {
      next.delete(deviceId);
      setStreamingChannels(prev => { const m = new Map(prev); m.delete(deviceId); return m; });
    } else {
      next.add(deviceId);
      const channels = await fetchChannelsForDevice(deviceId);
      setStreamingChannels(prev => { const m = new Map(prev); m.set(deviceId, channels); return m; });
    }
    setSelectedDevices(next);
  };

  const streamEntries: StreamEntry[] = Array.from(selectedDevices).flatMap((deviceId) => {
    const vehicle = filteredVehicles.find((v) => v.deviceId === deviceId);
    if (!vehicle) return [];
    const channels = streamingChannels.get(deviceId) || [];
    return channels.map((ch) => ({
      id: `${deviceId}-${ch.channelId}`,
      deviceId,
      channel: ch.channelId,
      vehicleName: `${vehicle.plateName} - Ch ${ch.channelId}`,
      streamUrl: ch.streamUrl!,
    }));
  });

  const renderVehicleCard = (vehicle: LocalVehicle) => {
    const selected = selectedDevices.has(vehicle.deviceId);
    const channels = streamingChannels.get(vehicle.deviceId);
    const channelCount = channels?.filter(c => c.success).length || 0;
    const hasAttempted = channels !== undefined;
    const firstMsg = channels?.[0]?.message;

    return (
      <Card
        key={vehicle.deviceId}
        className={`p-4 transition-all ${
          selected
            ? "border-emerald-400 bg-emerald-50 shadow-md"
            : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm"
        } cursor-pointer`}
        onClick={() => toggleDevice(vehicle.deviceId)}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-slate-900 p-2 text-white">
              <Video className="h-5 w-5" />
            </div>
            <div>
              <p className="font-bold text-slate-900">{vehicle.plateName}</p>
              <p className="text-xs text-slate-500">{vehicle.cameras} cameras</p>
            </div>
          </div>
          {selected && channelCount > 0 ? (
            <Badge className="bg-emerald-600 text-white">
              <Wifi className="mr-1 h-3 w-3" />
              {channelCount} active
            </Badge>
          ) : hasAttempted && channelCount === 0 ? (
            <Badge variant="outline" className="border-red-300 text-red-600">
              <WifiOff className="mr-1 h-3 w-3" />
              Offline
            </Badge>
          ) : (
            <Badge variant="outline">
              <Camera className="mr-1 h-3 w-3" />
              Ready
            </Badge>
          )}
        </div>
        <div className="mt-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-slate-600">
            <Activity className="h-3.5 w-3.5" />
            {selected && channelCount > 0
              ? `${channelCount}/${vehicle.cameras} streaming`
              : hasAttempted && channelCount === 0
                ? firstMsg || 'No streams'
                : `${vehicle.cameras} camera(s)`}
          </div>
          <Button
            size="sm"
            disabled={hasAttempted && channelCount === 0}
            variant={selected ? "destructive" : "default"}
            className={
              hasAttempted && channelCount === 0
                ? "bg-slate-200 text-slate-500 hover:bg-slate-200"
                : selected
                  ? ""
                  : "bg-slate-900 hover:bg-slate-800"
            }
          >
            {selected ? "Stop" : hasAttempted && channelCount === 0 ? "Offline" : "Stream"}
          </Button>
        </div>
      </Card>
    );
  };

  const renderVehicleTableSection = (title: string, sectionVehicles: LocalVehicle[]) => {
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
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Plate</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Device ID</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Cameras</th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-slate-600">Action</th>
              </tr>
            </thead>
            <tbody>
              {sectionVehicles.map((vehicle) => {
                const selected = selectedDevices.has(vehicle.deviceId);
                return (
                  <tr key={vehicle.deviceId} className="border-t hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-900">{vehicle.plateName}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-600">{vehicle.deviceId}</td>
                    <td className="px-4 py-3 text-slate-600">{vehicle.cameras}</td>
                    <td className="px-4 py-3 text-center">
                      <Button
                        size="sm"
                        variant={selected ? "destructive" : "default"}
                        onClick={() => toggleDevice(vehicle.deviceId)}
                        className={selected ? "" : "bg-slate-900 hover:bg-slate-800"}
                      >
                        {selected ? "Stop" : "Stream"}
                      </Button>
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

  const gridClassName = (() => {
    const cols = Math.min(streamEntries.length, gridColumns);
    const base = "grid grid-cols-1 gap-4";
    if (cols >= 2) return `${base} md:grid-cols-2`;
    if (cols >= 3) return `${base} md:grid-cols-2 xl:grid-cols-3`;
    if (cols >= 4) return `${base} md:grid-cols-2 xl:grid-cols-4`;
    if (cols >= 5) return `${base} md:grid-cols-2 xl:grid-cols-5`;
    return base;
  })();

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
                Vehicle Security Monitoring
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
                <p className="text-[11px] uppercase tracking-wide text-slate-400">Active Channels</p>
                <p className="mt-1 text-2xl font-bold text-cyan-300">{streamEntries.length}</p>
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
              placeholder="Search by plate or device ID..."
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
          <div className={gridClassName}>
            {streamEntries.map((entry) => (
              <div key={entry.id} className="relative overflow-hidden rounded-lg border border-slate-800 bg-slate-900">
                <div className="absolute right-2 top-2 z-20">
                  <Button
                    size="sm"
                    className="h-7 border border-cyan-400/40 bg-slate-950/80 px-2 text-[11px] text-cyan-300 hover:bg-slate-800"
                    variant="outline"
                    onClick={() => setPinnedFeed({ deviceId: entry.deviceId, channel: entry.channel, vehicleName: entry.vehicleName })}
                    title="Open split view"
                  >
                    <PictureInPicture2 className="mr-1 h-3.5 w-3.5" />
                    Split View
                  </Button>
                </div>
                <FLVPlayer
                  streamUrl={entry.streamUrl}
                  channel={entry.channel}
                  vehicleName={entry.vehicleName}
                  onStop={() => toggleDevice(entry.deviceId)}
                />
              </div>
            ))}
          </div>
        </Card>
      )}

      {pinnedFeed && (() => {
        const entry = streamEntries.find(e => e.deviceId === pinnedFeed.deviceId && e.channel === pinnedFeed.channel);
        return entry ? (
          <div
            className="fixed z-[70] min-h-[280px] min-w-[320px] max-h-[90vh] max-w-[95vw] resize overflow-auto rounded-lg border border-cyan-400/40 bg-slate-900 shadow-2xl"
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
                <p className="text-[11px] uppercase tracking-wide text-cyan-300">Split View</p>
                <p className="text-xs font-semibold text-slate-100">{entry.vehicleName}</p>
              </div>
              <Button size="icon" variant="ghost" className="h-7 w-7 text-slate-300 hover:bg-slate-800 hover:text-white" onClick={() => setPinnedFeed(null)} title="Close split view">
                <X className="h-4 w-4" />
              </Button>
            </div>
            <FLVPlayer streamUrl={entry.streamUrl} channel={entry.channel} vehicleName={`${entry.vehicleName} (Pinned)`} onStop={() => { toggleDevice(entry.deviceId); setPinnedFeed(null); }} />
          </div>
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
          <div className={gridClassName}>
            {filteredVehicles.map(renderVehicleCard)}
          </div>
        ) : (
          <div className="space-y-6">
            {renderVehicleTableSection("All Vehicles", filteredVehicles)}
          </div>
        )}
      </div>
    </div>
  );
}
