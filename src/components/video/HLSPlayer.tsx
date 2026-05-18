'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';

interface HLSPlayerProps {
  vehicleId: string;
  channel: number;
  vehicleName?: string;
  onStop?: () => void;
  fallbackVehicleIds?: string[];
}

// Stability mode: allow older frames (up to ~15s) to avoid constant reconnect churn.
const PREVIEW_WAIT_MS = 1800;
const PREVIEW_MAX_AGE_MS = 15000;
const PREVIEW_RETRY_DELAY_MS = 3500;
const MJPEG_FIRST_FRAME_DEADLINE_MS = 15000;
const START_LIVE_THROTTLE_MS = 45000;

function normalizeVehicleAlias(value: string) {
  const trimmed = String(value || '').trim();
  if (!/^\d+$/.test(trimmed)) return trimmed;
  if (trimmed.startsWith('862') && trimmed.length > 12) {
    return trimmed.slice(3);
  }
  return trimmed;
}

export default function HLSPlayer({
  vehicleId,
  channel,
  vehicleName,
  onStop,
  fallbackVehicleIds = [],
}: HLSPlayerProps) {
  const lastStartRequestAtRef = useRef<Map<string, number>>(new Map());
  const previewImgRef = useRef<HTMLImageElement | null>(null);

  const [status, setStatus] = useState('Connecting live preview...');
  const [error, setError] = useState(false);
  const [reloadToken, setReloadToken] = useState(() => Date.now());
  const [mjpegAttached, setMjpegAttached] = useState(false);
  const [mjpegReady, setMjpegReady] = useState(false);
  const [candidateIndex, setCandidateIndex] = useState(0);
  const [frozenFrameUrl, setFrozenFrameUrl] = useState('');
  const [showFrozenFrame, setShowFrozenFrame] = useState(false);

  const streamStartCandidates = useMemo(() => {
    const ordered = [vehicleId, ...fallbackVehicleIds]
      .map((value) => String(value || '').trim())
      .filter(Boolean);
    const candidates: string[] = [];
    const seen = new Set<string>();

    for (const id of ordered) {
      const alias = normalizeVehicleAlias(id);
      if (seen.has(id) || (alias && alias !== id && seen.has(alias))) {
        continue;
      }
      candidates.push(id);
      seen.add(id);
      if (alias && alias !== id && !seen.has(alias)) {
        candidates.push(alias);
        seen.add(alias);
      }
    }

    return candidates;
  }, [vehicleId, fallbackVehicleIds.map((value) => String(value || '').trim()).join('|')]);

  const fallbackKey = useMemo(
    () => streamStartCandidates.filter((value, index, values) => values.indexOf(value) === index).join(','),
    [streamStartCandidates]
  );

  const activeCandidateId = useMemo(() => {
    return streamStartCandidates[candidateIndex] || vehicleId;
  }, [candidateIndex, streamStartCandidates, vehicleId]);

  useEffect(() => {
    setCandidateIndex(0);
  }, [fallbackKey, vehicleId, channel]);

  const mjpegUrl = useMemo(() => {
    const params = new URLSearchParams({
      channel: String(channel),
      waitMs: String(PREVIEW_WAIT_MS),
      maxAgeMs: String(PREVIEW_MAX_AGE_MS),
      autoStart: 'true',
      videoOnly: 'true',
      input: 'auto',
      fps: '8',
      _ts: String(reloadToken),
    });
    return `/api/video-server/vehicles/${encodeURIComponent(activeCandidateId)}/live.mjpeg?${params.toString()}`;
  }, [activeCandidateId, channel, reloadToken]);

  const startLive = useMemo(
    () => async () => {
      const startKey = `${vehicleId}:${channel}:${fallbackKey}`;
      const now = Date.now();
      const last = lastStartRequestAtRef.current.get(startKey) || 0;
      if (now - last < START_LIVE_THROTTLE_MS) {
        return;
      }
      lastStartRequestAtRef.current.set(startKey, now);

      for (const candidateId of streamStartCandidates) {
        try {
          const listenerResponse = await fetch(
            `/api/video-server/vehicles/${encodeURIComponent(candidateId)}/start-live`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ channel }),
            }
          );
          if (listenerResponse.ok) {
            return;
          }
        } catch {
          // Try the next candidate.
        }
      }
    },
    [channel, fallbackKey, streamStartCandidates, vehicleId]
  );

  const tryNextCandidate = useCallback(
    (nextStatus: string) => {
      const nextIndex = candidateIndex + 1;
      if (nextIndex >= streamStartCandidates.length) {
        return false;
      }
      setCandidateIndex(nextIndex);
      setStatus(nextStatus);
      setMjpegAttached(false);
      setMjpegReady(false);
      setError(false);
      return true;
    },
    [candidateIndex, streamStartCandidates.length]
  );

  const captureFreezeFrame = useCallback((source?: HTMLImageElement | null): boolean => {
    const image = source || previewImgRef.current;
    if (!image) return false;
    const rawWidth = image.naturalWidth || image.clientWidth || 0;
    const rawHeight = image.naturalHeight || image.clientHeight || 0;
    if (rawWidth <= 1 || rawHeight <= 1) return false;

    const maxWidth = 960;
    const scale = rawWidth > maxWidth ? maxWidth / rawWidth : 1;
    const width = Math.max(1, Math.round(rawWidth * scale));
    const height = Math.max(1, Math.round(rawHeight * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return false;

    try {
      ctx.drawImage(image, 0, 0, width, height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.68);
      if (!dataUrl.startsWith('data:image/')) return false;
      setFrozenFrameUrl((prev) => (prev === dataUrl ? prev : dataUrl));
      return true;
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    setError(false);
    setStatus('Starting listener stream...');
    setMjpegAttached(false);
    setMjpegReady(false);

    void (async () => {
      await startLive();
      if (cancelled) return;

      setStatus('Connecting live stream...');
      setMjpegAttached(true);
      setMjpegReady(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [activeCandidateId, channel, mjpegUrl, startLive]);

  useEffect(() => {
    if (!mjpegAttached || mjpegReady) return;
    const timer = setTimeout(() => {
      if (tryNextCandidate('No live frames yet, trying alternate id...')) {
        return;
      }
      setStatus('No live frames yet, retrying stream...');
      setError(true);
    }, MJPEG_FIRST_FRAME_DEADLINE_MS);
    return () => clearTimeout(timer);
  }, [mjpegAttached, mjpegReady, tryNextCandidate]);

  useEffect(() => {
    if (!mjpegReady) return;
    const timer = setInterval(() => {
      void captureFreezeFrame();
    }, 1200);
    return () => clearInterval(timer);
  }, [captureFreezeFrame, mjpegReady]);

  const handleMjpegLoaded = () => {
    setStatus('Streaming live');
    setMjpegReady(true);
    setError(false);
    setShowFrozenFrame(false);
    void captureFreezeFrame(previewImgRef.current);
  };

  const handleMjpegError = () => {
    void captureFreezeFrame(previewImgRef.current);
    setShowFrozenFrame(true);
    setMjpegReady(false);
    setMjpegAttached(false);
    if (tryNextCandidate('Trying alternate listener stream id...')) {
      return;
    }
    setStatus('Waiting for frame... showing last frame');
    setError(true);
  };

  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(() => {
      setError(false);
      setMjpegAttached(false);
      setStatus('Reconnecting live stream...');
      setReloadToken((value) => value + 1);
      void startLive();
    }, PREVIEW_RETRY_DELAY_MS);
    return () => clearTimeout(timer);
  }, [error, startLive]);

  const isStreaming = !error && status.startsWith('Streaming');
  const hasFrozenFrame = showFrozenFrame && !!frozenFrameUrl;

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
        {hasFrozenFrame && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={frozenFrameUrl}
            alt={`${vehicleName || vehicleId} CH${channel} last frame`}
            className="absolute inset-0 z-0 h-full w-full object-cover bg-black"
          />
        )}

        {mjpegAttached ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            ref={previewImgRef}
            src={mjpegUrl}
            alt={`${vehicleName || vehicleId} CH${channel} live preview`}
            className={`relative z-10 w-full h-full object-cover bg-black ${error ? 'hidden' : 'block'}`}
            onLoad={handleMjpegLoaded}
            onError={handleMjpegError}
          />
        ) : null
        }

        {error && !hasFrozenFrame && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center text-slate-400">
              <AlertCircle className="w-12 h-12 mx-auto mb-2" />
              <p className="text-sm">Live preview unavailable</p>
              <p className="text-xs mt-1">Vehicle may be offline or not sending decodable frames</p>
            </div>
          </div>
        )}

        {!error && !isStreaming && !hasFrozenFrame && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center text-slate-400">
              <Loader2 className="w-12 h-12 mx-auto mb-2 animate-spin" />
              <p className="text-sm">{status}</p>
            </div>
          </div>
        )}

        {hasFrozenFrame && (
          <div className="absolute left-2 top-2 z-20 rounded bg-slate-950/75 px-2 py-1 text-[10px] text-amber-300">
            Waiting for frame... showing last frame
          </div>
        )}
      </div>
      <div className="text-xs text-gray-400 mt-2 font-mono">
        Live MJPEG | CH {channel}
      </div>
    </div>
  );
}
