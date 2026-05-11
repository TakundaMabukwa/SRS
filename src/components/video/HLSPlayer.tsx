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

const PREVIEW_WAIT_MS = 1200;
const PREVIEW_MAX_AGE_MS = 12000;
const PREVIEW_READY_TIMEOUT_MS = 3500;
const PREVIEW_READY_POLL_MS = 450;
const PREVIEW_RETRY_DELAY_MS = 1800;
const MJPEG_FIRST_FRAME_DEADLINE_MS = 3200;
const MJPEG_RECOVERY_RETRY_MS = 5000;
const SCREENSHOT_MAX_AGE_MS = 120000;
const SCREENSHOT_REFRESH_MS = 2500;
const START_LIVE_THROTTLE_MS = 6000;

type PreviewMode = 'mjpeg' | 'screenshot';

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
  const [reloadToken, setReloadToken] = useState(0);
  const [mode, setMode] = useState<PreviewMode>('mjpeg');
  const [snapshotUrl, setSnapshotUrl] = useState('');
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
  }, [vehicleId, fallbackVehicleIds]);

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
      _ts: String(reloadToken || Date.now()),
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
      setMode('mjpeg');
      setStatus(nextStatus);
      setMjpegAttached(false);
      setError(false);
      return true;
    },
    [candidateIndex, streamStartCandidates.length]
  );

  const waitForReady = useCallback(
    async (candidateId: string) => {
      const deadline = Date.now() + PREVIEW_READY_TIMEOUT_MS;
      while (Date.now() < deadline) {
        try {
          const url = `/api/video-server/live/ready?sim=${encodeURIComponent(candidateId)}&channel=${channel}&maxAgeMs=${PREVIEW_MAX_AGE_MS}`;
          const response = await fetch(url, { cache: 'no-store' });
          if (response.ok) {
            const payload = await response.json().catch(() => ({}));
            if (payload?.ready === true) {
              return true;
            }
          }
        } catch {
          // Keep polling until timeout.
        }
        await new Promise((resolve) => setTimeout(resolve, PREVIEW_READY_POLL_MS));
      }
      return false;
    },
    [channel]
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
    setMode('mjpeg');
    setError(false);
    setStatus('Starting listener stream...');
    setSnapshotUrl('');
    setMjpegAttached(false);
    setMjpegReady(false);

    void (async () => {
      await startLive();
      if (cancelled) return;

      setStatus('Waiting for live frames...');
      const ready = await waitForReady(activeCandidateId);
      if (cancelled) return;

      setMjpegAttached(true);
      setMjpegReady(false);
      if (ready) {
        setStatus('Stream ready, connecting...');
      } else {
        setStatus('Connecting stream (fallback if delayed)...');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeCandidateId, channel, mjpegUrl, startLive, tryNextCandidate, waitForReady]);

  useEffect(() => {
    if (mode !== 'mjpeg' || !mjpegAttached || mjpegReady) return;
    const timer = setTimeout(() => {
      if (tryNextCandidate('No live frames yet, trying alternate id...')) {
        return;
      }
      setMode('screenshot');
      setStatus('No live frames yet, using snapshots...');
      setError(false);
    }, MJPEG_FIRST_FRAME_DEADLINE_MS);
    return () => clearTimeout(timer);
  }, [mjpegAttached, mjpegReady, mode, tryNextCandidate]);

  useEffect(() => {
    if (mode !== 'mjpeg' || !mjpegReady) return;
    const timer = setInterval(() => {
      void captureFreezeFrame();
    }, 1200);
    return () => clearInterval(timer);
  }, [captureFreezeFrame, mjpegReady, mode]);

  useEffect(() => {
    if (mode !== 'screenshot') return;

    const buildSnapshotUrl = () => {
      const params = new URLSearchParams({
        channel: String(channel),
        maxAgeMs: String(SCREENSHOT_MAX_AGE_MS),
        _ts: String(Date.now()),
      });
      return `/api/video-server/vehicles/${encodeURIComponent(activeCandidateId)}/screenshot?${params.toString()}`;
    };

    setSnapshotUrl(buildSnapshotUrl());
    const timer = setInterval(() => {
      setSnapshotUrl(buildSnapshotUrl());
    }, SCREENSHOT_REFRESH_MS);

    return () => clearInterval(timer);
  }, [activeCandidateId, channel, mode]);

  useEffect(() => {
    if (mode !== 'screenshot') return;
    const retryTimer = setInterval(() => {
      setMjpegReady(false);
      setMjpegAttached(true);
      setMode('mjpeg');
      setStatus('Retrying live stream...');
      setReloadToken((value) => value + 1);
      void startLive();
    }, MJPEG_RECOVERY_RETRY_MS);

    return () => clearInterval(retryTimer);
  }, [mode, startLive]);

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
    setMode('screenshot');
    setStatus('MJPEG unavailable, using snapshots...');
    setError(false);
  };

  const handleSnapshotLoaded = () => {
    setStatus('Streaming snapshots');
    setError(false);
    setShowFrozenFrame(false);
    void captureFreezeFrame(previewImgRef.current);
  };

  const handleSnapshotError = () => {
    void captureFreezeFrame(previewImgRef.current);
    setShowFrozenFrame(true);
    if (tryNextCandidate('Retrying listener stream with alternate id...')) {
      return;
    }
    setStatus('Connection unstable, showing last frame...');
    setError(true);
  };

  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(() => {
      setError(false);
      setMode('mjpeg');
      setMjpegAttached(false);
      setStatus('Retrying listener live preview...');
      setReloadToken((value) => value + 1);
      void startLive();
    }, PREVIEW_RETRY_DELAY_MS);
    return () => clearTimeout(timer);
  }, [error, startLive]);

  const isStreaming = !error && (status.startsWith('Streaming') || status.includes('using snapshots'));
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

        {mode === 'mjpeg' && mjpegAttached ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            ref={previewImgRef}
            src={mjpegUrl}
            alt={`${vehicleName || vehicleId} CH${channel} live preview`}
            className={`relative z-10 w-full h-full object-cover bg-black ${error ? 'hidden' : 'block'}`}
            onLoad={handleMjpegLoaded}
            onError={handleMjpegError}
          />
        ) : mode === 'screenshot' && snapshotUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            ref={previewImgRef}
            src={snapshotUrl}
            alt={`${vehicleName || vehicleId} CH${channel} live snapshot`}
            className={`relative z-10 w-full h-full object-cover bg-black ${error ? 'hidden' : 'block'}`}
            onLoad={handleSnapshotLoaded}
            onError={handleSnapshotError}
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

        {!error && !isStreaming && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center text-slate-400">
              <Loader2 className="w-12 h-12 mx-auto mb-2 animate-spin" />
              <p className="text-sm">{status}</p>
            </div>
          </div>
        )}

        {hasFrozenFrame && (
          <div className="absolute left-2 top-2 z-20 rounded bg-slate-950/75 px-2 py-1 text-[10px] text-amber-300">
            Reconnecting... showing last frame
          </div>
        )}
      </div>
      <div className="text-xs text-gray-400 mt-2 font-mono">
        {mode === 'mjpeg' ? 'Live MJPEG | CH ' : 'Live snapshot fallback | CH '}
        {channel}
      </div>
    </div>
  );
}
