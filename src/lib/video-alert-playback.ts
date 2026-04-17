"use client";

export type AlertPlaybackVideo = {
  key: string;
  label: string;
  url: string;
};

type AlertPlaybackSource = string | { [key: string]: any };

const DEFAULT_VIDEO_PROXY_BASE = "/api/video-server";
const ALERT_PLAYBACK_WINDOW_BEFORE_MS = 60 * 1000;
const ALERT_PLAYBACK_WINDOW_AFTER_MS = 60 * 1000;
const PLAYBACK_CACHE_PREFIX = "alert-playback:";
const DIRECT_VIDEO_HUB_BASE = String(
  process.env.NEXT_PUBLIC_VIDEO_HUB_BASE_URL ||
    process.env.NEXT_PUBLIC_VIDEO_BASE_URL ||
    ""
).trim().replace(/\/+$/, "");
const playbackVideoCache = new Map<string, AlertPlaybackVideo[]>();

function normalizeApiBase(baseUrl: string) {
  const clean = String(baseUrl || "").trim().replace(/\/+$/, "");
  if (!clean) return "";
  if (/\/api(?:\/video-server)?$/i.test(clean)) return clean.replace(/\/video-server$/i, "");
  return `${clean}/api`;
}

function timeoutSignal(timeoutMs: number) {
  if (typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function") {
    return AbortSignal.timeout(timeoutMs);
  }
  return undefined;
}

