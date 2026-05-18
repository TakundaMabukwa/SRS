"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
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
  costCenter?: string;
  displayLabel?: string;
  connected?: boolean;
  activeStreams?: number[];
}

type VehicleCatalogRow = {
  registration_number?: string | null;
  fleet_number?: string | null;
  camera_sim_id?: string | null;
  camera_serial?: string | null;
  cost_center?: string | null;
};

type RuntimeRecord = Record<string, unknown>;
type LiveVideoStreamRow = {
  vehicleId?: string;
  channel?: number;
  updatedAtMs?: number;
};

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

const RUNTIME_HEARTBEAT_GRACE_MS = 3 * 60 * 1000;
const RUNTIME_SNAPSHOT_GRACE_MS = 2 * 60 * 1000;

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

type LiveStreamTabProps = {
  selectedCostCenters?: string[];
};

function normalizeVehicleIdentifier(value: string): string {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "";
  if (!/^\d+$/.test(trimmed)) return trimmed;

  let normalized = trimmed.replace(/^0+/, "");
  if (!normalized) normalized = "0";
  if (normalized.startsWith("862") && normalized.length > 12) {
    normalized = normalized.slice(3);
  }
  return normalized;
}

function vehicleKeyCandidates(...values: Array<string | undefined>): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    const raw = String(value || "").trim();
    if (raw && !seen.has(raw)) {
      out.push(raw);
      seen.add(raw);
    }
    const normalized = normalizeVehicleIdentifier(raw);
    if (normalized && !seen.has(normalized)) {
      out.push(normalized);
      seen.add(normalized);
    }
  }
  return out;
}

function isRecentTimestamp(value: unknown, thresholdMs = RUNTIME_HEARTBEAT_GRACE_MS): boolean {
  const raw = String(value || "").trim();
  if (!raw) return false;
  const ts = new Date(raw).getTime();
  if (!Number.isFinite(ts) || ts <= 0) return false;
  return Date.now() - ts <= thresholdMs;
}

function getChannelNumber(channel: VehicleChannel | number | string): number {
  if (typeof channel === "number") return channel;
  if (typeof channel === "string") {
    const parsed = Number(channel);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return channel.logicalChannel ?? channel.channel ?? 1;
}

function getWarmChannelsFromList(channels: Array<VehicleChannel | number | string> | undefined): number[] {
  return Array.isArray(channels)
    ? channels
        .map(getChannelNumber)
        .filter((value, index, values) => Number.isFinite(value) && value > 0 && values.indexOf(value) === index)
        .sort((a, b) => a - b)
    : [];
}

function getWarmChannelNumbers(vehicle: Pick<ConnectedVehicle, "channels" | "activeStreams">): number[] {
  const active = Array.isArray(vehicle.activeStreams)
    ? vehicle.activeStreams
        .map((value) => Number(value))
        .filter((value, index, values) => Number.isFinite(value) && value > 0 && values.indexOf(value) === index)
        .sort((a, b) => a - b)
    : [];

  return active.length ? active : getWarmChannelsFromList(vehicle.channels);
}

function toVehicleKey(vehicle: ConnectedVehicle): string {
  return (
    normalizeVehicleIdentifier(String(vehicle.id || "").trim()) ||
    normalizeVehicleIdentifier(String(vehicle.phone || "").trim()) ||
    String(vehicle.id || vehicle.phone || "").trim()
  );
}

function readRuntimeRecord(value: unknown): RuntimeRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as RuntimeRecord)
    : {};
}

function parseLiveVideoRows(payload: unknown): LiveVideoStreamRow[] {
  const root = readRuntimeRecord(payload);
  const rows = Array.isArray(root.rows)
    ? root.rows
    : Array.isArray(root.data)
      ? root.data
      : [];

  return rows
    .map((entry) => {
      const record = readRuntimeRecord(entry);
      const vehicleId = String(record.vehicleId ?? record.id ?? "").trim();
      const channel = Number(record.channel ?? 0);
      const updatedAtMs = Number(record.updatedAtMs ?? 0);
      if (!vehicleId || !Number.isFinite(channel) || channel <= 0) {
        return null;
      }

      return {
        vehicleId,
        channel,
        updatedAtMs: Number.isFinite(updatedAtMs) ? updatedAtMs : undefined,
      } satisfies LiveVideoStreamRow;
    })
    .filter((row): row is LiveVideoStreamRow => !!row);
}

