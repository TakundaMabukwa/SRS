function normalizeBaseUrl(value?: string | null, fallback = "http://localhost:3000") {
  const raw = String(value || "").trim();
  const base = raw || fallback;
  return base.replace(/\/+$/, "").replace(/\/api$/i, "");
}

function getExplicitLiveVideoBaseUrl() {
  const raw =
    process.env.LIVE_VIDEO_BASE_URL ||
    process.env.NEXT_PUBLIC_LIVE_VIDEO_BASE_URL ||
    "";
  return raw ? normalizeBaseUrl(raw, "http://localhost:3000") : "";
}

export function getListenerBaseUrl() {
  return normalizeBaseUrl(
    process.env.LISTENER_BASE_URL ||
      process.env.NEXT_PUBLIC_LISTENER_BASE_URL ||
      process.env.VIDEO_BASE_URL ||
      process.env.NEXT_PUBLIC_VIDEO_BASE_URL ||
      process.env.NEXT_PUBLIC_VIDEO_SERVER_BASE_URL,
    "http://209.38.206.44:3000"
  );
}

export function getAlertHubBaseUrl() {
  return normalizeBaseUrl(
    process.env.ALERT_HUB_BASE_URL ||
      process.env.NEXT_PUBLIC_ALERT_HUB_BASE_URL,
    getListenerBaseUrl()
  );
}

export function getVideoHubBaseUrl() {
  return normalizeBaseUrl(
    process.env.VIDEO_HUB_BASE_URL ||
      process.env.NEXT_PUBLIC_VIDEO_HUB_BASE_URL,
    getListenerBaseUrl()
  );
}

export function getLiveVideoCommandBaseUrl() {
  return getExplicitLiveVideoBaseUrl() || getListenerBaseUrl();
}

export function getLiveVideoPlaybackBaseUrl() {
  return getExplicitLiveVideoBaseUrl() || getListenerBaseUrl();
}

export function getLiveVideoRuntimeBaseUrl() {
  return getExplicitLiveVideoBaseUrl() || getListenerBaseUrl();
}

export function getLivePreviewBaseUrl() {
  return normalizeBaseUrl(
    process.env.LIVE_PREVIEW_BASE_URL ||
      process.env.NEXT_PUBLIC_LIVE_PREVIEW_BASE_URL ||
      process.env.PLAYBACK_HUB_BASE_URL ||
      process.env.NEXT_PUBLIC_PLAYBACK_HUB_BASE_URL ||
      process.env.VIDEO_ARCHIVE_BASE_URL ||
      process.env.NEXT_PUBLIC_VIDEO_ARCHIVE_BASE_URL,
    getPlaybackHubBaseUrl()
  );
}

export function getPlaybackHubBaseUrl() {
  return normalizeBaseUrl(
    process.env.PLAYBACK_HUB_BASE_URL ||
      process.env.NEXT_PUBLIC_PLAYBACK_HUB_BASE_URL ||
      process.env.VIDEO_ARCHIVE_BASE_URL ||
      process.env.NEXT_PUBLIC_VIDEO_ARCHIVE_BASE_URL,
    "http://146.190.74.107:3201"
  );
}

export function resolveVideoServerProxyBase(pathArray: string[]) {
  const [first = "", second = "", third = "", fourth = ""] = pathArray;
  const joined = pathArray.join("/").toLowerCase();
  const isAlertMutationPath =
    first === "alerts" &&
    (
      third === "acknowledge" ||
      third === "resolve" ||
      third === "resolve-with-notes" ||
      third === "close" ||
      third === "mark-false" ||
      third === "escalate"
    );
  const isAlertMediaPath =
    first === "alerts" &&
    (
      third === "media" ||
      third === "screenshots" ||
      third === "videos" ||
      third === "video" ||
      third === "collect-evidence"
    );

  const isLiveCommandPath =
    isAlertMutationPath ||
    (first === "vehicles" &&
      (third === "start-live" ||
        third === "stop-live" ||
        third === "start-all-streams" ||
        third === "stop-all-streams" ||
        third === "query-capabilities" ||
        third === "screenshot" ||
        third === "screenshot-at" ||
        third === "test-query-resources" ||
        third === "test-playback" ||
        third === "switch-stream" ||
        third === "optimize-video" ||
        third === "config")) ||
    isAlertMediaPath;

  if (isLiveCommandPath) {
    const baseUrl = getLiveVideoCommandBaseUrl();
    return { name: baseUrl === getListenerBaseUrl() ? "listener" : "liveVideo", baseUrl };
  }

  const isLiveRuntimePath =
    first === "vehicles" &&
    second === "connected";

  if (isLiveRuntimePath) {
    const baseUrl = getLiveVideoRuntimeBaseUrl();
    return { name: baseUrl === getListenerBaseUrl() ? "listener" : "liveVideo", baseUrl };
  }

  const isLivePlaybackPath =
    first === "stream" ||
    joined.startsWith("stream/") ||
    (first === "vehicles" &&
      (third === "stream-info" ||
        second === "streams"));

  if (isLivePlaybackPath) {
    const baseUrl = getLiveVideoPlaybackBaseUrl();
    return { name: baseUrl === getListenerBaseUrl() ? "listener" : "liveVideo", baseUrl };
  }

  const isArchivePlaybackPath =
    first === "video" ||
    first === "media" ||
    (first === "vehicles" &&
      (third === "video" || fourth === "video"));

  if (isArchivePlaybackPath) {
    return { name: "playbackHub", baseUrl: getPlaybackHubBaseUrl() };
  }

  const isPlaybackPath =
    first === "playback" ||
    first === "videos" ||
    (first === "vehicles" && third === "videos") ||
    fourth === "videos";

  if (isPlaybackPath) {
    return { name: "playbackHub", baseUrl: getPlaybackHubBaseUrl() };
  }

  const isAlertPath =
    first === "alerts" ||
    first === "dashboard" ||
    first === "drivers" ||
    first === "speeding";

  if (isAlertPath) {
    return { name: "alertHub", baseUrl: getAlertHubBaseUrl() };
  }

  const isScreenshotPath =
    first === "images";

  if (isScreenshotPath) {
    return { name: "listener", baseUrl: getListenerBaseUrl() };
  }

  return { name: "listener", baseUrl: getListenerBaseUrl() };
}
