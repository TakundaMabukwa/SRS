'use client';

import { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import { AlertCircle, Loader2 } from 'lucide-react';

interface HLSPlayerProps {
  vehicleId: string;
  channel: number;
  vehicleName?: string;
}

export default function HLSPlayer({ vehicleId, channel, vehicleName }: HLSPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [status, setStatus] = useState('Starting stream...');
  const [stats, setStats] = useState('');
  const [error, setError] = useState(false);

  useEffect(() => {
    let mounted = true;

    const startAndPlayStream = async () => {
      try {
        // Step 1: Start the stream on video server
        setStatus('Starting stream...');
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

        // Step 2: Wait for FFmpeg to generate HLS files
        setStatus('Initializing...');
        await new Promise(resolve => setTimeout(resolve, 3000));

        if (!mounted) return;

        // Step 3: Load HLS stream
        const video = videoRef.current;
        if (!video) return;

        const hlsUrl = `/api/hls-proxy/${vehicleId}/channel_${channel}/playlist.m3u8`;
        console.log('[HLS Player] Loading:', hlsUrl);

        if (Hls.isSupported()) {
          const hls = new Hls({
            enableWorker: true,
            lowLatencyMode: true,
            backBufferLength: 90,
            maxLoadingDelay: 4,
            maxBufferLength: 30,
          });

          hls.loadSource(hlsUrl);
          hls.attachMedia(video);

          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            console.log('[HLS Player] Manifest parsed successfully');
            if (!mounted) return;
            setStatus('Streaming');
            setError(false);
            video.play().catch(e => console.warn('Autoplay blocked:', e));
          });

          hls.on(Hls.Events.ERROR, (event, data) => {
            console.error('[HLS Player] Error:', data.type, data.details, data.fatal);
            if (data.fatal && mounted) {
              if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
                console.log('[HLS Player] Network error, retrying...');
                setTimeout(() => hls.loadSource(hlsUrl), 2000);
              } else {
                setStatus('Stream Unavailable');
                setError(true);
              }
            }
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
      mounted = false;
      hlsRef.current?.destroy();
    };
  }, [vehicleId, channel]);

  return (
    <div className="bg-slate-800 rounded-lg p-4 shadow-lg">
      <div className="flex justify-between mb-2">
        <h3 className="text-teal-400 font-bold">📹 {vehicleName || vehicleId} - Ch {channel}</h3>
        <span className={status === 'Streaming' ? 'text-green-400' : error ? 'text-red-400' : 'text-yellow-400'}>
          {status}
        </span>
      </div>
      {error ? (
        <div className="w-full aspect-video bg-slate-900 rounded flex items-center justify-center">
          <div className="text-center text-slate-400">
            <AlertCircle className="w-12 h-12 mx-auto mb-2" />
            <p className="text-sm">Stream not available</p>
            <p className="text-xs mt-1">Vehicle may be offline</p>
          </div>
        </div>
      ) : status !== 'Streaming' ? (
        <div className="w-full aspect-video bg-slate-900 rounded flex items-center justify-center">
          <div className="text-center text-slate-400">
            <Loader2 className="w-12 h-12 mx-auto mb-2 animate-spin" />
            <p className="text-sm">{status}</p>
          </div>
        </div>
      ) : (
        <video
          ref={videoRef}
          controls
          autoPlay
          muted
          playsInline
          className="w-full bg-black rounded"
        />
      )}
      <div className="text-xs text-gray-400 mt-2 font-mono">{stats}</div>
    </div>
  );
}
