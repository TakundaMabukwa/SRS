function normalizeBaseUrl(value?: string | null, fallback = "http://localhost:3000") {
  const raw = String(value || "").trim();
  const base = raw || fallback;
  return base.replace(/\/+$/, "").replace(/\/api$/i, "");
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

export function resolveVideoServerProxyBase(pathArray: string[]) {
  const [first = "", second = "", third = "", fourth = ""] = pathArray;
  const joined = pathArray.join("/").toLowerCase();
  const isAlertMediaPath =
    first === "alerts" &&
    (
      third === "media" ||
      third === "screenshots" ||
      third === "videos" ||
      third === "video" ||
      third === "request-report-video" ||
      third === "collect-evidence"
    );

  const isLiveStreamPath =
    first === "stream" ||
    (first === "vehicles" &&
      (third === "start-live" ||
        third === "stop-live" ||
        third === "stream-info" ||
        third === "start-all-streams" ||
        third === "stop-all-streams" ||
        third === "query-capabilities" ||
        third === "screenshot" ||
        third === "test-query-resources" ||
        third === "test-playback" ||
        second === "connected" ||
        second === "streams")) ||
    joined.startsWith("stream/") ||
    first === "screenshots" ||
    first === "images" ||
    isAlertMediaPath;

  if (isLiveStreamPath) {
    return { name: "listener", baseUrl: getListenerBaseUrl() };
  }

  const isPlaybackPath =
    first === "playback" ||
    first === "videos" ||
    (first === "vehicles" && third === "videos") ||
    fourth === "videos";

  if (isPlaybackPath) {
    return { name: "videoHub", baseUrl: getVideoHubBaseUrl() };
  }

  const isAlertPath =
    first === "alerts" ||
    first === "dashboard" ||
    first === "drivers" ||
    first === "speeding";

  if (isAlertPath) {
    return { name: "alertHub", baseUrl: getAlertHubBaseUrl() };
  }

  return { name: "listener", baseUrl: getListenerBaseUrl() };
}