function readCachedPlaybackVideos(cacheKey: string): AlertPlaybackVideo[] {
  const normalizedKey = String(cacheKey || "").trim();
  if (!normalizedKey) return [];

  const memoryCached = playbackVideoCache.get(normalizedKey);
  if (Array.isArray(memoryCached) && memoryCached.length > 0) {
    return memoryCached;
  }

  if (typeof window === "undefined") return [];
  try {
    const raw = window.sessionStorage.getItem(`${PLAYBACK_CACHE_PREFIX}${normalizedKey}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    const videos = Array.isArray(parsed)
      ? parsed.filter((video) => video && typeof video.url === "string" && video.url.trim())
      : [];
    if (videos.length > 0) {
      playbackVideoCache.set(normalizedKey, videos);
    }
    return videos;
  } catch {
    return [];
  }
}

function writeCachedPlaybackVideos(cacheKey: string, videos: AlertPlaybackVideo[]) {
  const normalizedKey = String(cacheKey || "").trim();
  if (!normalizedKey || !Array.isArray(videos) || videos.length === 0) return;
  playbackVideoCache.set(normalizedKey, videos);
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(`${PLAYBACK_CACHE_PREFIX}${normalizedKey}`, JSON.stringify(videos));
  } catch {
    // Ignore session storage write failures.
  }
}

function getPlaybackRequestBases(videoProxyBase = DEFAULT_VIDEO_PROXY_BASE) {
  const bases = [String(videoProxyBase || "").trim()];
  const directApiBase = normalizeApiBase(DIRECT_VIDEO_HUB_BASE);
  if (directApiBase && !bases.includes(directApiBase)) {
    bases.push(directApiBase);
  }
  return bases.filter(Boolean);
}

export function normalizeBackendMediaUrl(url: string, videoProxyBase = DEFAULT_VIDEO_PROXY_BASE) {
  const value = String(url || "").trim();
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) {
    try {
      const parsed = new URL(value);
      if (parsed.pathname.startsWith("/api/video-server/")) {
        return `${videoProxyBase}${parsed.pathname.slice("/api/video-server".length)}${parsed.search || ""}`;
      }
      if (DIRECT_VIDEO_HUB_BASE) {
        const hubBase = new URL(DIRECT_VIDEO_HUB_BASE);
        if (parsed.origin === hubBase.origin && parsed.pathname.startsWith('/api/')) {
          if (parsed.pathname.startsWith("/api/video-server/")) {
            return `${videoProxyBase}${parsed.pathname.slice("/api/video-server".length)}${parsed.search || ""}`;
          }
          return `${videoProxyBase}${parsed.pathname.slice(4)}${parsed.search || ''}`;
        }
      }
      return value;
    } catch {
      return value;
    }
  }
  if (value.startsWith(`${videoProxyBase}/`)) return value;
  if (value.startsWith("/api/")) {
    return `${videoProxyBase}${value.slice(4)}`;
  }
  if (value.startsWith("/")) return value;
  return `${videoProxyBase}/${value.replace(/^\/+/, "")}`;
}

export function resolveMediaUrlForCurrentOrigin(url: string, videoProxyBase = DEFAULT_VIDEO_PROXY_BASE) {
  const normalized = normalizeBackendMediaUrl(url, videoProxyBase);
  if (!normalized) return "";
  if (typeof window === "undefined") return normalized;

  try {
    if (/^https?:\/\//i.test(normalized)) {
      const parsed = new URL(normalized);
      if (parsed.pathname.startsWith("/api/video-server/")) {
        return `${window.location.origin}${parsed.pathname}${parsed.search || ""}`;
      }
      return normalized;
    }
    if (normalized.startsWith("/api/video-server/")) {
      return `${window.location.origin}${normalized}`;
    }
    return normalized;
  } catch {
    return normalized;
  }
}

type RawAlertTimestampParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

function parseRawAlertTimestampParts(value: unknown): RawAlertTimestampParts | null {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const match = raw.match(/^(\d{4})[-/](\d{2})[-/](\d{2})[T\s](\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!match) return null;
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4]),
    minute: Number(match[5]),
    second: Number(match[6] || 0),
  };
}

function getRawAlertTimestampValue(value: unknown) {
  return String(value || "").trim();
}

function timestampToComparableMs(value: unknown) {
  const raw = getRawAlertTimestampValue(value);
  if (!raw) return Number.NaN;

  const parsedRaw = parseRawAlertTimestampParts(raw);
  if (parsedRaw) {
    return Date.UTC(
      parsedRaw.year,
      Math.max(0, parsedRaw.month - 1),
      parsedRaw.day,
      parsedRaw.hour,
      parsedRaw.minute,
      parsedRaw.second,
      0
    );
  }

  const nativeMs = new Date(raw).getTime();
  return Number.isFinite(nativeMs) ? nativeMs : Number.NaN;
}

function collectAlertDisplayTimestampCandidates(alert: any) {
  const metadata = alert?.metadata || {};
  const vendorExtensions = Array.isArray(metadata?.vendorExtensions) ? metadata.vendorExtensions : [];

  return [
    alert?.lastOccurrenceTimestamp,
    alert?.last_occurrence_timestamp,
    alert?.lastOccurrenceAt,
    alert?.last_occurrence_at,
    alert?.lastOccurrence,
    alert?.last_occurrence,
    alert?.latestTimestamp,
    alert?.latest_timestamp,
    alert?.timestamp,
    alert?.alertTimestamp,
    alert?.alert_timestamp,
    alert?.created_at,
    alert?.timestampLocal,
    alert?.timestamp_local,
    alert?.alertTimestampLocal,
    alert?.alert_timestamp_local,
    metadata?.timestamp,
    metadata?.eventTimestamp,
    metadata?.event_timestamp,
    metadata?.resourceEndTime,
    metadata?.resource_end_time,
    metadata?.resourceStartTime,
    metadata?.resource_start_time,
    metadata?.sourceTimestamp,
    metadata?.source_timestamp,
    metadata?.locationFix?.timestamp,
    ...vendorExtensions.map((entry: any) => entry?.sourceTimestamp),
  ]
    .map(getRawAlertTimestampValue)
    .filter(Boolean);
}

function collectAlertFirstOccurrenceCandidates(alert: any) {
  const metadata = alert?.metadata || {};
  const vendorExtensions = Array.isArray(metadata?.vendorExtensions) ? metadata.vendorExtensions : [];

  return [
    alert?.timestamp,
    alert?.alertTimestamp,
    alert?.alert_timestamp,
    alert?.created_at,
    alert?.firstOccurrenceTimestamp,
    alert?.first_occurrence_timestamp,
    alert?.firstOccurrenceAt,
    alert?.first_occurrence_at,
    metadata?.firstOccurrence,
    metadata?.first_occurrence,
    metadata?.timestamp,
    metadata?.eventTimestamp,
    metadata?.event_timestamp,
    metadata?.resourceStartTime,
    metadata?.resource_start_time,
    metadata?.sourceTimestamp,
    metadata?.source_timestamp,
    metadata?.locationFix?.timestamp,
    ...vendorExtensions.map((entry: any) => entry?.sourceTimestamp),
  ]
    .map(getRawAlertTimestampValue)
    .filter(Boolean);
}

function pickLatestTimestamp(candidates: string[]) {
  if (candidates.length === 0) return null;

  let latestValue = candidates[0];
  let latestMs = timestampToComparableMs(latestValue);

  for (const candidate of candidates.slice(1)) {
    const candidateMs = timestampToComparableMs(candidate);
    if (Number.isFinite(candidateMs) && (!Number.isFinite(latestMs) || candidateMs > latestMs)) {
      latestValue = candidate;
      latestMs = candidateMs;
    }
  }

  return latestValue || null;
}

function pickEarliestTimestamp(candidates: string[]) {
  if (candidates.length === 0) return null;

  let earliestValue = candidates[0];
  let earliestMs = timestampToComparableMs(earliestValue);

  for (const candidate of candidates.slice(1)) {
    const candidateMs = timestampToComparableMs(candidate);
    if (Number.isFinite(candidateMs) && (!Number.isFinite(earliestMs) || candidateMs < earliestMs)) {
      earliestValue = candidate;
      earliestMs = candidateMs;
    }
  }

  return earliestValue || null;
}

export function getAlertDisplayTimestamp(alert: any) {
  return pickLatestTimestamp(collectAlertDisplayTimestampCandidates(alert));
}

export function getAlertPlaybackTimestamp(alert: any) {
  const firstOccurrence = pickEarliestTimestamp(collectAlertFirstOccurrenceCandidates(alert));
  return firstOccurrence || getAlertDisplayTimestamp(alert);
}

export function getAlertFirstOccurrenceTimestamp(alert: any) {
  return getAlertPlaybackTimestamp(alert);
}

export function getAlertLastOccurrenceTimestamp(alert: any) {
  return getAlertDisplayTimestamp(alert);
}

export function getAlertPlaybackSignature(alert: any) {
  if (!alert || typeof alert !== "object") return "";
  const playbackWindow = getAlertPlaybackWindow(alert);
  return JSON.stringify({
    id: String(alert?.id || "").trim(),
    vehicleId: getAlertVehicleId(alert),
    channel: getAlertChannel(alert),
    timestamp: getAlertPlaybackTimestamp(alert) || "",
    startIso: playbackWindow?.startIso || "",
    endIso: playbackWindow?.endIso || "",
  });
}

export function formatRawAlertTimestamp(
  value: unknown,
  style: "datetime" | "date" | "time" = "datetime"
) {
  const parts = parseRawAlertTimestampParts(value);
  if (!parts) return String(value || "").trim();

  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const monthLabel = months[Math.max(0, Math.min(11, parts.month - 1))] || "";
  const day = String(parts.day).padStart(2, "0");
  const hour = String(parts.hour).padStart(2, "0");
  const minute = String(parts.minute).padStart(2, "0");

  if (style === "date") return `${monthLabel} ${day}`;
  if (style === "time") return `${hour}:${minute}`;
  return `${monthLabel} ${day}, ${hour}:${minute}`;
}

function buildJobStatusUrl(jobId: string, videoProxyBase = DEFAULT_VIDEO_PROXY_BASE, playbackJobUrl?: string) {
  const absoluteJobFileUrl = String(playbackJobUrl || "").trim();
  if (absoluteJobFileUrl) {
    return absoluteJobFileUrl.replace(/\/file(?:\?.*)?$/i, "");
  }
  return `${videoProxyBase}/videos/jobs/${encodeURIComponent(jobId)}`;
}

function buildJobFileUrl(jobId: string, videoProxyBase = DEFAULT_VIDEO_PROXY_BASE, playbackJobUrl?: string) {
  const absoluteJobFileUrl = String(playbackJobUrl || "").trim();
  if (absoluteJobFileUrl) {
    return absoluteJobFileUrl;
  }
  return `${videoProxyBase}/videos/jobs/${encodeURIComponent(jobId)}/file`;
}

function getPreferredCompletedJobUrl(
  job: any,
  jobId: string,
  videoProxyBase = DEFAULT_VIDEO_PROXY_BASE,
  playbackJobUrl?: string
) {
  const jobFileUrl = normalizeBackendMediaUrl(
    String(job?.outputUrl || "").trim() ||
      buildJobFileUrl(jobId, videoProxyBase, playbackJobUrl),
    videoProxyBase
  );
  if (!jobFileUrl) return "";
  const stamp = encodeURIComponent(String(job?.updatedAt || job?.updated_at || job?.fileSize || "").trim());
  if (!stamp) return jobFileUrl;
  return `${jobFileUrl}${jobFileUrl.includes("?") ? "&" : "?"}_ts=${stamp}`;
}

async function pollPlaybackJob(jobId: string, videoProxyBase = DEFAULT_VIDEO_PROXY_BASE, playbackJobUrl?: string) {
  const statusUrl = buildJobStatusUrl(jobId, videoProxyBase, playbackJobUrl);
  let lastProgressKey = "";
  let stalledAttempts = 0;
  for (let attempt = 0; attempt < 120; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, attempt === 0 ? 500 : 1500));
    const statusRes = await fetch(statusUrl, {
      cache: "no-store",
      signal: timeoutSignal(5000),
    });
    const statusJson = await statusRes.json().catch(() => ({}));
    const job = statusJson?.data || {};
    if (attempt === 0 || job?.status === "completed" || job?.status === "failed") {
      console.info("[AlertPlayback] Job status", {
        jobId,
        attempt,
        statusUrl,
        playbackJobUrl,
        status: job?.status || "unknown",
        fileReady: !!job?.fileReady,
        fileSize: Number(job?.fileSize || 0),
        updatedAt: job?.updatedAt || job?.updated_at || "",
        outputUrl: job?.outputUrl || "",
      });
    }
    if (job?.status === "completed") {
      return getPreferredCompletedJobUrl(job, jobId, videoProxyBase, playbackJobUrl);
    }
    if (job?.status === "failed") {
      throw new Error(job?.error || "Playback generation failed.");
    }
    const progressKey = `${String(job?.status || "")}|${String(job?.updatedAt || job?.updated_at || "")}|${Number(job?.fileSize || 0)}`;
    if (progressKey === lastProgressKey) {
      stalledAttempts += 1;
    } else {
      lastProgressKey = progressKey;
      stalledAttempts = 0;
    }
    if (stalledAttempts >= 20) {
      throw new Error("Playback job is taking too long on the server. Please try again.");
    }
  }
  throw new Error("Playback job timed out.");
}

function getAlertVehicleId(alert: any) {
  return String(
    alert?.vehicleId ||
      alert?.device_id ||
      alert?.vehicle?.vehicleId ||
      alert?.vehicle?.terminalPhone ||
      alert?.metadata?.vehicle?.vehicleId ||
      alert?.metadata?.vehicle?.terminalPhone ||
      ""
  ).trim();
}

function getAlertChannel(alert: any) {
  const candidates = [
    alert?.channel,
    alert?.metadata?.channel,
    alert?.metadata?.resourceChannel,
    alert?.metadata?.locationFix?.channel,
  ];
  for (const candidate of candidates) {
    const value = Number(candidate);
    if (Number.isFinite(value) && value > 0) return value;
  }
  return 1;
}

function getAlertChannelCandidates(alert: any) {
  const primaryChannel = getAlertChannel(alert);
  return Array.from(
    new Set(
      [primaryChannel, 1, 2].filter((value) => Number.isFinite(value) && value > 0)
    )
  );
}

function getAlertPlaybackWindow(alert: any) {
  const timestamp = getAlertPlaybackTimestamp(alert);
  if (!timestamp) return null;

  const metadata = alert?.metadata || {};
  const startCandidate =
    metadata?.resourceStartTime ||
    metadata?.resource_start_time ||
    metadata?.eventStartTime ||
    metadata?.event_start_time ||
    null;
  const endCandidate =
    metadata?.resourceEndTime ||
    metadata?.resource_end_time ||
    metadata?.eventEndTime ||
    metadata?.event_end_time ||
    null;

  const baseTime = new Date(timestamp);
  if (Number.isNaN(baseTime.getTime())) return null;

  const start = startCandidate ? new Date(startCandidate) : new Date(baseTime.getTime() - ALERT_PLAYBACK_WINDOW_BEFORE_MS);
  const end = endCandidate ? new Date(endCandidate) : new Date(baseTime.getTime() + ALERT_PLAYBACK_WINDOW_AFTER_MS);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
    return {
      startIso: new Date(baseTime.getTime() - ALERT_PLAYBACK_WINDOW_BEFORE_MS).toISOString(),
      endIso: new Date(baseTime.getTime() + ALERT_PLAYBACK_WINDOW_AFTER_MS).toISOString(),
    };
  }

  return {
    startIso: start.toISOString(),
    endIso: end.toISOString(),
  };
}

function getAlertPlaybackCacheKey(alert: any) {
  if (!alert || typeof alert !== "object") return "";
  const playbackWindow = getAlertPlaybackWindow(alert);
  return JSON.stringify({
    id: String(alert?.id || "").trim(),
    vehicleId: getAlertVehicleId(alert),
    channels: getAlertChannelCandidates(alert),
    startIso: playbackWindow?.startIso || "",
    endIso: playbackWindow?.endIso || "",
  });
}

function formatAvailabilityDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function collectAvailabilityDates(baseTime: Date) {
  const oneDay = 24 * 60 * 60 * 1000;
  return Array.from(
    new Set([
      formatAvailabilityDate(baseTime),
      formatAvailabilityDate(new Date(baseTime.getTime() - oneDay)),
      formatAvailabilityDate(new Date(baseTime.getTime() + oneDay)),
    ])
  );
}

type AvailabilityClip = {
  channel: number;
  startTime: string;
  endTime: string;
};

function buildBoundedPlaybackWindow(
  clip: AvailabilityClip,
  targetTime: Date,
  beforeMs = ALERT_PLAYBACK_WINDOW_BEFORE_MS,
  afterMs = ALERT_PLAYBACK_WINDOW_AFTER_MS
) {
  const clipStart = new Date(clip.startTime);
  const clipEnd = new Date(clip.endTime);
  if (Number.isNaN(clipStart.getTime()) || Number.isNaN(clipEnd.getTime())) {
    return {
      startTime: clip.startTime,
      endTime: clip.endTime,
    };
  }

  const targetMs = targetTime.getTime();
  const safeTargetMs = Number.isFinite(targetMs)
    ? Math.min(Math.max(targetMs, clipStart.getTime()), clipEnd.getTime())
    : clipStart.getTime();

  const desiredStart = new Date(safeTargetMs - beforeMs);
  const desiredEnd = new Date(safeTargetMs + afterMs);

  const boundedStartMs = Math.max(desiredStart.getTime(), clipStart.getTime());
  const boundedEndMs = Math.min(desiredEnd.getTime(), clipEnd.getTime());

  if (!Number.isFinite(boundedStartMs) || !Number.isFinite(boundedEndMs) || boundedEndMs <= boundedStartMs) {
    return {
      startTime: clip.startTime,
      endTime: clip.endTime,
    };
  }

  return {
    startTime: new Date(boundedStartMs).toISOString(),
    endTime: new Date(boundedEndMs).toISOString(),
  };
}

async function findNearestAvailableClip(
  vehicleId: string,
  channel: number,
  targetTime: Date,
  videoProxyBase = DEFAULT_VIDEO_PROXY_BASE
): Promise<AvailabilityClip | null> {
  const targetMs = targetTime.getTime();
  if (!vehicleId || !Number.isFinite(targetMs)) return null;

  const candidates: Array<AvailabilityClip & { distanceMs: number }> = [];

  for (const playbackBase of getPlaybackRequestBases(videoProxyBase)) {
    for (const date of collectAvailabilityDates(targetTime)) {
      try {
        const res = await fetch(
          `${playbackBase}/vehicles/${encodeURIComponent(vehicleId)}/videos/availability?date=${encodeURIComponent(date)}`,
          { cache: "no-store", signal: timeoutSignal(6000) }
        );
        const json = await res.json().catch(() => ({}));
        const channels = Array.isArray(json?.data?.channels) ? json.data.channels : [];
        const targetChannel = channels.find((entry: any) => Number(entry?.channel || 0) === Number(channel));
        const clips = Array.isArray(targetChannel?.clips) ? targetChannel.clips : [];

        for (const clip of clips) {
          const start = new Date(clip?.startTime || 0);
          const end = new Date(clip?.endTime || clip?.startTime || 0);
          if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) continue;
          const distanceMs =
            targetMs < start.getTime()
              ? start.getTime() - targetMs
              : targetMs > end.getTime()
                ? targetMs - end.getTime()
                : 0;
          candidates.push({
            channel: Number(targetChannel?.channel || channel) || channel,
            startTime: start.toISOString(),
            endTime: end.toISOString(),
            distanceMs,
          });
        }
      } catch {
        // Try next date/base.
      }
    }
  }

  if (candidates.length === 0) return null;
  candidates.sort((a, b) => a.distanceMs - b.distanceMs);
  const best = candidates[0];
  return {
    channel: best.channel,
    startTime: best.startTime,
    endTime: best.endTime,
  };
}

async function resolvePlaybackWindowForAlert(alert: any, videoProxyBase = DEFAULT_VIDEO_PROXY_BASE): Promise<AlertPlaybackVideo[]> {
  const cacheKey = getAlertPlaybackCacheKey(alert);
  const cachedVideos = readCachedPlaybackVideos(cacheKey);
  if (cachedVideos.length > 0) {
    return cachedVideos;
  }

  const vehicleId = getAlertVehicleId(alert);
  const channel = getAlertChannel(alert);
  const channelCandidates = getAlertChannelCandidates(alert);
  const playbackWindow = getAlertPlaybackWindow(alert);
  if (!vehicleId || !playbackWindow) return [];

  const { startIso, endIso } = playbackWindow;
  const targetTimestamp = getAlertPlaybackTimestamp(alert) || startIso;
  const targetTime = new Date(targetTimestamp);
  const safeTargetTime = Number.isNaN(targetTime.getTime()) ? new Date(startIso) : targetTime;

  let lastError: Error | null = null;

  const alertId = String((alert as any)?.id || "").trim();
  const lookbackSeconds = Math.max(30, Math.round((new Date(endIso).getTime() - new Date(startIso).getTime()) / 2000));
  const forwardSeconds = lookbackSeconds;

  const tryAlertWindow = async () => {
    if (!alertId) return [];

    for (const playbackBase of getPlaybackRequestBases(videoProxyBase)) {
      try {
        const res = await fetch(`${playbackBase}/alerts/${encodeURIComponent(alertId)}/request-report-video`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            lookbackSeconds,
            forwardSeconds,
            queryResources: true,
          }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok || !json?.success) {
          throw new Error(json?.message || `HTTP ${res.status}`);
        }

        const data = json?.data || {};
        const channelEntries = Array.isArray(data?.channels) ? data.channels : [];
        const channelJobs = channelEntries
          .map((entry: any) => ({
            channel: Number(entry?.channel || 0),
            jobId: String(entry?.jobId || "").trim(),
          }))
          .filter((entry: any) => Number.isFinite(entry.channel) && entry.channel > 0 && entry.jobId);

        if (channelJobs.length > 0) {
          const resolvedVideos = await Promise.all(channelJobs.map(async (entry: any) => ({
            key: `alert_job_${entry.jobId}_${entry.channel}`,
            label: `Alert-time Playback CH${entry.channel}`,
            url: await pollPlaybackJob(entry.jobId, playbackBase, buildJobFileUrl(entry.jobId, playbackBase)),
          })));
          console.info("[AlertPlayback] Multi-channel alert jobs resolved", {
            alertId,
            vehicleId,
            videos: resolvedVideos,
          });
          writeCachedPlaybackVideos(cacheKey, resolvedVideos);
          return resolvedVideos;
        }

        const jobId = String(data?.playbackJobId || "").trim();
        const playbackJobUrl = normalizeBackendMediaUrl(String(data?.playbackJobUrl || "").trim(), playbackBase);
        if (jobId) {
          const resolvedUrl = await pollPlaybackJob(jobId, playbackBase, playbackJobUrl);
          const resolvedVideos = [
            {
              key: `alert_job_${jobId}`,
              label: `Alert-time Playback CH${Number(data?.playbackChannel || channel) || channel}`,
              url: resolvedUrl,
            },
          ];
          writeCachedPlaybackVideos(cacheKey, resolvedVideos);
          return resolvedVideos;
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
      }
    }

    return [];
  };

  const tryStoredWindow = async () => {
    for (const targetChannel of channelCandidates) {
      for (const playbackBase of getPlaybackRequestBases(videoProxyBase)) {
        try {
          const res = await fetch(`${playbackBase}/vehicles/${encodeURIComponent(vehicleId)}/videos/window`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              channel: targetChannel,
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
            const fallbackVideos = [
              {
                key: `live_fallback_${vehicleId}_${targetChannel}`,
                label: `Alert-time Live Fallback CH${targetChannel}`,
                url: normalizeBackendMediaUrl(String(data.streamUrl), playbackBase),
              },
            ];
            console.info("[AlertPlayback] Live fallback selected", {
              alertId: String(alert?.id || "").trim(),
              vehicleId,
              channel: targetChannel,
              videos: fallbackVideos,
            });
            writeCachedPlaybackVideos(cacheKey, fallbackVideos);
            return fallbackVideos;
          }

          const jobId = String(data?.playbackJobId || "").trim();
          const playbackJobUrl = normalizeBackendMediaUrl(String(data?.playbackJobUrl || "").trim(), playbackBase);
          console.info("[AlertPlayback] Window job created", {
            alertId: String(alert?.id || "").trim(),
            vehicleId,
            channel: targetChannel,
            playbackBase,
            startIso,
            endIso,
            jobId,
            playbackJobUrl,
            sourceSegments: Number(data?.sourceSegments || 0),
          });
          if (jobId) {
            const resolvedUrl = await pollPlaybackJob(jobId, playbackBase, playbackJobUrl);
            const resolvedVideos = [
              {
                key: `job_${jobId}`,
                label: `Alert-time Playback CH${targetChannel}`,
                url: resolvedUrl,
              },
            ];
            console.info("[AlertPlayback] Window job resolved", {
              alertId: String(alert?.id || "").trim(),
              jobId,
              videos: resolvedVideos,
            });
            writeCachedPlaybackVideos(cacheKey, resolvedVideos);
            return resolvedVideos;
          }
        } catch (error) {
          lastError = error instanceof Error ? error : new Error(String(error));
        }
      }
    }

    return [];
  };

  const immediateStored = await tryStoredWindow();
  if (immediateStored.length > 0) {
    return immediateStored;
  }

  for (const targetChannel of channelCandidates) {
    const fallbackClip = await findNearestAvailableClip(vehicleId, targetChannel, safeTargetTime, videoProxyBase);
    if (!fallbackClip) continue;

    const boundedWindow = buildBoundedPlaybackWindow(fallbackClip, safeTargetTime);
    for (const playbackBase of getPlaybackRequestBases(videoProxyBase)) {
      try {
        const res = await fetch(`${playbackBase}/vehicles/${encodeURIComponent(vehicleId)}/videos/window`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            channel: fallbackClip.channel,
            startTime: boundedWindow.startTime,
            endTime: boundedWindow.endTime,
          }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok || !json?.success) {
          throw new Error(json?.message || `HTTP ${res.status}`);
        }

        const data = json?.data || {};
        const jobId = String(data?.playbackJobId || "").trim();
        const playbackJobUrl = normalizeBackendMediaUrl(String(data?.playbackJobUrl || "").trim(), playbackBase);
        console.info("[AlertPlayback] Availability-range job created", {
          alertId: String(alert?.id || "").trim(),
          vehicleId,
          channel: fallbackClip.channel,
          playbackBase,
          startTime: boundedWindow.startTime,
          endTime: boundedWindow.endTime,
          jobId,
          playbackJobUrl,
          sourceSegments: Number(data?.sourceSegments || 0),
        });
        if (jobId) {
          const resolvedUrl = await pollPlaybackJob(jobId, playbackBase, playbackJobUrl);
          const resolvedVideos = [
            {
              key: `nearest_job_${jobId}`,
              label: `Playback In Available Range CH${fallbackClip.channel}`,
              url: resolvedUrl,
            },
          ];
          console.info("[AlertPlayback] Availability-range job resolved", {
            alertId: String(alert?.id || "").trim(),
            jobId,
            videos: resolvedVideos,
          });
          writeCachedPlaybackVideos(cacheKey, resolvedVideos);
          return resolvedVideos;
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
      }
    }
  }

  if (lastError) throw lastError;
  return [];
}

export async function resolveAlertPlaybackVideos(alertSource: AlertPlaybackSource, videoProxyBase = DEFAULT_VIDEO_PROXY_BASE): Promise<AlertPlaybackVideo[]> {
  const alert = typeof alertSource === "object" && alertSource !== null ? alertSource : null;
  const id = String(alert?.id || alertSource || "").trim();
  if (!id || !alert) return [];

  return resolvePlaybackWindowForAlert(alert, videoProxyBase);
}

