"use client";

export type AlertPlaybackVideo = {
  key: string;
  label: string;
  url: string;
};

type AlertPlaybackSource = string | PlaybackJsonRecord;
type AlertPlaybackWindowOptions = {
  beforeMs?: number;
  afterMs?: number;
};

type PlaybackJsonRecord = Record<string, unknown>;

const DEFAULT_VIDEO_PROXY_BASE = "/api/video-server";
const ALERT_PLAYBACK_WINDOW_BEFORE_MS = 60 * 1000;
const ALERT_PLAYBACK_WINDOW_AFTER_MS = 60 * 1000;
const PLAYBACK_CACHE_PREFIX = "alert-playback:";
const playbackVideoCache = new Map<string, AlertPlaybackVideo[]>();
const APPROX_AVAILABLE_RANGE_PATTERN =
  /Approx available range:\s*([0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9:\.\-+Z]+)\s+to\s+([0-9]{4}-[0-9]{2}-[0-9:\.\-+Z]+)/i;

function resolvePlaybackWindowOptions(options?: AlertPlaybackWindowOptions) {
  const beforeCandidate = Number(options?.beforeMs);
  const afterCandidate = Number(options?.afterMs);
  const beforeMs = Number.isFinite(beforeCandidate) && beforeCandidate >= 0
    ? beforeCandidate
    : ALERT_PLAYBACK_WINDOW_BEFORE_MS;
  const afterMs = Number.isFinite(afterCandidate) && afterCandidate >= 0
    ? afterCandidate
    : ALERT_PLAYBACK_WINDOW_AFTER_MS;
  return { beforeMs, afterMs };
}

function dedupePlaybackVideos(videos: AlertPlaybackVideo[]) {
  const seen = new Set<string>();
  const out: AlertPlaybackVideo[] = [];
  for (const video of Array.isArray(videos) ? videos : []) {
    const url = String(video?.url || "").trim();
    if (!url || seen.has(url)) continue;
    seen.add(url);
    out.push(video);
  }
  return out;
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
  const base = String(videoProxyBase || "").trim();
  return base ? [base] : [];
}

function readPlaybackRecord(value: unknown): PlaybackJsonRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as PlaybackJsonRecord)
    : {};
}

function getPlaybackMessage(value: unknown) {
  const record = readPlaybackRecord(value);
  return String(record.message || "").trim();
}

function getPlaybackChannels(value: unknown) {
  const record = readPlaybackRecord(value);
  const dataRecord = readPlaybackRecord(record.data);
  if (Array.isArray(record.channels)) {
    return record.channels.map((entry) => readPlaybackRecord(entry));
  }
  if (Array.isArray(dataRecord.channels)) {
    return dataRecord.channels.map((entry) => readPlaybackRecord(entry));
  }
  return [];
}

function getPlaybackRows(value: unknown) {
  const record = readPlaybackRecord(value);
  const dataRecord = readPlaybackRecord(record.data);
  if (Array.isArray(record.rows)) {
    return record.rows.map((entry) => readPlaybackRecord(entry));
  }
  if (Array.isArray(dataRecord.rows)) {
    return dataRecord.rows.map((entry) => readPlaybackRecord(entry));
  }
  if (Array.isArray(record.data)) {
    return record.data.map((entry) => readPlaybackRecord(entry));
  }
  return [];
}

function parseApproxAvailableRange(message: string) {
  const match = String(message || "").match(APPROX_AVAILABLE_RANGE_PATTERN);
  if (!match) return null;
  return {
    startIso: match[1],
    endIso: match[2],
  };
}

function buildChannelAvailabilitySummary(rows: PlaybackJsonRecord[]) {
  const channelSummaries = rows
    .map((row) => {
      const channel = Number(row.channel || 0);
      if (!Number.isFinite(channel) || channel <= 0) return "";

      const startIso = String(
        row.first_packet_time ||
          row.approx_first_packet_time ||
          row.earliestTime ||
          ""
      ).trim();
      const endIso = String(
        row.last_packet_time ||
          row.approx_last_packet_time ||
          row.latestTime ||
          ""
      ).trim();

      if (!startIso || !endIso) return "";
      return `CH${channel} (${startIso} to ${endIso})`;
    })
    .filter(Boolean);

  return channelSummaries.length > 0
    ? `Available channels: ${channelSummaries.join(", ")}.`
    : "";
}

