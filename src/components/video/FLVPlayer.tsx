'use client';

import { useRef, useEffect, useState } from 'react';
import flvjs from 'flv.js';

interface FLVPlayerProps {
  streamUrl: string;
  channel: number;
  vehicleName: string;
  onStop?: () => void;
}

export default function FLVPlayer({ streamUrl, channel, vehicleName, onStop }: FLVPlayerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const playerRef = useRef<any>(null);
  const reconnectRef = useRef(0);
  const pingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const destroyedRef = useRef(false);
  const [status, setStatus] = useState('Connecting...');
  const [error, setError] = useState(false);
  const [videoPlaying, setVideoPlaying] = useState(false);

  useEffect(() => {
    if (!videoRef.current || !streamUrl || !flvjs.isSupported()) {
      if (!flvjs.isSupported()) setStatus('FLV not supported');
      return;
    }

    destroyedRef.current = false;
    reconnectRef.current = 0;
    setVideoPlaying(false);
    setError(false);
    setStatus('Connecting...');
    const maxReconnects = 5;

    const onVideoPlaying = () => {
      if (destroyedRef.current) return;
      setVideoPlaying(true);
      setStatus('Streaming live');
      setError(false);
      reconnectRef.current = 0;
    };
    const onVideoTimeUpdate = () => {
      if (destroyedRef.current) return;
      if (videoRef.current && videoRef.current.currentTime > 0 && !videoPlaying) {
        setVideoPlaying(true);
        setStatus('Streaming live');
        setError(false);
        reconnectRef.current = 0;
      }
    };
    const videoEl = videoRef.current;
    videoEl.addEventListener('playing', onVideoPlaying);
    videoEl.addEventListener('timeupdate', onVideoTimeUpdate);

    function connect() {
      if (destroyedRef.current || !videoRef.current) return;

      destroyPlayer();

      const proxyUrl = `/api/video-server/stream/stream/proxy?url=${encodeURIComponent(streamUrl)}`;

      try {
        const player = flvjs.createPlayer({
          type: 'flv',
          url: proxyUrl,
          isLive: true,
          hasAudio: false,
          enableStashBuffer: false,
          stashInitialSize: 128,
        });

        player.attachMediaElement(videoRef.current);
        playerRef.current = player;

        player.on(flvjs.Events.ERROR, () => {
          if (destroyedRef.current) return;
          setError(true);
          setStatus('Stream error');
          if (reconnectRef.current < maxReconnects) {
            reconnectRef.current++;
            setTimeout(connect, 2000 * reconnectRef.current);
          }
        });

        player.on(flvjs.Events.LOADING_COMPLETE, () => {
          if (!destroyedRef.current) reconnectRef.current = 0;
        });

        player.load();
        player.play().catch(() => {});
      } catch (e) {
        if (destroyedRef.current) return;
        setError(true);
        setStatus('Player error');
        if (reconnectRef.current < maxReconnects) {
          reconnectRef.current++;
          setTimeout(connect, 3000);
        }
      }
    }

    function destroyPlayer() {
      if (playerRef.current) {
        try {
          playerRef.current.pause();
          playerRef.current.unload();
          playerRef.current.detachMediaElement();
          playerRef.current.destroy();
        } catch (e) {}
        playerRef.current = null;
      }
    }

    connect();

    pingRef.current = setInterval(() => {
      if (destroyedRef.current) return;
      if (playerRef.current && videoRef.current && videoRef.current.paused) {
        playerRef.current.play().catch(() => {});
      }
    }, 10000);

    return () => {
      destroyedRef.current = true;
      if (videoEl) {
        videoEl.removeEventListener('playing', onVideoPlaying);
        videoEl.removeEventListener('timeupdate', onVideoTimeUpdate);
      }
      if (pingRef.current) clearInterval(pingRef.current);
      destroyPlayer();
    };
  }, [streamUrl]);

  const isStreaming = !error && videoPlaying;

  return (
    <div className="bg-slate-800 rounded-lg p-4 shadow-lg">
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-teal-400 font-bold text-sm">{vehicleName}</h3>
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
          className="w-full h-full object-contain"
          muted
          playsInline
          autoPlay
        />
        {!isStreaming && !error && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80">
            <div className="text-center text-slate-400">
              <div className="w-8 h-8 border-2 border-slate-500 border-t-cyan-400 rounded-full animate-spin mx-auto mb-2" />
              <p className="text-sm">{status}</p>
            </div>
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80">
            <div className="text-center text-slate-400">
              <p className="text-sm">{status}</p>
            </div>
          </div>
        )}
      </div>
      <div className="text-xs text-gray-400 mt-2 font-mono">
        FLV Live | CH {channel}
      </div>
    </div>
  );
}
