'use client';

import { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import { AlertCircle, Loader2 } from 'lucide-react';

interface HLSPlayerProps {
  vehicleId: string;
  channel: number;
  vehicleName?: string;
  onStop?: () => void;
  fallbackVehicleIds?: string[];
}

const resolvedVehicleIdCache = new Map<string, string>();
const PLAYLIST_PROBE_TIMEOUT_MS = 5000;
const START_LIVE_TIMEOUT_MS = 5000;

export default function HLSPlayer({ vehicleId, channel, vehicleName, onStop, fallbackVehicleIds = [] }: HLSPlayerProps) {
  const targetLiveDelaySeconds = 3;
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const statsTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startLiveCooldownUntilRef = useRef(0);
  const fatalErrorCountRef = useRef(0);
  const [status, setStatus] = useState('Starting stream...');
  const [stats, setStats] = useState('Waiting for stream...');
  const [error, setError] = useState(false);
  const fallbackKey = fallbackVehicleIds.map((value) => String(value || '').trim()).filter(Boolean).join('|');

  useEffect(() => {
    let mounted = true;
    const cacheKey = `${vehicleId}:${channel}`;
    const cachedCandidate = resolvedVehicleIdCache.get(cacheKey);
    const candidateVehicleIds = Array.from(
      new Set([cachedCandidate, vehicleId, ...fallbackKey.split('|')].map((value) => String(value || '').trim()).filter(Boolean))
    );
    let activeVehicleId = vehicleId;

    const clearRetry = () => {
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
    };

    const clearStatsTimer = () => {
      if (statsTimerRef.current) {
        clearInterval(statsTimerRef.current);
        statsTimerRef.current = null;
      }
    };

    const cleanupHls = () => {
      clearRetry();
      clearStatsTimer();
      fatalErrorCountRef.current = 0;
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      const video = videoRef.current;
      if (video) {
        try {
          video.pause();
        } catch {}
        video.removeAttribute('src');
        video.load();
      }
    };

    const attachNativeHls = (video: HTMLVideoElement, hlsUrl: string) => {
      video.src = `${hlsUrl}?_ts=${Date.now()}`;
      video.addEventListener(
        'loadedmetadata',
        () => {
          if (!mounted) return;
          setStatus('Streaming');
          setError(false);
        },
        { once: true }
      );
      video.addEventListener(
        'error',
        () => {
          if (!mounted) return;
          setStatus('Stream unavailable');
          setError(true);
        },
        { once: true }
      );
    };

    const attachHls = (video: HTMLVideoElement, hlsUrl: string) => {
      if (Hls.isSupported()) {
        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: false,
          backBufferLength: 20,
          maxBufferLength: 10,
          maxMaxBufferLength: 14,
          liveSyncDurationCount: 3,
          liveMaxLatencyDurationCount: 6,
          liveDurationInfinity: true,
          maxLiveSyncPlaybackRate: 1.05,
        });

        hlsRef.current = hls;
        hls.loadSource(`${hlsUrl}?_ts=${Date.now()}`);
        hls.attachMedia(video);

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          if (!mounted) return;
          fatalErrorCountRef.current = 0;
          setStatus('Streaming');
          setError(false);
          video.play().catch(() => {});
        });

        hls.on(Hls.Events.LEVEL_UPDATED, (_event, data) => {
          if (!mounted || !Number.isFinite(data.details?.edge)) return;
          const liveEdge = Number(data.details.edge);
          const latency = liveEdge - video.currentTime;
          if (Number.isFinite(latency) && latency > targetLiveDelaySeconds + 1.5) {
            const targetTime = Math.max(0, liveEdge - targetLiveDelaySeconds);
            if (Math.abs(video.currentTime - targetTime) > 0.25) {
              video.currentTime = targetTime;
            }
          }
        });

        hls.on(Hls.Events.ERROR, (_event, data) => {
          if (!data.fatal || !mounted) return;

          fatalErrorCountRef.current += 1;

          if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
            setStatus('Recovering stream...');
            setError(false);
            try {
              hls.startLoad();
            } catch {}
            if (fatalErrorCountRef.current < 3) {
              return;
            }
          }

          if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
            setStatus('Recovering stream...');
            setError(false);
            try {
              hls.recoverMediaError();
            } catch {}
            if (fatalErrorCountRef.current < 3) {
              return;
            }
          }

          setStatus('Reconnecting stream...');
          setError(false);
          cleanupHls();
          retryTimerRef.current = setTimeout(() => {
            if (!mounted) return;
            void startStreamAndAttach();
          }, 2500);
        });

        return;
      }

      if (video.canPlayType('application/vnd.apple.mpegurl')) {
        attachNativeHls(video, hlsUrl);
        return;
      }

      setStatus('HLS not supported');
      setError(true);
    };

    const buildHlsUrl = (candidateId: string) =>
      `/api/video-server/stream/${encodeURIComponent(candidateId)}/${encodeURIComponent(String(channel))}/playlist.m3u8`;

    const probeExistingPlaylist = async () => {
      for (const candidateId of candidateVehicleIds) {
        const probeUrl = `${buildHlsUrl(candidateId)}?_probe=${Date.now()}`;
        try {
          const response = await fetch(probeUrl, {
            method: 'GET',
            cache: 'no-store',
            signal: AbortSignal.timeout(PLAYLIST_PROBE_TIMEOUT_MS),
          });

          if (response.ok) {
            activeVehicleId = candidateId;
            resolvedVehicleIdCache.set(cacheKey, candidateId);
            return buildHlsUrl(candidateId);
          }
        } catch {}
      }

      return null;
    };

    const requestStartLive = async () => {
      if (Date.now() < startLiveCooldownUntilRef.current) {
        return false;
      }

      let sawNotConnected = false;

      for (const candidateId of candidateVehicleIds) {
        try {
          const response = await fetch(`/api/video-server/vehicles/${encodeURIComponent(candidateId)}/start-live`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ channel }),
            signal: AbortSignal.timeout(START_LIVE_TIMEOUT_MS),
          });

          if (response.ok) {
            activeVehicleId = candidateId;
            resolvedVehicleIdCache.set(cacheKey, candidateId);
            return true;
          }

          if (response.status === 404) {
            sawNotConnected = true;
          }
        } catch {}
      }

      if (sawNotConnected) {
        startLiveCooldownUntilRef.current = Date.now() + 15000;
      }

      return false;
    };

    const startStreamAndAttach = async () => {
      const video = videoRef.current;
      if (!video || !mounted) return;

      cleanupHls();
      setStatus('Checking live stream...');
      setError(false);

      const existingPlaylistUrl = await probeExistingPlaylist();
      if (!mounted) return;

      if (existingPlaylistUrl) {
        setStatus('Loading live stream...');
        attachHls(video, existingPlaylistUrl);
        return;
      }

      setStatus('Requesting live stream...');
      const started = await requestStartLive();
      if (!mounted) return;

      const playlistAfterStartUrl = await probeExistingPlaylist();
      if (!mounted) return;

      if (playlistAfterStartUrl) {
        setStatus('Loading live stream...');
        attachHls(video, playlistAfterStartUrl);
        return;
      }

      if (!started && candidateVehicleIds.length === 0) {
        setStatus('Failed to start');
        setError(true);
        return;
      }

      const hlsUrl = buildHlsUrl(activeVehicleId);
      setStatus(started ? 'Loading stream...' : 'Waiting for stream...');
      attachHls(video, hlsUrl);
    };

    const video = videoRef.current;
    const updateStats = () => {
      if (!video) return;
      if (video.buffered.length > 0) {
        const bufferedEnd = video.buffered.end(video.buffered.length - 1);
        const buffered = Math.max(0, bufferedEnd - video.currentTime);
        const liveLag = Math.max(0, bufferedEnd - video.currentTime);
        if (liveLag > targetLiveDelaySeconds + 1.5 && !video.paused) {
          video.currentTime = Math.max(0, bufferedEnd - targetLiveDelaySeconds);
        }
        setStats(`Buffer: ${buffered.toFixed(1)}s | Time: ${video.currentTime.toFixed(1)}s | Lag: ${liveLag.toFixed(1)}s`);
      }
    };

    video?.addEventListener('timeupdate', updateStats);
    video?.addEventListener('waiting', updateStats);
    video?.addEventListener('stalled', updateStats);
    statsTimerRef.current = setInterval(updateStats, 1000);
    void startStreamAndAttach();

    return () => {
      mounted = false;
      video?.removeEventListener('timeupdate', updateStats);
      video?.removeEventListener('waiting', updateStats);
      video?.removeEventListener('stalled', updateStats);
      clearStatsTimer();
      cleanupHls();
    };
  }, [vehicleId, channel, fallbackKey]);

  const isStreaming = status === 'Streaming';

  return (
    <div className="bg-slate-800 rounded-lg p-4 shadow-lg">
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-teal-400 font-bold text-sm">📹 {vehicleName || `${vehicleId} - Ch ${channel}`}</h3>
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
      <div className="relative w-full aspect-video bg-slate-900 rounded">
        <video
          ref={videoRef}
          controls
          autoPlay
          muted
          playsInline
          className="w-full h-full bg-black rounded"
          style={{ display: isStreaming ? 'block' : 'none' }}
        />
        {error && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center text-slate-400">
              <AlertCircle className="w-12 h-12 mx-auto mb-2" />
              <p className="text-sm">Stream not available</p>
              <p className="text-xs mt-1">Vehicle may be offline</p>
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
      <div className="text-xs text-gray-400 mt-2 font-mono">{stats}</div>
    </div>
  );
}
