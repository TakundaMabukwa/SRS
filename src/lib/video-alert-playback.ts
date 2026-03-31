"use client";

export type AlertPlaybackVideo = {
  key: string;
  label: string;
  url: string;
};

type AlertPlaybackSource = string | { [key: string]: any };

const DEFAULT_VIDEO_PROXY_BASE = "/api/video-server";
const ALERT_PLAYBACK_WINDOW_BEFORE_MS = 30 * 1000;
const ALERT_PLAYBACK_WINDOW_AFTER_MS = 30 * 1000;
const DIRECT_VIDEO_HUB_BASE = String(
  process.env.NEXT_PUBLIC_VIDEO_HUB_BASE_URL ||
    process.env.NEXT_PUBLIC_VIDEO_BASE_URL ||
    ""
).trim().replace(/\/+$/, "");

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
  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith(`${videoProxyBase}/`)) return value;
  if (value.startsWith("/api/")) {
    return `${videoProxyBase}${value.slice(4)}`;
  }
  if (value.startsWith("/")) return value;
  return `${videoProxyBase}/${value.replace(/^\/+/, "")}`;
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

function collectAlertTimestampCandidates(alert: any) {
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

export function getAlertDisplayTimestamp(alert: any) {
  const candidates = collectAlertTimestampCandidates(alert);
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

export function getAlertPlaybackTimestamp(alert: any) {
  return getAlertDisplayTimestamp(alert);
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

async function pollPlaybackJob(jobId: string, videoProxyBase = DEFAULT_VIDEO_PROXY_BASE, playbackJobUrl?: string) {
  const statusUrl = buildJobStatusUrl(jobId, videoProxyBase, playbackJobUrl);
  const fallbackFileUrl = buildJobFileUrl(jobId, videoProxyBase, playbackJobUrl);
  for (let attempt = 0; attempt < 40; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, attempt === 0 ? 500 : 1500));
    const statusRes = await fetch(statusUrl, {
      cache: "no-store",
      signal: timeoutSignal(5000),
    });
    const statusJson = await statusRes.json().catch(() => ({}));
    const job = statusJson?.data || {};
    if (job?.status === "completed") {
      return normalizeBackendMediaUrl(
        String(job?.persistedVideoUrl || "").trim() ||
          (job?.persistedVideoId ? `${videoProxyBase}/videos/${encodeURIComponent(String(job.persistedVideoId))}/file` : "") ||
          String(job?.outputUrl || "").trim() ||
          fallbackFileUrl,
        videoProxyBase
      );
    }
    if (job?.status === "failed") {
      throw new Error(job?.error || "Playback generation failed.");
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

async function resolvePlaybackWindowForAlert(alert: any, videoProxyBase = DEFAULT_VIDEO_PROXY_BASE): Promise<AlertPlaybackVideo[]> {
  const vehicleId = getAlertVehicleId(alert);
  const channel = getAlertChannel(alert);
  const playbackWindow = getAlertPlaybackWindow(alert);
  if (!vehicleId || !playbackWindow) return [];

  const { startIso, endIso } = playbackWindow;

  let lastError: Error | null = null;

  const tryStoredWindow = async () => {
    for (const playbackBase of getPlaybackRequestBases(videoProxyBase)) {
      try {
        const res = await fetch(`${playbackBase}/vehicles/${encodeURIComponent(vehicleId)}/videos/window`, {
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
          return [
            {
              key: `live_fallback_${vehicleId}_${channel}`,
              label: `Alert-time Live Fallback CH${channel}`,
              url: normalizeBackendMediaUrl(String(data.streamUrl), playbackBase),
            },
          ];
        }

        const playbackJobUrl = normalizeBackendMediaUrl(String(data?.playbackJobUrl || "").trim(), playbackBase);
        const directUrl = normalizeBackendMediaUrl(
          String(data?.persistedVideoUrl || "").trim() ||
            (data?.persistedVideoId ? `${playbackBase}/videos/${encodeURIComponent(String(data.persistedVideoId))}/file` : "") ||
            String(data?.outputUrl || "").trim() ||
            playbackJobUrl,
          playbackBase
        );
        if (directUrl && !/\/videos\/jobs\/JOB-LOCAL-/i.test(directUrl)) {
          return [
            {
              key: `window_${vehicleId}_${channel}`,
              label: `Alert-time Playback CH${channel}`,
              url: directUrl,
            },
          ];
        }

        const jobId = String(data?.playbackJobId || "").trim();
        if (!jobId) {
          return [];
        }

        const resolvedUrl = await pollPlaybackJob(jobId, playbackBase, playbackJobUrl);
        return [
          {
            key: `job_${jobId}`,
            label: `Alert-time Playback CH${channel}`,
            url: resolvedUrl,
          },
        ];
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
      }
    }

    return [];
  };

  const immediateStored = await tryStoredWindow();
  if (immediateStored.length > 0) {
    return immediateStored;
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