function parseRuntimeVehicles(payload: unknown): ConnectedVehicle[] {
  const root = readRuntimeRecord(payload);
  const rootData = readRuntimeRecord(root.data);
  const rows = Array.isArray(payload)
    ? payload
    : Array.isArray(root.data)
      ? root.data
      : Array.isArray(root.vehicles)
        ? root.vehicles
        : Array.isArray(rootData.vehicles)
          ? rootData.vehicles
          : [];

  const fromVehicles = rows
    .map((entry) => {
      const record = readRuntimeRecord(entry);
      const id = String(
        record.id ??
          record.vehicleId ??
          record.deviceId ??
          record.phone ??
          ""
      ).trim();
      if (!id) return null;

      const phone = String(record.phone ?? "").trim();
      const channelsRaw = Array.isArray(record.channels) ? record.channels : [];
      const channels = channelsRaw
        .map((channelEntry) => {
          if (typeof channelEntry === "number" || typeof channelEntry === "string") {
            const primitive = Number(channelEntry);
            if (!Number.isFinite(primitive) || primitive <= 0) return null;
            return {
              logicalChannel: primitive,
              channel: primitive,
            } satisfies VehicleChannel;
          }
          const channelRecord = readRuntimeRecord(channelEntry);
          const channel = Number(
            channelRecord.logicalChannel ??
              channelRecord.channel ??
              channelRecord.channelId ??
              0
          );
          if (!Number.isFinite(channel) || channel <= 0) return null;
          return {
            logicalChannel: channel,
            channel,
          } satisfies VehicleChannel;
        })
        .filter((channel): channel is VehicleChannel => !!channel);

      const activeStreams = Array.isArray(record.activeStreams)
        ? record.activeStreams
            .map((value) => Number(value))
            .filter((value, index, values) => Number.isFinite(value) && value > 0 && values.indexOf(value) === index)
            .sort((a, b) => a - b)
        : [];
      const connectedFlag = record.connected !== false;
      const hasActiveChannels = activeStreams.length > 0 || channels.length > 0;
      const hasRecentHeartbeat = isRecentTimestamp(
        record.lastHeartbeat ?? record.lastSeenAt ?? record.last_seen ?? record.updatedAt
      );
      const connected = connectedFlag || hasActiveChannels || hasRecentHeartbeat;

      return {
        id,
        name: String(record.displayLabel ?? record.registration ?? id).trim() || id,
        phone,
        channels,
        connected,
        activeStreams,
      } satisfies ConnectedVehicle;
    })
    .filter((vehicle): vehicle is ConnectedVehicle => !!vehicle);

  if (fromVehicles.length > 0) {
    return fromVehicles;
  }

  const liveRows = parseLiveVideoRows(payload);
  const byVehicle = new Map<string, Set<number>>();
  for (const row of liveRows) {
    const vehicleId = String(row.vehicleId || "").trim();
    const channel = Number(row.channel || 0);
    if (!vehicleId || !Number.isFinite(channel) || channel <= 0) continue;
    if (!byVehicle.has(vehicleId)) byVehicle.set(vehicleId, new Set<number>());
    byVehicle.get(vehicleId)?.add(channel);
  }

  return Array.from(byVehicle.entries()).map(([vehicleId, channelSet]) => {
    const channels = Array.from(channelSet).sort((a, b) => a - b);
    return {
      id: vehicleId,
      name: vehicleId,
      channels: channels.map((channel) => ({ logicalChannel: channel, channel })),
      connected: true,
      activeStreams: channels,
    } satisfies ConnectedVehicle;
  });
}

