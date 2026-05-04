'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';

interface HLSPlayerProps {
  vehicleId: string;
  channel: number;
  vehicleName?: string;
  onStop?: () => void;
  fallbackVehicleIds?: string[];
}

const PREVIEW_WAIT_MS = 2500;
const PREVIEW_MAX_AGE_MS = 15000;
const PREVIEW_CONNECT_TIMEOUT_MS = 12000;
const PREVIEW_RETRY_DELAY_MS = 3000;
const SCREENSHOT_MAX_AGE_MS = 120000;
const SCREENSHOT_REFRESH_MS = 2500;
const START_LIVE_THROTTLE_MS = 12000;

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
  const connectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [status, setStatus] = useState('Connecting live preview...');
  const [error, setError] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const [mode, setMode] = useState<PreviewMode>('mjpeg');
  const [snapshotUrl, setSnapshotUrl] = useState('');

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
    () =>
      streamStartCandidates
        .filter((value, index, values) => values.indexOf(value) === index)
        .join(','),
    [streamStartCandidates]
  );

  const mjpegUrl = useMemo(() => {
    const params = new URLSearchParams({
      channel: String(channel),
      waitMs: String(PREVIEW_WAIT_MS),
      maxAgeMs: String(PREVIEW_MAX_AGE_MS),
      _ts: String(reloadToken || Date.now()),
    });
    if (fallbackKey) {
      params.set('fallbackIds', fallbackKey);
    }
    return `/api/live-preview/vehicles/${encodeURIComponent(vehicleId)}/live.mjpeg?${params.toString()}`;
  }, [channel, fallbackKey, reloadToken, vehicleId]);

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
          // Try the next id.
        }
      }
    },
    [channel, fallbackKey, streamStartCandidates, vehicleId]
  );

  useEffect(() => {
    setMode('mjpeg');
    setError(false);
    setStatus('Connecting live preview...');
    setSnapshotUrl('');
    void startLive();

    if (connectTimeoutRef.current) {
      clearTimeout(connectTimeoutRef.current);
    }
    connectTimeoutRef.current = setTimeout(() => {
      setMode('screenshot');
      setStatus('Switching to snapshot preview...');
      setError(false);
    }, PREVIEW_CONNECT_TIMEOUT_MS);

    return () => {
      if (connectTimeoutRef.current) {
        clearTimeout(connectTimeoutRef.current);
        connectTimeoutRef.current = null;
      }
    };
  }, [mjpegUrl, startLive]);

  useEffect(() => {
    if (mode !== 'screenshot') return;

    const buildSnapshotUrl = () => {
      const params = new URLSearchParams({
        channel: String(channel),
        maxAgeMs: String(SCREENSHOT_MAX_AGE_MS),
        _ts: String(Date.now()),
      });
      if (fallbackKey) {
        params.set('fallbackIds', fallbackKey);
      }
      return `/api/live-preview/vehicles/${encodeURIComponent(vehicleId)}/screenshot?${params.toString()}`;
    };

    setSnapshotUrl(buildSnapshotUrl());
    const timer = setInterval(() => {
      setSnapshotUrl(buildSnapshotUrl());
    }, SCREENSHOT_REFRESH_MS);

    return () => clearInterval(timer);
  }, [mode, channel, fallbackKey, vehicleId]);

  const handleMjpegLoaded = () => {
    if (connectTimeoutRef.current) {
      clearTimeout(connectTimeoutRef.current);
      connectTimeoutRef.current = null;
    }
    setStatus('Streaming (preview)');
    setError(false);
  };

  const handleMjpegError = () => {
    if (connectTimeoutRef.current) {
      clearTimeout(connectTimeoutRef.current);
      connectTimeoutRef.current = null;
    }
    setMode('screenshot');
    setStatus('MJPEG unavailable, using snapshots...');
    setError(false);
  };

  const handleSnapshotLoaded = () => {
    setStatus('Streaming (snapshots)');
    setError(false);
  };

  const handleSnapshotError = () => {
    setStatus('Live preview unavailable');
    setError(true);
  };

  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(() => {
      setError(false);
      setStatus('Retrying live preview...');
      setReloadToken((value) => value + 1);
    }, PREVIEW_RETRY_DELAY_MS);
    return () => clearTimeout(timer);
  }, [error]);

  const isStreaming = !error && (status.startsWith('Streaming') || status.includes('using snapshots'));

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
        {mode === 'mjpeg' ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={mjpegUrl}
            alt={`${vehicleName || vehicleId} CH${channel} live preview`}
            className={`w-full h-full object-cover bg-black ${error ? 'hidden' : 'block'}`}
            onLoad={handleMjpegLoaded}
            onError={handleMjpegError}
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={snapshotUrl}
            alt={`${vehicleName || vehicleId} CH${channel} live snapshot`}
            className={`w-full h-full object-cover bg-black ${error ? 'hidden' : 'block'}`}
            onLoad={handleSnapshotLoaded}
            onError={handleSnapshotError}
          />
        )}

        {error && (
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
      </div>
      <div className="text-xs text-gray-400 mt-2 font-mono">
        {mode === 'mjpeg' ? 'MJPEG live preview | CH ' : 'Snapshot live preview | CH '}
        {channel}
      </div>
    </div>
  );
}
