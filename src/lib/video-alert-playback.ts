"use client";

export type AlertPlaybackVideo = {
  key: string;
  label: string;
  url: string;
};

type AlertPlaybackSource = string | { [key: string]: any };

const DEFAULT_VIDEO_PROXY_BASE = "/api/video-server";

function timeoutSignal(timeoutMs: number) {
  if (typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function") {
    return AbortSignal.timeout(timeoutMs);
  }
  return undefined;
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

export function getAlertDisplayTimestamp(alert: any) {
  return (
    alert?.timestampLocal ||
    alert?.timestamp_local ||
    alert?.alertTimestampLocal ||
    alert?.alert_timestamp_local ||
    alert?.timestamp ||
    alert?.alertTimestamp ||
    alert?.alert_timestamp ||
    alert?.created_at ||
    null
  );
}

function mapAlertVideosPayload(videosPayload: any, videoProxyBase = DEFAULT_VIDEO_PROXY_BASE): AlertPlaybackVideo[] {
  const out: AlertPlaybackVideo[] = [];
  const seen = new Set<string>();
  const add = (label: string, url: any, key: string) => {
    const normalized = normalizeBackendMediaUrl(String(url || ""), videoProxyBase);
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    out.push({ key, label, url: normalized });
  };

  const videos = videosPayload?.videos || {};
  add("Pre-Incident Video", videos?.pre_event?.raw_url || videos?.pre_event?.url || videos?.pre_event?.path, "pre_event");
  add("Post-Incident Video", videos?.post_event?.raw_url || videos?.post_event?.url || videos?.post_event?.path, "post_event");
  add("Camera Video", videos?.camera_sd?.raw_url || videos?.camera_sd?.url || videos?.camera_sd?.path, "camera_sd");
  add("Camera Pre Video", videos?.camera_sd_pre?.raw_url || videos?.camera_sd_pre?.url || videos?.camera_sd_pre?.path, "camera_sd_pre");
  add("Camera Post Video", videos?.camera_sd_post?.raw_url || videos?.camera_sd_post?.url || videos?.camera_sd_post?.path, "camera_sd_post");

  const databaseRecords = Array.isArray(videos?.database_records) ? videos.database_records : [];
  databaseRecords.forEach((record: any, index: number) => {
    add(
      record?.label ||
        record?.title ||
        (record?.video_type ? String(record.video_type).replace(/_/g, " ").toUpperCase() : `Stored Clip ${index + 1}`),
      record?.url || record?.storage_url || record?.signed_url || record?.download_url || record?.video_url || record?.path,
      record?.id || `database_record_${index + 1}`
    );
  });

  return out;
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

async function resolvePlaybackWindowForAlert(alert: any, videoProxyBase = DEFAULT_VIDEO_PROXY_BASE): Promise<AlertPlaybackVideo[]> {
  const vehicleId = getAlertVehicleId(alert);
  const timestamp = getAlertDisplayTimestamp(alert) || alert?.metadata?.locationFix?.timestamp;
  const channel = getAlertChannel(alert);
  if (!vehicleId || !timestamp) return [];

  const alertTime = new Date(timestamp);
  if (Number.isNaN(alertTime.getTime())) return [];

  const startIso = new Date(alertTime.getTime() - 30 * 1000).toISOString();
  const endIso = new Date(alertTime.getTime() + 30 * 1000).toISOString();

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
    return [
      {
        key: `live_fallback_${vehicleId}_${channel}`,
        label: `Alert-time Live Fallback CH${channel}`,
        url: normalizeBackendMediaUrl(String(data.streamUrl), videoProxyBase),
      },
    ];
  }

  const playbackJobUrl = normalizeBackendMediaUrl(String(data?.playbackJobUrl || "").trim(), videoProxyBase);
  const directUrl = normalizeBackendMediaUrl(
    String(data?.persistedVideoUrl || "").trim() ||
      (data?.persistedVideoId ? `${videoProxyBase}/videos/${encodeURIComponent(String(data.persistedVideoId))}/file` : "") ||
      String(data?.outputUrl || "").trim() ||
      playbackJobUrl,
    videoProxyBase
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
  if (!jobId) return [];

  const resolvedUrl = await pollPlaybackJob(jobId, videoProxyBase, playbackJobUrl);
  return [
    {
      key: `job_${jobId}`,
      label: `Alert-time Playback CH${channel}`,
      url: resolvedUrl,
    },
  ];
}

export async function resolveAlertPlaybackVideos(alertSource: AlertPlaybackSource, videoProxyBase = DEFAULT_VIDEO_PROXY_BASE): Promise<AlertPlaybackVideo[]> {
  const alert = typeof alertSource === "object" && alertSource !== null ? alertSource : null;
  const id = String(alert?.id || alertSource || "").trim();
  if (!id) return [];

  if (alert) {
    try {
      const playbackWindowVideos = await resolvePlaybackWindowForAlert(alert, videoProxyBase);
      if (playbackWindowVideos.length > 0) {
        return playbackWindowVideos;
      }
    } catch {
      // Fall back to alert-centric resolution below.
    }
  }

  const videosRes = await fetch(`${videoProxyBase}/alerts/${encodeURIComponent(id)}/videos?ensureMedia=true`, {
    cache: "no-store",
    signal: timeoutSignal(7000),
  });
  const videosJson = videosRes.ok ? await videosRes.json().catch(() => ({})) : {};
  const videosPayload = videosJson?.data || videosJson || {};
  const immediateVideos = mapAlertVideosPayload(videosPayload, videoProxyBase);
  if (immediateVideos.length > 0) {
    return immediateVideos;
  }

  const requestRes = await fetch(`${videoProxyBase}/alerts/${encodeURIComponent(id)}/request-report-video`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      lookbackSeconds: 30,
      forwardSeconds: 30,
      queryResources: true,
      requestDownload: false,
    }),
  });
  const requestJson = await requestRes.json().catch(() => ({}));
  if (!requestRes.ok || !requestJson?.success) {
    throw new Error(requestJson?.message || `HTTP ${requestRes.status}`);
  }

  const requestData = requestJson?.data || {};
  if (requestData?.playbackSource === "live_fallback" && requestData?.streamUrl) {
    return [
      {
        key: "live_fallback",
        label: "Alert-time Live Fallback",
        url: normalizeBackendMediaUrl(String(requestData.streamUrl), videoProxyBase),
      },
    ];
  }

  const jobId = String(requestData?.playbackJobId || "").trim();
  const playbackJobUrl = normalizeBackendMediaUrl(String(requestData?.playbackJobUrl || ""), videoProxyBase);
  if (jobId) {
    const resolvedUrl = await pollPlaybackJob(jobId, videoProxyBase, playbackJobUrl);
    return [
      {
        key: `job_${jobId}`,
        label: "Alert-time Playback",
        url: resolvedUrl,
      },
    ];
  }
  if (playbackJobUrl) {
    return [
      {
        key: "playback_job",
        label: "Alert-time Playback",
        url: playbackJobUrl,
      },
    ];
  }

  return [];
}