function parseConnectedVehicles(payload: unknown): ConnectedVehicle[] {
  const root = readRuntimeRecord(payload);
  const rows = Array.isArray(payload)
    ? payload
    : Array.isArray(root.data)
      ? root.data
      : Array.isArray(root.vehicles)
        ? root.vehicles
        : [];

  return rows
    .map((entry) => {
      const record = readRuntimeRecord(entry);
      const vehicleId = String(record.id ?? record.vehicleId ?? record.phone ?? "").trim();
      if (!vehicleId) return null;

      const channelsRaw = Array.isArray(record.channels) ? record.channels : [];
      const channels = getWarmChannelsFromList(channelsRaw as Array<VehicleChannel | number | string>);
      const activeStreams = Array.isArray(record.activeStreams)
        ? record.activeStreams
            .map((value) => Number(value))
            .filter((value, index, values) => Number.isFinite(value) && value > 0 && values.indexOf(value) === index)
            .sort((a, b) => a - b)
        : channels;

      const warm = activeStreams.length ? activeStreams : channels;
      const connectedFlag = record.connected === true;
      const hasRecentHeartbeat = isRecentTimestamp(
        record.lastHeartbeat ?? record.lastSeenAt ?? record.last_seen ?? record.updatedAt
      );
      return {
        id: vehicleId,
        name: vehicleId,
        phone: String(record.phone ?? "").trim(),
        channels: warm.map((channel) => ({ logicalChannel: channel, channel })),
        connected: connectedFlag || warm.length > 0 || hasRecentHeartbeat,
        activeStreams: warm,
      } satisfies ConnectedVehicle;
    })
    .filter((row): row is ConnectedVehicle => !!row);
}

function mergeRuntimeVehicleRecords(left: ConnectedVehicle, right: ConnectedVehicle): ConnectedVehicle {
  const leftChannels = getWarmChannelNumbers(left);
  const rightChannels = getWarmChannelNumbers(right);
  const channels = Array.from(new Set([...leftChannels, ...rightChannels]))
    .filter((value) => Number.isFinite(value) && value > 0)
    .sort((a, b) => a - b);

  return {
    ...left,
    ...right,
    id: String(left.id || right.id || "").trim(),
    phone: String(left.phone || right.phone || "").trim(),
    displayLabel: String(right.displayLabel || left.displayLabel || right.name || left.name || left.id).trim(),
    name: String(right.name || left.name || right.displayLabel || left.displayLabel || left.id).trim(),
    connected: left.connected === true || right.connected === true || channels.length > 0,
    channels: channels.map((channel) => ({ logicalChannel: channel, channel })),
    activeStreams: channels,
  };
}

function mergeRuntimeIntoCatalog(
  catalogVehicles: ConnectedVehicle[],
  runtimeVehicles: ConnectedVehicle[]
): ConnectedVehicle[] {
  const runtimeByKey = new Map<string, ConnectedVehicle>();

  for (const vehicle of runtimeVehicles) {
    const keys = vehicleKeyCandidates(vehicle.id, vehicle.phone);
    for (const key of keys) {
      const existing = runtimeByKey.get(key);
      runtimeByKey.set(key, existing ? mergeRuntimeVehicleRecords(existing, vehicle) : vehicle);
    }
  }

  const mapped = catalogVehicles
    .map((vehicle) => {
      const runtimeMatch =
        vehicleKeyCandidates(vehicle.id, vehicle.phone)
          .filter(Boolean)
          .map((key) => runtimeByKey.get(key))
          .find(Boolean) || null;

      if (!runtimeMatch) {
        return {
          ...vehicle,
          connected: false,
          channels: [],
          activeStreams: [],
        };
      }

      const warmChannels = getWarmChannelNumbers(runtimeMatch);

      return {
        ...vehicle,
        phone: vehicle.phone || runtimeMatch.phone || "",
        name: vehicle.displayLabel || runtimeMatch.name || runtimeMatch.id,
        channels: warmChannels.map((channel) => ({
          logicalChannel: channel,
          channel,
        })),
        connected: runtimeMatch.connected === true || warmChannels.length > 0,
        activeStreams: warmChannels,
      };
    });

  const mappedKeys = new Set(
    mapped.flatMap((vehicle) => vehicleKeyCandidates(vehicle.id, vehicle.phone))
  );
  const runtimeOnly = runtimeVehicles
    .filter((vehicle) => {
      const keys = vehicleKeyCandidates(vehicle.id, vehicle.phone);
      return !keys.some((key) => mappedKeys.has(key));
    })
    .map((vehicle) => {
      const displayLabel = String(vehicle.displayLabel || vehicle.name || vehicle.id || "").trim();
      return {
        ...vehicle,
        displayLabel,
        name: displayLabel || vehicle.id,
      };
    });

  return [...mapped, ...runtimeOnly].sort((a, b) => {
    const statusDiff = getVehicleStatusRank(a) - getVehicleStatusRank(b);
    if (statusDiff !== 0) return statusDiff;
    return String(a.displayLabel || a.name || "").localeCompare(String(b.displayLabel || b.name || ""));
  });
}

