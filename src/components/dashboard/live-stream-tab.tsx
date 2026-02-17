"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import HLSPlayer from "@/components/video/HLSPlayer";
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
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type VehicleChannel = {
  logicalChannel?: number;
  channel?: number;
};

interface ConnectedVehicle {
  id: string;
  name: string;
  phone?: string;
  channels: VehicleChannel[];
  registration?: string;
  connected?: boolean;
}

type PinnedFeed = {
  vehicleId: string;
  channel: number;
  vehicleName: string;
};

type StreamEntry = {
  id: string;
  vehicleId: string;
  channel: number;
  vehicleName: string;
};

function getChannelNumber(channel: VehicleChannel): number {
  return channel.logicalChannel ?? channel.channel ?? 1;
}

export default function LiveStreamTab() {
  const [vehicles, setVehicles] = useState<ConnectedVehicle[]>([]);
  const [selectedVehicles, setSelectedVehicles] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [loading, setLoading] = useState(true);
  const [pinnedFeed, setPinnedFeed] = useState<PinnedFeed | null>(null);
  const [pipPosition, setPipPosition] = useState({ x: 24, y: 96 });
  const [isDraggingPip, setIsDraggingPip] = useState(false);
  const pipDragOffsetRef = useRef({ x: 0, y: 0 });
  const supabase = createClient();

  const fetchConnectedVehicles = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/video-vehicles");
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data) {
          const vehiclesWithReg = await Promise.all(
            data.data.map(async (vehicle: ConnectedVehicle) => {
              const phoneNumber = vehicle.phone || vehicle.id;
              const { data: vehicleData } = await supabase
                .from("vehiclesc")
                .select("registration_number, camera_sim_id")
                .ilike("camera_sim_id", `%${phoneNumber}%`)
                .single();

              return {
                ...vehicle,
                registration: vehicleData?.registration_number || vehicle.id,
              };
            })
          );
          setVehicles(vehiclesWithReg);
        }
      }
    } catch (error) {
      console.error("Failed to fetch vehicles:", error);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    void fetchConnectedVehicles();
  }, [fetchConnectedVehicles]);

  const toggleVehicle = (vehicleId: string) => {
    const next = new Set(selectedVehicles);
    if (next.has(vehicleId)) {
      next.delete(vehicleId);
      if (pinnedFeed?.vehicleId === vehicleId) {
        setPinnedFeed(null);
      }
    } else {
      next.add(vehicleId);
    }
    setSelectedVehicles(next);
  };

  const filteredVehicles = vehicles.filter((v) =>
    (v.connected !== false) &&
    (v.id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      v.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      v.registration?.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const liveChannelCount = filteredVehicles.reduce(
    (acc, vehicle) => acc + ((vehicle.channels && vehicle.channels.length > 0) ? vehicle.channels.length : 1),
    0
  );

  const streamEntries: StreamEntry[] = Array.from(selectedVehicles).flatMap((vehicleId) => {
    const vehicle = vehicles.find((v) => v.id === vehicleId);
    if (!vehicle) return [];

    const channels = (vehicle.channels && vehicle.channels.length > 0)
      ? vehicle.channels
      : [{ logicalChannel: 1 }];

    return channels.map((ch, idx) => {
      const channelNumber = getChannelNumber(ch);
      return {
        id: `${vehicleId}-${channelNumber}-${idx}`,
        vehicleId,
        channel: channelNumber,
        vehicleName: `${vehicle?.registration || vehicle?.name || vehicleId} - Ch ${channelNumber}`,
      };
    });
  });

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
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
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
                Real-time visibility of connected vehicle channels.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              <div className="rounded-lg border border-slate-700 bg-slate-900/70 px-4 py-3">
                <p className="text-[11px] uppercase tracking-wide text-slate-400">Connected</p>
                <p className="mt-1 text-2xl font-bold text-emerald-300">{filteredVehicles.length}</p>
              </div>
              <div className="rounded-lg border border-slate-700 bg-slate-900/70 px-4 py-3">
                <p className="text-[11px] uppercase tracking-wide text-slate-400">Channels</p>
                <p className="mt-1 text-2xl font-bold text-cyan-300">{liveChannelCount}</p>
              </div>
              <div className="col-span-2 rounded-lg border border-slate-700 bg-slate-900/70 px-4 py-3 md:col-span-1">
                <p className="text-[11px] uppercase tracking-wide text-slate-400">Streaming</p>
                <p className="mt-1 text-2xl font-bold text-amber-300">{selectedVehicles.size}</p>
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
              placeholder="Search by registration, name, or SIM ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-10 border-slate-300 bg-white pl-9"
            />
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={fetchConnectedVehicles}
              title="Refresh vehicles"
              className="border-slate-300"
            >
              <RefreshCw className="h-4 w-4" />
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

      {selectedVehicles.size > 0 && (
        <Card className="border-slate-200 bg-slate-950 p-4 shadow-lg">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2 text-slate-100">
              <MonitorPlay className="h-5 w-5 text-emerald-400" />
              <h3 className="text-lg font-semibold">Active Stream Wall</h3>
            </div>
            <div className="flex items-center gap-2">
              {pinnedFeed && (
                <Badge className="bg-cyan-600 text-white hover:bg-cyan-600">
                  Split View Active
                </Badge>
              )}
              <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">
                {selectedVehicles.size} vehicle(s) live
              </Badge>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {streamEntries.map((entry) => (
              <div
                key={entry.id}
                className="relative overflow-hidden rounded-lg border border-slate-800 bg-slate-900"
              >
                <div className="absolute right-2 top-2 z-20">
                  <Button
                    size="sm"
                    className="h-7 border border-cyan-400/40 bg-slate-950/80 px-2 text-[11px] text-cyan-300 hover:bg-slate-800"
                    variant="outline"
                    onClick={() => {
                      setPinnedFeed({
                        vehicleId: entry.vehicleId,
                        channel: entry.channel,
                        vehicleName: entry.vehicleName,
                      });
                      setPipPosition({
                        x: Math.max(16, window.innerWidth - 440),
                        y: Math.max(16, window.innerHeight - 390),
                      });
                    }}
                    title="Open split view"
                  >
                    <PictureInPicture2 className="mr-1 h-3.5 w-3.5" />
                    Split View
                  </Button>
                </div>
                <HLSPlayer
                  vehicleId={entry.vehicleId}
                  channel={entry.channel}
                  vehicleName={entry.vehicleName}
                  onStop={() => toggleVehicle(entry.vehicleId)}
                />
              </div>
            ))}
          </div>
        </Card>
      )}

      {pinnedFeed && (
        <div
          className="fixed z-[70] min-h-[280px] min-w-[320px] max-h-[90vh] max-w-[95vw] resize overflow-auto rounded-lg border border-cyan-400/40 bg-slate-900 shadow-2xl"
          style={{ left: pipPosition.x, top: pipPosition.y }}
        >
          <div
            className="flex cursor-move items-center justify-between border-b border-slate-700 bg-slate-950 px-3 py-2"
            onMouseDown={(event) => {
              setIsDraggingPip(true);
              pipDragOffsetRef.current = {
                x: event.clientX - pipPosition.x,
                y: event.clientY - pipPosition.y,
              };
            }}
          >
            <div>
              <p className="text-[11px] uppercase tracking-wide text-cyan-300">Split View</p>
              <p className="text-xs font-semibold text-slate-100">{pinnedFeed.vehicleName}</p>
            </div>
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 text-slate-300 hover:bg-slate-800 hover:text-white"
              onClick={() => setPinnedFeed(null)}
              title="Close split view"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <HLSPlayer
            vehicleId={pinnedFeed.vehicleId}
            channel={pinnedFeed.channel}
            vehicleName={`${pinnedFeed.vehicleName} (Pinned)`}
            onStop={() => {
              toggleVehicle(pinnedFeed.vehicleId);
              setPinnedFeed(null);
            }}
          />
        </div>
      )}

      <div>
        <div className="mb-4 flex items-center gap-2">
          <RadioTower className="h-5 w-5 text-slate-700" />
          <h3 className="text-lg font-semibold text-slate-900">
            Connected Vehicles ({filteredVehicles.length})
          </h3>
        </div>

        {loading ? (
          <Card className="p-8 text-center text-slate-600">Loading vehicles...</Card>
        ) : filteredVehicles.length === 0 ? (
          <Card className="p-8 text-center text-slate-500">No connected vehicles found</Card>
        ) : viewMode === "grid" ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredVehicles.map((vehicle) => (
              <Card
                key={vehicle.id}
                className={`cursor-pointer p-4 transition-all ${
                  selectedVehicles.has(vehicle.id)
                    ? "border-emerald-400 bg-emerald-50 shadow-md"
                    : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm"
                }`}
                onClick={() => toggleVehicle(vehicle.id)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="rounded-lg bg-slate-900 p-2 text-white">
                      <Video className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-bold text-slate-900">{vehicle.registration || vehicle.id}</p>
                      <p className="font-mono text-xs text-slate-500">{vehicle.id}</p>
                    </div>
                  </div>
                  {vehicle.connected !== false ? (
                    <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">
                      <Wifi className="mr-1 h-3 w-3" />
                      Live
                    </Badge>
                  ) : (
                    <Badge variant="outline">
                      <WifiOff className="mr-1 h-3 w-3" />
                      Offline
                    </Badge>
                  )}
                </div>

                <div className="mt-3 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs text-slate-600">
                    <Activity className="h-3.5 w-3.5" />
                    {(vehicle.channels && vehicle.channels.length > 0) ? vehicle.channels.length : 1} channel(s)
                  </div>
                  <Button
                    size="sm"
                    variant={selectedVehicles.has(vehicle.id) ? "destructive" : "default"}
                    className={selectedVehicles.has(vehicle.id) ? "" : "bg-slate-900 hover:bg-slate-800"}
                  >
                    {selectedVehicles.has(vehicle.id) ? "Stop" : "Stream"}
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="overflow-hidden border-slate-200">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Registration</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">SIM ID</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Channels</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-slate-600">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredVehicles.map((vehicle) => (
                  <tr key={vehicle.id} className="border-t hover:bg-slate-50">
                    <td className="px-4 py-3">
                      {vehicle.connected !== false ? (
                        <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">Live</Badge>
                      ) : (
                        <Badge variant="outline">Offline</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-900">{vehicle.registration || "-"}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-600">{vehicle.id}</td>
                    <td className="px-4 py-3 text-slate-600">{(vehicle.channels && vehicle.channels.length > 0) ? vehicle.channels.length : 1}</td>
                    <td className="px-4 py-3 text-center">
                      <Button
                        size="sm"
                        variant={selectedVehicles.has(vehicle.id) ? "destructive" : "default"}
                        onClick={() => toggleVehicle(vehicle.id)}
                        className={selectedVehicles.has(vehicle.id) ? "" : "bg-slate-900 hover:bg-slate-800"}
                      >
                        {selectedVehicles.has(vehicle.id) ? "Stop" : "Stream"}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </div>
    </div>
  );
}
