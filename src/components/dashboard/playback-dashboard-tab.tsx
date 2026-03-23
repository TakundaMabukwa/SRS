"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Hls from "hls.js";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock3, PlayCircle, RefreshCw, Search, Video } from "lucide-react";

type PlaybackVehicle = {
  vehicleId: string;
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

function formatDateTime(value?: string | null) {
  if (!value) return "N/A";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "N/A";
  return date.toLocaleString();
}

function formatTimeInputValue(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  return `${hours}:${minutes}:${seconds}`;
}

function combineDateAndTime(dateValue: string, timeValue: string) {
  if (!dateValue || !timeValue) return "";
  return new Date(`${dateValue}T${timeValue}`).toISOString();
}

function sourceLooksHls(url: string) {
  return /\.m3u8(?:$|\?)/i.test(url);
}

function normalizeBackendMediaUrl(url: string, videoProxyBase: string) {
  const value = String(url || "").trim();
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith(`${videoProxyBase}/`)) return value;
  if (value.startsWith("/api/")) {
    return `${videoProxyBase}${value.slice(4)}`;
  }
  if (value.startsWith("/")) return value;
  return `${videoProxyBase}/${value.replace(/^\/+/, "")}`;
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
  const PLAYBACK_LIST_TIMEOUT_MS = 20000;
  const PLAYBACK_AVAILABILITY_TIMEOUT_MS = 20000;

  const vehicleDisplayLabel = useCallback((vehicle: PlaybackVehicle | null | undefined) => {
    if (!vehicle) return "N/A";
    return vehicle.vehicleRegistration || vehicle.fleetNumber || vehicle.vehicleId;
  }, []);

  const fetchJsonWithRetry = useCallback(async (url: string, timeoutMs: number, retries = 1) => {
    let lastError: any = null;
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

  const fetchVehicles = useCallback(async () => {
    const json = await fetchJsonWithRetry(
      `${videoProxyBase}/playback/vehicles?days=14&limit=500`,
      PLAYBACK_LIST_TIMEOUT_MS,
      1
    );
    const rows = Array.isArray(json?.data) ? json.data : [];
    const deviceIds = Array.from(
      new Set(rows.map((row: any) => String(row?.vehicleId || "").trim()).filter(Boolean))
    );

    let vehicleDetails = new Map<string, any>();
    if (deviceIds.length > 0) {
      try {
        const lookupRes = await fetch(
          `/api/vehicle-lookup?deviceIds=${encodeURIComponent(deviceIds.join(","))}`,
          {
            cache: "no-store",
            signal: AbortSignal.timeout(PLAYBACK_LIST_TIMEOUT_MS),
          }
        );
        const lookupJson = await lookupRes.json().catch(() => ({}));
        const lookupRows = Array.isArray(lookupJson?.vehicles) ? lookupJson.vehicles : [];
        vehicleDetails = new Map(
          lookupRows.map((row: any) => [String(row?.deviceId || "").trim(), row])
        );
      } catch (error) {
        console.warn("Playback vehicle registration lookup failed:", error);
      }
    }

    const enrichedRows = rows.map((row: any) => {
      const vehicleId = String(row?.vehicleId || "").trim();
      const details = vehicleDetails.get(vehicleId);
      return {
        ...row,
        vehicleRegistration: details?.plate || null,
        fleetNumber: details?.fleetNumber || null,
        make: details?.make || null,
        model: details?.model || null,
      };
    });
    setVehicles(enrichedRows);
    return enrichedRows as PlaybackVehicle[];
  }, [fetchJsonWithRetry]);

  const fetchAvailability = useCallback(async (vehicleId: string, date: string) => {
    setAvailabilityLoading(true);
    try {
      const json = await fetchJsonWithRetry(
        `${videoProxyBase}/vehicles/${encodeURIComponent(vehicleId)}/videos/availability?date=${encodeURIComponent(date)}`,
        PLAYBACK_AVAILABILITY_TIMEOUT_MS,
        1
      );
      const channels = Array.isArray(json?.data?.channels) ? json.data.channels : [];
      setAvailability(channels);
      if (channels.length > 0) {
        const firstChannel = Number(channels[0]?.channel || 1);
        setSelectedChannel(firstChannel);
        const firstClip = channels[0]?.clips?.[0];
        const lastClip = channels[0]?.clips?.[channels[0]?.clips?.length - 1];
        setStartTime(formatTimeInputValue(firstClip?.startTime || channels[0]?.earliestTime));
        setEndTime(formatTimeInputValue(lastClip?.endTime || lastClip?.startTime || channels[0]?.latestTime));
      } else {
        setSelectedChannel(1);
        setStartTime("");
        setEndTime("");
      }
    } finally {
      setAvailabilityLoading(false);
    }
  }, [fetchJsonWithRetry]);

  const refreshAll = useCallback(async () => {
    setRefreshing(true);
    try {
      const rows = await fetchVehicles();
      if (!selectedVehicle && rows.length > 0) {
        const first = rows[0];
        setSelectedVehicle(first);
        const latest = first.latestTime ? new Date(first.latestTime) : new Date();
        const nextDate = latest.toISOString().slice(0, 10);
        setSelectedDate(nextDate);
        await fetchAvailability(first.vehicleId, nextDate);
      }
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }, [fetchAvailability, fetchVehicles, selectedVehicle]);

  useEffect(() => {
    void refreshAll();
  }, [refreshAll]);

  useEffect(() => {
    if (!selectedVehicle || !selectedDate) return;
    void fetchAvailability(selectedVehicle.vehicleId, selectedDate);
  }, [fetchAvailability, selectedDate, selectedVehicle?.vehicleId]);

  const filteredVehicles = useMemo(() => {
    const needle = searchQuery.trim().toLowerCase();
    if (!needle) return vehicles;
    return vehicles.filter((vehicle) =>
      [
        vehicle.vehicleId,
        vehicle.vehicleRegistration,
        vehicle.fleetNumber,
        vehicle.make,
        vehicle.model,
      ]
        .map((value) => String(value || "").toLowerCase())
        .some((value) => value.includes(needle))
    );
  }, [searchQuery, vehicles]);

  const selectedChannelAvailability = useMemo(
    () => availability.find((entry) => Number(entry.channel) === Number(selectedChannel)) || null,
    [availability, selectedChannel]
  );

  const availableChannelNumbers = useMemo(
    () => availability.map((entry) => Number(entry.channel || 0)).filter((channel) => Number.isFinite(channel) && channel > 0),
    [availability]
  );

  const playbackChannels = useMemo(() => {
    if (!playBothChannels) return [selectedChannel];
    return Array.from(new Set([selectedChannel, ...availableChannelNumbers])).slice(0, 2);
  }, [availableChannelNumbers, playBothChannels, selectedChannel]);

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

  useEffect(() => {
    if (!selectedChannelAvailability) return;
    if (!startTime) setStartTime(formatTimeInputValue(selectedChannelAvailability.earliestTime));
    if (!endTime) setEndTime(formatTimeInputValue(selectedChannelAvailability.latestTime));
  }, [selectedChannelAvailability, startTime, endTime]);

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

  const applyFullAvailableRange = useCallback(() => {
    if (!selectedChannelAvailability) return;
    const firstClip = selectedChannelAvailability.clips[0];
    const lastClip = selectedChannelAvailability.clips[selectedChannelAvailability.clips.length - 1];
    applyClipRange(
      firstClip?.startTime || selectedChannelAvailability.earliestTime,
      lastClip?.endTime || lastClip?.startTime || selectedChannelAvailability.latestTime
    );
  }, [applyClipRange, selectedChannelAvailability]);

  const applyLatestRange = useCallback((seconds: number) => {
    if (!selectedChannelAvailability) return;
    const lastClip = selectedChannelAvailability.clips[selectedChannelAvailability.clips.length - 1];
    const latestRaw = lastClip?.endTime || lastClip?.startTime || selectedChannelAvailability.latestTime;
    if (!latestRaw) return;
    const latest = new Date(latestRaw);
    if (Number.isNaN(latest.getTime())) return;
    const start = new Date(latest.getTime() - seconds * 1000);
    setStartTime(formatTimeInputValue(start.toISOString()));
    setEndTime(formatTimeInputValue(latest.toISOString()));
  }, [selectedChannelAvailability]);

  const resolvePlaybackForChannel = useCallback(async (
    vehicleId: string,
    channel: number,
    startIso: string,
    endIso: string,
    labelStart: string,
    labelEnd: string
  ): Promise<PlaybackItem> => {
    const res = await fetch(`${videoProxyBase}/vehicles/${encodeURIComponent(vehicleId)}/videos/window`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        channel,
        startTime: startIso,
        endTime: endIso,
      }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json?.success) {
      throw new Error(json?.message || `HTTP ${res.status}`);
    }

    const data = json?.data || {};
    if (data?.playbackSource === "live_fallback" && data?.streamUrl) {
      return {
        channel,
        url: normalizeBackendMediaUrl(String(data.streamUrl), videoProxyBase),
        label: `${vehicleId} CH${channel} live fallback`,
      };
    }

    const jobId = String(data?.playbackJobId || "").trim();
    if (!jobId) {
      throw new Error(`Playback job was not created for CH${channel}.`);
    }

    for (let attempt = 0; attempt < 60; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, attempt === 0 ? 600 : 1500));
      const statusRes = await fetch(`${videoProxyBase}/videos/jobs/${encodeURIComponent(jobId)}`, {
        cache: "no-store",
        signal: AbortSignal.timeout(5000),
      });
      const statusJson = await statusRes.json().catch(() => ({}));
      const job = statusJson?.data || {};
      if (job?.status === "completed") {
        const preferredUrl = normalizeBackendMediaUrl(
          String(job?.persistedVideoUrl || "").trim() ||
          (job?.persistedVideoId ? `${videoProxyBase}/videos/${encodeURIComponent(String(job.persistedVideoId))}/file` : "") ||
          String(job?.outputUrl || "").trim() ||
          `${videoProxyBase}/videos/jobs/${encodeURIComponent(jobId)}/file`,
          videoProxyBase
        );
        return {
          channel,
          url: preferredUrl,
          label: `${vehicleId} CH${channel} ${labelStart} - ${labelEnd}`,
        };
      }
      if (job?.status === "failed") {
        throw new Error(job?.error || `Playback generation failed for CH${channel}.`);
      }
    }

    throw new Error(`Playback job timed out for CH${channel}.`);
  }, [videoProxyBase]);

  const requestPlayback = useCallback(async () => {
    if (!selectedVehicle) return;
    const startIso = combineDateAndTime(selectedDate, startTime);
    const endIso = combineDateAndTime(selectedDate, endTime);
    if (!startIso || !endIso) {
      setPlaybackState("error");
      setPlaybackError("Select a valid date and time range.");
      return;
    }

    setPlaybackState("loading");
    setPlaybackError("");
    setPlaybackItems([]);

    try {
      const items = await Promise.all(
        playbackChannels.map((channel) =>
          resolvePlaybackForChannel(selectedVehicle.vehicleId, channel, startIso, endIso, startTime, endTime)
        )
      );
      setPlaybackItems(items);
      setRangeSummary(`${selectedDate} ${startTime} - ${endTime}`);
      setPlaybackState("ready");
    } catch (error: any) {
      setPlaybackState("error");
      setPlaybackError(error?.message || "Failed to prepare playback.");
    }
  }, [endTime, playbackChannels, resolvePlaybackForChannel, selectedDate, selectedVehicle, startTime]);

  const applyClipRangeAndPlay = useCallback(async (start?: string | null, end?: string | null) => {
    applyClipRange(start, end);
    const resolvedStart = start ? formatTimeInputValue(start) : "";
    const resolvedEnd = formatTimeInputValue(end || start);
    const nextStart = resolvedStart || startTime;
    const nextEnd = resolvedEnd || endTime;
    const startIso = combineDateAndTime(selectedDate, nextStart);
    const endIso = combineDateAndTime(selectedDate, nextEnd);

    if (!selectedVehicle || !startIso || !endIso) {
      setPlaybackState("error");
      setPlaybackError("Select a valid date and time range.");
      return;
    }

    setPlaybackState("loading");
    setPlaybackError("");
    setPlaybackItems([]);

    try {
      const items = await Promise.all(
        playbackChannels.map((channel) =>
          resolvePlaybackForChannel(selectedVehicle.vehicleId, channel, startIso, endIso, nextStart, nextEnd)
        )
      );
      setPlaybackItems(items);
      setRangeSummary(`${selectedDate} ${nextStart} - ${nextEnd}`);
      setPlaybackState("ready");
    } catch (error: any) {
      setPlaybackState("error");
      setPlaybackError(error?.message || "Failed to prepare playback.");
    }
  }, [
    applyClipRange,
    endTime,
    playbackChannels,
    resolvePlaybackForChannel,
    selectedDate,
    selectedVehicle,
    startTime,
  ]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Playback</h2>
          <p className="text-sm text-slate-600 mt-1">
            Review stored video by vehicle, channel, and exact time range.
          </p>
        </div>
        <Button variant="outline" onClick={() => void refreshAll()} disabled={refreshing}>
          <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        <Card className="xl:col-span-4 overflow-hidden border-slate-200 shadow-sm">
          <div className="flex items-center justify-between gap-3 mb-4">
            <h3 className="text-base font-semibold text-slate-900">Find Vehicle</h3>
            <Badge variant="outline">{filteredVehicles.length} vehicles</Badge>
          </div>

          <div className="relative mb-4">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && filteredVehicles[0]) {
                  const first = filteredVehicles[0];
                  setSelectedVehicle(first);
                  const latest = first.latestTime ? new Date(first.latestTime) : new Date();
                  const nextDate = latest.toISOString().slice(0, 10);
                  setSelectedDate(nextDate);
                  setPlaybackState("idle");
                  setPlaybackItems([]);
                  setPlaybackError("");
                  setRangeSummary("");
                }
              }}
              placeholder="Enter vehicle ID..."
              className="h-10 w-full rounded-md border border-slate-200 bg-white pl-10 pr-3 text-sm"
            />
          </div>

          <div className="overflow-auto max-h-[70vh] rounded-lg border border-slate-200">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-50">
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
                      <tr key={vehicle.vehicleId} className={`border-t border-slate-100 ${selected ? "bg-cyan-50" : "bg-white"}`}>
                        <td className="px-3 py-3 align-top">
                          <div className="font-medium text-slate-900">{vehicleDisplayLabel(vehicle)}</div>
                          {vehicle.vehicleRegistration || vehicle.fleetNumber ? (
                            <>
                              <div className="text-xs text-slate-500">{vehicle.vehicleId}</div>
                              <div className="text-xs text-slate-500">{vehicle.clipCount} clip(s)</div>
                            </>
                          ) : (
                            <div className="text-xs text-slate-500">{vehicle.clipCount} clip(s)</div>
                          )}
                        </td>
                        <td className="px-3 py-3 align-top text-right">
                          <Button
                            size="sm"
                            variant={selected ? "default" : "outline"}
                            onClick={() => {
                              setSelectedVehicle(vehicle);
                              const latest = vehicle.latestTime ? new Date(vehicle.latestTime) : new Date();
                              const nextDate = latest.toISOString().slice(0, 10);
                              setSelectedDate(nextDate);
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

        <Card className="xl:col-span-8 p-4 border-slate-200 shadow-sm">
          {!selectedVehicle ? (
            <div className="h-full min-h-[320px] grid place-items-center text-slate-500">
              Search for a vehicle on the left, then set the playback window.
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">{vehicleDisplayLabel(selectedVehicle)}</h3>
                  <p className="text-sm text-slate-600">Choose the day, channel, and time window. Quick picks below use real stored coverage.</p>
                  {(selectedVehicle.vehicleRegistration || selectedVehicle.fleetNumber) ? (
                    <p className="text-xs text-slate-500">{selectedVehicle.vehicleId}</p>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="bg-slate-100 text-slate-700 hover:bg-slate-100">{selectedVehicle.clipCount} clip(s)</Badge>
                  <Badge variant="outline">{selectedVehicle.channels.map((channel) => `CH${channel}`).join(", ") || "N/A"}</Badge>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                <label className="space-y-1">
                  <span className="text-xs font-medium text-slate-600">Date</span>
                  <div className="relative">
                    <Calendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      type="date"
                      className="h-10 w-full rounded-md border border-slate-200 bg-white pl-10 pr-3 text-sm"
                      value={selectedDate}
                      onChange={(e) => setSelectedDate(e.target.value)}
                    />
                  </div>
                </label>

                <label className="space-y-1">
                  <span className="text-xs font-medium text-slate-600">Primary Channel</span>
                  <select
                    className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
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
                    <Clock3 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      type="time"
                      step={1}
                      className="h-10 w-full rounded-md border border-slate-200 bg-white pl-10 pr-3 text-sm"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                    />
                  </div>
                </label>

                <label className="space-y-1">
                  <span className="text-xs font-medium text-slate-600">End Time</span>
                  <div className="relative">
                    <Clock3 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      type="time"
                      step={1}
                      className="h-10 w-full rounded-md border border-slate-200 bg-white pl-10 pr-3 text-sm"
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                    />
                  </div>
                </label>
              </div>

              <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
                <Button
                  type="button"
                  variant={playBothChannels ? "default" : "outline"}
                  onClick={() => setPlayBothChannels((prev) => !prev)}
                  disabled={availableChannelNumbers.length < 2}
                >
                  {playBothChannels ? "Playing 2 channels" : "Play both channels"}
                </Button>
                <Button type="button" variant="outline" onClick={applyFullAvailableRange} disabled={!selectedChannelAvailability}>
                  Full available range
                </Button>
                <Button type="button" variant="outline" onClick={() => applyLatestRange(300)} disabled={!selectedChannelAvailability}>
                  Latest 5 min
                </Button>
                <Button type="button" variant="outline" onClick={() => applyLatestRange(600)} disabled={!selectedChannelAvailability}>
                  Latest 10 min
                </Button>
                <Button onClick={() => void requestPlayback()} disabled={playbackState === "loading" || availabilityLoading}>
                  <PlayCircle className="mr-2 h-4 w-4" />
                  {playbackState === "loading" ? "Preparing..." : playBothChannels ? "Play both channels" : "Play Playback"}
                </Button>
                {availabilityLoading ? <span className="text-xs text-slate-500">Loading channel coverage...</span> : null}
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Quick range picks</p>
                    <p className="text-xs text-slate-500">
                      One click below fills the range and starts playback.
                    </p>
                  </div>
                  {selectedChannelAvailability ? (
                    <Badge variant="outline">
                      {`CH${selectedChannel} Ã¢â‚¬Â¢ ${selectedChannelAvailability.clipCount} stored segment(s)`}
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
                  <p className="text-xs text-slate-500">No stored ranges found yet for this date and channel.</p>
                )}
              </div>`r`n`r`n              <Card className="overflow-hidden border-slate-200 bg-[#070b16] text-slate-100 shadow-none">
                <div className="border-b border-slate-800 bg-[#0b1020] px-4 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-300 ring-1 ring-cyan-400/20">
                        <Video className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-white">Now Playing</p>
                        <p className="text-xs text-slate-300">
                          {playbackItems.length > 0
                            ? `${vehicleDisplayLabel(selectedVehicle)} ${playBothChannels ? "dual-channel playback" : `CH${selectedChannel} playback`}`
                            : "Choose a range and play stored footage."}
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
                          Dual channel compare
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