async function fetchAlertAvailabilitySummary(
  vehicleId: string,
  referenceIso: string,
  videoProxyBase = DEFAULT_VIDEO_PROXY_BASE
) {
  const referenceDate = new Date(referenceIso);
  if (Number.isNaN(referenceDate.getTime())) return "";

  const dayStart = new Date(referenceDate);
  dayStart.setUTCHours(0, 0, 0, 0);
  const dayEnd = new Date(referenceDate);
  dayEnd.setUTCHours(23, 59, 59, 999);
  const dateKey = dayStart.toISOString().slice(0, 10);

  for (const playbackBase of getPlaybackRequestBases(videoProxyBase)) {
    try {
      const coverageQuery = new URLSearchParams({
        vehicleId,
        from: dayStart.toISOString(),
        to: dayEnd.toISOString(),
      });
      const coverageResponse = await fetch(
        `${playbackBase}/video/coverage?${coverageQuery.toString()}`,
        {
          cache: "no-store",
          signal: timeoutSignal(12000),
        }
      );
      const coverageJson = await coverageResponse.json().catch(() => ({}));
      const coverageSummary = buildChannelAvailabilitySummary(getPlaybackRows(coverageJson));
      if (coverageSummary) return coverageSummary;
    } catch {
      // Fall through to approximate availability.
    }

    for (const availabilityPath of [
      `${playbackBase}/vehicles/${encodeURIComponent(vehicleId)}/videos/availability?date=${encodeURIComponent(dateKey)}`,
      `${playbackBase}/vehicles/${encodeURIComponent(vehicleId)}/video/availability?date=${encodeURIComponent(dateKey)}`,
    ]) {
      try {
        const availabilityResponse = await fetch(availabilityPath, {
          cache: "no-store",
          signal: timeoutSignal(12000),
        });
        const availabilityJson = await availabilityResponse.json().catch(() => ({}));
        const availabilitySummary = buildChannelAvailabilitySummary(getPlaybackRows(availabilityJson));
        if (availabilitySummary) return availabilitySummary;
      } catch {
        // Try the next endpoint.
      }
    }
  }

  return "";
}

export function normalizeBackendMediaUrl(url: string, videoProxyBase = DEFAULT_VIDEO_PROXY_BASE) {
  const value = String(url || "").trim();
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) {
    try {
      const parsed = new URL(value);
      if (parsed.pathname.startsWith("/media/")) {
        return `${videoProxyBase}${parsed.pathname}${parsed.search || ""}`;
      }
      if (parsed.pathname.startsWith("/api/video-server/")) {
        return `${videoProxyBase}${parsed.pathname.slice("/api/video-server".length)}${parsed.search || ""}`;
      }
      if (parsed.pathname.startsWith("/api/")) {
        return `${videoProxyBase}${parsed.pathname.slice(4)}${parsed.search || ''}`;
      }
      return value;
    } catch {
      return value;
    }
  }
  if (value.startsWith(`${videoProxyBase}/`)) return value;
  if (value.startsWith("/media/")) {
    return `${videoProxyBase}${value}`;
  }
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

function collectAlertDisplayTimestampCandidates(alert: PlaybackJsonRecord | null | undefined) {
  const metadata = readPlaybackRecord(alert?.metadata);
  const vendorExtensions = Array.isArray(metadata.vendorExtensions)
    ? metadata.vendorExtensions.map((entry) => readPlaybackRecord(entry))
    : [];

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
    ...vendorExtensions.map((entry) => entry.sourceTimestamp),
  ]
    .map(getRawAlertTimestampValue)
    .filter(Boolean);
}

