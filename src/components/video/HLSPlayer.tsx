'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Hls from 'hls.js';
import { AlertCircle, Loader2 } from 'lucide-react';

interface HLSPlayerProps {
  vehicleId: string;
  channel: number;
  vehicleName?: string;
  onStop?: () => void;
  fallbackVehicleIds?: string[];
}

const LIVE_WARM_MAX_AGE_MS = 20000;
const LIVE_CONNECT_TIMEOUT_MS = 20000;
const LIVE_RETRY_DELAY_MS = 3000;

export default function HLSPlayer({
  vehicleId,
  channel,
  vehicleName,
  onStop,
  fallbackVehicleIds = [],
}: HLSPlayerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [status, setStatus] = useState('Connecting live video...');
  const [error, setError] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  const fallbackKey = useMemo(
    () =>
      Array.from(
        new Set(
          fallbackVehicleIds
            .map((value) => String(value || '').trim())
            .filter(Boolean)
        )
      ).join(','),
    [fallbackVehicleIds]
  );

  const streamUrl = useMemo(() => {
    const params = new URLSearchParams({
      channel: String(channel),
      waitMs: '15000',
      maxAgeMs: String(LIVE_WARM_MAX_AGE_MS),
      _ts: String(reloadToken || Date.now()),
    });
    if (fallbackKey) {
      params.set('fallbackIds', fallbackKey);
    }
    return `/api/live-video/vehicles/${encodeURIComponent(vehicleId)}/playlist.m3u8?${params.toString()}`;
  }, [channel, fallbackKey, reloadToken, vehicleId]);

  const streamStartCandidates = useMemo(
    () =>
      Array.from(
        new Set(
          [vehicleId, ...fallbackVehicleIds]
            .map((value) => String(value || '').trim())
            .filter(Boolean)
        )
      ),
    [fallbackVehicleIds, vehicleId]
  );

  useEffect(() => {
    const videoEl = videoRef.current;
    if (!videoEl) {
      return;
    }

    setStatus('Connecting live video...');
    setError(false);

    let destroyed = false;
    let hls: Hls | null = null;
    let connectTimeout: ReturnType<typeof setTimeout> | null = null;

    const markStreaming = () => {
      if (destroyed) {
        return;
      }
      if (connectTimeout) {
        clearTimeout(connectTimeout);
        connectTimeout = null;
      }
      setStatus('Streaming');
      setError(false);
    };

    const markUnavailable = (message = 'Live video unavailable') => {
      if (destroyed) {
        return;
      }
      if (connectTimeout) {
        clearTimeout(connectTimeout);
        connectTimeout = null;
      }
      setStatus(message);
      setError(true);
    };

    const tryPlay = () => {
      void videoEl.play().catch(() => {
        // Autoplay can be blocked briefly during route changes; keep the stream attached.
      });
    };

    const onPlaying = () => {
      markStreaming();
    };

    const onLoadedData = () => {
      markStreaming();
      tryPlay();
    };

    const onWaiting = () => {
      if (!destroyed) {
        setStatus('Buffering live video...');
      }
    };

    const onVideoError = () => {
      markUnavailable();
    };

    videoEl.muted = true;
    videoEl.autoplay = true;
    videoEl.playsInline = true;
    videoEl.preload = 'auto';

    const requestStartLive = async () => {
      for (const candidateId of streamStartCandidates) {
        try {
          const response = await fetch(
            `/api/video-server/vehicles/${encodeURIComponent(candidateId)}/start-live`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ channel }),
            }
          );
          if (response.ok) {
            break;
          }
        } catch {
          // Try next candidate id.
        }
      }
    };
    void requestStartLive();

    connectTimeout = setTimeout(() => {
      markUnavailable('Live video startup timed out');
    }, LIVE_CONNECT_TIMEOUT_MS);

    videoEl.addEventListener('playing', onPlaying);
    videoEl.addEventListener('loadeddata', onLoadedData);
    videoEl.addEventListener('waiting', onWaiting);
    videoEl.addEventListener('error', onVideoError);

    if (videoEl.canPlayType('application/vnd.apple.mpegurl')) {
      videoEl.src = streamUrl;
      tryPlay();
    } else if (Hls.isSupported()) {
      hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        liveSyncDurationCount: 2,
        liveMaxLatencyDurationCount: 4,
        maxLiveSyncPlaybackRate: 1.5,
        backBufferLength: 30,
        manifestLoadingTimeOut: 15000,
        levelLoadingTimeOut: 15000,
        fragLoadingTimeOut: 15000,
      });

      hls.loadSource(streamUrl);
      hls.attachMedia(videoEl);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        tryPlay();
      });
      hls.on(Hls.Events.LEVEL_LOADED, () => {
        markStreaming();
      });
      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data?.fatal) {
          markUnavailable();
          hls?.destroy();
          hls = null;
          return;
        }

        if (data?.type === Hls.ErrorTypes.NETWORK_ERROR) {
          setStatus('Reconnecting live video...');
          try {
            hls?.startLoad();
          } catch {
            // Retry loop below will reload the player if needed.
          }
        }
      });
    } else {
      markUnavailable('Live video unsupported');
    }

    return () => {
      destroyed = true;
      videoEl.pause();
      videoEl.removeAttribute('src');
      videoEl.load();
      videoEl.removeEventListener('playing', onPlaying);
      videoEl.removeEventListener('loadeddata', onLoadedData);
      videoEl.removeEventListener('waiting', onWaiting);
      videoEl.removeEventListener('error', onVideoError);
      if (hls) {
        hls.destroy();
      }
      if (connectTimeout) {
        clearTimeout(connectTimeout);
      }
    };
  }, [channel, streamStartCandidates, streamUrl]);

  useEffect(() => {
    if (!error) {
      return;
    }

    const timer = setTimeout(() => {
      setStatus('Retrying live video...');
      setError(false);
      setReloadToken((value) => value + 1);
    }, LIVE_RETRY_DELAY_MS);

    return () => clearTimeout(timer);
  }, [error]);

  const isStreaming = !error && status === 'Streaming';

  return (
    <div className="bg-slate-800 rounded-lg p-4 shadow-lg">
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-teal-400 font-bold text-sm">{vehicleName || `${vehicleId} - Ch ${channel}`}</h3>
        <div className="flex items-center gap-2">
          <span className={`text-xs ${isStreaming ? 'text-green-400' : error ? 'text-red-400' : 'text-yellow-400'}`}>
            {status}
          </span>
          {onStop && (
            <button
              onClick={onStop}
              className="text-xs px-2 py-1 bg-red-500 hover:bg-red-600 text-white rounded"
            >
              Stop
            </button>
          )}
        </div>
      </div>
      <div className="relative w-full aspect-video bg-slate-900 rounded overflow-hidden">
        <video
          ref={videoRef}
          muted
          autoPlay
          playsInline
          className={`w-full h-full object-cover bg-black ${error ? 'hidden' : 'block'}`}
        />
        {error && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center text-slate-400">
              <AlertCircle className="w-12 h-12 mx-auto mb-2" />
              <p className="text-sm">Live video unavailable</p>
              <p className="text-xs mt-1">Vehicle may be offline or stream not warm yet</p>
            </div>
          </div>
        )}
        {!error && !isStreaming && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center text-slate-400">
              <Loader2 className="w-12 h-12 mx-auto mb-2 animate-spin" />
              <p className="text-sm">{status}</p>
            </div>
          </div>
        )}
      </div>
      <div className="text-xs text-gray-400 mt-2 font-mono">
        HLS live video | CH {channel}
      </div>
    </div>
  );
}
