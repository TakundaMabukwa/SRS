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
  const [activeChannel, setActiveChannel] = useState(channel);

  useEffect(() => {
    let mounted = true;
    let hls: Hls | null = null;
    let manifestRetries = 0;
    const maxManifestRetries = 15;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let validationTimer: ReturnType<typeof setTimeout> | null = null;
    let hlsUrlBase = '';
    let activeVehicleId = vehicleId;
    let framePollingStopped = false;
    let switchedToFallback = false;
    let currentChannel = channel;
    const candidateVehicleIds = Array.from(new Set([vehicleId, ...fallbackVehicleIds].map((value) => String(value || '').trim()).filter(Boolean)));
    const candidateChannels = Array.from(new Set([channel, ...(channel === 1 ? [] : [1])]));

    const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

    const cleanupPlayback = () => {
      if (retryTimer) clearTimeout(retryTimer);
      retryTimer = null;
      if (validationTimer) clearTimeout(validationTimer);
      validationTimer = null;
      if (hls) {
        hls.destroy();
        hls = null;
      }
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      const video = videoRef.current;
      if (video) {
        try { video.pause(); } catch {}
        video.removeAttribute('src');
        video.load();
      }
    };

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

    const probeStreamInfo = async (candidateId: string, candidateChannel: number) => {
      try {
        const response = await fetch(`/api/video-server/vehicles/${encodeURIComponent(candidateId)}/stream-info?channel=${encodeURIComponent(String(candidateChannel))}`, {
          cache: 'no-store',
        });
        const data = await response.json().catch(() => null);
        if (!response.ok) return null;
        return data?.data?.stream || data?.stream || null;
      } catch {
        return null;
      }
    };

    const looksLikeCorruptGreenFrame = (video: HTMLVideoElement) => {
      const width = video.videoWidth || 0;
      const height = video.videoHeight || 0;
      if (width < 32 || height < 32) return false;

      const canvas = document.createElement('canvas');
      canvas.width = 64;
      canvas.height = 36;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return false;

      try {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
        let sampled = 0;
        let hardGreen = 0;
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          sampled += 1;
          if (g > 80 && r < 45 && b < 45) {
            hardGreen += 1;
          }
        }
        return sampled > 0 && hardGreen / sampled > 0.22;
      } catch {
        return false;
      }
    };

    const watchForFrames = async () => {
      for (let attempt = 0; attempt < maxManifestRetries; attempt += 1) {
        if (framePollingStopped || !mounted) return null;
        for (const candidateId of candidateVehicleIds) {
          const stream = await probeStreamInfo(candidateId, currentChannel);
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
          current.startsWith('Streaming')
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

      hls.loadSource(withCacheBuster);
      hls.startLoad(-1);
      return true;
    };

    const attemptFallback = async (reason: string) => {
      if (switchedToFallback || channel === 1 || !mounted) return false;
      const fallbackChannel = candidateChannels.find((value) => value !== currentChannel);
      if (!fallbackChannel || fallbackChannel === currentChannel) return false;

      switchedToFallback = true;
      cleanupPlayback();
      setStatus(`CH${channel} unstable, falling back to CH${fallbackChannel}...`);
      setError(false);
      await wait(300);
      currentChannel = fallbackChannel;
      setActiveChannel(fallbackChannel);
      console.warn(`[HLS Player] Falling back from CH${channel} to CH${fallbackChannel}: ${reason}`);
      void startAndPlayStream();
      return true;
    };

    async function startAndPlayStream() {
      try {
        setStatus(`Starting CH${currentChannel}...`);
        const video = videoRef.current;
        if (!video) return;

        let startData: any = null;
        let started = false;
        for (const candidateId of candidateVehicleIds) {
          const startResponse = await fetch(`/api/video-server/vehicles/${encodeURIComponent(candidateId)}/start-live`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ channel: currentChannel })
          });
          startData = await startResponse.json().catch(() => null);
          if (startResponse.ok) {
            activeVehicleId = candidateId;
            started = true;
            break;
          }
        }

        setStatus(`Loading CH${currentChannel}...`);
        const streamCandidates = candidateVehicleIds.map((candidateId) => `/api/video-server/stream/${candidateId}/${currentChannel}/playlist.m3u8`);
        let selectedStreamUrl = streamCandidates[0] || `/api/video-server/stream/${activeVehicleId}/${currentChannel}/playlist.m3u8`;

        for (const candidateUrl of streamCandidates) {
          const probe = await fetchManifestText(candidateUrl);
          const hasManifest =
            probe.ok &&
            /#extm3u/i.test(probe.text) &&
            !/application\/json/i.test(probe.contentType) &&
            !/<html/i.test(probe.text);
          if (hasManifest) {
            selectedStreamUrl = candidateUrl;
            break;
          }
        }

        if (!started && streamCandidates.length === 0) {
          throw new Error(startData?.error || startData?.message || 'Failed to start stream');
        }

        void watchForFrames().then((frameReady) => {
          if (!mounted || framePollingStopped) return;
          if (frameReady?.vehicleId) {
            activeVehicleId = frameReady.vehicleId;
            setStatus(`Camera frames received on CH${currentChannel}`);
            return;
          }
          void attemptFallback('no-frames').then((fallbackStarted) => {
            if (!fallbackStarted) {
              setStatus('No frames received from camera');
              setError(true);
            }
          });
        });

        hlsUrlBase = selectedStreamUrl;

        if (Hls.isSupported()) {
          hls = new Hls({
            enableWorker: true,
            lowLatencyMode: false,
            maxBufferLength: 30,
            maxMaxBufferLength: 60,
            maxBufferSize: 60 * 1000 * 1000,
            maxBufferHole: 1,
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
            liveSyncDurationCount: 3,
            liveMaxLatencyDurationCount: 6,
            startPosition: -1,
          });

          hls.attachMedia(video);
          hlsRef.current = hls;
          const manifestReady = await loadManifest();
          if (!manifestReady) {
            manifestRetries += 1;
            setStatus(`Waiting for stream manifest... ${manifestRetries}/${maxManifestRetries}`);
            if (retryTimer) clearTimeout(retryTimer);
            retryTimer = setTimeout(() => {
              if (!mounted) return;
              void loadManifest();
            }, 1200);
          }

          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            if (!mounted) return;
            manifestRetries = 0;
            framePollingStopped = true;
            setStatus(`Streaming CH${currentChannel}`);
            setError(false);
            video.play().catch((e) => console.warn('Autoplay blocked:', e));

            if (currentChannel !== 1) {
              let failedChecks = 0;
              const validateSecondaryFeed = () => {
                if (!mounted) return;
                const progressing = video.currentTime > 0.6 && video.readyState >= 2;
                if (!progressing) {
                  validationTimer = setTimeout(validateSecondaryFeed, 700);
                  return;
                }
                if (looksLikeCorruptGreenFrame(video)) {
                  failedChecks += 1;
                  if (failedChecks >= 2) {
                    void attemptFallback('corrupt-frame');
                    return;
                  }
                } else {
                  failedChecks = 0;
                }
                validationTimer = setTimeout(validateSecondaryFeed, 900);
              };
              validationTimer = setTimeout(validateSecondaryFeed, 1400);
            }
          });

          hls.on(Hls.Events.ERROR, (_event, data) => {
            if (!data.fatal || !mounted) return;
            const detailsText = String(data.details || '').toLowerCase();
            const isManifestIssue =
              detailsText.includes('manifestparsingerror') ||
              detailsText.includes('manifestloaderror') ||
              detailsText.includes('manifestloadtimeout');

            if (isManifestIssue && manifestRetries < maxManifestRetries) {
              manifestRetries += 1;
              setStatus(`Waiting for stream manifest... ${manifestRetries}/${maxManifestRetries}`);
              setError(false);
              if (retryTimer) clearTimeout(retryTimer);
              retryTimer = setTimeout(() => {
                if (!mounted) return;
                void loadManifest();
              }, 1200);
              return;
            }

            if (isManifestIssue && manifestRetries >= maxManifestRetries) {
              framePollingStopped = true;
              void attemptFallback('manifest-timeout').then((fallbackStarted) => {
                if (!fallbackStarted) {
                  setStatus('Stream unavailable');
                  setError(true);
                }
              });
              return;
            }

            if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
              hls?.startLoad();
              return;
            }

            if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
              if (currentChannel !== 1) {
                void attemptFallback('media-error').then((fallbackStarted) => {
                  if (!fallbackStarted) {
                    hls?.recoverMediaError();
                  }
                });
              } else {
                hls?.recoverMediaError();
              }
              return;
            }

            void attemptFallback('fatal-error').then((fallbackStarted) => {
              if (!fallbackStarted) {
                setStatus('Stream unavailable');
                setError(true);
              }
            });
          });
        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
          video.src = `${hlsUrlBase}?_ts=${Date.now()}`;
          video.addEventListener('loadedmetadata', () => {
            if (mounted) {
              framePollingStopped = true;
              setStatus(`Streaming CH${currentChannel}`);
              setError(false);
            }
          });
          video.addEventListener('error', () => {
            if (!mounted) return;
            void attemptFallback('native-error').then((fallbackStarted) => {
              if (!fallbackStarted) {
                setStatus('Stream unavailable');
                setError(true);
              }
            });
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
        if (!mounted) return;
        void attemptFallback('start-error').then((fallbackStarted) => {
          if (!fallbackStarted) {
            setStatus('Failed to start');
            setError(true);
          }
        });
      }
    }

    setActiveChannel(channel);
    void startAndPlayStream();

    return () => {
      mounted = false;
      framePollingStopped = true;
      cleanupPlayback();
    };
  }, [vehicleId, channel, fallbackVehicleIds]);

  const isStreaming = status.startsWith('Streaming');

  return (
    <div className="bg-slate-800 rounded-lg p-4 shadow-lg">
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-teal-400 font-bold text-sm">ðŸ“¹ {vehicleName || `${vehicleId} - Ch ${activeChannel}`}</h3>
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
