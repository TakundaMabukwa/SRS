"use client";

export type AlertPlaybackVideo = {
  key: string;
  label: string;
  url: string;
};

const DEFAULT_VIDEO_PROXY_BASE = "/api/video-server";

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

async function pollPlaybackJob(jobId: string, videoProxyBase = DEFAULT_VIDEO_PROXY_BASE) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, attempt === 0 ? 500 : 1500));
    const statusRes = await fetch(`${videoProxyBase}/videos/jobs/${encodeURIComponent(jobId)}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    const statusJson = await statusRes.json().catch(() => ({}));
    const job = statusJson?.data || {};
    if (job?.status === "completed") {
      return normalizeBackendMediaUrl(
        String(job?.persistedVideoUrl || "").trim() ||
          (job?.persistedVideoId ? `${videoProxyBase}/videos/${encodeURIComponent(String(job.persistedVideoId))}/file` : "") ||
          String(job?.outputUrl || "").trim() ||
          `${videoProxyBase}/videos/jobs/${encodeURIComponent(jobId)}/file`,
        videoProxyBase
      );
    }
    if (job?.status === "failed") {
      throw new Error(job?.error || "Playback generation failed.");
    }
  }
  throw new Error("Playback job timed out.");
}

export async function resolveAlertPlaybackVideos(alertId: string, videoProxyBase = DEFAULT_VIDEO_PROXY_BASE): Promise<AlertPlaybackVideo[]> {
  const id = String(alertId || "").trim();
  if (!id) return [];

  const videosRes = await fetch(`${videoProxyBase}/alerts/${encodeURIComponent(id)}/videos?ensureMedia=true`, {
    cache: "no-store",
    signal: AbortSignal.timeout(7000),
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
    const resolvedUrl = await pollPlaybackJob(jobId, videoProxyBase);
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