function getActiveStreamCount(vehicle: ConnectedVehicle): number {
  return getWarmChannelNumbers(vehicle).length;
}

function isVehicleOnline(vehicle: ConnectedVehicle): boolean {
  return vehicle.connected === true || getActiveStreamCount(vehicle) > 0;
}

function getVehicleStatusRank(vehicle: ConnectedVehicle): number {
  return isVehicleOnline(vehicle) ? 0 : 1;
}

export default function LiveStreamTab({ selectedCostCenters = [] }: LiveStreamTabProps) {
  const [vehicles, setVehicles] = useState<ConnectedVehicle[]>([]);
  const [selectedVehicles, setSelectedVehicles] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [gridColumns, setGridColumns] = useState(4);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pinnedFeed, setPinnedFeed] = useState<PinnedFeed | null>(null);
  const [pipPosition, setPipPosition] = useState({ x: 24, y: 96 });
  const [isDraggingPip, setIsDraggingPip] = useState(false);
  const pipDragOffsetRef = useRef({ x: 0, y: 0 });
  const catalogVehiclesRef = useRef<ConnectedVehicle[]>([]);
  const runtimeSnapshotRef = useRef<ConnectedVehicle[]>([]);
  const runtimeSnapshotAtRef = useRef(0);
  const supabase = createClient();

  const fetchCatalogVehicles = useCallback(async () => {
    const { data: vehicleRows, error: vehiclesError } = await supabase
      .from("vehiclesc")
      .select("registration_number, fleet_number, camera_sim_id, camera_serial, cost_center");

    if (vehiclesError) {
      throw new Error("Failed to load vehicle catalog");
    }

    const dedupedByKey = new Map<string, ConnectedVehicle>();
    for (const rawRow of vehicleRows || []) {
      const row = rawRow as VehicleCatalogRow;
      const keys = [row.camera_sim_id, row.camera_serial]
        .map((value) => String(value || "").trim())
        .filter(Boolean);
      if (keys.length === 0) continue;

      const primaryKey = keys[0];
      const secondaryKey = keys[1] || "";
      const registration = String(row.registration_number || "").trim();
      const fleetNumber = String(row.fleet_number || "").trim();
      const fallbackLabel = registration || fleetNumber || primaryKey;
      const displayLabel =
        registration && fleetNumber
          ? `${fleetNumber} - ${registration}`
          : fallbackLabel;

      const nextVehicle: ConnectedVehicle = {
        id: primaryKey,
        name: displayLabel || primaryKey,
        phone: secondaryKey || "",
        channels: [],
        registration: registration || undefined,
        fleetNumber: fleetNumber || undefined,
        costCenter: String(row.cost_center || "").trim() || undefined,
        displayLabel: displayLabel || primaryKey,
        connected: false,
        activeStreams: [],
      };

      const key = toVehicleKey(nextVehicle);
      const existing = dedupedByKey.get(key);
      if (!existing) {
        dedupedByKey.set(key, nextVehicle);
        continue;
      }

      dedupedByKey.set(key, {
        ...existing,
        ...nextVehicle,
        displayLabel: String(nextVehicle.displayLabel || existing.displayLabel || key).trim(),
      });
    }

    return Array.from(dedupedByKey.values()).sort((a, b) => {
      const statusDiff = getVehicleStatusRank(a) - getVehicleStatusRank(b);
      if (statusDiff !== 0) return statusDiff;
      return String(a.displayLabel || "").localeCompare(String(b.displayLabel || ""));
    });
  }, [supabase]);

  const fetchRuntimeVehicles = useCallback(async () => {
    const runtimeEndpoints = [
      { url: `/api/video-server/live/vehicles`, parser: parseRuntimeVehicles },
      { url: `/api/video-server/vehicles/connected`, parser: parseConnectedVehicles },
      { url: `/api/video-server/live/streams?maxAgeMs=5000`, parser: parseRuntimeVehicles },
    ] as const;

    for (const endpoint of runtimeEndpoints) {
      try {
        const response = await fetch(endpoint.url, {
          cache: "no-store",
          signal: AbortSignal.timeout(3200),
        });
        if (!response.ok) continue;
        const data = await response.json();
        const parsed = endpoint.parser(data);
        if (parsed.length > 0) {
          return parsed;
        }
      } catch {
        // Try next runtime endpoint.
      }
    }

    return [] as ConnectedVehicle[];
  }, []);

  const fetchConnectedVehicles = useCallback(async (options?: { background?: boolean }) => {
    const background = options?.background === true;
    if (!background) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }

    try {
      const catalogVehicles =
        background && catalogVehiclesRef.current.length > 0
          ? catalogVehiclesRef.current
          : await fetchCatalogVehicles();
      catalogVehiclesRef.current = catalogVehicles;

      if (!background) {
        setVehicles(catalogVehicles);
        setLoading(false);
      }

      const runtimeVehicles = await fetchRuntimeVehicles();
      if (runtimeVehicles.length > 0) {
        runtimeSnapshotRef.current = runtimeVehicles;
        runtimeSnapshotAtRef.current = Date.now();
        setVehicles(mergeRuntimeIntoCatalog(catalogVehicles, runtimeVehicles));
      } else {
        const hasRecentRuntimeSnapshot =
          runtimeSnapshotRef.current.length > 0 &&
          Date.now() - runtimeSnapshotAtRef.current <= RUNTIME_SNAPSHOT_GRACE_MS;

        if (hasRecentRuntimeSnapshot) {
          setVehicles(mergeRuntimeIntoCatalog(catalogVehicles, runtimeSnapshotRef.current));
        } else {
          setVehicles(mergeRuntimeIntoCatalog(catalogVehicles, runtimeVehicles));
        }
      }
    } catch (error) {
      console.error("Failed to fetch vehicles:", error);
      const hasRecentRuntimeSnapshot =
        runtimeSnapshotRef.current.length > 0 &&
        Date.now() - runtimeSnapshotAtRef.current <= RUNTIME_SNAPSHOT_GRACE_MS;

      if (hasRecentRuntimeSnapshot) {
        setVehicles(mergeRuntimeIntoCatalog(catalogVehiclesRef.current, runtimeSnapshotRef.current));
      } else if (catalogVehiclesRef.current.length > 0) {
        setVehicles((prev) => (prev.length > 0 ? prev : catalogVehiclesRef.current));
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [fetchCatalogVehicles, fetchRuntimeVehicles]);

  useEffect(() => {
    void fetchConnectedVehicles();
  }, [fetchConnectedVehicles]);

  // Intentionally no background polling:
  // load once on page open, then only refresh when user clicks Refresh.

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

  useEffect(() => {
    const scopedVehiclesById = new Set(
      scopedVehicles.map((entry) => String(entry.id || "").trim()).filter(Boolean)
    );

    setSelectedVehicles((previous) => {
      const nextIds = Array.from(previous).filter((vehicleId) => {
        const vehicle = scopedVehicles.find((entry) => entry.id === vehicleId);
        return !!vehicle && getWarmChannelNumbers(vehicle).length > 0;
      });

      return nextIds.length === previous.size ? previous : new Set(nextIds);
    });

    setPinnedFeed((previous) => {
      if (!previous) {
        return previous;
      }

      if (!scopedVehiclesById.has(String(previous.vehicleId || "").trim())) {
        return null;
      }

      const vehicle = scopedVehicles.find((entry) => entry.id === previous.vehicleId);
      if (!vehicle || !getWarmChannelNumbers(vehicle).includes(previous.channel)) {
        return null;
      }

      return previous;
    });
  }, [scopedVehicles]);

  const toggleVehicle = async (vehicleId: string) => {
    const vehicle = scopedVehicles.find((entry) => entry.id === vehicleId);
    if (!vehicle) return;

    const next = new Set(selectedVehicles);
    if (next.has(vehicleId)) {
      next.delete(vehicleId);
      if (pinnedFeed?.vehicleId === vehicleId) {
        setPinnedFeed(null);
      }
    } else if (!isVehicleOnline(vehicle)) {
      return;
    } else {
      next.add(vehicleId);
    }
    setSelectedVehicles(next);
  };

  const filteredVehicles = scopedVehicles
    .filter((v) =>
      v.id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      v.displayLabel?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      v.registration?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      v.fleetNumber?.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => {
      const statusDiff = getVehicleStatusRank(a) - getVehicleStatusRank(b);
      if (statusDiff !== 0) return statusDiff;
      return String(a.displayLabel || "").localeCompare(String(b.displayLabel || ""));
    });

  const onlineVehicles = filteredVehicles.filter((vehicle) => isVehicleOnline(vehicle));
  const offlineVehicles = filteredVehicles.filter((vehicle) => !isVehicleOnline(vehicle));
  const onlineVehicleCount = onlineVehicles.length;
  const offlineVehicleCount = offlineVehicles.length;

  const liveChannelCount = filteredVehicles.reduce(
    (acc, vehicle) => acc + getActiveStreamCount(vehicle),
    0
  );

  const streamEntries: StreamEntry[] = Array.from(selectedVehicles).flatMap((vehicleId) => {
    const vehicle = scopedVehicles.find((v) => v.id === vehicleId);
    if (!vehicle) return [];

    const channels = getWarmChannelNumbers(vehicle);

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

  const renderVehicleCard = (vehicle: ConnectedVehicle) => {
    const online = isVehicleOnline(vehicle);
    const selected = selectedVehicles.has(vehicle.id);

    return (
      <Card
        key={vehicle.id}
        className={`p-4 transition-all ${
          selected
            ? "border-emerald-400 bg-emerald-50 shadow-md"
            : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm"
        } ${online ? "cursor-pointer" : "opacity-90"}`}
        onClick={() => {
          if (online) toggleVehicle(vehicle.id);
        }}
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
          {online ? (
            <Badge className="bg-cyan-600 hover:bg-cyan-600 text-white">
              <Wifi className="mr-1 h-3 w-3" />
              Ready
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
            {online
              ? `${getActiveStreamCount(vehicle)} live channel(s) ready`
              : "No active live video session"}
          </div>
          <Button
            size="sm"
            disabled={!online}
            variant={selected ? "destructive" : "default"}
            className={
              !online
                ? "bg-slate-200 text-slate-500 hover:bg-slate-200"
                : selected
                  ? ""
                  : "bg-slate-900 hover:bg-slate-800"
            }
          >
            {selected ? "Stop" : online ? "Stream" : "Offline"}
          </Button>
        </div>
      </Card>
    );
  };

  const renderVehicleTableSection = (title: string, sectionVehicles: ConnectedVehicle[]) => {
    if (sectionVehicles.length === 0) return null;

    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          {title === "Online Vehicles" ? (
            <Wifi className="h-4 w-4 text-emerald-600" />
          ) : (
            <WifiOff className="h-4 w-4 text-slate-500" />
          )}
          <h4 className="text-base font-semibold text-slate-900">
            {title} ({sectionVehicles.length})
          </h4>
        </div>
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
              {sectionVehicles.map((vehicle) => {
                const online = isVehicleOnline(vehicle);
                const selected = selectedVehicles.has(vehicle.id);

                return (
                  <tr key={vehicle.id} className="border-t hover:bg-slate-50">
                    <td className="px-4 py-3">
                      {online ? (
                        <Badge className="bg-cyan-600 hover:bg-cyan-600 text-white">
                          Ready
                        </Badge>
                      ) : (
                        <Badge variant="outline">Offline</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-900">{vehicle.displayLabel}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-600">{vehicle.phone || vehicle.id}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {online
                        ? `${getActiveStreamCount(vehicle)} live`
                        : "Unavailable"}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Button
                        size="sm"
                        disabled={!online}
                        variant={selected ? "destructive" : "default"}
                        onClick={() => toggleVehicle(vehicle.id)}
                        className={
                          !online
                            ? "bg-slate-200 text-slate-500 hover:bg-slate-200"
                            : selected
                              ? ""
                              : "bg-slate-900 hover:bg-slate-800"
                        }
                      >
                        {selected ? "Stop" : online ? "Stream" : "Offline"}
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
                Real-time visibility of all vehicles with active and inactive status.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              <div className="rounded-lg border border-slate-700 bg-slate-900/70 px-4 py-3">
                <p className="text-[11px] uppercase tracking-wide text-slate-400">Total Vehicles</p>
                <p className="mt-1 text-2xl font-bold text-emerald-300">{filteredVehicles.length}</p>
                <p className="mt-1 text-[11px] text-slate-400">{onlineVehicleCount} online - {offlineVehicleCount} offline</p>
              </div>
              <div className="rounded-lg border border-slate-700 bg-slate-900/70 px-4 py-3">
                <p className="text-[11px] uppercase tracking-wide text-slate-400">Active Channels</p>
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
              onClick={() => void fetchConnectedVehicles({ background: true })}
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
            Vehicle Status Overview
          </h3>
        </div>

        {loading ? (
          <Card className="p-8 text-center text-slate-600">Loading vehicles...</Card>
        ) : filteredVehicles.length === 0 ? (
          <Card className="p-8 text-center text-slate-500">No vehicles found</Card>
        ) : viewMode === "grid" ? (
          <div className="space-y-6">
            <div>
              <div className="mb-3 flex items-center gap-2">
                <Wifi className="h-4 w-4 text-emerald-600" />
                <h4 className="text-base font-semibold text-slate-900">
                  Online Vehicles ({onlineVehicles.length})
                </h4>
              </div>
              {onlineVehicles.length > 0 ? (
                <div className={gridClassName}>
                  {onlineVehicles.map(renderVehicleCard)}
                </div>
              ) : (
                <Card className="p-6 text-center text-slate-500">No online vehicles found.</Card>
              )}
            </div>
            <div>
              <div className="mb-3 flex items-center gap-2">
                <WifiOff className="h-4 w-4 text-slate-500" />
                <h4 className="text-base font-semibold text-slate-900">
                  Offline Vehicles ({offlineVehicles.length})
                </h4>
              </div>
              {offlineVehicles.length > 0 ? (
                <div className={gridClassName}>
                  {offlineVehicles.map(renderVehicleCard)}
                </div>
              ) : (
                <Card className="p-6 text-center text-slate-500">No offline vehicles found.</Card>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {renderVehicleTableSection("Online Vehicles", onlineVehicles)}
            {renderVehicleTableSection("Offline Vehicles", offlineVehicles)}
          </div>
        )}
      </div>
    </div>
  );
}




