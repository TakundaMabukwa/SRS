/* eslint-disable @next/next/no-img-element */
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw, Download, MonitorPlay, Shield, RadioTower, ExternalLink } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type ChannelInfo = {
  logicalChannel?: number;
  channel?: number;
  updatedAtMs?: number;
};

type ConnectedVehicle = {
  id: string;
  phone?: string;
  channels?: ChannelInfo[];
  connected?: boolean;
  registration?: string;
  fleetNumber?: string;
  displayLabel?: string;
};

type LivePreviewRow = {
  vehicleId: string;
  channel: number;
  updatedAtMs: number;
  timestamp: string;
};

type VehicleChannelCard = {
  channel: number;
  active: boolean;
  imageUrl: string;
  timestamp?: string;
};

type VehicleGroupCard = {
  vehicleId: string;
  displayLabel: string;
  connected: boolean;
  channels: VehicleChannelCard[];
};

type VehicleCatalogRow = {
  registration_number?: string | null;
  fleet_number?: string | null;
  camera_sim_id?: string | null;
  camera_serial?: string | null;
};

function toVehicleKey(vehicle: ConnectedVehicle): string {
  return String(vehicle.id || vehicle.phone || "").trim();
}

function parseDate(value?: string): number {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function getScreenshotChannels(channels: ChannelInfo[] | undefined): number[] {
  const discovered = (channels || [])
    .map((channel) => channel.logicalChannel ?? channel.channel ?? 1)
    .filter((value, index, values) => Number.isFinite(value) && value > 0 && values.indexOf(value) === index);

  return Array.from(new Set([1, 2, ...discovered])).sort((a, b) => a - b);
}

function buildFallbackIds(vehicle: ConnectedVehicle): string {
  return Array.from(
    new Set([vehicle.id, vehicle.phone].map((value) => String(value || "").trim()).filter(Boolean))
  ).join(",");
}

function buildScreenshotUrl(vehicle: ConnectedVehicle, channel: number, refreshToken: number) {
  const params = new URLSearchParams({
    channel: String(channel),
    maxAgeMs: "45000",
    _ts: String(refreshToken),
  });
  const fallbackIds = buildFallbackIds(vehicle);
  if (fallbackIds) {
    params.set("fallbackIds", fallbackIds);
  }
  return `/api/live-preview/vehicles/${encodeURIComponent(vehicle.id)}/screenshot?${params.toString()}`;
}

function readRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function parseLivePreviewFeed(payload: unknown): LivePreviewRow[] {
  const root = readRecord(payload);
  const rows = Array.isArray(root.rows)
    ? root.rows
    : Array.isArray(root.data)
      ? root.data
      : [];

  return rows
    .map((entry) => {
      const record = readRecord(entry);
      const vehicleId = String(record.vehicleId ?? record.id ?? "").trim();
      const channel = Number(record.channel ?? 0);
      const updatedAtMs = Number(record.updatedAtMs ?? 0);
      const timestamp = String(record.updatedAt ?? "").trim();
      if (!vehicleId || !Number.isFinite(channel) || channel <= 0) {
        return null;
      }

      return {
        vehicleId,
        channel,
        updatedAtMs: Number.isFinite(updatedAtMs) ? updatedAtMs : 0,
        timestamp,
      } satisfies LivePreviewRow;
    })
    .filter((row): row is LivePreviewRow => !!row);
}

type ScreenshotsDashboardTabProps = {
  detachable?: boolean;
};

export default function ScreenshotsDashboardTab({ detachable = true }: ScreenshotsDashboardTabProps) {
  const supabase = createClient();
  const [vehicles, setVehicles] = useState<ConnectedVehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [gridColumns, setGridColumns] = useState(4);
  const [refreshToken, setRefreshToken] = useState(Date.now());
  const LIVE_SCREENSHOT_WINDOW_MS = 10 * 60 * 1000;

  const fetchConnectedVehicles = useCallback(async () => {
    const liveRowsResponse = await fetch("/api/live-preview/streams?maxAgeMs=45000", {
      cache: "no-store",
      signal: AbortSignal.timeout(12000),
    }).catch(() => null);

    const liveRowsPayload = liveRowsResponse && liveRowsResponse.ok
      ? await liveRowsResponse.json().catch(() => ({}))
      : {};
    const liveRows = parseLivePreviewFeed(liveRowsPayload);
    const liveByKey = new Map<string, Map<number, LivePreviewRow>>();

    for (const row of liveRows) {
      if (!liveByKey.has(row.vehicleId)) {
        liveByKey.set(row.vehicleId, new Map<number, LivePreviewRow>());
      }
      liveByKey.get(row.vehicleId)?.set(row.channel, row);
    }

    const { data: vehicleRows, error: vehiclesError } = await supabase
      .from("vehiclesc")
      .select("registration_number, fleet_number, camera_sim_id, camera_serial");

    if (vehiclesError) {
      throw new Error("Failed to load vehicle catalog");
    }

    const dedupedById = new Map<string, ConnectedVehicle>();
    for (const rawRow of vehicleRows || []) {
      const row = rawRow as VehicleCatalogRow;
      const keys = [row.camera_sim_id, row.camera_serial]
        .map((value) => String(value || "").trim())
        .filter(Boolean);
      if (keys.length === 0) continue;

      const primaryKey = keys[0];
      const secondaryKey = keys[1] || "";
      const matchedRows = keys.flatMap((key) => {
        const channelMap = liveByKey.get(key);
        return channelMap ? Array.from(channelMap.values()) : [];
      });

      const uniqueChannelRows = Array.from(
        matchedRows.reduce((acc, rowValue) => {
          if (!acc.has(rowValue.channel) || Number(rowValue.updatedAtMs) > Number(acc.get(rowValue.channel)?.updatedAtMs || 0)) {
            acc.set(rowValue.channel, rowValue);
          }
          return acc;
        }, new Map<number, LivePreviewRow>())
          .values()
      ).sort((a, b) => a.channel - b.channel);

      const registration = String(row.registration_number || "").trim();
      const fleetNumber = String(row.fleet_number || "").trim();
      const fallbackLabel = registration || fleetNumber || primaryKey;
      const displayLabel = registration && fleetNumber ? `${fleetNumber} - ${registration}` : fallbackLabel;

      const nextVehicle: ConnectedVehicle = {
        id: primaryKey,
        phone: secondaryKey || "",
        channels: uniqueChannelRows.map((liveRow) => ({
          logicalChannel: liveRow.channel,
          channel: liveRow.channel,
          updatedAtMs: liveRow.updatedAtMs,
        })),
        connected: uniqueChannelRows.length > 0,
        registration: registration || undefined,
        fleetNumber: fleetNumber || undefined,
        displayLabel: displayLabel || primaryKey,
      };

      const dedupeKey = toVehicleKey(nextVehicle);
      const existing = dedupedById.get(dedupeKey);
      if (!existing) {
        dedupedById.set(dedupeKey, nextVehicle);
        continue;
      }

      dedupedById.set(dedupeKey, {
        ...existing,
        ...nextVehicle,
        channels: nextVehicle.channels?.length ? nextVehicle.channels : existing.channels,
        connected: existing.connected === true || nextVehicle.connected === true,
        displayLabel: String(nextVehicle.displayLabel || existing.displayLabel || dedupeKey).trim(),
      });
    }

    const enrichedVehicles = Array.from(dedupedById.values()).sort((a, b) => {
      const aConnected = a.connected === true ? 0 : 1;
      const bConnected = b.connected === true ? 0 : 1;
      if (aConnected !== bConnected) return aConnected - bConnected;
      return String(a.displayLabel || "").localeCompare(String(b.displayLabel || ""));
    });

    setVehicles(enrichedVehicles);
    setLastRefresh(new Date());
    setRefreshToken(Date.now());
    return enrichedVehicles;
  }, [supabase]);

  const refreshAll = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      await fetchConnectedVehicles();
    } catch (fetchError) {
      console.error("[Screenshots] Refresh failed:", fetchError);
      setError("Unable to refresh screenshot monitor right now.");
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }, [fetchConnectedVehicles]);

  useEffect(() => {
    let active = true;
    const boot = async () => {
      try {
        await refreshAll();
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
  }, [refreshAll]);

  useEffect(() => {
    const pollingInterval = setInterval(() => {
      void refreshAll();
    }, 30000);

    return () => clearInterval(pollingInterval);
  }, [refreshAll]);

  const connectedVehicles = useMemo(
    () => vehicles.filter((vehicle) => vehicle.connected === true),
    [vehicles]
  );

  const cards = useMemo<VehicleGroupCard[]>(() => {
    return vehicles
      .map((vehicle) => {
        const vehicleId = toVehicleKey(vehicle);
        if (!vehicleId) return null;

        const channels = getScreenshotChannels(vehicle.channels)
          .filter((channel) => channel === 1 || channel === 2)
          .map((channel) => {
            const liveRow = (vehicle.channels || []).find(
              (entry) => Number(entry.logicalChannel ?? entry.channel ?? 0) === Number(channel)
            );
            const timestamp = Number(liveRow?.updatedAtMs || 0) > 0
              ? new Date(Number(liveRow?.updatedAtMs)).toISOString()
              : undefined;

            return {
              channel,
              active: !!liveRow,
              imageUrl: buildScreenshotUrl(vehicle, channel, refreshToken),
              timestamp,
            } satisfies VehicleChannelCard;
          });

        return {
          vehicleId,
          displayLabel: String(vehicle.displayLabel || vehicleId).trim(),
          connected: vehicle.connected === true,
          channels,
        } satisfies VehicleGroupCard;
      })
      .filter((card): card is VehicleGroupCard => !!card)
      .sort((a, b) => {
        const aLatest = Math.max(...a.channels.map((channel) => parseDate(channel.timestamp)), 0);
        const bLatest = Math.max(...b.channels.map((channel) => parseDate(channel.timestamp)), 0);
        const aConnected = a.connected ? 0 : 1;
        const bConnected = b.connected ? 0 : 1;
        if (aConnected !== bConnected) return aConnected - bConnected;
        if (aLatest !== bLatest) return bLatest - aLatest;
        return a.displayLabel.localeCompare(b.displayLabel);
      });
  }, [refreshToken, vehicles]);

  const liveCount = useMemo(() => {
    const now = Date.now();
    return cards.flatMap((card) => card.channels).filter((channelCard) => {
      const ts = parseDate(channelCard.timestamp);
      return ts > 0 && now - ts <= LIVE_SCREENSHOT_WINDOW_MS;
    }).length;
  }, [cards, LIVE_SCREENSHOT_WINDOW_MS]);

  const gridClassName = useMemo(() => {
    switch (gridColumns) {
      case 1:
        return "grid grid-cols-1 gap-3";
      case 2:
        return "grid grid-cols-1 gap-3 md:grid-cols-2";
      case 3:
        return "grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3";
      case 4:
        return "grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4";
      case 5:
        return "grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5";
      case 6:
        return "grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-6";
      case 7:
        return "grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-7";
      case 8:
        return "grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-8";
      default:
        return "grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4";
    }
  }, [gridColumns]);

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
                Sandbox-backed screenshots for CH1 and CH2, refreshed every 30 seconds.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-slate-700 bg-slate-900/70 px-4 py-3">
                <p className="text-[11px] uppercase tracking-wide text-slate-400">Vehicles</p>
                <p className="mt-1 text-2xl font-bold text-emerald-300">{vehicles.length}</p>
                <p className="mt-1 text-[11px] text-slate-400">{connectedVehicles.length} connected</p>
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
            <Button onClick={() => void refreshAll()} disabled={refreshing} className="bg-cyan-600 hover:bg-cyan-700">
              <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            {detachable && (
              <Button
                variant="outline"
                onClick={() => window.open("/dashboard/screenshots-monitor", "screenshots-monitor", "popup=yes,width=1600,height=1000,resizable=yes,scrollbars=yes")}
                className="border-slate-600 bg-slate-900 text-slate-100 hover:bg-slate-800"
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                Pop Out Monitor
              </Button>
            )}
          </div>
        </div>
      </Card>

      {error && (
        <Card className="border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</Card>
      )}

      {loading ? (
        <Card className="p-10 text-center text-slate-600">Loading screenshot monitor...</Card>
      ) : cards.length === 0 ? (
        <Card className="p-10 text-center text-slate-600">No vehicles found in the catalog yet.</Card>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-2">
              <RadioTower className="h-5 w-5 text-slate-700" />
              <h3 className="text-lg font-semibold text-slate-900">Vehicle Screenshot Grid</h3>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Grid</span>
              {[1, 2, 3, 4, 5, 6, 7, 8].map((cols) => (
                <Button
                  key={cols}
                  type="button"
                  size="sm"
                  variant={gridColumns === cols ? "default" : "outline"}
                  className={gridColumns === cols ? "bg-slate-900 text-white hover:bg-slate-800" : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"}
                  onClick={() => setGridColumns(cols)}
                >
                  {cols}x{cols}
                </Button>
              ))}
            </div>
          </div>
          <div className={gridClassName}>
            {cards.map((card) => {
              const latestTimestamp = Math.max(...card.channels.map((channelCard) => parseDate(channelCard.timestamp)), 0);
              const hasScreenshot = card.channels.some((channelCard) => channelCard.active);
              return (
                <Card
                  key={card.vehicleId}
                  className="overflow-hidden border-slate-300 bg-white text-slate-900"
                >
                  <div className="border-b border-slate-200 px-3 py-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{card.displayLabel}</p>
                        <p className="mt-1 text-[11px] text-slate-500">
                          {card.connected ? "Connected" : "Offline"}
                          {" - "}
                          {latestTimestamp > 0
                            ? `Latest screenshot ${new Date(latestTimestamp).toLocaleTimeString()}`
                            : "Waiting for screenshots"}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                          hasScreenshot
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {hasScreenshot ? "Live" : "Idle"}
                      </span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 p-2">
                    {card.channels.map((channelCard) => (
                      <div
                        key={`${card.vehicleId}-${channelCard.channel}`}
                        className="overflow-hidden rounded-md border border-slate-300 bg-slate-950 text-slate-100"
                      >
                        <div className="relative aspect-video bg-slate-900">
                          {channelCard.active ? (
                            <img
                              src={channelCard.imageUrl}
                              alt={`Vehicle ${card.vehicleId} channel ${channelCard.channel}`}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full items-center justify-center text-slate-500">
                              <MonitorPlay className="h-8 w-8" />
                            </div>
                          )}
                          <div className="absolute right-2 top-2 rounded bg-black/70 px-2 py-1 text-[11px] font-medium">
                            CH {channelCard.channel}
                          </div>
                        </div>
                        <div className="flex items-start justify-between gap-3 border-t border-slate-800 px-3 py-2">
                          <div className="min-w-0">
                            <p className="text-[11px] text-slate-400">
                              {channelCard.timestamp
                                ? `Refreshed ${new Date(channelCard.timestamp).toLocaleTimeString()}`
                                : (channelCard.active ? "Waiting for image" : "Channel idle")}
                            </p>
                          </div>
                          {channelCard.active && (
                            <Button
                              size="icon"
                              variant="secondary"
                              className="h-7 w-7 shrink-0"
                              onClick={() => window.open(channelCard.imageUrl, "_blank")}
                              title="Open image"
                            >
                              <Download className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
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
