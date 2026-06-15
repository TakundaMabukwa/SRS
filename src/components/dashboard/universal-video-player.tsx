"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Hls from "hls.js";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { resolveMediaUrlForCurrentOrigin } from "@/lib/video-alert-playback";

function isFlvUrl(url: string): boolean {
  return /\.flv(?:$|\?)/i.test(url) || /\.history\.flv/i.test(url);
}

interface UniversalVideoPlayerProps {
  url: string;
  fallbackUrls?: string[];
  className?: string;
  onPlayableChange?: (playable: boolean) => void;
  onScreenshotCapture?: (blob: Blob) => void;
  autoPlay?: boolean;
}

export function UniversalVideoPlayer({
  url,
  fallbackUrls = [],
  className = "w-full rounded mb-3",
  onPlayableChange,
  onScreenshotCapture,
  autoPlay = false,
}: UniversalVideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [playbackError, setPlaybackError] = useState("");
  const screenshotCapturedForRef = useRef("");
  const candidateSources = React.useMemo(() => {
    const out: string[] = [];
    const push = (v?: string) => {
      const s = String(v || "").trim();
      if (!s) return;
      if (out.includes(s)) return;
      out.push(s);
    };
    push(url);
    (fallbackUrls || []).forEach((u) => push(u));
    return out;
  }, [fallbackUrls, url]);
  const [sourceIndex, setSourceIndex] = useState(0);
  const activeUrl = candidateSources[sourceIndex] || "";
  const isHlsUrl = /\.m3u8(?:$|\?)/i.test(activeUrl);
  const isFlv = isFlvUrl(activeUrl);
  const isJobMp4Url = /\/api\/video-server\/videos\/jobs\/[^/]+\/file/i.test(activeUrl) && !isHlsUrl && !isFlv;

  const flvPlayerRef = useRef<any>(null);

  useEffect(() => {
    setPlaybackError("");
    setSourceIndex(0);
    screenshotCapturedForRef.current = "";
  }, [url, fallbackUrls]);

  // HLS playback
  useEffect(() => {
    const videoEl = videoRef.current;
    if (!videoEl || !activeUrl || !isHlsUrl) return;

    let hls: Hls | null = null;
    videoEl.removeAttribute("src");
    videoEl.load();

    if (videoEl.canPlayType("application/vnd.apple.mpegurl")) {
      videoEl.src = activeUrl;
    } else if (Hls.isSupported()) {
      hls = new Hls({ enableWorker: true, lowLatencyMode: true });
      hls.loadSource(activeUrl);
      hls.attachMedia(videoEl);
      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data?.fatal) {
          if (sourceIndex < candidateSources.length - 1) {
            setSourceIndex((prev) => prev + 1);
            return;
          }
          setPlaybackError("HLS playback failed. Use Open/Download for this clip.");
          onPlayableChange?.(false);
        }
      });
    } else {
      if (sourceIndex < candidateSources.length - 1) { setSourceIndex((prev) => prev + 1); }
      else { setPlaybackError("HLS is not supported in this browser."); onPlayableChange?.(false); }
    }
    return () => { if (hls) hls.destroy(); };
  }, [activeUrl, candidateSources.length, isHlsUrl, onPlayableChange, sourceIndex]);

  // FLV playback via flv.js (proxy through backend for CORS)
  useEffect(() => {
    const videoEl = videoRef.current;
    if (!videoEl || !activeUrl || !isFlv) return;

    let destroyed = false;
    videoEl.removeAttribute("src");
    videoEl.load();

    (async () => {
      try {
        const flvjs = (await import("flv.js")).default;
        if (destroyed || !flvjs.isSupported()) {
          if (!destroyed) setPlaybackError("FLV not supported in this browser.");
          return;
        }
        // Proxy external FLV URLs through backend to avoid CORS issues
        const isExternalUrl = /^https?:\/\//i.test(activeUrl) && !activeUrl.includes(window.location.host);
        const proxyUrl = isExternalUrl
          ? `/api/video-server/playback/flv-proxy?url=${encodeURIComponent(activeUrl)}`
          : activeUrl;
        const player = flvjs.createPlayer({ type: "flv", url: proxyUrl, isLive: false });
        flvPlayerRef.current = player;
        player.attachMediaElement(videoEl);
        player.load();
        player.on(flvjs.Events.ERROR, () => {
          if (sourceIndex < candidateSources.length - 1) {
            setSourceIndex((prev) => prev + 1);
          } else {
            setPlaybackError("FLV playback failed. Download the file instead.");
            onPlayableChange?.(false);
          }
        });
        player.on(flvjs.Events.METADATA_ARRIVED, () => onPlayableChange?.(true));
      } catch { setPlaybackError("FLV player failed to load."); }
    })();

    return () => {
      destroyed = true;
      if (flvPlayerRef.current) { flvPlayerRef.current.detachMediaElement(); flvPlayerRef.current.destroy(); flvPlayerRef.current = null; }
    };
  }, [activeUrl, candidateSources.length, isFlv, onPlayableChange, sourceIndex]);

  useEffect(() => {
    const videoEl = videoRef.current;
    if (!videoEl || !autoPlay) return;
    const tryPlay = async () => {
      try {
        await videoEl.play();
      } catch {
        // Ignore autoplay rejections (browser policy), user can manually play.
      }
    };
    void tryPlay();
  }, [activeUrl, autoPlay]);

  const looksLikeRawH264 = /\.h264(?:$|\?)/i.test(activeUrl);
  const tryAutoplay = useCallback(() => {
    const videoEl = videoRef.current;
    if (!videoEl || !autoPlay) return;
    void videoEl.play().catch(() => {
      // Browser autoplay policy can still block; user can press play.
    });
  }, [autoPlay]);
  const tryCaptureScreenshot = useCallback(() => {
    const videoEl = videoRef.current;
    if (!videoEl || !onScreenshotCapture || !activeUrl) return;
    if (screenshotCapturedForRef.current === activeUrl) return;
    if ((videoEl.videoWidth || 0) <= 0 || (videoEl.videoHeight || 0) <= 0) return;

    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, videoEl.videoWidth || 1280);
    canvas.height = Math.max(1, videoEl.videoHeight || 720);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (!blob) return;
      screenshotCapturedForRef.current = activeUrl;
      onScreenshotCapture(blob);
    }, "image/jpeg", 0.9);
  }, [activeUrl, onScreenshotCapture]);

  return (
    <div className="mb-3">
      <video
        ref={videoRef}
        controls
        preload="metadata"
        playsInline
        autoPlay={autoPlay}
        muted={autoPlay}
        className={className}
        src={!activeUrl || isHlsUrl || isFlv ? undefined : resolveMediaUrlForCurrentOrigin(activeUrl)}
        onLoadedMetadata={() => {
          onPlayableChange?.(true);
          tryAutoplay();
        }}
        onLoadedData={() => {
          onPlayableChange?.(true);
          tryAutoplay();
          tryCaptureScreenshot();
        }}
        onCanPlay={() => {
          onPlayableChange?.(true);
          tryAutoplay();
          tryCaptureScreenshot();
        }}
        onError={() => {
          if (sourceIndex < candidateSources.length - 1) {
            setSourceIndex((prev) => prev + 1);
            return;
          }
          setPlaybackError("Browser could not decode this format. Use Open/Download for this clip.");
          onPlayableChange?.(false);
        }}
      >
        Your browser does not support video playback.
      </video>
      {candidateSources.length > 1 && (
        <p className="text-xs text-slate-400">
          Trying source {sourceIndex + 1}/{candidateSources.length}
        </p>
      )}
      {isFlv && (
        <div className="flex justify-end gap-2 mt-1">
          <Button
            variant="outline"
            size="sm"
            className="border-slate-400 bg-slate-800 text-slate-200 hover:bg-slate-700"
            onClick={async () => {
              const u = resolveMediaUrlForCurrentOrigin(activeUrl);
              try {
                const r = await fetch(u);
                const b = await r.blob();
                const a = document.createElement("a");
                a.href = URL.createObjectURL(b);
                a.download = `alert-video-${Date.now()}.flv`;
                a.click();
                URL.revokeObjectURL(a.href);
              } catch { window.open(u, "_blank"); }
            }}
          >
            <Download className="w-3 h-3 mr-1" />
            Download FLV
          </Button>
        </div>
      )}
      {isJobMp4Url && (
        <div className="flex justify-end">
          <Button
            variant="outline"
            size="sm"
            className="border-cyan-400/40 bg-slate-900 text-cyan-200 hover:bg-slate-800"
            onClick={() => window.open(resolveMediaUrlForCurrentOrigin(activeUrl), "_blank")}
          >
            Open In Browser
          </Button>
        </div>
      )}
      {isFlv && (
        <p className="text-xs text-amber-600 mt-1">FLV format — use the Download button or flv.js-compatible player.</p>
      )}
      {looksLikeRawH264 && (
        <p className="text-xs text-amber-700">Raw H264 clip detected. If it does not play, use Download/Open.</p>
      )}
      {playbackError && (
        <p className="text-xs text-red-600">{playbackError}</p>
      )}
    </div>
  );
}
