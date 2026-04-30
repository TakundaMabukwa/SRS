"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Hls from "hls.js";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock3, PlayCircle, RefreshCw, Search, Video } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type PlaybackVehicle = {
  vehicleId: string;
  deviceIds: string[];
  cameraSimId?: string | null;
  clipCount: number;
  earliestTime?: string | null;
  latestTime?: string | null;
  channels: number[];
  vehicleRegistration?: string | null;
  fleetNumber?: string | null;
  make?: string | null;
  model?: string | null;
};

type PlaybackClip = {
  id: string;
  startTime: string;
  endTime?: string | null;
  durationSeconds?: number;
  fileSize?: number;
  videoType?: string;
};

type PlaybackChannelAvailability = {
  channel: number;
  clipCount: number;
  earliestTime?: string | null;
  latestTime?: string | null;
  clips: PlaybackClip[];
};

type AvailabilityClipResponse = {
  id?: string | number;
  startTime?: string;
  start_time?: string;
  endTime?: string;
  end_time?: string;
  durationSeconds?: number;
  duration_seconds?: number;
  fileSize?: number;
  file_size?: number;
  videoType?: string;
  video_type?: string;
};

type AvailabilityChannelResponse = {
  channel?: number;
  clipCount?: number;
  clip_count?: number;
  earliestTime?: string;
  earliest_time?: string;
  latestTime?: string;
  latest_time?: string;
  clips?: AvailabilityClipResponse[];
};

type CoverageRowResponse = {
  channel?: number;
  packet_count?: number;
  first_packet_time?: string;
  last_packet_time?: string;
  first_packet_timestamp_ms?: number;
  last_packet_timestamp_ms?: number;
};

type PlaybackItem = {
  channel: number;
  url: string;
  label: string;
};

type QuickRangeOption = {
  key: string;
  label: string;
  start: string;
  end: string;
};

type ParsedAvailableRange = {
  startIso: string;
  endIso: string;
};

function channelHasStoredFiles(entry?: PlaybackChannelAvailability | null) {
  if (!entry) return false;
  const clipCount = Number(entry.clipCount || 0);
  if (Number.isFinite(clipCount) && clipCount > 0) return true;
  if (Array.isArray(entry.clips) && entry.clips.length > 0) return true;
  const startMs = entry.earliestTime ? new Date(entry.earliestTime).getTime() : Number.NaN;
  const endMs = entry.latestTime ? new Date(entry.latestTime).getTime() : Number.NaN;
  return Number.isFinite(startMs) && Number.isFinite(endMs) && endMs >= startMs;
}

function buildCandidateVehicleIds(vehicle?: PlaybackVehicle | null, preferredId?: string | null): string[] {
  const cameraSimId = String(vehicle?.cameraSimId || vehicle?.vehicleId || "").trim();
  if (cameraSimId) return [cameraSimId];

  const fallback = String(preferredId || "").trim();
  return fallback ? [fallback] : [];
}

function formatDateTime(value?: string | null) {
  if (!value) return "N/A";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "N/A";
  return `${date.toLocaleString(undefined, {
    timeZone: "UTC",
    hour12: false,
  })} UTC`;
}

function formatTimeInputValue(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const hours = String(date.getUTCHours()).padStart(2, "0");
  const minutes = String(date.getUTCMinutes()).padStart(2, "0");
  const seconds = String(date.getUTCSeconds()).padStart(2, "0");
  return `${hours}:${minutes}:${seconds}`;
}

function combineDateAndTime(dateValue: string, timeValue: string) {
  if (!dateValue || !timeValue) return "";
  const dateMatch = String(dateValue).trim().match(/^([0-9]{4})-([0-9]{2})-([0-9]{2})$/);
  if (!dateMatch) return "";

  const timeParts = String(timeValue)
    .trim()
    .split(":")
    .map((part) => Number(part));
  if (timeParts.length < 2) return "";

  const [, yearRaw, monthRaw, dayRaw] = dateMatch;
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);
  const hours = Number(timeParts[0] ?? 0);
  const minutes = Number(timeParts[1] ?? 0);
  const seconds = Number(timeParts[2] ?? 0);

  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day) ||
    !Number.isInteger(hours) ||
    !Number.isInteger(minutes) ||
    !Number.isInteger(seconds)
  ) {
    return "";
  }

  if (
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31 ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59 ||
    seconds < 0 ||
    seconds > 59
  ) {
    return "";
  }

  const ms = Date.UTC(year, month - 1, day, hours, minutes, seconds, 0);
  if (!Number.isFinite(ms)) return "";
  return new Date(ms).toISOString();
}

function getUtcDayBounds(dateValue: string): { startMs: number; endMs: number } | null {
  const match = String(dateValue || "").trim().match(/^([0-9]{4})-([0-9]{2})-([0-9]{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
  const startMs = Date.UTC(year, month - 1, day, 0, 0, 0, 0);
  const endMs = Date.UTC(year, month - 1, day, 23, 59, 59, 999);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return null;
  return { startMs, endMs };
}

function sourceLooksHls(url: string) {
  return /\.m3u8(?:$|\?)/i.test(url);
}

function normalizeBackendMediaUrl(url: string, videoProxyBase: string) {
  const value = String(url || "").trim();
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) {
    try {
      const parsed = new URL(value);
      if (parsed.pathname.startsWith("/api/video-server/")) {
        return `${videoProxyBase}${parsed.pathname.slice("/api/video-server".length)}${parsed.search || ""}`;
      }
      if (parsed.pathname.startsWith("/api/")) {
        return `${videoProxyBase}${parsed.pathname.slice(4)}${parsed.search || ""}`;
      }
      if (parsed.pathname.startsWith("/media/")) {
        return `${videoProxyBase}${parsed.pathname}${parsed.search || ""}`;
      }
      return value;
    } catch {
      return value;
    }
  }
  if (value.startsWith(`${videoProxyBase}/`)) return value;
  if (value.startsWith("/media/")) return `${videoProxyBase}${value}`;
  if (value.startsWith("/api/")) {
    return `${videoProxyBase}${value.slice(4)}`;
  }
  if (value.startsWith("/")) return value;
  return `${videoProxyBase}/${value.replace(/^\/+/, "")}`;
}

function readRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function errorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) {
    const message = String(error.message || "").trim();
    return message || fallback;
  }
  const message = String(error || "").trim();
  return message || fallback;
}

function parseAvailableRangeFromMessage(value: unknown): ParsedAvailableRange | null {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const match = raw.match(
    /Approx available range:\s*([0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9:\.\-+Z]+)\s+to\s+([0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9:\.\-+Z]+)/i
  );
  if (!match) return null;

  const startRaw = String(match[1] || "").trim().replace(/[.,;]$/, "");
  const endRaw = String(match[2] || "").trim().replace(/[.,;]$/, "");
  const startMs = new Date(startRaw).getTime();
  const endMs = new Date(endRaw).getTime();
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) return null;
  return {
    startIso: new Date(startMs).toISOString(),
    endIso: new Date(endMs).toISOString(),
  };
}

