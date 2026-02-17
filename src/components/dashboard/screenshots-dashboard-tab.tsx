"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Camera, RefreshCw, Download, MonitorPlay, Shield, RadioTower, Activity } from "lucide-react";
import { useVideoWebSocket } from "@/hooks/use-video-websocket";

type ChannelInfo = {
  logicalChannel?: number;
  channel?: number;
  type?: string;
};

type ConnectedVehicle = {
  id: string;
  phone?: string;
  channels?: ChannelInfo[];
  connected?: boolean;
};

type ScreenshotItem = {
  id: string;
  device_id?: string;
  channel?: number;
  storage_url?: string;
  timestamp?: string;
};

type CaptureTarget = {
  vehicleId: string;
  channel: number;
};

type VehicleChannelCard = {
  channel: number;
  screenshot?: ScreenshotItem;
};

type VehicleGroupCard = {
  vehicleId: string;
  channels: VehicleChannelCard[];
};

function isVideoChannel(channel: ChannelInfo): boolean {
  const channelType = (channel.type || "").toLowerCase();
  return channelType === "video" || channelType === "audio_video";
}

function toTargetKey(target: CaptureTarget): string {
  return `${target.vehicleId}:${target.channel}`;
}

function toVehicleKey(vehicle: ConnectedVehicle): string {
  return vehicle.id || vehicle.phone || "";
}

