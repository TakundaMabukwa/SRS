/* eslint-disable @next/next/no-img-element */
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  costCenter?: string;
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
  isLive: boolean;
  imageUrl?: string;
  timestamp?: string;
  source?: "ws" | "stream";
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
  cost_center?: string | null;
};

type ScreenshotResult = {
  vehicleId?: string;
  channel?: number;
  ok?: boolean;
  fileUrl?: string;
  sourceUrl?: string;
};

type ScreenshotWsMessage = {
  type?: "snapshot" | "update";
  results?: ScreenshotResult[];
  result?: ScreenshotResult;
};

type ScreenshotEntry = {
  url: string;
  timestampMs: number;
  ok: boolean;
};

const LIVE_PREVIEW_BASE_URL =
  process.env.NEXT_PUBLIC_LIVE_PREVIEW_BASE_URL ||
  process.env.NEXT_PUBLIC_PLAYBACK_HUB_BASE_URL ||
  "";
const LIVE_PREVIEW_WS_URL =
  process.env.NEXT_PUBLIC_LIVE_PREVIEW_WS_URL ||
  "";
const LIVE_SCREENSHOT_WINDOW_MS = 10 * 60 * 1000;

function normalizeCostCenter(value: unknown): string {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function matchesCostCenterFilter(costCenter: string | undefined, selectedCostCenters: Set<string>) {
  if (selectedCostCenters.size === 0) return true;
  const normalized = normalizeCostCenter(costCenter);
  if (!normalized) {
    return selectedCostCenters.has("unassigned");
  }
  return selectedCostCenters.has(normalized);
}

function toVehicleKey(vehicle: ConnectedVehicle): string {
  return String(vehicle.id || vehicle.phone || "").trim();
}

function normalizeVehicleAlias(value: string): string {
  const trimmed = String(value || "").trim();
  if (!/^\d+$/.test(trimmed)) return trimmed;
  if (trimmed.startsWith("862") && trimmed.length > 12) {
    return trimmed.slice(3);
  }
  return trimmed;
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

function screenshotKey(vehicleId: string, channel: number): string {
  return `${String(vehicleId || "").trim()}|${Number(channel || 0)}`;
}

function buildVehicleCandidateIds(vehicle: ConnectedVehicle): string[] {
  const values = [vehicle.id, vehicle.phone]
    .map((value) => String(value || "").trim())
    .filter(Boolean);
  const out: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    const alias = normalizeVehicleAlias(value);
    if (!seen.has(value)) {
      out.push(value);
      seen.add(value);
    }
    if (alias && alias !== value && !seen.has(alias)) {
      out.push(alias);
      seen.add(alias);
    }
  }
  return out;
}

function toProxiedScreenshotUrl(rawValue: unknown): string {
  const raw = String(rawValue || "").trim();
  if (!raw) return "";

  if (raw.startsWith("/api/video-server/")) {
    return raw;
  }
  if (raw.startsWith("/api/")) {
    return `/api/video-server${raw.slice(4)}`;
  }
  if (raw.startsWith("/captures/") || raw.startsWith("/media/")) {
    return `/api/video-server${raw}`;
  }
  if (raw.startsWith("captures/")) {
    return `/api/video-server/${raw}`;
  }
  if (/^https?:\/\//i.test(raw)) {
    try {
      const parsed = new URL(raw);
      if (parsed.pathname.startsWith("/api/video-server/")) {
        return `${parsed.pathname}${parsed.search || ""}`;
      }
      if (parsed.pathname.startsWith("/api/")) {
        return `/api/video-server${parsed.pathname.slice(4)}${parsed.search || ""}`;
      }
      if (parsed.pathname.startsWith("/captures/") || parsed.pathname.startsWith("/media/")) {
        return `/api/video-server${parsed.pathname}${parsed.search || ""}`;
      }
    } catch {
      return raw;
    }
  }
  return raw;
}

function toScreenshotWsCandidates(): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const isHttps = typeof window !== "undefined" && window.location.protocol === "https:";

  const push = (url: string) => {
    const normalized = String(url || "").trim().replace(/\/+$/, "");
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    out.push(normalized);
  };

  const rawWs = String(LIVE_PREVIEW_WS_URL || "").trim();
  if (rawWs) {
    if (/^wss?:\/\//i.test(rawWs)) {
      try {
        const parsed = new URL(rawWs);
        const path = String(parsed.pathname || "").replace(/\/+$/, "");
        if (path && path !== "/") {
          push(`${parsed.protocol}//${parsed.host}${path}`);
        } else {
          push(`${parsed.protocol}//${parsed.host}/ws/screenshots`);
        }
      } catch {
        push(rawWs.replace(/\/+$/, "").replace(/\/ws\/screenshots$/i, "") + "/ws/screenshots");
      }
    } else if (/^https?:\/\//i.test(rawWs)) {
      try {
        const parsed = new URL(rawWs);
        const proto = parsed.protocol === "https:" ? "wss" : "ws";
        const path = String(parsed.pathname || "").replace(/\/+$/, "");
        if (path && path !== "/") {
          push(`${proto}://${parsed.host}${path}`);
        } else {
          push(`${proto}://${parsed.host}/ws/screenshots`);
        }
      } catch {
        // ignore invalid URL and continue with other candidates
      }
    }
  }

  const rawHttp = String(LIVE_PREVIEW_BASE_URL || "").trim();
  if (rawHttp) {
    try {
      const parsed = new URL(rawHttp);
      const proto = parsed.protocol === "https:" ? "wss" : "ws";
      if (isHttps) {
        push(`wss://${parsed.host}/ws/screenshots`);
      }
      push(`${proto}://${parsed.host}/ws/screenshots`);
      if (!isHttps && parsed.protocol !== "https:") {
        push(`ws://${parsed.host}/ws/screenshots`);
      }
    } catch {
      // ignore invalid URL
    }
  }

  // Only fall back to current window host when no explicit screenshot endpoints are configured.
  if (typeof window !== "undefined" && !rawWs && !rawHttp) {
    const host = window.location.host;
    if (host) {
      push(`${isHttps ? "wss" : "ws"}://${host}/ws/screenshots`);
    }
  }

  return out;
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
  selectedCostCenters?: string[];
};