function collectAlertFirstOccurrenceCandidates(alert: PlaybackJsonRecord | null | undefined) {
  const metadata = readPlaybackRecord(alert?.metadata);
  const vendorExtensions = Array.isArray(metadata.vendorExtensions)
    ? metadata.vendorExtensions.map((entry) => readPlaybackRecord(entry))
    : [];

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
    ...vendorExtensions.map((entry) => entry.sourceTimestamp),
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

export function getAlertDisplayTimestamp(alert: PlaybackJsonRecord | null | undefined) {
  return pickLatestTimestamp(collectAlertDisplayTimestampCandidates(alert));
}

export function getAlertPlaybackTimestamp(alert: PlaybackJsonRecord | null | undefined) {
  const firstOccurrence = pickEarliestTimestamp(collectAlertFirstOccurrenceCandidates(alert));
  return firstOccurrence || getAlertDisplayTimestamp(alert);
}

export function getAlertFirstOccurrenceTimestamp(alert: PlaybackJsonRecord | null | undefined) {
  return getAlertPlaybackTimestamp(alert);
}

export function getAlertLastOccurrenceTimestamp(alert: PlaybackJsonRecord | null | undefined) {
  return getAlertDisplayTimestamp(alert);
}

export function getAlertPlaybackSignature(
  alert: PlaybackJsonRecord | null | undefined,
  windowOptions?: AlertPlaybackWindowOptions
) {
  if (!alert || typeof alert !== "object") return "";
  const playbackWindow = getAlertPlaybackWindow(alert, windowOptions);
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

function getAlertVehicleId(alert: PlaybackJsonRecord | null | undefined) {
  const vehicle = readPlaybackRecord(alert?.vehicle);
  const metadata = readPlaybackRecord(alert?.metadata);
  const metadataVehicle = readPlaybackRecord(metadata.vehicle);
  return String(
    alert?.vehicleId ||
      alert?.device_id ||
      vehicle.vehicleId ||
      vehicle.terminalPhone ||
      metadataVehicle.vehicleId ||
      metadataVehicle.terminalPhone ||
      ""
  ).trim();
}

function getAlertChannel(alert: PlaybackJsonRecord | null | undefined) {
  const metadata = readPlaybackRecord(alert?.metadata);
  const locationFix = readPlaybackRecord(metadata.locationFix);
  const candidates = [
    alert?.channel,
    metadata.channel,
    metadata.resourceChannel,
    locationFix.channel,
  ];
  for (const candidate of candidates) {
    const value = Number(candidate);
    if (Number.isFinite(value) && value > 0) return value;
  }
  return 1;
}

function getAlertChannelCandidates(alert: PlaybackJsonRecord | null | undefined) {
  const primaryChannel = getAlertChannel(alert);
  return Array.from(
    new Set(
      [primaryChannel, 1, 2].filter((value) => Number.isFinite(value) && value > 0)
    )
  );
}

function getAlertPlaybackWindow(
  alert: PlaybackJsonRecord | null | undefined,
  windowOptions: AlertPlaybackWindowOptions = {}
) {
  const timestamp = getAlertPlaybackTimestamp(alert);
  if (!timestamp) return null;
  const { beforeMs, afterMs } = resolvePlaybackWindowOptions(windowOptions);
  const hasExplicitWindow = windowOptions.beforeMs !== undefined || windowOptions.afterMs !== undefined;

  const metadata = readPlaybackRecord(alert?.metadata);
  const startCandidate =
    metadata.resourceStartTime ||
    metadata.resource_start_time ||
    metadata.eventStartTime ||
    metadata.event_start_time ||
    null;
  const endCandidate =
    metadata.resourceEndTime ||
    metadata.resource_end_time ||
    metadata.eventEndTime ||
    metadata.event_end_time ||
    null;

  const baseTime = new Date(timestamp);
  if (Number.isNaN(baseTime.getTime())) return null;

  const start = !hasExplicitWindow && startCandidate
    ? new Date(startCandidate)
    : new Date(baseTime.getTime() - beforeMs);
  const end = !hasExplicitWindow && endCandidate
    ? new Date(endCandidate)
    : new Date(baseTime.getTime() + afterMs);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
    return {
      startIso: new Date(baseTime.getTime() - beforeMs).toISOString(),
      endIso: new Date(baseTime.getTime() + afterMs).toISOString(),
    };
  }

  return {
    startIso: start.toISOString(),
    endIso: end.toISOString(),
  };
}

function getAlertPlaybackCacheKey(
  alert: PlaybackJsonRecord | null | undefined,
  windowOptions?: AlertPlaybackWindowOptions
) {
  if (!alert || typeof alert !== "object") return "";
  const playbackWindow = getAlertPlaybackWindow(alert, windowOptions);
  return JSON.stringify({
    id: String(alert?.id || "").trim(),
    vehicleId: getAlertVehicleId(alert),
    channels: getAlertChannelCandidates(alert),
    startIso: playbackWindow?.startIso || "",
    endIso: playbackWindow?.endIso || "",
  });
}

async function resolvePlaybackWindowForAlert(
  alert: PlaybackJsonRecord,
  videoProxyBase = DEFAULT_VIDEO_PROXY_BASE,
  windowOptions: AlertPlaybackWindowOptions = {}
): Promise<AlertPlaybackVideo[]> {
  const cacheKey = getAlertPlaybackCacheKey(alert, windowOptions);
  const cachedVideos = readCachedPlaybackVideos(cacheKey);
  if (cachedVideos.length > 0) {
    return cachedVideos;
  }

  const vehicleId = getAlertVehicleId(alert);
  const channelCandidates = getAlertChannelCandidates(alert);
  const playbackWindow = getAlertPlaybackWindow(alert, windowOptions);
  if (!vehicleId || !playbackWindow) return [];

  const { startIso, endIso } = playbackWindow;
  const query = new URLSearchParams({
    from: startIso,
    to: endIso,
  });

  const requestChannelPlayback = async (targetChannel: number) => {
    let lastFailureMessage = `No playback available for channel ${targetChannel}.`;

    for (const playbackBase of getPlaybackRequestBases(videoProxyBase)) {
      try {
        const res = await fetch(
          `${playbackBase}/vehicles/${encodeURIComponent(vehicleId)}/video/${encodeURIComponent(String(targetChannel))}?${query.toString()}`,
          {
            cache: "no-store",
            signal: timeoutSignal(15000),
          }
        );
        const json = await res.json().catch(() => ({}));
        const jsonRecord = readPlaybackRecord(json);
        if (!res.ok || jsonRecord.success !== true) {
          throw new Error(getPlaybackMessage(json) || `HTTP ${res.status}`);
        }

        const channels = getPlaybackChannels(json);
        const successfulChannel =
          channels.find(
            (entry) =>
              Number(entry.channel || 0) === Number(targetChannel) && entry.success === true
          ) ||
          channels.find((entry) => entry.success === true) ||
          null;

        if (!successfulChannel) {
          throw new Error(
            getPlaybackMessage(json) || `No playback available for channel ${targetChannel}.`
          );
        }

        const resolvedChannel = Number(successfulChannel.channel || targetChannel);
        const sourceUrl = String(
          successfulChannel.playUrl ||
            successfulChannel.mp4Url ||
            successfulChannel.playUrlAbsolute ||
            successfulChannel.mp4UrlAbsolute ||
            ""
        ).trim();

        if (!sourceUrl) {
          throw new Error(`Playback URL missing for channel ${resolvedChannel}.`);
        }

        return {
          key: `alert_window_${String(alert?.id || vehicleId)}_${resolvedChannel}_${startIso}_${endIso}`,
          label: `Alert-time Playback CH${resolvedChannel}`,
          url: normalizeBackendMediaUrl(sourceUrl, videoProxyBase),
        } satisfies AlertPlaybackVideo;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        lastFailureMessage = errorMessage || lastFailureMessage;
      }
    }

    throw new Error(`CH${targetChannel}: ${lastFailureMessage}`);
  };

  const settledVideos = await Promise.allSettled(
    channelCandidates.map((targetChannel) => requestChannelPlayback(targetChannel))
  );

  const resolvedVideos = settledVideos
    .filter(
      (result): result is PromiseFulfilledResult<AlertPlaybackVideo> =>
        result.status === "fulfilled"
    )
    .map((result) => result.value);

  const dedupedVideos = dedupePlaybackVideos(resolvedVideos);
  if (dedupedVideos.length > 0) {
    writeCachedPlaybackVideos(cacheKey, dedupedVideos);
    return dedupedVideos;
  }

  const failureMessages = settledVideos
    .filter(
      (result): result is PromiseRejectedResult =>
        result.status === "rejected"
    )
    .map((result) => {
      const reason = result.reason;
      return reason instanceof Error ? reason.message : String(reason || "");
    })
    .filter(Boolean);

  const firstApproximateRange = failureMessages
    .map((message) => parseApproxAvailableRange(message))
    .find((value) => !!value);
  const availabilitySummary = await fetchAlertAvailabilitySummary(vehicleId, startIso, videoProxyBase);
  const combinedMessageParts = [
    failureMessages[0] || "Alert video is not ready yet for this alert.",
    ...failureMessages.slice(1),
  ];

  if (firstApproximateRange) {
    combinedMessageParts.push(
      `Approx range for this alert day: ${firstApproximateRange.startIso} to ${firstApproximateRange.endIso}.`
    );
  }

  if (availabilitySummary) {
    combinedMessageParts.push(availabilitySummary);
  }

  const combinedMessage = Array.from(new Set(combinedMessageParts.filter(Boolean))).join(" ");
  if (combinedMessage) {
    throw new Error(combinedMessage);
  }

  return [];
}

export async function resolveAlertPlaybackVideos(
  alertSource: AlertPlaybackSource,
  videoProxyBase = DEFAULT_VIDEO_PROXY_BASE,
  windowOptions: AlertPlaybackWindowOptions = {}
): Promise<AlertPlaybackVideo[]> {
  const alert = typeof alertSource === "object" && alertSource !== null ? alertSource : null;
  const id = String(alert?.id || alertSource || "").trim();
  if (!id || !alert) return [];

  return resolvePlaybackWindowForAlert(alert, videoProxyBase, windowOptions);
}

