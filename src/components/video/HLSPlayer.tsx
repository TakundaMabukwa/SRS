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

export default function HLSPlayer({ vehicleId, channel, vehicleName, onStop, fallbackVehicleIds = [] }: HLSPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [status, setStatus] = useState('Starting stream...');
  const [stats, setStats] = useState('');
  const [error, setError] = useState(false);

  useEffect(() => {
    let mounted = true;
    let hls: Hls | null = null;
    let manifestRetries = 0;
    const maxManifestRetries = 15;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let hlsUrlBase = '';
    let activeVehicleId = vehicleId;
    let framePollingStopped = false;

    const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

    const fetchManifestText = async (url: string) => {
      try {
        const response = await fetch(`${url}${url.includes('?') ? '&' : '?'}_probe=${Date.now()}`, {
          method: 'GET',
          cache: 'no-store',
        });
        const text = await response.text().catch(() => '');
        return {
          ok: response.ok,
          status: response.status,
          contentType: response.headers.get('content-type') || '',
          text,
        };
      } catch {
        return {
          ok: false,
          status: 0,
          contentType: '',
          text: '',
        };
      }
    };

    const probeStreamInfo = async (candidateId: string) => {
      try {
        const response = await fetch(`/api/video-server/vehicles/${encodeURIComponent(candidateId)}/stream-info?channel=${encodeURIComponent(String(channel))}`, {
          cache: 'no-store',
        });
        const data = await response.json().catch(() => null);
        if (!response.ok) return null;
        return data?.data?.stream || data?.stream || null;
      } catch {
        return null;
      }
    };

    const watchForFrames = async (candidateIds: string[]) => {
      for (let attempt = 0; attempt < maxManifestRetries; attempt += 1) {
        if (framePollingStopped || !mounted) return null;
        for (const candidateId of candidateIds) {
          const stream = await probeStreamInfo(candidateId);
          const frameCount = Number(stream?.frameCount || 0);
          const active = !!stream?.active;
          if (frameCount > 0 || active) {
            activeVehicleId = candidateId;
            return {
              vehicleId: candidateId,
              frameCount,
              active,
            };
          }
        }
        if (!mounted) return null;
        setStatus((current) => (
          current === 'Streaming'
            ? current
            : `Waiting for camera frames... ${attempt + 1}/${maxManifestRetries}`
        ));
        await wait(1200);
      }
      return null;
    };

    const loadManifest = async () => {
      if (!hls) return false;
      const withCacheBuster = `${hlsUrlBase}${hlsUrlBase.includes('?') ? '&' : '?'}_ts=${Date.now()}`;
      const probe = await fetchManifestText(hlsUrlBase);
      const looksLikeManifest =
        probe.ok &&
        /#extm3u/i.test(probe.text) &&
        !/application\/json/i.test(probe.contentType) &&
        !/<html/i.test(probe.text);

      if (!looksLikeManifest) {
        console.warn('[HLS Player] Manifest not ready yet:', probe.status, probe.contentType, probe.text.slice(0, 80));
        return false;
      }

      console.log('[HLS Player] Loading manifest:', withCacheBuster);
      hls.loadSource(withCacheBuster);
      hls.startLoad(-1);
      return true;
    };

    const startAndPlayStream = async () => {
      try {
        // Step 1: Start the stream on video server
        setStatus('Starting stream...');
        console.log(`[HLS Player] Starting ${vehicleId} ch${channel}`);
        const candidateVehicleIds = Array.from(new Set([vehicleId, ...fallbackVehicleIds].map((value) => String(value || '').trim()).filter(Boolean)));
        let startData: any = null;
        let started = false;

        for (const candidateId of candidateVehicleIds) {
          const startResponse = await fetch(`/api/video-server/vehicles/${encodeURIComponent(candidateId)}/start-live`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ channel })
          });

          startData = await startResponse.json().catch(() => null);
          console.log('[HLS Player] Start response:', candidateId, startResponse.status, startData);

          if (startResponse.ok) {
            activeVehicleId = candidateId;
            started = true;
            break;
          }
        }
        if (!started) {
          console.warn('[HLS Player] Start-live failed for all candidate ids; probing existing playlists.', candidateVehicleIds);
        }

        if (!mounted) {
          console.log('[HLS Player] Component unmounted after start');
          return;
        }

        // Step 2: Load HLS stream immediately
        setStatus('Loading...');
        const video = videoRef.current;
        if (!video) {
          console.error('[HLS Player] Video element not found');
          return;
        }

        const streamCandidates = candidateVehicleIds.map((candidateId) => `/api/video-server/stream/${candidateId}/${channel}/playlist.m3u8`);
        let selectedStreamUrl = streamCandidates[0] || `/api/video-server/stream/${activeVehicleId}/${channel}/playlist.m3u8`;

        for (const candidateUrl of streamCandidates) {
          try {
            const probeResponse = await fetch(candidateUrl, {
              method: 'GET',
              cache: 'no-store',
              headers: { Range: 'bytes=0-256' },
            });
            if (probeResponse.ok) {
              selectedStreamUrl = candidateUrl;
              break;
            }
          } catch {
            // Ignore and continue probing candidates.
          }
        }

        if (!started && selectedStreamUrl === streamCandidates[0] && !streamCandidates.length) {
          throw new Error(startData?.error || startData?.message || 'Failed to start stream');
        }

        void watchForFrames(candidateVehicleIds).then((frameReady) => {
          if (!mounted || framePollingStopped) return;
          if (frameReady?.vehicleId) {
            activeVehicleId = frameReady.vehicleId;
            if (status !== 'Streaming') {
              setStatus('Camera frames received');
            }
            return;
          }
          if (!started && !error) {
            setStatus('No frames received from camera');
            setError(true);
          }
        });

        hlsUrlBase = selectedStreamUrl;
        console.log('[HLS Player] Base URL:', hlsUrlBase);

        if (Hls.isSupported()) {
          hls = new Hls({
            enableWorker: true,
            lowLatencyMode: false,
            // Larger buffer to handle slow segments
            maxBufferLength: 30,
            maxMaxBufferLength: 60,
            maxBufferSize: 60 * 1000 * 1000,
            maxBufferHole: 1,
            // More aggressive loading
            maxLoadingDelay: 2,
            manifestLoadingTimeOut: 15000,
            manifestLoadingMaxRetry: 10,
            manifestLoadingRetryDelay: 1000,
            levelLoadingTimeOut: 15000,
            levelLoadingMaxRetry: 10,
            levelLoadingRetryDelay: 1000,
            fragLoadingTimeOut: 30000,
            fragLoadingMaxRetry: 10,
            fragLoadingRetryDelay: 2000,
            // Keep more segments buffered
            liveSyncDurationCount: 3,
            liveMaxLatencyDurationCount: 6,
            // Start with buffer
            startPosition: -1,
          });

          hls.attachMedia(video);
          const manifestReady = await loadManifest();
          if (!manifestReady) {
            manifestRetries += 1;
            setStatus(`Waiting for stream... ${manifestRetries}/${maxManifestRetries}`);
            if (retryTimer) clearTimeout(retryTimer);
            retryTimer = setTimeout(() => {
              if (!mounted) return;
              void loadManifest();
            }, 1200);
          }
          hlsRef.current = hls;

          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            console.log('[HLS Player] Manifest parsed successfully');
            if (!mounted) return;
            manifestRetries = 0;
            framePollingStopped = true;
            setStatus('Streaming');
            setError(false);
            video.play().catch(e => console.warn('Autoplay blocked:', e));
          });

          hls.on(Hls.Events.ERROR, (event, data) => {
            if (data.fatal) {
              console.error('[HLS Player] FATAL Error:', data.type, data.details);
              if (mounted) {
                const detailsText = String(data.details || '').toLowerCase();
                const isManifestIssue =
                  detailsText.includes('manifestparsingerror') ||
                  detailsText.includes('manifestloaderror') ||
                  detailsText.includes('manifestloadtimeout');

                if (isManifestIssue && manifestRetries < maxManifestRetries) {
                  manifestRetries += 1;
                  setStatus(`Waiting for stream... ${manifestRetries}/${maxManifestRetries}`);
                  setError(false);
                  if (retryTimer) clearTimeout(retryTimer);
                  retryTimer = setTimeout(() => {
                    if (!mounted) return;
                    console.log('[HLS Player] Retrying manifest load...');
                    void loadManifest();
                  }, 1200);
                  return;
                }
                if (isManifestIssue && manifestRetries >= maxManifestRetries) {
                  framePollingStopped = true;
                  setStatus('Stream unavailable');
                  setError(true);
                  return;
                }

                if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
                  console.log('[HLS Player] Fatal network error, attempting recovery...');
                  hls.startLoad();
                } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
                  console.log('[HLS Player] Fatal media error, attempting recovery...');
                  hls.recoverMediaError();
                } else {
                  console.error('[HLS Player] Fatal error, cannot recover');
                  setStatus('Stream Unavailable');
                  setError(true);
                }
              }
            }
            // Ignore non-fatal errors (buffering issues are expected with slow server)
          });

          hlsRef.current = hls;
        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
          video.src = `${hlsUrlBase}?_ts=${Date.now()}`;
          video.addEventListener('loadedmetadata', () => {
            if (mounted) {
              framePollingStopped = true;
              setStatus('Streaming');
              setError(false);
            }
          });
          video.addEventListener('error', () => {
            if (mounted) {
              framePollingStopped = true;
              setStatus('Stream Unavailable');
              setError(true);
            }
          });
        }

        const updateStats = () => {
          if (video.buffered.length > 0) {
            const buffered = video.buffered.end(0) - video.currentTime;
            setStats(`Buffer: ${buffered.toFixed(1)}s | Time: ${video.currentTime.toFixed(1)}s`);
          }
        };

        video.addEventListener('timeupdate', updateStats);

      } catch (err) {
        console.error('Stream start error:', err);
        if (mounted) {
          setStatus('Failed to start');
          setError(true);
        }
      }
    };

    startAndPlayStream();

    return () => {
      console.log(`[HLS Player] Cleanup ${vehicleId} ch${channel}`);
      mounted = false;
      framePollingStopped = true;
      if (retryTimer) clearTimeout(retryTimer);
      if (hls) {
        hls.destroy();
      }
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [vehicleId, channel]);

  return (
    <div className="bg-slate-800 rounded-lg p-4 shadow-lg">
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-teal-400 font-bold text-sm">📹 {vehicleName || `${vehicleId} - Ch ${channel}`}</h3>
        <div className="flex items-center gap-2">
          <span className={`text-xs ${status === 'Streaming' ? 'text-green-400' : error ? 'text-red-400' : 'text-yellow-400'}`}>
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
          style={{ display: status === 'Streaming' ? 'block' : 'none' }}
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
        {!error && status !== 'Streaming' && (
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