function PlaybackVideoPlayer({
  url,
  className = "w-full rounded-2xl border border-slate-800 bg-black shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]",
}: {
  url: string;
  className?: string;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const videoEl = videoRef.current;
    if (!videoEl || !url) return;
    setError("");

    let hls: Hls | null = null;
    const isHls = sourceLooksHls(url);

    if (isHls) {
      videoEl.removeAttribute("src");
      videoEl.load();

      if (videoEl.canPlayType("application/vnd.apple.mpegurl")) {
        videoEl.src = url;
      } else if (Hls.isSupported()) {
        hls = new Hls({ enableWorker: true, lowLatencyMode: true });
        hls.loadSource(url);
        hls.attachMedia(videoEl);
        hls.on(Hls.Events.ERROR, (_, data) => {
          if (data?.fatal) setError("Playback stream failed.");
        });
      } else {
        setError("HLS is not supported in this browser.");
      }
    } else {
      videoEl.src = url;
      videoEl.load();
    }

    return () => {
      if (hls) hls.destroy();
    };
  }, [url]);

  return (
    <div className="space-y-2">
      <video ref={videoRef} controls playsInline className={className} />
      {error ? <p className="text-xs text-rose-600">{error}</p> : null}
    </div>
  );
}

export default function PlaybackDashboardTab() {
  const videoProxyBase = "/api/video-server";
  const supabase = createClient();
  const [vehicles, setVehicles] = useState<PlaybackVehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedVehicle, setSelectedVehicle] = useState<PlaybackVehicle | null>(null);
  const [selectedDate, setSelectedDate] = useState("");
  const [availability, setAvailability] = useState<PlaybackChannelAvailability[]>([]);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [selectedChannel, setSelectedChannel] = useState(1);
  const [playBothChannels, setPlayBothChannels] = useState(false);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [playbackItems, setPlaybackItems] = useState<PlaybackItem[]>([]);
  const [playbackState, setPlaybackState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [playbackError, setPlaybackError] = useState("");
  const [rangeSummary, setRangeSummary] = useState("");
  const [resolvedVehicleId, setResolvedVehicleId] = useState("");
  const PLAYBACK_AVAILABILITY_TIMEOUT_MS = 15000;
  const initialLoadStartedRef = useRef(false);

  const vehicleDisplayLabel = useCallback((vehicle: PlaybackVehicle | null | undefined) => {
    if (!vehicle) return "N/A";
    if (vehicle.fleetNumber && vehicle.vehicleRegistration) {
      return `${vehicle.fleetNumber} - ${vehicle.vehicleRegistration}`;
    }
    if (vehicle.vehicleRegistration) return vehicle.vehicleRegistration;
    if (vehicle.fleetNumber) return vehicle.fleetNumber;
    if (vehicle.vehicleId) return vehicle.vehicleId;
    return "Unknown vehicle";
  }, []);

  const fetchJsonWithRetry = useCallback(async (url: string, timeoutMs: number, retries = 1) => {
    let lastError: unknown = null;
    for (let attempt = 0; attempt <= retries; attempt += 1) {
      try {
        const res = await fetch(url, {
          cache: "no-store",
          signal: AbortSignal.timeout(timeoutMs),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok || !json?.success) {
          throw new Error(json?.message || json?.error || `HTTP ${res.status}`);
        }
        return json;
      } catch (error) {
        lastError = error;
        if (attempt >= retries) throw error;
        await new Promise((resolve) => setTimeout(resolve, 800 * (attempt + 1)));
      }
    }
    throw lastError || new Error("Request failed");
  }, []);

  const fetchVehicles = useCallback(async (): Promise<PlaybackVehicle[]> => {
    const { data: vehicleRows, error: vehiclesError } = await supabase
      .from("vehiclesc")
      .select("registration_number, fleet_number, camera_sim_id, make, model");

    if (vehiclesError) {
      throw new Error(vehiclesError.message || "Failed to load vehicles");
    }

    const bySimId = new Map<string, PlaybackVehicle>();
    for (const row of vehicleRows || []) {
      const cameraSimId = String(row?.camera_sim_id || "").trim();
      if (!cameraSimId) continue;

      const registration = String(row?.registration_number || "").trim();
      const fleetNumber = String(row?.fleet_number || "").trim();
      const make = String(row?.make || "").trim();
      const model = String(row?.model || "").trim();
      const existing = bySimId.get(cameraSimId);

      if (!existing) {
        bySimId.set(cameraSimId, {
          vehicleId: cameraSimId,
          deviceIds: [cameraSimId],
          cameraSimId: cameraSimId || null,
          clipCount: 0,
          earliestTime: null,
          latestTime: null,
          channels: [1, 2],
          vehicleRegistration: registration || null,
          fleetNumber: fleetNumber || null,
          make: make || null,
          model: model || null,
        });
        continue;
      }

      existing.deviceIds = [cameraSimId];
      existing.cameraSimId = cameraSimId;
      existing.vehicleId = cameraSimId;
      if (!existing.vehicleRegistration && registration) existing.vehicleRegistration = registration;
      if (!existing.fleetNumber && fleetNumber) existing.fleetNumber = fleetNumber;
      if (!existing.make && make) existing.make = make;
      if (!existing.model && model) existing.model = model;
      bySimId.set(cameraSimId, existing);
    }

    const rowsByVehicle = Array.from(bySimId.values()).sort((a, b) =>
      vehicleDisplayLabel(a).localeCompare(vehicleDisplayLabel(b))
    );

    setVehicles(rowsByVehicle);
    return rowsByVehicle;
  }, [supabase, vehicleDisplayLabel]);

  const fetchAvailability = useCallback(async (vehicle: PlaybackVehicle, date: string) => {
    setAvailabilityLoading(true);
    try {
      const candidateVehicleIds = buildCandidateVehicleIds(vehicle);
      const dayBounds = getUtcDayBounds(date);
      const dayStartMs = dayBounds?.startMs ?? Number.NaN;
      const dayEndMs = dayBounds?.endMs ?? Number.NaN;

      const toMs = (value?: string | null) => {
        const ms = value ? new Date(value).getTime() : Number.NaN;
        return Number.isFinite(ms) ? ms : Number.NaN;
      };

      const parseAvailability = (json: unknown, candidateVehicleId: string): PlaybackChannelAvailability[] => {
        const jsonRecord = readRecord(json);
        const jsonData = readRecord(jsonRecord.data);
        const channelsFromResponse = Array.isArray(jsonData.channels)
          ? (jsonData.channels as AvailabilityChannelResponse[])
          : Array.isArray(jsonRecord.channels)
            ? (jsonRecord.channels as AvailabilityChannelResponse[])
            : [];

        if (channelsFromResponse.length > 0) {
          return channelsFromResponse
            .map((entry: AvailabilityChannelResponse) => ({
              channel: Number(entry?.channel || 0),
              clipCount: Number(entry?.clipCount ?? entry?.clip_count ?? 0),
              earliestTime: String(entry?.earliestTime || entry?.earliest_time || "").trim() || null,
              latestTime: String(entry?.latestTime || entry?.latest_time || "").trim() || null,
              clips: Array.isArray(entry?.clips)
                ? entry.clips.map((clip: AvailabilityClipResponse, idx: number) => ({
                    id: String(clip?.id || `${candidateVehicleId}_${entry?.channel || 1}_${idx}`),
                    startTime: String(clip?.startTime || clip?.start_time || "").trim(),
                    endTime: String(clip?.endTime || clip?.end_time || "").trim() || null,
                    durationSeconds: Number(clip?.durationSeconds ?? clip?.duration_seconds ?? 0) || undefined,
                    fileSize: Number(clip?.fileSize ?? clip?.file_size ?? 0) || undefined,
                    videoType: String(clip?.videoType || clip?.video_type || "").trim() || undefined,
                  }))
                : [],
            }))
            .filter((entry: PlaybackChannelAvailability) => Number.isFinite(entry.channel) && entry.channel > 0)
            .sort((a, b) => a.channel - b.channel);
        }

        const rows = Array.isArray(jsonRecord.rows)
          ? jsonRecord.rows
          : Array.isArray(jsonData.rows)
            ? jsonData.rows
            : Array.isArray(jsonRecord.data)
              ? jsonRecord.data
              : [];

        const channelMap = new Map<
          number,
          {
            channel: number;
            clipCount: number;
            earliestTime: string | null;
            latestTime: string | null;
          }
        >();

        const pushRow = (row: Record<string, unknown>, applyDateBounds: boolean) => {
          const channel = Number(row?.channel || 0);
          if (!Number.isFinite(channel) || channel <= 0) return;

          const firstRaw = String(
            row?.approx_first_packet_time ||
              row?.first_packet_time ||
              row?.earliestTime ||
              ""
          ).trim();
          const lastRaw = String(
            row?.approx_last_packet_time ||
              row?.last_packet_time ||
              row?.latestTime ||
              ""
          ).trim();

          let firstMs = toMs(firstRaw);
          let lastMs = toMs(lastRaw);

          if (applyDateBounds && Number.isFinite(dayStartMs) && Number.isFinite(dayEndMs) && Number.isFinite(firstMs) && Number.isFinite(lastMs)) {
            if (lastMs < dayStartMs || firstMs > dayEndMs) return;
            firstMs = Math.max(firstMs, dayStartMs);
            lastMs = Math.min(lastMs, dayEndMs);
          }

          const firstIso = Number.isFinite(firstMs) ? new Date(firstMs).toISOString() : firstRaw || null;
          const lastIso = Number.isFinite(lastMs) ? new Date(lastMs).toISOString() : lastRaw || null;

          const existing = channelMap.get(channel) || {
            channel,
            clipCount: 0,
            earliestTime: null,
            latestTime: null,
          };

          const countCandidate = Number(row?.file_count ?? row?.clip_count ?? 1);
          existing.clipCount += Number.isFinite(countCandidate) && countCandidate > 0 ? countCandidate : 1;

          if (firstIso) {
            const firstIsoMs = toMs(firstIso);
            const existingFirstMs = toMs(existing.earliestTime);
            if (!Number.isFinite(existingFirstMs) || (Number.isFinite(firstIsoMs) && firstIsoMs < existingFirstMs)) {
              existing.earliestTime = firstIso;
            }
          }

          if (lastIso) {
            const lastIsoMs = toMs(lastIso);
            const existingLastMs = toMs(existing.latestTime);
            if (!Number.isFinite(existingLastMs) || (Number.isFinite(lastIsoMs) && lastIsoMs > existingLastMs)) {
              existing.latestTime = lastIso;
            }
          }

          channelMap.set(channel, existing);
        };

        rows.forEach((row) => pushRow(readRecord(row), true));
        if (channelMap.size === 0) {
          rows.forEach((row) => pushRow(readRecord(row), false));
        }

        return Array.from(channelMap.values())
          .sort((a, b) => a.channel - b.channel)
          .map((entry) => ({
            channel: entry.channel,
            clipCount: entry.clipCount,
            earliestTime: entry.earliestTime,
            latestTime: entry.latestTime,
            clips:
              entry.earliestTime && entry.latestTime
                ? [
                    {
                      id: `${candidateVehicleId}_${entry.channel}_${date}`,
                      startTime: entry.earliestTime,
                      endTime: entry.latestTime,
                    },
                  ]
                : [],
          }));
      };

      const parseExactCoverage = (json: unknown, candidateVehicleId: string): PlaybackChannelAvailability[] => {
        const jsonRecord = readRecord(json);
        const jsonData = readRecord(jsonRecord.data);
        const rows = Array.isArray(jsonRecord.rows)
          ? jsonRecord.rows
          : Array.isArray(jsonData.rows)
            ? jsonData.rows
            : Array.isArray(jsonRecord.data)
              ? jsonRecord.data
              : [];

        return rows
          .map((value) => readRecord(value) as CoverageRowResponse)
          .map((row, index) => {
            const channel = Number(row?.channel || 0);
            if (!Number.isFinite(channel) || channel <= 0) return null;
            const firstRaw = String(row?.first_packet_time || "").trim();
            const lastRaw = String(row?.last_packet_time || "").trim();
            const firstMs = firstRaw ? new Date(firstRaw).getTime() : Number.NaN;
            const lastMs = lastRaw ? new Date(lastRaw).getTime() : Number.NaN;
            const earliestTime = Number.isFinite(firstMs) ? new Date(firstMs).toISOString() : null;
            const latestTime = Number.isFinite(lastMs) ? new Date(lastMs).toISOString() : null;
            const hasRange = !!earliestTime && !!latestTime && new Date(latestTime).getTime() >= new Date(earliestTime).getTime();
            return {
              channel,
              clipCount: hasRange ? 1 : 0,
              earliestTime,
              latestTime,
              clips: hasRange
                ? [
                    {
                      id: `${candidateVehicleId}_${channel}_coverage_${index}`,
                      startTime: earliestTime,
                      endTime: latestTime,
                    },
                  ]
                : [],
            } as PlaybackChannelAvailability;
          })
          .filter((entry): entry is PlaybackChannelAvailability => !!entry)
          .sort((a, b) => a.channel - b.channel);
      };

      let hasSuccessfulResponse = false;
      let lastError: unknown = null;

      for (const candidateVehicleId of candidateVehicleIds) {
        if (Number.isFinite(dayStartMs) && Number.isFinite(dayEndMs)) {
          try {
            const exactCoverageQuery = new URLSearchParams({
              from: new Date(dayStartMs).toISOString(),
              to: new Date(dayEndMs).toISOString(),
              vehicleId: candidateVehicleId,
            });
            const exactCoverageJson = await fetchJsonWithRetry(
              `${videoProxyBase}/video/coverage?${exactCoverageQuery.toString()}`,
              PLAYBACK_AVAILABILITY_TIMEOUT_MS,
              0
            );
            hasSuccessfulResponse = true;
            const exactChannels = parseExactCoverage(exactCoverageJson, candidateVehicleId).filter((entry) =>
              channelHasStoredFiles(entry)
            );
            if (exactChannels.length > 0) {
              setAvailability(exactChannels);
              setResolvedVehicleId(candidateVehicleId);
              const preferredChannel = exactChannels.find((entry) => channelHasStoredFiles(entry)) || exactChannels[0];
              const nextChannel = Number(preferredChannel?.channel || 1);
              setSelectedChannel(nextChannel);
              const firstClip = preferredChannel?.clips?.[0];
              const lastClip = preferredChannel?.clips?.[preferredChannel?.clips?.length - 1];
              setStartTime(formatTimeInputValue(firstClip?.startTime || preferredChannel?.earliestTime));
              setEndTime(formatTimeInputValue(lastClip?.endTime || lastClip?.startTime || preferredChannel?.latestTime));
              return;
            }
          } catch (error) {
            lastError = error;
          }
        }

        const encodedVehicle = encodeURIComponent(candidateVehicleId);
        const encodedDate = encodeURIComponent(date);
        const availabilityUrls = [
          `${videoProxyBase}/vehicles/${encodedVehicle}/videos/availability?date=${encodedDate}`,
          `${videoProxyBase}/vehicles/${encodedVehicle}/video/availability?date=${encodedDate}`,
        ];

        for (const url of availabilityUrls) {
          try {
            const json = await fetchJsonWithRetry(url, PLAYBACK_AVAILABILITY_TIMEOUT_MS, 0);
            hasSuccessfulResponse = true;
            const channels = parseAvailability(json, candidateVehicleId);
            if (channels.length > 0) {
              setAvailability(channels);
              setResolvedVehicleId(candidateVehicleId);
              const preferredChannel = channels.find((entry) => channelHasStoredFiles(entry)) || channels[0];
              const nextChannel = Number(preferredChannel?.channel || 1);
              setSelectedChannel(nextChannel);
              const firstClip = preferredChannel?.clips?.[0];
              const lastClip = preferredChannel?.clips?.[preferredChannel?.clips?.length - 1];
              setStartTime(formatTimeInputValue(firstClip?.startTime || preferredChannel?.earliestTime));
              setEndTime(formatTimeInputValue(lastClip?.endTime || lastClip?.startTime || preferredChannel?.latestTime));
              return;
            }
            break;
          } catch (error) {
            lastError = error;
          }
        }
      }

      if (!hasSuccessfulResponse && lastError) {
        throw lastError;
      }

      setAvailability([]);
      setResolvedVehicleId(candidateVehicleIds[0] || "");
      setSelectedChannel(1);
      setStartTime("");
      setEndTime("");
    } finally {
      setAvailabilityLoading(false);
    }
  }, [fetchJsonWithRetry, videoProxyBase]);

  const refreshAll = useCallback(async () => {
    setRefreshing(true);
    try {
      await fetchVehicles();
      setPlaybackError("");
    } catch (error: unknown) {
      console.error("Failed to load playback inventory:", error);
      setVehicles([]);
      const message = errorMessage(error, "");
      if (/timed out|timeout|aborted/i.test(message)) {
        setPlaybackError("Playback inventory request timed out. Please refresh to retry.");
      } else {
        setPlaybackError(message || "Failed to load playback inventory.");
      }
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }, [fetchVehicles]);

  useEffect(() => {
    if (initialLoadStartedRef.current) return;
    initialLoadStartedRef.current = true;
    void refreshAll();
  }, [refreshAll]);

  useEffect(() => {
    if (!selectedVehicle || !selectedDate) return;
    void fetchAvailability(selectedVehicle, selectedDate);
  }, [fetchAvailability, selectedDate, selectedVehicle]);

  const filteredVehicles = useMemo(() => {
    const needle = searchQuery.trim().toLowerCase();
    if (!needle) return vehicles;
    return vehicles.filter((vehicle) =>
      [
        vehicle.vehicleId,
        ...(vehicle.deviceIds || []),
        vehicle.fleetNumber,
        vehicle.vehicleRegistration,
        vehicleDisplayLabel(vehicle),
        vehicle.make,
        vehicle.model,
      ]
        .map((value) => String(value || "").toLowerCase())
        .some((value) => value.includes(needle))
    );
  }, [searchQuery, vehicleDisplayLabel, vehicles]);

  const canonicalSelectedVehicle = useMemo(() => {
    if (!selectedVehicle) return null;
    const selectedId = String(selectedVehicle.vehicleId || "").trim();
    const selectedSimId = String(selectedVehicle.cameraSimId || "").trim();
    const selectedReg = String(selectedVehicle.vehicleRegistration || "").trim().toLowerCase();
    const selectedFleet = String(selectedVehicle.fleetNumber || "").trim().toLowerCase();

    return (
      vehicles.find((vehicle) => {
        const vehicleId = String(vehicle.vehicleId || "").trim();
        const vehicleSimId = String(vehicle.cameraSimId || "").trim();
        if (selectedId && (vehicleId === selectedId || vehicleSimId === selectedId)) return true;
        if (selectedSimId && (vehicleId === selectedSimId || vehicleSimId === selectedSimId)) return true;
        const vehicleReg = String(vehicle.vehicleRegistration || "").trim().toLowerCase();
        const vehicleFleet = String(vehicle.fleetNumber || "").trim().toLowerCase();
        return !!selectedReg && !!selectedFleet && vehicleReg === selectedReg && vehicleFleet === selectedFleet;
      }) || selectedVehicle
    );
  }, [selectedVehicle, vehicles]);

  const selectedChannelAvailability = useMemo(
    () => availability.find((entry) => Number(entry.channel) === Number(selectedChannel)) || null,
    [availability, selectedChannel]
  );

  const availableChannelNumbersWithCoverage = useMemo(
    () =>
      availability
        .filter((entry) => channelHasStoredFiles(entry))
        .map((entry) => Number(entry.channel || 0))
        .filter((channel) => Number.isFinite(channel) && channel > 0),
    [availability]
  );

  const selectedChannelHasCoverage = useMemo(
    () => channelHasStoredFiles(selectedChannelAvailability),
    [selectedChannelAvailability]
  );

  const playbackChannels = useMemo(() => {
    if (playBothChannels) return Array.from(new Set(availableChannelNumbersWithCoverage)).slice(0, 2);
    return selectedChannelHasCoverage ? [selectedChannel] : [];
  }, [availableChannelNumbersWithCoverage, playBothChannels, selectedChannel, selectedChannelHasCoverage]);

  const selectedChannelNoFilesHint = useMemo(() => {
    if (!selectedDate || availabilityLoading || availability.length === 0) return "";
    if (selectedChannelHasCoverage) return "";
    if (availableChannelNumbersWithCoverage.length > 0) {
      return `No stored files for CH${selectedChannel} on ${selectedDate}. Available channels: ${availableChannelNumbersWithCoverage
        .map((channel) => `CH${channel}`)
        .join(", ")}.`;
    }
    return `No stored files found for ${selectedDate}. Try another date.`;
  }, [availability.length, availabilityLoading, availableChannelNumbersWithCoverage, selectedChannel, selectedChannelHasCoverage, selectedDate]);

  const quickRangeOptions = useMemo<QuickRangeOption[]>(() => {
    if (!selectedChannelAvailability) return [];
    const clips = selectedChannelAvailability.clips || [];
    const latestClips = [...clips].slice(-6).reverse();
    const options: QuickRangeOption[] = latestClips.map((clip, index) => ({
      key: clip.id || `clip_${index}`,
      label: index === 0 ? "Latest clip" : `Clip ${latestClips.length - index}`,
      start: clip.startTime,
      end: clip.endTime || clip.startTime,
    }));

    const earliest = clips[0]?.startTime || selectedChannelAvailability.earliestTime;
    const latest = clips[clips.length - 1]?.endTime || clips[clips.length - 1]?.startTime || selectedChannelAvailability.latestTime;
    if (earliest && latest) {
      options.unshift({
        key: "full_range",
        label: "Full day range",
        start: earliest,
        end: latest,
      });
    }

    return options;
  }, [selectedChannelAvailability]);

  const selectedChannelRangeSummary = useMemo(() => {
    if (!selectedChannelAvailability) return "";
    const clips = selectedChannelAvailability.clips || [];
    const earliest = clips[0]?.startTime || selectedChannelAvailability.earliestTime;
    const latest = clips[clips.length - 1]?.endTime || clips[clips.length - 1]?.startTime || selectedChannelAvailability.latestTime;
    if (!earliest || !latest) return "";
    return `CH${selectedChannel}: ${formatDateTime(earliest)} - ${formatDateTime(latest)}`;
  }, [selectedChannel, selectedChannelAvailability]);

  const alternateChannelRangeSummaries = useMemo(() => {
    return availability
      .filter((entry) => Number(entry.channel) !== Number(selectedChannel))
      .filter((entry) => channelHasStoredFiles(entry))
      .map((entry) => {
        const clips = entry.clips || [];
        const earliest = clips[0]?.startTime || entry.earliestTime;
        const latest = clips[clips.length - 1]?.endTime || clips[clips.length - 1]?.startTime || entry.latestTime;
        if (!earliest || !latest) return "";
        return `CH${entry.channel}: ${formatDateTime(earliest)} - ${formatDateTime(latest)}`;
      })
      .filter(Boolean)
      .slice(0, 2);
  }, [availability, selectedChannel]);

  useEffect(() => {
    if (!selectedChannelAvailability) return;
    if (!startTime) setStartTime(formatTimeInputValue(selectedChannelAvailability.earliestTime));
    if (!endTime) setEndTime(formatTimeInputValue(selectedChannelAvailability.latestTime));
  }, [selectedChannelAvailability, startTime, endTime]);

  useEffect(() => {
    if (!playBothChannels) return;
    if (availableChannelNumbersWithCoverage.length < 2) {
      setPlayBothChannels(false);
    }
  }, [availableChannelNumbersWithCoverage.length, playBothChannels]);

  const applyClipRange = useCallback((start?: string | null, end?: string | null) => {
    if (start) setStartTime(formatTimeInputValue(start));
    if (end || start) setEndTime(formatTimeInputValue(end || start));
    const startLabel = formatDateTime(start);
    const endLabel = formatDateTime(end || start);
    if (startLabel !== "N/A" || endLabel !== "N/A") {
      setRangeSummary(`${startLabel} - ${endLabel}`);
    }
    setPlaybackItems([]);
    setPlaybackState("idle");
    setPlaybackError("");
  }, []);

  const buildLatestRange = useCallback((seconds: number) => {
    if (!selectedChannelAvailability) return;
    const lastClip = selectedChannelAvailability.clips[selectedChannelAvailability.clips.length - 1];
    const latestRaw = lastClip?.endTime || lastClip?.startTime || selectedChannelAvailability.latestTime;
    if (!latestRaw) return;
    const latest = new Date(latestRaw);
    if (Number.isNaN(latest.getTime())) return;
    const start = new Date(latest.getTime() - seconds * 1000);
    return {
      startIso: start.toISOString(),
      endIso: latest.toISOString(),
    };
  }, [selectedChannelAvailability]);

  const handlePlaybackRequestError = useCallback((error: unknown) => {
    const message = errorMessage(error, "Failed to prepare playback.");
    const availableRange = parseAvailableRangeFromMessage(message);
    if (availableRange) {
      setPlaybackError(`Available range: ${formatDateTime(availableRange.startIso)} - ${formatDateTime(availableRange.endIso)}`);
      return;
    }
    setPlaybackError(message || "Failed to prepare playback.");
  }, []);

  const resolvePlaybackForChannel = useCallback(async (
    candidateVehicleIds: string[],
    vehicleLabel: string,
    channel: number,
    startIso: string,
    endIso: string,
    labelStart: string,
    labelEnd: string
  ): Promise<PlaybackItem> => {
    let lastError: unknown = null;

    for (const vehicleId of candidateVehicleIds) {
      const query = new URLSearchParams({
        from: startIso,
        to: endIso,
      });
      try {
        const parsePlayableChannel = (json: unknown, preferredChannel: number) => {
          const payload = readRecord(json);
          const channels = Array.isArray(payload.channels)
            ? payload.channels
            : Array.isArray(readRecord(payload.data).channels)
              ? (readRecord(payload.data).channels as unknown[])
              : [];

          const normalizeChannel = (entry: unknown) => readRecord(entry);
          const preferred = channels
            .map(normalizeChannel)
            .find(
              (entry) =>
                Number(entry?.channel || 0) === Number(preferredChannel) &&
                Boolean(entry?.success)
            );
          const firstSuccessful = channels.map(normalizeChannel).find((entry) => Boolean(entry?.success));
          const picked = preferred || firstSuccessful;
          if (!picked) return null;

          const sourceUrl = String(
            picked?.playUrl ||
              picked?.mp4Url ||
              picked?.playUrlAbsolute ||
              picked?.mp4UrlAbsolute ||
              ""
          ).trim();
          if (!sourceUrl) return null;

          return {
            channel: Number(picked?.channel || preferredChannel),
            sourceUrl,
          };
        };

        const channelScopedUrl = `${videoProxyBase}/vehicles/${encodeURIComponent(vehicleId)}/video/${encodeURIComponent(String(channel))}?${query.toString()}`;
        const channelScopedRes = await fetch(channelScopedUrl, { cache: "no-store" });
        const channelScopedJson = await channelScopedRes.json().catch(() => ({}));
        if (channelScopedRes.ok && channelScopedJson?.success) {
          const scopedPlayable = parsePlayableChannel(channelScopedJson, channel);
          if (scopedPlayable) {
            setResolvedVehicleId(vehicleId);
            return {
              channel: scopedPlayable.channel,
              url: normalizeBackendMediaUrl(scopedPlayable.sourceUrl, videoProxyBase),
              label: `${vehicleLabel} CH${scopedPlayable.channel} ${labelStart} - ${labelEnd}`,
            };
          }
        }

        const channelAgnosticUrl = `${videoProxyBase}/vehicles/${encodeURIComponent(vehicleId)}/video?${query.toString()}`;
        const channelAgnosticRes = await fetch(channelAgnosticUrl, { cache: "no-store" });
        const channelAgnosticJson = await channelAgnosticRes.json().catch(() => ({}));
        if (channelAgnosticRes.ok && channelAgnosticJson?.success) {
          const fallbackPlayable = parsePlayableChannel(channelAgnosticJson, channel);
          if (fallbackPlayable) {
            setResolvedVehicleId(vehicleId);
            return {
              channel: fallbackPlayable.channel,
              url: normalizeBackendMediaUrl(fallbackPlayable.sourceUrl, videoProxyBase),
              label: `${vehicleLabel} CH${fallbackPlayable.channel} ${labelStart} - ${labelEnd}`,
            };
          }
        }

        const channelScopedMessage =
          String(channelScopedJson?.message || "").trim() ||
          String(
            Array.isArray(channelScopedJson?.channels)
              ? channelScopedJson.channels
                  .map((entry: { message?: string }) => String(entry?.message || "").trim())
                  .find(Boolean) || ""
              : ""
          );
        const channelAgnosticMessage =
          String(channelAgnosticJson?.message || "").trim() ||
          String(
            Array.isArray(channelAgnosticJson?.channels)
              ? channelAgnosticJson.channels
                  .map((entry: { message?: string }) => String(entry?.message || "").trim())
                  .find(Boolean) || ""
              : ""
          );
        const failureMessage =
          channelScopedMessage ||
          channelAgnosticMessage ||
          `No playable video for CH${channel} in that range.`;
        throw new Error(failureMessage);
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError || new Error(`No playable video for CH${channel} in that range.`);
  }, [videoProxyBase]);

  const requestPlayback = useCallback(async () => {
    if (!canonicalSelectedVehicle) return;
    if (!selectedChannelHasCoverage && !playBothChannels) {
      setPlaybackState("error");
      setPlaybackError(
        selectedChannelNoFilesHint || `No stored files for CH${selectedChannel} on ${selectedDate || "selected date"}.`
      );
      return;
    }
    if (playbackChannels.length === 0) {
      setPlaybackState("error");
      setPlaybackError(
        selectedChannelNoFilesHint || `No stored files are available for playback on ${selectedDate || "the selected date"}.`
      );
      return;
    }
    const candidateVehicleIds = buildCandidateVehicleIds(canonicalSelectedVehicle, resolvedVehicleId);
    const startIso = combineDateAndTime(selectedDate, startTime);
    const endIso = combineDateAndTime(selectedDate, endTime);
    if (!startIso || !endIso) {
      setPlaybackState("error");
      setPlaybackError("Select a valid date and time range.");
      return;
    }
    if (new Date(endIso).getTime() <= new Date(startIso).getTime()) {
      setPlaybackState("error");
      setPlaybackError("End time must be after start time.");
      return;
    }

    setPlaybackState("loading");
    setPlaybackError("");
    setPlaybackItems([]);

    try {
      const items = await Promise.all(
        playbackChannels.map((channel) =>
          resolvePlaybackForChannel(candidateVehicleIds, vehicleDisplayLabel(canonicalSelectedVehicle), channel, startIso, endIso, startTime, endTime)
        )
      );
      setPlaybackItems(items);
      setRangeSummary(`${selectedDate} ${startTime} - ${endTime} UTC`);
      setPlaybackState("ready");
    } catch (error: unknown) {
      setPlaybackState("error");
      handlePlaybackRequestError(error);
    }
  }, [
    endTime,
    handlePlaybackRequestError,
    playbackChannels,
    playBothChannels,
    resolvePlaybackForChannel,
    resolvedVehicleId,
    selectedChannel,
    selectedChannelHasCoverage,
    selectedChannelNoFilesHint,
    selectedDate,
    canonicalSelectedVehicle,
    startTime,
    vehicleDisplayLabel,
  ]);

  const applyClipRangeAndPlay = useCallback(async (start?: string | null, end?: string | null) => {
    applyClipRange(start, end);
    if (!selectedChannelHasCoverage && !playBothChannels) {
      setPlaybackState("error");
      setPlaybackError(
        selectedChannelNoFilesHint || `No stored files for CH${selectedChannel} on ${selectedDate || "selected date"}.`
      );
      return;
    }
    if (playbackChannels.length === 0) {
      setPlaybackState("error");
      setPlaybackError(
        selectedChannelNoFilesHint || `No stored files are available for playback on ${selectedDate || "the selected date"}.`
      );
      return;
    }
    const candidateVehicleIds = buildCandidateVehicleIds(canonicalSelectedVehicle, resolvedVehicleId);
    const resolvedStart = start ? formatTimeInputValue(start) : "";
    const resolvedEnd = formatTimeInputValue(end || start);
    const nextStart = resolvedStart || startTime;
    const nextEnd = resolvedEnd || endTime;
    const startIso = combineDateAndTime(selectedDate, nextStart);
    const endIso = combineDateAndTime(selectedDate, nextEnd);

    if (!canonicalSelectedVehicle || !startIso || !endIso) {
      setPlaybackState("error");
      setPlaybackError("Select a valid date and time range.");
      return;
    }
    if (new Date(endIso).getTime() <= new Date(startIso).getTime()) {
      setPlaybackState("error");
      setPlaybackError("End time must be after start time.");
      return;
    }

    setPlaybackState("loading");
    setPlaybackError("");
    setPlaybackItems([]);

    try {
      const items = await Promise.all(
        playbackChannels.map((channel) =>
          resolvePlaybackForChannel(candidateVehicleIds, vehicleDisplayLabel(canonicalSelectedVehicle), channel, startIso, endIso, nextStart, nextEnd)
        )
      );
      setPlaybackItems(items);
      setRangeSummary(`${selectedDate} ${nextStart} - ${nextEnd} UTC`);
      setPlaybackState("ready");
    } catch (error: unknown) {
      setPlaybackState("error");
      handlePlaybackRequestError(error);
    }
  }, [
    applyClipRange,
    endTime,
    handlePlaybackRequestError,
    playbackChannels,
    playBothChannels,
    resolvePlaybackForChannel,
    resolvedVehicleId,
    selectedChannel,
    selectedChannelHasCoverage,
    selectedChannelNoFilesHint,
    selectedDate,
    canonicalSelectedVehicle,
    startTime,
    vehicleDisplayLabel,
  ]);

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-800 p-6 text-white shadow-xl">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-500/10 px-3 py-1 text-xs font-medium text-cyan-200"><Video className="h-3.5 w-3.5" /> Stored Review</div>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-white">Playback Workspace</h2>
          <p className="mt-2 max-w-3xl text-sm text-slate-300">
            Review stored video by vehicle, channel, and exact time range.
          </p>
        </div>
        <Button variant="outline" onClick={() => void refreshAll()} disabled={refreshing} className="border-slate-600 bg-slate-950/40 text-white hover:bg-slate-900">
          <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          Refresh
        </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
        <Card className="overflow-hidden border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div><h3 className="text-lg font-semibold text-slate-900">Find Vehicle</h3><p className="mt-1 text-sm text-slate-500">Search the stored library, then jump straight into playback.</p></div>
            <Badge variant="outline" className="rounded-full px-3 py-1 text-xs">{filteredVehicles.length} vehicles</Badge>
          </div>

          <div className="relative mb-5">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && filteredVehicles[0]) {
                  const first = filteredVehicles[0];
                  setSelectedVehicle(first);
                  setResolvedVehicleId(first.cameraSimId || first.vehicleId);
                  const latest = first.latestTime ? new Date(first.latestTime) : new Date();
                  const nextDate = latest.toISOString().slice(0, 10);
                  setSelectedDate(nextDate);
                  setAvailability([]);
                  setPlaybackState("idle");
                  setPlaybackItems([]);
                  setPlaybackError("");
                  setRangeSummary("");
                }
              }}
              placeholder="Search by fleet number or registration..."
              className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-12 pr-4 text-sm shadow-sm outline-none transition focus:border-cyan-400 focus:bg-white focus:ring-4 focus:ring-cyan-100"
            />
          </div>

          <div className="overflow-auto max-h-[70vh] rounded-2xl border border-slate-200">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-50/95 backdrop-blur">
                <tr className="text-left text-slate-600">
                  <th className="px-3 py-2 font-medium">Vehicle</th>
                  <th className="px-3 py-2 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td className="px-3 py-8 text-center text-slate-500" colSpan={2}>Loading playback inventory...</td>
                  </tr>
                ) : filteredVehicles.length === 0 ? (
                  <tr>
                    <td className="px-3 py-8 text-center text-slate-500" colSpan={2}>No stored playback data found.</td>
                  </tr>
                ) : (
                  filteredVehicles.map((vehicle) => {
                    const selected = selectedVehicle?.vehicleId === vehicle.vehicleId;
                    return (
                      <tr key={vehicle.vehicleId} className={`border-t border-slate-100 transition ${selected ? "bg-cyan-50" : "bg-white hover:bg-slate-50"}`}>
                        <td className="px-3 py-3 align-top">
                          <div className="font-medium text-slate-900">{vehicleDisplayLabel(vehicle)}</div>
                        </td>
                        <td className="px-3 py-3 align-top text-right">
                          <Button
                            size="sm"
                            variant={selected ? "default" : "outline"}
                            onClick={() => {
                              setSelectedVehicle(vehicle);
                              setResolvedVehicleId(vehicle.cameraSimId || vehicle.vehicleId);
                              const latest = vehicle.latestTime ? new Date(vehicle.latestTime) : new Date();
                              const nextDate = latest.toISOString().slice(0, 10);
                              setSelectedDate(nextDate);
                              setAvailability([]);
                              setPlaybackState("idle");
                              setPlaybackItems([]);
                              setPlaybackError("");
                              setRangeSummary("");
                            }}
                          >
                            View
                          </Button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="border-slate-200 bg-white p-5 shadow-sm">
          {!selectedVehicle ? (
            <div className="grid min-h-[420px] place-items-center rounded-3xl border border-dashed border-slate-200 bg-slate-50 px-6 text-center text-slate-500">
              Use the library on the left to load stored clips, then choose a time window and playback mode.
            </div>
          ) : (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-2xl font-bold text-slate-900">{vehicleDisplayLabel(selectedVehicle)}</h3>
                  <p className="mt-1 text-sm text-slate-600">Choose the day, channel, and time window. Quick picks below use real stored coverage.</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="rounded-full bg-white">{selectedVehicle.channels.map((channel) => `CH${channel}`).join(", ") || "N/A"}</Badge>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                <label className="space-y-1">
                  <span className="text-xs font-medium text-slate-600">Date</span>
                  <div className="relative">
                    <Calendar className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      type="date"
                      className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-12 pr-4 text-sm shadow-sm outline-none transition focus:border-cyan-400 focus:bg-white focus:ring-4 focus:ring-cyan-100"
                      value={selectedDate}
                      onChange={(e) => setSelectedDate(e.target.value)}
                    />
                  </div>
                </label>

                <label className="space-y-1">
                  <span className="text-xs font-medium text-slate-600">Primary Channel</span>
                  <select
                    className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm shadow-sm outline-none transition focus:border-cyan-400 focus:bg-white focus:ring-4 focus:ring-cyan-100"
                    value={selectedChannel}
                    onChange={(e) => {
                      const next = Number(e.target.value || 1);
                      setSelectedChannel(next);
                      const channelData = availability.find((entry) => Number(entry.channel) === next);
                      setStartTime(formatTimeInputValue(channelData?.earliestTime));
                      setEndTime(formatTimeInputValue(channelData?.latestTime));
                    }}
                  >
                    {(availability.length > 0 ? availability : [{ channel: 1, clipCount: 0, clips: [] }]).map((entry) => (
                      <option key={entry.channel} value={entry.channel}>CH{entry.channel}</option>
                    ))}
                  </select>
                </label>

                <label className="space-y-1">
                  <span className="text-xs font-medium text-slate-600">Start Time</span>
                  <div className="relative">
                    <Clock3 className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      type="time"
                      step={1}
                      className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-12 pr-4 text-sm shadow-sm outline-none transition focus:border-cyan-400 focus:bg-white focus:ring-4 focus:ring-cyan-100"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                    />
                  </div>
                </label>

                <label className="space-y-1">
                  <span className="text-xs font-medium text-slate-600">End Time</span>
                  <div className="relative">
                    <Clock3 className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      type="time"
                      step={1}
                      className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-12 pr-4 text-sm shadow-sm outline-none transition focus:border-cyan-400 focus:bg-white focus:ring-4 focus:ring-cyan-100"
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                    />
                  </div>
                </label>
              </div>

              <div className="flex flex-wrap items-center gap-2 rounded-3xl border border-slate-200 bg-slate-50 p-4">
                <Button
                  type="button"
                  variant={playBothChannels ? "default" : "outline"}
                  onClick={() => setPlayBothChannels((prev) => !prev)}
                  disabled={availableChannelNumbersWithCoverage.length < 2}
                >
                  {playBothChannels ? "Dual-channel on" : "Play both channels"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    const firstClip = selectedChannelAvailability?.clips?.[0];
                    const lastClip = selectedChannelAvailability?.clips?.[selectedChannelAvailability.clips.length - 1];
                    void applyClipRangeAndPlay(
                      firstClip?.startTime || selectedChannelAvailability?.earliestTime,
                      lastClip?.endTime || lastClip?.startTime || selectedChannelAvailability?.latestTime
                    );
                  }}
                  disabled={!selectedChannelAvailability}
                >
                  Full available range
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    const range = buildLatestRange(300);
                    void applyClipRangeAndPlay(range?.startIso, range?.endIso);
                  }}
                  disabled={!selectedChannelAvailability}
                >
                  Latest 5 min
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    const range = buildLatestRange(600);
                    void applyClipRangeAndPlay(range?.startIso, range?.endIso);
                  }}
                  disabled={!selectedChannelAvailability}
                >
                  Latest 10 min
                </Button>
                <Button onClick={() => void requestPlayback()} disabled={playbackState === "loading" || availabilityLoading}>
                  <PlayCircle className="mr-2 h-4 w-4" />
                  {playbackState === "loading" ? "Preparing..." : "Start Playback"}
                </Button>
                {availabilityLoading ? <span className="text-xs text-slate-500">Loading channel coverage...</span> : null}
                {!availabilityLoading && selectedChannelNoFilesHint ? (
                  <span className="text-xs text-amber-700">{selectedChannelNoFilesHint}</span>
                ) : null}
              </div>

              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Quick range picks</p>
                    <p className="text-xs text-slate-500">
                      One click below fills the range and starts playback.
                    </p>
                    {selectedChannelRangeSummary ? (
                      <p className="mt-1 text-xs text-slate-600">
                        Available range: {selectedChannelRangeSummary}
                      </p>
                    ) : alternateChannelRangeSummaries.length > 0 ? (
                      <p className="mt-1 text-xs text-slate-600">
                        Available range: {alternateChannelRangeSummaries.join(" | ")}
                      </p>
                    ) : null}
                  </div>
                  {selectedChannelAvailability ? (
                    <Badge variant="outline">
                      {`CH${selectedChannel} | ${selectedChannelAvailability.clipCount} stored segment(s)`}
                    </Badge>
                  ) : null}
                </div>

                {quickRangeOptions.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {quickRangeOptions.map((option) => (
                      <Button
                        key={option.key}
                        type="button"
                        variant="outline"
                        size="sm"
                        className="rounded-xl bg-white px-4 shadow-sm"
                        onClick={() => void applyClipRangeAndPlay(option.start, option.end)}
                      >
                        {option.label}
                      </Button>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">
                    {selectedChannelRangeSummary || alternateChannelRangeSummaries.length > 0
                      ? "No quick clip ranges found yet. Use Full available range or switch channel."
                      : "No stored ranges found yet for this date and channel."}
                  </p>
                )}
              </div>

              <Card className="overflow-hidden border-slate-200 bg-[#070b16] text-slate-100 shadow-sm">
                <div className="border-b border-slate-800 bg-[#0b1020] px-4 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-300 ring-1 ring-cyan-400/20">
                        <Video className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-base font-semibold text-white">Playback Viewer</p>
                        <p className="text-xs text-slate-300">
                          {playbackItems.length > 0
                            ? `${vehicleDisplayLabel(selectedVehicle)} ${playBothChannels ? "dual-channel review" : `CH${selectedChannel} playback`}`
                            : "Choose a stored range to begin playback."}
                        </p>
                        {rangeSummary ? <p className="text-[11px] text-cyan-200/80">{rangeSummary}</p> : null}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className="border border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-900">
                        {vehicleDisplayLabel(selectedVehicle)}
                      </Badge>
                      {playBothChannels && playbackItems.length > 1 ? (
                        <Badge className="bg-cyan-500/15 text-cyan-200 hover:bg-cyan-500/15">
                          Side-by-side compare
                        </Badge>
                      ) : null}
                    </div>
                  </div>
                </div>

                {playbackState === "ready" && playbackItems.length > 0 ? (
                  <div className={`grid gap-4 p-4 ${playbackItems.length > 1 ? "grid-cols-1 2xl:grid-cols-2" : "grid-cols-1"}`}>
                    {playbackItems.map((item) => (
                      <div
                        key={`${item.channel}:${item.url}`}
                        className="space-y-3 rounded-2xl border border-slate-800 bg-[#0a1020] p-3 shadow-[0_10px_30px_rgba(0,0,0,0.25)]"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <Badge className="bg-cyan-500/15 text-cyan-200 hover:bg-cyan-500/15">CH{item.channel}</Badge>
                            <span className="text-xs uppercase tracking-[0.18em] text-slate-500">Playback</span>
                          </div>
                          <span className="text-xs text-slate-400">{item.label}</span>
                        </div>
                        <PlaybackVideoPlayer url={item.url} className="aspect-video w-full rounded-2xl border border-slate-800 bg-black" />
                        <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-xs text-slate-400">
                          <span>Source window</span>
                          <span className="text-slate-200">{rangeSummary || "Selected time range"}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : playbackState === "loading" ? (
                  <div className="p-4">
                    <div className="aspect-video w-full rounded-2xl border border-slate-800 bg-slate-900 grid place-items-center text-slate-300">
                      Preparing playback video...
                    </div>
                  </div>
                ) : (
                  <div className="p-4">
                    <div className="aspect-video w-full rounded-2xl border border-slate-800 bg-slate-900 grid place-items-center text-slate-400">
                      {playbackError || "No playback selected yet."}
                    </div>
                  </div>
                )}
              </Card>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
