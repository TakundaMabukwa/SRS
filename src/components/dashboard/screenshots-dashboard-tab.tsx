"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Camera, RefreshCw, Download, MonitorPlay, Shield, RadioTower, ExternalLink } from "lucide-react";
import { useVideoWebSocket } from "@/hooks/use-video-websocket";
import { createClient } from "@/lib/supabase/client";
import { resolveMediaUrlForCurrentOrigin } from "@/lib/video-alert-playback";

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
  registration?: string;
  fleetNumber?: string;
  displayLabel?: string;
};

type ScreenshotItem = {
  id: string;
  device_id?: string;
  channel?: number;
  storage_url?: string;
  display_url?: string;
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
  displayLabel: string;
  connected: boolean;
  channels: VehicleChannelCard[];
};
type CaptureAvailability = {
  failedAt?: number;
  reason?: string;
  status?: number;
  succeededAt?: number;
};

function isVideoChannel(channel: ChannelInfo): boolean {
  const channelType = (channel.type || "").toLowerCase();
  return channelType === "video" || channelType === "audio_video";
}

function getScreenshotChannels(channels: ChannelInfo[] | undefined): number[] {
  const discovered = (channels || [])
    .filter(isVideoChannel)
    .map((channel) => channel.logicalChannel ?? channel.channel ?? 1)
    .filter((value, index, values) => Number.isFinite(value) && value > 0 && values.indexOf(value) === index);

  return Array.from(new Set([...discovered, 1, 2])).sort((a, b) => a - b);
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

function mergeLatestScreenshots(current: ScreenshotItem[], incoming: ScreenshotItem[]): ScreenshotItem[] {
  const byKey = new Map<string, ScreenshotItem>();
  for (const shot of [...current, ...incoming]) {
    const deviceId = String(shot.device_id || "").trim();
    const channel = Number(shot.channel || 1);
    const uniqueId = String(shot.id || "").trim();
    const key = deviceId ? `${deviceId}:${channel}` : `id:${uniqueId || Math.random()}`;
    const existing = byKey.get(key);
    if (!existing || parseDate(shot.timestamp) >= parseDate(existing.timestamp)) {
      byKey.set(key, shot);
    }
  }
  return Array.from(byKey.values()).sort((a, b) => parseDate(b.timestamp) - parseDate(a.timestamp));
}

function buildTargets(vehicles: ConnectedVehicle[]): CaptureTarget[] {
  const targets: CaptureTarget[] = [];
  const seen = new Set<string>();

  for (const vehicle of vehicles) {
    const vehicleId = toVehicleKey(vehicle);
    if (!vehicleId) continue;

    const channels = getScreenshotChannels(vehicle.channels);

    for (const channel of channels) {
      const target = {
        vehicleId,
        channel,
      };
      const key = toTargetKey(target);
      if (!seen.has(key)) {
        seen.add(key);
        targets.push(target);
      }
    }
  }

  return targets;
}

type ScreenshotsDashboardTabProps = {
  detachable?: boolean;
};

export default function ScreenshotsDashboardTab({ detachable = true }: ScreenshotsDashboardTabProps) {
  const supabase = createClient();
  const [vehicles, setVehicles] = useState<ConnectedVehicle[]>([]);
  const [screenshots, setScreenshots] = useState<ScreenshotItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [gridColumns, setGridColumns] = useState(4);
  const vehiclesRef = useRef<ConnectedVehicle[]>([]);
  const lastWsRefreshAt = useRef(0);
  const captureAvailabilityRef = useRef<Map<string, CaptureAvailability>>(new Map());
  const SCREENSHOT_FAILURE_COOLDOWN_MS = 90_000;
  const LIVE_SCREENSHOT_WINDOW_MS = 10 * 60 * 1000;
  const captureFailureSummary = (() => {
    const reasons = Array.from(captureAvailabilityRef.current.values())
      .map((entry) => String(entry.reason || "").trim())
      .filter(Boolean);
    if (!reasons.length) return null;
    const counts = new Map<string, number>();
    for (const reason of reasons) {
      counts.set(reason, (counts.get(reason) || 0) + 1);
    }
    const [topReason, topCount] = Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0] || [];
    if (!topReason) return null;
    return { reason: topReason, count: topCount || 0 };
  })();

  const withCacheBust = useCallback((url: string, seed?: string | number) => {
    const value = String(url || "").trim();
    if (!value) return "";
    const suffix = `_ts=${encodeURIComponent(String(seed ?? Date.now()))}`;
    return value.includes("?") ? `${value}&${suffix}` : `${value}?${suffix}`;
  }, []);

  const toDisplayUrl = useCallback((raw?: string) => {
    const value = String(raw || "").trim();
    if (!value || value === "upload-failed" || value === "local-only") return "";
    let normalized = value;
    if (normalized.startsWith("/api/images/")) {
      normalized = `/api/video-server/images/${normalized.slice("/api/images/".length)}`;
    } else if (!/^https?:\/\//i.test(normalized) && normalized.startsWith("/images/")) {
      normalized = `/api/video-server${normalized}`;
    } else if (!/^https?:\/\//i.test(normalized) && !normalized.startsWith("/")) {
      normalized = `/${normalized.replace(/^\/+/, "")}`;
    }
    return resolveMediaUrlForCurrentOrigin(normalized);
  }, []);

  const resolveRenderableImageUrl = useCallback(async (rawUrl: string, retries = 5, delayMs = 500) => {
    const baseUrl = String(rawUrl || "").trim();
    if (!baseUrl) return "";
    for (let attempt = 0; attempt < retries; attempt++) {
      const tryUrl = withCacheBust(baseUrl, `${Date.now()}-${attempt}`);
      try {
        const response = await fetch(tryUrl, { cache: "no-store" });
        if (response.ok) {
          const blob = await response.blob();
          if (blob.size > 0) {
            return URL.createObjectURL(blob);
          }
        }
      } catch {
        // retry
      }
      if (attempt < retries - 1) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
    return "";
  }, [withCacheBust]);

  const fetchConnectedVehicles = useCallback(async () => {
    let connectedVehicles: ConnectedVehicle[] = [];
    try {
      const response = await fetch("/api/video-server/vehicles/connected", { cache: "no-store" });
      if (response.ok) {
        const data = await response.json();
        connectedVehicles = Array.isArray(data) ? data : [];
      }
    } catch {
      // Continue with DB catalog even if connected endpoint is down.
    }

    const connectedByKey = new Map<string, ConnectedVehicle>();
    for (const vehicle of connectedVehicles) {
      const keys = [vehicle.id, vehicle.phone]
        .map((value) => String(value || "").trim())
        .filter(Boolean);
      for (const key of keys) {
        if (!connectedByKey.has(key)) connectedByKey.set(key, vehicle);
      }
    }

    const { data: vehicleRows, error: vehiclesError } = await supabase
      .from("vehiclesc")
      .select("registration_number, fleet_number, camera_sim_id, camera_serial");

    if (vehiclesError) {
      throw new Error("Failed to load vehicle catalog");
    }

    const catalogVehicles: ConnectedVehicle[] = [];
    for (const row of vehicleRows || []) {
      const keys = [row?.camera_sim_id, row?.camera_serial]
        .map((value) => String(value || "").trim())
        .filter(Boolean);
      if (keys.length === 0) continue;

      const connectedMatch =
        keys
          .map((key) => connectedByKey.get(key))
          .find(Boolean) || null;
      const primaryKey = keys[0];
      const secondaryKey = keys[1] || "";
      const registration = String(row?.registration_number || "").trim();
      const fleetNumber = String(row?.fleet_number || "").trim();
      const fallbackLabel = registration || fleetNumber || primaryKey;
      const displayLabel =
        registration && fleetNumber
          ? `${fleetNumber} - ${registration}`
          : fallbackLabel;

      catalogVehicles.push({
        id: primaryKey,
        phone: secondaryKey || connectedMatch?.phone || "",
        channels: connectedMatch?.channels,
        connected: !!connectedMatch && connectedMatch.connected !== false,
        registration: registration || undefined,
        fleetNumber: fleetNumber || undefined,
        displayLabel: displayLabel || primaryKey,
      });
    }

    const dedupedById = new Map<string, ConnectedVehicle>();
    for (const vehicle of catalogVehicles) {
      const key = String(toVehicleKey(vehicle) || "").trim();
      if (!key) continue;
      const existing = dedupedById.get(key);
      if (!existing) {
        dedupedById.set(key, vehicle);
        continue;
      }
      dedupedById.set(key, {
        ...existing,
        ...vehicle,
        channels: vehicle.channels || existing.channels,
        connected: (existing.connected === true || vehicle.connected === true),
        displayLabel: String(vehicle.displayLabel || existing.displayLabel || key).trim(),
      });
    }

    const enrichedVehicles = Array.from(dedupedById.values()).sort((a, b) =>
      String(a.displayLabel || "").localeCompare(String(b.displayLabel || ""))
    );

    vehiclesRef.current = enrichedVehicles;
    setVehicles(enrichedVehicles);
    return enrichedVehicles as ConnectedVehicle[];
  }, [supabase]);

  const fetchRecentScreenshots = useCallback(async () => {
    try {
      const response = await fetch("/api/video-server/screenshots/recent?limit=300&minutes=10");
      if (!response.ok) {
        setError("Recent screenshots endpoint is temporarily unavailable.");
        return [];
      }

      const data = await response.json();
      const rows = Array.isArray(data?.screenshots) ? data.screenshots : [];
      const validRows = rows
        .map((row: ScreenshotItem) => ({
          ...row,
          storage_url: withCacheBust(
            toDisplayUrl(row.storage_url),
            row.timestamp || row.id || Date.now()
          ),
          display_url: withCacheBust(
            toDisplayUrl(row.storage_url),
            row.timestamp || row.id || Date.now()
          ),
        }))
        .filter((row: ScreenshotItem) => row.storage_url && row.storage_url.length > 0);

      console.info("[Screenshots] Recent feed rows", {
        totalRows: rows.length,
        validRows: validRows.length,
        rows: rows.map((row: ScreenshotItem) => ({
          id: row.id,
          deviceId: row.device_id,
          channel: row.channel ?? 1,
          timestamp: row.timestamp,
          rawUrl: row.storage_url,
          displayUrl: toDisplayUrl(row.storage_url),
        })),
      });

      setScreenshots((current) => mergeLatestScreenshots(current, validRows));
      setLastRefresh(new Date());
      return validRows as ScreenshotItem[];
    } catch {
      setError("Recent screenshots request failed. Retrying automatically.");
      return [];
    }
  }, [toDisplayUrl, withCacheBust]);

  const requestScreenshot = useCallback(async (target: CaptureTarget) => {
    const targetKey = toTargetKey(target);
    const availability = captureAvailabilityRef.current.get(targetKey);
    if (availability?.failedAt && Date.now() - availability.failedAt < SCREENSHOT_FAILURE_COOLDOWN_MS) {
      return false;
    }

    const candidateVehicleIds = [String(target.vehicleId || "").trim()].filter(Boolean);

    for (const candidateId of candidateVehicleIds) {
      const response = await fetch(`/api/video-server/vehicles/${candidateId}/screenshot`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel: target.channel,
          fallback: true,
          fallbackDelayMs: 600,
        }),
      });

      const payload = await response.json().catch(() => null);
      const fallbackReason = String(
        payload?.fallback?.reason ||
        payload?.message ||
        ""
      ).trim();
      const returnedUrl = String(
        payload?.storage_url ||
        payload?.screenshot?.storage_url ||
        payload?.screenshot?.url ||
        payload?.url ||
        ""
      ).trim();
      const imageId = String(payload?.fallback?.imageId || payload?.imageId || "").trim();
      const liveFrameUrl = String(payload?.liveFrameUrl || "").trim();
      const immediateImageUrl = liveFrameUrl
        ? withCacheBust(toDisplayUrl(liveFrameUrl))
        : returnedUrl
          ? withCacheBust(toDisplayUrl(returnedUrl))
        : imageId
          ? withCacheBust(`/api/video-server/images/${encodeURIComponent(imageId)}/file`)
          : "";

      console.info("[Screenshots] Capture response", {
        requestedVehicleId: target.vehicleId,
        candidateId,
        channel: target.channel,
        status: response.status,
        ok: response.ok,
        success: payload?.success,
        fallbackOk: payload?.fallback?.ok,
        fallbackReason,
        returnedUrl,
        imageId,
        liveFrameUrl,
        immediateImageUrl,
        payload,
      });

      if (response.ok) {
        const fallbackOk = payload?.fallback?.ok !== false;
        const success = payload?.success !== false && fallbackOk;
        if (success && immediateImageUrl) {
          const renderableUrl = await resolveRenderableImageUrl(immediateImageUrl);
          setScreenshots((current) => {
            const nextShot: ScreenshotItem = {
              id: imageId || `optimistic-${candidateId}-${target.channel}-${Date.now()}`,
              device_id: candidateId || target.vehicleId,
              channel: target.channel,
              storage_url: immediateImageUrl,
              display_url: renderableUrl || immediateImageUrl,
              timestamp: new Date().toISOString(),
            };
            return mergeLatestScreenshots(current, [nextShot]);
          });
        }
        captureAvailabilityRef.current.set(targetKey, {
          failedAt: success ? undefined : Date.now(),
          reason: success ? undefined : (fallbackReason || "Screenshot request did not produce an image"),
          status: response.status,
          succeededAt: success ? Date.now() : undefined,
        });
        return success;
      }

      if (response.status === 404) {
        continue;
      }

      captureAvailabilityRef.current.set(targetKey, {
        failedAt: Date.now(),
        reason: fallbackReason || `Screenshot request failed (${response.status})`,
        status: response.status,
      });
    }

    captureAvailabilityRef.current.set(targetKey, {
      failedAt: Date.now(),
      reason: "Vehicle did not accept screenshot capture",
      status: 404,
    });
    return false;
  }, [resolveRenderableImageUrl, toDisplayUrl, withCacheBust]);

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
      void fetchRecentScreenshots();
    }, 8000);
    return () => clearInterval(pollingInterval);
  }, [fetchRecentScreenshots]);

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

    return vehicles
      .map((vehicle) => {
        const vehicleId = toVehicleKey(vehicle);
        if (!vehicleId) return null;
        const lookupIds = Array.from(
          new Set([vehicle.id, vehicle.phone].map((value) => String(value || "").trim()).filter(Boolean))
        );
        const dedupedChannels = getScreenshotChannels(vehicle.channels).filter(
          (channel) => Number(channel) === 1 || Number(channel) === 2
        );
        const channelsToRender = dedupedChannels.length > 0 ? dedupedChannels : [1, 2];

        const groupedChannels = channelsToRender.map((channel) => ({
          channel,
          screenshot:
            lookupIds
              .map((lookupId) => latestByDeviceChannel.get(`${lookupId}:${channel}`))
              .find(Boolean),
        }));

        return {
          vehicleId,
          displayLabel: String(vehicle.displayLabel || vehicleId).trim(),
          connected: vehicle.connected !== false,
          channels: groupedChannels.sort((a, b) => a.channel - b.channel),
        };
      })
      .filter((card): card is VehicleGroupCard => !!card && card.vehicleId.length > 0 && card.displayLabel.length > 0)
      .sort((a, b) => {
        const aLatest = Math.max(...a.channels.map((channel) => parseDate(channel.screenshot?.timestamp)), 0);
        const bLatest = Math.max(...b.channels.map((channel) => parseDate(channel.screenshot?.timestamp)), 0);
        const aHasScreenshot = aLatest > 0;
        const bHasScreenshot = bLatest > 0;
        if (aHasScreenshot !== bHasScreenshot) {
          return aHasScreenshot ? -1 : 1;
        }
        if (aLatest !== bLatest) return bLatest - aLatest;
        return a.displayLabel.localeCompare(b.displayLabel);
      });
  }, [vehicles, screenshots]);

  const liveCount = useMemo(() => {
    const now = Date.now();
    return cards.flatMap((card) => card.channels).filter((channelCard) => {
      const ts = parseDate(channelCard.screenshot?.timestamp);
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
                Server-backed snapshots from connected live channels with live refresh.
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
            <Button variant="outline" onClick={() => void runCaptureCycle()} disabled={capturing} className="border-slate-600 bg-slate-900 text-slate-100 hover:bg-slate-800">
              <Camera className={`mr-2 h-4 w-4 ${capturing ? "animate-pulse" : ""}`} />
              Capture Now
            </Button>
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
      {!error && screenshots.length === 0 && captureFailureSummary && (
        <Card className="border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          Screenshot capture is not producing images right now. Most recent backend reason: {captureFailureSummary.reason}
          {captureFailureSummary.count > 1 ? ` (${captureFailureSummary.count} channels)` : ""}.
        </Card>
      )}

      {loading ? (
        <Card className="p-10 text-center text-slate-600">Loading screenshot monitor...</Card>
      ) : cards.length === 0 ? (
        <Card className="p-10 text-center text-slate-600">
          No vehicles found in the catalog yet.
        </Card>
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
              const latestTimestamp = Math.max(...card.channels.map((channelCard) => parseDate(channelCard.screenshot?.timestamp)), 0);
              const hasScreenshot = card.channels.some((channelCard) => !!channelCard.screenshot?.storage_url);
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
                        {hasScreenshot ? "Has screenshots" : "No screenshots"}
                      </span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 p-2">
                    {card.channels.map((channelCard) => {
                      const shot = channelCard.screenshot;
                      const availability = captureAvailabilityRef.current.get(
                        `${card.vehicleId}:${channelCard.channel}`
                      );
                      return (
                        <div
                          key={`${card.vehicleId}-${channelCard.channel}`}
                          className="overflow-hidden rounded-md border border-slate-300 bg-slate-950 text-slate-100"
                        >
                          <div className="relative aspect-video bg-slate-900">
                            {shot?.storage_url ? (
                              <img
                                src={shot.display_url || shot.storage_url}
                                alt={`Vehicle ${card.vehicleId} channel ${channelCard.channel}`}
                                className="h-full w-full object-cover"
                                onLoad={() => {
                                  console.info("[Screenshots] Image loaded", {
                                    vehicleId: card.vehicleId,
                                    channel: channelCard.channel,
                                    url: shot.display_url || shot.storage_url,
                                  });
                                }}
                                onError={() => {
                                  console.error("[Screenshots] Image failed to load", {
                                    vehicleId: card.vehicleId,
                                    channel: channelCard.channel,
                                    url: shot.display_url || shot.storage_url,
                                  });
                                }}
                                ref={(img) => {
                                  if (!img) return;
                                  img.onerror = () => {
                                    const attemptedRetry = img.dataset.retryAttempted === "true";
                                    if (!attemptedRetry) {
                                      img.dataset.retryAttempted = "true";
                                      img.src = withCacheBust(
                                        shot.display_url || shot.storage_url || "",
                                        Date.now()
                                      );
                                      return;
                                    }
                                    console.error("[Screenshots] Image failed after retry", {
                                      vehicleId: card.vehicleId,
                                      channel: channelCard.channel,
                                      url: shot.display_url || shot.storage_url,
                                    });
                                  };
                                }}
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
                                {shot?.timestamp
                                  ? new Date(shot.timestamp).toLocaleTimeString()
                                  : (availability?.reason || "Waiting for image")}
                              </p>
                            </div>
                            {shot?.storage_url && (
                              <Button
                                size="icon"
                                variant="secondary"
                                className="h-7 w-7 shrink-0"
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