export default function ScreenshotsDashboardTab({
  detachable = true,
  selectedCostCenters = [],
}: ScreenshotsDashboardTabProps) {
  const supabase = createClient();
  const wsRef = useRef<WebSocket | null>(null);
  const wsReconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wsUrlCursorRef = useRef(0);
  const [vehicles, setVehicles] = useState<ConnectedVehicle[]>([]);
  const [screenshotMap, setScreenshotMap] = useState<Record<string, ScreenshotEntry>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [lastScreenshotAt, setLastScreenshotAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [gridColumns, setGridColumns] = useState(4);

  const ingestScreenshotResult = useCallback((result: ScreenshotResult) => {
    const vehicleId = String(result.vehicleId || "").trim();
    const channel = Number(result.channel || 0);
    if (!vehicleId || !Number.isFinite(channel) || channel <= 0) return;

    const rawUrl = String(result.fileUrl || "").trim();
    if (!rawUrl) return;
    const normalizedUrl = toProxiedScreenshotUrl(rawUrl);
    if (!normalizedUrl) return;

    const nowMs = Date.now();
    const entries: Array<[string, ScreenshotEntry]> = [];
    const ids = [vehicleId, normalizeVehicleAlias(vehicleId)].filter(Boolean);
    for (const id of ids) {
      entries.push([
        screenshotKey(id, channel),
        {
          url: normalizedUrl,
          timestampMs: nowMs,
          ok: result.ok !== false,
        },
      ]);
    }

    setScreenshotMap((prev) => {
      const next = { ...prev };
      for (const [key, value] of entries) {
        next[key] = value;
      }
      return next;
    });
    setLastScreenshotAt(new Date(nowMs));
  }, []);

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
      .select("registration_number, fleet_number, camera_sim_id, camera_serial, cost_center");

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
        costCenter: String(row.cost_center || "").trim() || undefined,
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
    let active = true;
    const urls = toScreenshotWsCandidates();
    if (urls.length === 0) {
      setError("No screenshot websocket URL configured.");
      return () => {
        active = false;
      };
    }

    const clearReconnect = () => {
      if (wsReconnectTimerRef.current) {
        clearTimeout(wsReconnectTimerRef.current);
        wsReconnectTimerRef.current = null;
      }
    };

    const handleMessage = (event: MessageEvent<string>) => {
      let payload: ScreenshotWsMessage | null = null;
      try {
        payload = JSON.parse(event.data) as ScreenshotWsMessage;
      } catch {
        return;
      }
      if (!payload) return;
      if (payload.type === "snapshot" && Array.isArray(payload.results)) {
        payload.results.forEach(ingestScreenshotResult);
        return;
      }
      if (payload.type === "update" && payload.result) {
        ingestScreenshotResult(payload.result);
      }
    };

    const scheduleReconnect = () => {
      if (!active || wsReconnectTimerRef.current) return;
      wsReconnectTimerRef.current = setTimeout(() => {
        wsReconnectTimerRef.current = null;
        openSocket();
      }, 2500);
    };

    const openSocket = () => {
      if (!active || urls.length === 0) return;
      clearReconnect();

      const current = wsRef.current;
      if (current) {
        wsRef.current = null;
        current.onopen = null;
        current.onmessage = null;
        current.onerror = null;
        current.onclose = null;
        current.close();
      }

      let attempts = 0;
      const startIndex = wsUrlCursorRef.current % urls.length;

      const tryNext = () => {
        if (!active) return;
        if (attempts >= urls.length) {
          setWsConnected(false);
          scheduleReconnect();
          return;
        }

        const idx = (startIndex + attempts) % urls.length;
        const wsUrl = urls[idx];
        attempts += 1;

        let socket: WebSocket;
        try {
          socket = new WebSocket(wsUrl);
        } catch {
          tryNext();
          return;
        }

        wsRef.current = socket;
        wsUrlCursorRef.current = idx + 1;

        const openTimeout = setTimeout(() => {
          if (socket.readyState === WebSocket.CONNECTING) {
            socket.close();
          }
        }, 7000);

        socket.onopen = () => {
          clearTimeout(openTimeout);
          if (!active || wsRef.current !== socket) return;
          setWsConnected(true);
          setError(null);
          clearReconnect();
        };

        socket.onmessage = handleMessage;
        socket.onerror = () => {
          clearTimeout(openTimeout);
        };
        socket.onclose = () => {
          clearTimeout(openTimeout);
          if (wsRef.current === socket) {
            wsRef.current = null;
          }
          if (!active) return;
          setWsConnected(false);
          if (attempts < urls.length) {
            tryNext();
            return;
          }
          scheduleReconnect();
        };
      };

      tryNext();
    };

    openSocket();

    return () => {
      active = false;
      clearReconnect();
      const socket = wsRef.current;
      wsRef.current = null;
      if (socket) {
        socket.onopen = null;
        socket.onmessage = null;
        socket.onerror = null;
        socket.onclose = null;
        socket.close();
      }
    };
  }, [ingestScreenshotResult]);

  useEffect(() => {
    let active = true;

    const refreshFromLatest = async () => {
      try {
        const response = await fetch(`/api/video-server/live/screenshots/latest?_ts=${Date.now()}`, {
          cache: "no-store",
          signal: AbortSignal.timeout(20000),
        });
        if (!response.ok) return;
        const payload = await response.json().catch(() => ({} as Record<string, unknown>));
        const rows = Array.isArray(payload.results) ? payload.results as ScreenshotResult[] : [];
        if (!active || rows.length === 0) return;
        rows.forEach(ingestScreenshotResult);
      } catch {
        // keep quiet; websocket reconnect flow continues in parallel
      }
    };

    void refreshFromLatest();
    const timer = setInterval(() => {
      void refreshFromLatest();
    }, 30000);

    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [ingestScreenshotResult]);

  const selectedCostCenterSet = useMemo(
    () =>
      new Set(
        selectedCostCenters
          .map((value) => normalizeCostCenter(value))
          .filter(Boolean)
      ),
    [selectedCostCenters]
  );

  const scopedVehicles = useMemo(
    () => vehicles.filter((vehicle) => matchesCostCenterFilter(vehicle.costCenter, selectedCostCenterSet)),
    [selectedCostCenterSet, vehicles]
  );

  const connectedVehicles = useMemo(
    () => scopedVehicles.filter((vehicle) => vehicle.connected === true),
    [scopedVehicles]
  );

  const cards = useMemo<VehicleGroupCard[]>(() => {
    return scopedVehicles
      .map((vehicle) => {
        const vehicleId = toVehicleKey(vehicle);
        if (!vehicleId) return null;
        const candidateIds = buildVehicleCandidateIds(vehicle);

        const channels = getScreenshotChannels(vehicle.channels)
          .filter((channel) => channel === 1 || channel === 2)
          .map((channel) => {
            const liveRow = (vehicle.channels || []).find(
              (entry) => Number(entry.logicalChannel ?? entry.channel ?? 0) === Number(channel)
            );
            const streamTimestampMs = Number(liveRow?.updatedAtMs || 0);
            let shot: ScreenshotEntry | undefined;
            for (const id of candidateIds) {
              const entry = screenshotMap[screenshotKey(id, channel)];
              if (!entry) continue;
              if (!shot || entry.timestampMs > shot.timestampMs) {
                shot = entry;
              }
            }
            const shotTimestampMs = Number(shot?.timestampMs || 0);
            const timestampMs = Math.max(streamTimestampMs, shotTimestampMs);
            const timestamp = timestampMs > 0
              ? new Date(timestampMs).toISOString()
              : undefined;
            const isLive = shotTimestampMs > 0
              ? (Date.now() - shotTimestampMs) <= LIVE_SCREENSHOT_WINDOW_MS
              : !!liveRow;

            return {
              channel,
              active: vehicle.connected === true || !!liveRow || !!shot,
              isLive,
              imageUrl: shot?.url,
              timestamp,
              source: shot ? "ws" : "stream",
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
  }, [scopedVehicles, screenshotMap]);

  const liveCount = useMemo(() => {
    const now = Date.now();
    return cards.flatMap((card) => card.channels).filter((channelCard) => {
      const ts = parseDate(channelCard.timestamp);
      return ts > 0 && now - ts <= LIVE_SCREENSHOT_WINDOW_MS;
    }).length;
  }, [cards]);

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
                Websocket-backed screenshots for CH1 and CH2 from go-hub live feed.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-slate-700 bg-slate-900/70 px-4 py-3">
                <p className="text-[11px] uppercase tracking-wide text-slate-400">Vehicles</p>
                <p className="mt-1 text-2xl font-bold text-emerald-300">{scopedVehicles.length}</p>
                <p className="mt-1 text-[11px] text-slate-400">{connectedVehicles.length} connected</p>
              </div>
              <div className="rounded-lg border border-slate-700 bg-slate-900/70 px-4 py-3">
                <p className="text-[11px] uppercase tracking-wide text-slate-400">Live Channels</p>
                <p className="mt-1 text-2xl font-bold text-cyan-300">{liveCount}</p>
              </div>
              <div className="rounded-lg border border-slate-700 bg-slate-900/70 px-4 py-3">
                <p className="text-[11px] uppercase tracking-wide text-slate-400">Last Update</p>
                <p className="mt-1 text-sm font-semibold text-slate-100">
                  {lastScreenshotAt ? lastScreenshotAt.toLocaleTimeString() : (lastRefresh ? lastRefresh.toLocaleTimeString() : "Waiting...")}
                </p>
              </div>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button onClick={() => void refreshAll()} disabled={refreshing} className="bg-cyan-600 hover:bg-cyan-700">
              <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
              Refresh vehicles
            </Button>
            <div
              className={`rounded-full border px-3 py-1 text-xs font-medium ${
                wsConnected
                  ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-300"
                  : "border-amber-400/40 bg-amber-500/10 text-amber-300"
              }`}
            >
              {wsConnected ? "WS Connected" : "WS Reconnecting"}
            </div>
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
              const hasScreenshot = card.channels.some((channelCard) => channelCard.active || channelCard.isLive);
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
                          {channelCard.imageUrl ? (
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
                          {channelCard.source === "ws" && (
                            <div className="absolute left-2 top-2 rounded bg-cyan-500/80 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-white">
                              Live Shot
                            </div>
                          )}
                        </div>
                        <div className="flex items-start justify-between gap-3 border-t border-slate-800 px-3 py-2">
                          <div className="min-w-0">
                            <p className="text-[11px] text-slate-400">
                              {channelCard.timestamp
                                ? `Refreshed ${new Date(channelCard.timestamp).toLocaleTimeString()}`
                                : (channelCard.active ? "Awaiting websocket screenshot" : "Channel idle")}
                            </p>
                          </div>
                          {channelCard.imageUrl && (
                            <Button
                              size="icon"
                              variant="secondary"
                              className="h-7 w-7 shrink-0"
                              onClick={() => window.open(channelCard.imageUrl || "", "_blank")}
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
