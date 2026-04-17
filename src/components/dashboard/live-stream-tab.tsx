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
  fleetNumber?: string;
  displayLabel?: string;
  connected?: boolean;
  activeStreams?: number[];
}

type PinnedFeed = {
  vehicleId: string;
  fallbackVehicleIds: string[];
  channel: number;
  vehicleName: string;
};

type StreamEntry = {
  id: string;
  vehicleId: string;
  fallbackVehicleIds: string[];
  channel: number;
  vehicleName: string;
};

function getChannelNumber(channel: VehicleChannel): number {
  return channel.logicalChannel ?? channel.channel ?? 1;
}

function getLiveChannels(channels: VehicleChannel[] | undefined): number[] {
  const discovered = Array.isArray(channels)
    ? channels
        .map(getChannelNumber)
        .filter((value, index, values) => Number.isFinite(value) && value > 0 && values.indexOf(value) === index)
    : [];

  return Array.from(new Set([1, 2, ...discovered]));
}

export default function LiveStreamTab() {
  const [vehicles, setVehicles] = useState<ConnectedVehicle[]>([]);
  const [selectedVehicles, setSelectedVehicles] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [gridColumns, setGridColumns] = useState(4);
  const [loading, setLoading] = useState(true);
  const [pinnedFeed, setPinnedFeed] = useState<PinnedFeed | null>(null);
  const [pipPosition, setPipPosition] = useState({ x: 24, y: 96 });
  const [isDraggingPip, setIsDraggingPip] = useState(false);
  const pipDragOffsetRef = useRef({ x: 0, y: 0 });
  const supabase = createClient();

  const fetchConnectedVehicles = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/video-server/vehicles/connected", { cache: "no-store" });
      if (response.ok) {
        const data = await response.json();
        const connectedVehicles = Array.isArray(data)
          ? data
          : Array.isArray(data?.data)
            ? data.data
            : Array.isArray(data?.vehicles)
              ? data.vehicles
              : [];
        if (connectedVehicles.length > 0) {
          const cameraIds = Array.from(
            new Set(
              connectedVehicles
                .map((vehicle: ConnectedVehicle) => String(vehicle.phone || vehicle.id || "").trim())
                .filter(Boolean)
            )
          );
          const vehicleLookup = new Map<string, string>();
          const vehicleFleetLookup = new Map<string, string>();
          if (cameraIds.length > 0) {
            const { data: vehicleRows } = await supabase
              .from("vehiclesc")
              .select("registration_number, fleet_number, camera_sim_id, camera_serial")
              .or(`camera_sim_id.in.(${cameraIds.join(",")}),camera_serial.in.(${cameraIds.join(",")})`);
            for (const row of vehicleRows || []) {
              const registration = String(row?.registration_number || "").trim();
              const fleetNumber = String(row?.fleet_number || "").trim();
              const keys = [row?.camera_sim_id, row?.camera_serial]
                .map((value) => String(value || "").trim())
                .filter(Boolean);
              for (const key of keys) {
                if (registration && !vehicleLookup.has(key)) {
                  vehicleLookup.set(key, registration);
                }
                if (fleetNumber && !vehicleFleetLookup.has(key)) {
                  vehicleFleetLookup.set(key, fleetNumber);
                }
              }
            }
          }
          const vehiclesWithReg = connectedVehicles.map((vehicle: ConnectedVehicle) => {
            const key = String(vehicle.phone || vehicle.id || "").trim();
            const registration = vehicleLookup.get(key) || "";
            const fleetNumber = vehicleFleetLookup.get(key) || "";
            const displayLabel = registration && fleetNumber ? `${fleetNumber} - ${registration}` : "";
            return {
              ...vehicle,
              registration,
              fleetNumber,
              displayLabel,
            };
          }).filter((vehicle: ConnectedVehicle) => !!vehicle.displayLabel);
          setVehicles(vehiclesWithReg);
        } else {
          setVehicles([]);
        }
      }
    } catch (error) {
      console.error("Failed to fetch vehicles:", error);
      setVehicles([]);
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
      v.displayLabel?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      v.registration?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      v.fleetNumber?.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const liveChannelCount = filteredVehicles.reduce(
    (acc, vehicle) => acc + getLiveChannels(vehicle.channels).length,
    0
  );

  const streamEntries: StreamEntry[] = Array.from(selectedVehicles).flatMap((vehicleId) => {
    const vehicle = vehicles.find((v) => v.id === vehicleId);
    if (!vehicle) return [];

    const channels = getLiveChannels(vehicle.channels);

    return channels.map((channelNumber, idx) => {
      const fallbackVehicleIds = Array.from(
        new Set([vehicle.id, vehicle.phone].map((value) => String(value || "").trim()).filter(Boolean))
      );
      return {
        id: `${vehicleId}-${channelNumber}-${idx}`,
        vehicleId,
        fallbackVehicleIds,
        channel: channelNumber,
        vehicleName: `${vehicle.displayLabel} - Ch ${channelNumber}`,
      };
    });
  });

  const gridClassName = (() => {
    switch (gridColumns) {
      case 1:
        return "grid grid-cols-1 gap-4";
      case 2:
        return "grid grid-cols-1 gap-4 md:grid-cols-2";
      case 3:
        return "grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3";
      case 4:
        return "grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4";
      case 5:
        return "grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5";
      case 6:
        return "grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6";
      case 7:
        return "grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-7";
      case 8:
        return "grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-8";
      default:
        return "grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4";
    }
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

          <div className={gridClassName}>
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
                        fallbackVehicleIds: entry.fallbackVehicleIds,
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
                  fallbackVehicleIds={entry.fallbackVehicleIds}
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
            fallbackVehicleIds={pinnedFeed.fallbackVehicleIds}
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
          <div className={gridClassName}>
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
                      <p className="font-bold text-slate-900">{vehicle.displayLabel}</p>
                    </div>
                  </div>
                  {vehicle.connected !== false ? (
                    <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">
                      <Wifi className="mr-1 h-3 w-3" />
                      {Array.isArray(vehicle.activeStreams) && vehicle.activeStreams.length > 0 ? "Live" : "Connected"}
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
                    {getLiveChannels(vehicle.channels).length} channel(s)
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
                        <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">
                          {Array.isArray(vehicle.activeStreams) && vehicle.activeStreams.length > 0 ? "Live" : "Connected"}
                        </Badge>
                      ) : (
                        <Badge variant="outline">Offline</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-900">{vehicle.displayLabel}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-600">{vehicle.phone || vehicle.id}</td>
                    <td className="px-4 py-3 text-slate-600">{(vehicle.channels && vehicle.channels.length > 0) ? vehicle.channels.length : 2}</td>
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