function parseDate(value?: string): number {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function buildTargets(vehicles: ConnectedVehicle[]): CaptureTarget[] {
  const targets: CaptureTarget[] = [];
  const seen = new Set<string>();

  for (const vehicle of vehicles) {
    const vehicleId = toVehicleKey(vehicle);
    if (!vehicleId) continue;

    const videoChannels = (vehicle.channels || [])
      .filter(isVideoChannel)
      .map((channel) => channel.logicalChannel ?? channel.channel ?? 1);

    const channels = videoChannels.length > 0 ? videoChannels : [1];

    for (const channel of channels) {
      const target = { vehicleId, channel };
      const key = toTargetKey(target);
      if (!seen.has(key)) {
        seen.add(key);
        targets.push(target);
      }
    }
  }

  return targets;
}

export default function ScreenshotsDashboardTab() {
  const [vehicles, setVehicles] = useState<ConnectedVehicle[]>([]);
  const [screenshots, setScreenshots] = useState<ScreenshotItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const vehiclesRef = useRef<ConnectedVehicle[]>([]);
  const lastWsRefreshAt = useRef(0);

  const fetchConnectedVehicles = useCallback(async () => {
    const response = await fetch("/api/video-server/vehicles/connected");
    if (!response.ok) {
      throw new Error("Failed to load connected vehicles");
    }
    const data = await response.json();
    const connectedVehicles = Array.isArray(data) ? data : [];
    vehiclesRef.current = connectedVehicles;
    setVehicles(connectedVehicles);
    return connectedVehicles as ConnectedVehicle[];
  }, []);

  const fetchRecentScreenshots = useCallback(async () => {
    try {
      const response = await fetch("/api/video-server/screenshots/recent?limit=300&minutes=30");
      if (!response.ok) {
        setError("Recent screenshots endpoint is temporarily unavailable.");
        return [];
      }

      const data = await response.json();
      const rows = Array.isArray(data?.screenshots) ? data.screenshots : [];
      const validRows = rows.filter((row: ScreenshotItem) => {
        const url = row.storage_url || "";
        return url.length > 0 && url !== "upload-failed" && url !== "local-only";
      });

      setScreenshots(validRows);
      setLastRefresh(new Date());
      return validRows as ScreenshotItem[];
    } catch {
      setError("Recent screenshots request failed. Retrying automatically.");
      return [];
    }
  }, []);

  const requestScreenshot = useCallback(async (target: CaptureTarget) => {
    await fetch(`/api/video-server/vehicles/${target.vehicleId}/screenshot`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        channel: target.channel,
        fallback: true,
        fallbackDelayMs: 600,
      }),
    });
  }, []);

  const runCaptureCycle = useCallback(async () => {
    setCapturing(true);
    setError(null);
    try {
      const sourceVehicles =
        vehiclesRef.current.length > 0 ? vehiclesRef.current : await fetchConnectedVehicles();
      const targets = buildTargets(sourceVehicles.filter((vehicle) => vehicle.connected !== false));
      await Promise.allSettled(targets.map((target) => requestScreenshot(target)));
      await new Promise((resolve) => setTimeout(resolve, 1200));
      await fetchRecentScreenshots();
    } catch {
      setError("Capture cycle failed. Monitoring continues with polling.");
    } finally {
      setCapturing(false);
    }
  }, [fetchConnectedVehicles, fetchRecentScreenshots, requestScreenshot]);

  const refreshAll = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      await fetchConnectedVehicles();
      await fetchRecentScreenshots();
    } catch {
      setError("Unable to refresh screenshot monitor right now.");
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }, [fetchConnectedVehicles, fetchRecentScreenshots]);

  const handleWsMessage = useCallback(
    (data: { type?: string }) => {
      if (data.type === "screenshot-received") {
        const now = Date.now();
        if (now - lastWsRefreshAt.current < 1500) {
          return;
        }
        lastWsRefreshAt.current = now;
        void fetchRecentScreenshots();
      }
    },
    [fetchRecentScreenshots]
  );

  useVideoWebSocket(handleWsMessage);

  useEffect(() => {
    let active = true;
    const boot = async () => {
      try {
        await refreshAll();
        if (active) {
          await runCaptureCycle();
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };
    void boot();
    return () => {
      active = false;
    };
  }, [refreshAll, runCaptureCycle]);

  useEffect(() => {
    const captureInterval = setInterval(() => {
      void runCaptureCycle();
    }, 30000);
    return () => clearInterval(captureInterval);
  }, [runCaptureCycle]);

  useEffect(() => {
    const pollingInterval = setInterval(() => {
      void fetchRecentScreenshots();
    }, 8000);
    return () => clearInterval(pollingInterval);
  }, [fetchRecentScreenshots]);

  useEffect(() => {
    const vehiclesInterval = setInterval(() => {
      void fetchConnectedVehicles();
    }, 60000);
    return () => clearInterval(vehiclesInterval);
  }, [fetchConnectedVehicles]);

  const connectedVehicles = useMemo(
    () => vehicles.filter((vehicle) => vehicle.connected !== false),
    [vehicles]
  );

  const cards = useMemo<VehicleGroupCard[]>(() => {
    const latestByDeviceChannel = new Map<string, ScreenshotItem>();
    for (const shot of screenshots) {
      const deviceId = shot.device_id || "";
      const channel = shot.channel ?? 1;
      if (!deviceId) continue;
      const key = `${deviceId}:${channel}`;
      const existing = latestByDeviceChannel.get(key);
      if (!existing || parseDate(shot.timestamp) > parseDate(existing.timestamp)) {
        latestByDeviceChannel.set(key, shot);
      }
    }

    return connectedVehicles
      .map((vehicle) => {
        const vehicleId = toVehicleKey(vehicle);
        const videoChannels = (vehicle.channels || [])
          .filter(isVideoChannel)
          .map((channel) => channel.logicalChannel ?? channel.channel ?? 1);
        const channels = videoChannels.length > 0 ? videoChannels : [1];
        const dedupedChannels = Array.from(new Set(channels)).sort((a, b) => a - b);

        const groupedChannels = dedupedChannels.map((channel) => ({
          channel,
          screenshot: latestByDeviceChannel.get(`${vehicleId}:${channel}`),
        }));

        return {
          vehicleId,
          channels: groupedChannels,
        };
      })
      .filter((card) => card.vehicleId.length > 0);
  }, [connectedVehicles, screenshots]);

  const liveCount = useMemo(() => {
    const now = Date.now();
    return cards.flatMap((card) => card.channels).filter((channelCard) => {
      const ts = parseDate(channelCard.screenshot?.timestamp);
      return ts > 0 && now - ts <= 120000;
    }).length;
  }, [cards]);

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden border-slate-800 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-800 text-slate-100 shadow-xl">
        <div className="p-6 md:p-7">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-500/10 px-3 py-1 text-xs font-medium text-cyan-300">
                <Shield className="h-3.5 w-3.5" />
                Vehicle Screenshot Monitoring
              </div>
              <h2 className="mt-3 text-3xl font-bold tracking-tight">Screenshot Control Room</h2>
              <p className="mt-1 text-sm text-slate-300">
                Per-vehicle camera snapshots with auto-capture and live refresh.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-slate-700 bg-slate-900/70 px-4 py-3">
                <p className="text-[11px] uppercase tracking-wide text-slate-400">Connected</p>
                <p className="mt-1 text-2xl font-bold text-emerald-300">{connectedVehicles.length}</p>
              </div>
              <div className="rounded-lg border border-slate-700 bg-slate-900/70 px-4 py-3">
                <p className="text-[11px] uppercase tracking-wide text-slate-400">Live Channels</p>
                <p className="mt-1 text-2xl font-bold text-cyan-300">{liveCount}</p>
              </div>
              <div className="rounded-lg border border-slate-700 bg-slate-900/70 px-4 py-3">
                <p className="text-[11px] uppercase tracking-wide text-slate-400">Last Update</p>
                <p className="mt-1 text-sm font-semibold text-slate-100">
                  {lastRefresh ? lastRefresh.toLocaleTimeString() : "Waiting..."}
                </p>
              </div>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={() => void runCaptureCycle()} disabled={capturing} className="border-slate-600 bg-slate-900 text-slate-100 hover:bg-slate-800">
              <Camera className={`mr-2 h-4 w-4 ${capturing ? "animate-pulse" : ""}`} />
              Capture Now
            </Button>
            <Button onClick={() => void refreshAll()} disabled={refreshing} className="bg-cyan-600 hover:bg-cyan-700">
              <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </div>
      </Card>

      {error && (
        <Card className="border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</Card>
      )}

      {loading ? (
        <Card className="p-10 text-center text-slate-600">Loading screenshot monitor...</Card>
      ) : cards.length === 0 ? (
        <Card className="p-10 text-center text-slate-600">
          No connected vehicles with screenshot channels available.
        </Card>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <RadioTower className="h-5 w-5 text-slate-700" />
            <h3 className="text-lg font-semibold text-slate-900">Vehicle Screenshot Grid</h3>
          </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {cards.map((card) => {
            return (
              <Card
                key={card.vehicleId}
                className="overflow-hidden border-slate-300 bg-slate-950 text-slate-100"
              >
                <div className="flex items-center justify-between border-b border-slate-800 px-3 py-2">
                  <p className="text-sm font-semibold">{card.vehicleId}</p>
                  <Badge className="bg-slate-700 text-slate-100 hover:bg-slate-700">
                    <Activity className="mr-1 h-3 w-3" />
                    {card.channels.length} channels
                  </Badge>
                </div>

                <div className="grid grid-cols-1 gap-2 p-2 sm:grid-cols-2">
                  {card.channels.map((channelCard) => {
                    const shot = channelCard.screenshot;
                    const ageMs = Date.now() - parseDate(shot?.timestamp);
                    const isLive = parseDate(shot?.timestamp) > 0 && ageMs <= 120000;

                    return (
                      <div key={`${card.vehicleId}-${channelCard.channel}`} className="overflow-hidden rounded border border-slate-800">
                        <div className="relative aspect-video bg-slate-900">
                          {shot?.storage_url ? (
                            <img
                              src={shot.storage_url}
                              alt={`Vehicle ${card.vehicleId} channel ${channelCard.channel}`}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full items-center justify-center text-slate-500">
                              <MonitorPlay className="h-8 w-8" />
                            </div>
                          )}
                          <div className="absolute right-2 top-2 rounded bg-black/70 px-2 py-1 text-[11px]">
                            CH {channelCard.channel}
                          </div>
                        </div>
                        <div className="flex items-center justify-between px-2 py-2">
                          <div>
                            <Badge
                              className={
                                isLive
                                  ? "bg-emerald-600 text-white hover:bg-emerald-600"
                                  : "bg-amber-600 text-white hover:bg-amber-600"
                              }
                            >
                              {isLive ? "Live" : "Stale"}
                            </Badge>
                            <p className="mt-1 text-[11px] text-slate-400">
                              {shot?.timestamp
                                ? new Date(shot.timestamp).toLocaleTimeString()
                                : "No image"}
                            </p>
                          </div>
                          {shot?.storage_url && (
                            <Button
                              size="icon"
                              variant="secondary"
                              className="h-7 w-7"
                              onClick={() => window.open(shot.storage_url, "_blank")}
                              title="Open image"
                            >
                              <Download className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>
            );
          })}
        </div>
        </div>
      )}
    </div>
  );
}
