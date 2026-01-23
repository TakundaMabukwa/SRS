'use client';

import { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import { AlertCircle, Loader2 } from 'lucide-react';

interface HLSPlayerProps {
  vehicleId: string;
  channel: number;
  vehicleName?: string;
  onStop?: () => void;
}

export default function HLSPlayer({ vehicleId, channel, vehicleName, onStop }: HLSPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [status, setStatus] = useState('Starting stream...');
  const [stats, setStats] = useState('');
  const [error, setError] = useState(false);

  useEffect(() => {
    let mounted = true;
    let hls: Hls | null = null;

    const startAndPlayStream = async () => {
      try {
        // Step 1: Start the stream on video server
        setStatus('Starting stream...');
        console.log(`[HLS Player] Starting ${vehicleId} ch${channel}`);
        const startResponse = await fetch('/api/start-stream', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ vehicleId, channel })
        });

        const startData = await startResponse.json();
        console.log('[HLS Player] Start response:', startResponse.status, startData);

        if (!startResponse.ok) {
          throw new Error(startData.error || 'Failed to start stream');
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

        const hlsUrl = `/api/hls-proxy/${vehicleId}/${channel}/playlist.m3u8`;
        console.log('[HLS Player] Loading:', hlsUrl);

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

          hls.loadSource(hlsUrl);
          hls.attachMedia(video);
          hlsRef.current = hls;

          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            console.log('[HLS Player] Manifest parsed successfully');
            if (!mounted) return;
            setStatus('Streaming');
            setError(false);
            video.play().catch(e => console.warn('Autoplay blocked:', e));
          });

          hls.on(Hls.Events.ERROR, (event, data) => {
            if (data.fatal) {
              console.error('[HLS Player] FATAL Error:', data.type, data.details);
              if (mounted) {
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
          video.src = hlsUrl;
          video.addEventListener('loadedmetadata', () => {
            if (mounted) {
              setStatus('Streaming');
              setError(false);
            }
          });
          video.addEventListener('error', () => {
            if (mounted) {
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
