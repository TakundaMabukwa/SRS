/* eslint-disable @next/next/no-img-element */
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';

interface HLSPlayerProps {
  vehicleId: string;
  channel: number;
  vehicleName?: string;
  onStop?: () => void;
  fallbackVehicleIds?: string[];
}

const LIVE_WARM_MAX_AGE_MS = 20000;
const START_LIVE_TIMEOUT_MS = 7000;
const START_LIVE_COOLDOWN_MS = 12000;
const START_LIVE_REQUESTS = new Map<string, Promise<boolean>>();
const START_LIVE_COOLDOWNS = new Map<string, number>();

export default function HLSPlayer({
  vehicleId,
  channel,
  vehicleName,
  onStop,
  fallbackVehicleIds = [],
}: HLSPlayerProps) {
  const [status, setStatus] = useState('Connecting live preview...');
  const [error, setError] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  const candidateVehicleIds = useMemo(
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

  const fallbackKey = useMemo(() => candidateVehicleIds.join(','), [candidateVehicleIds]);

  const startLiveRequestKey = useMemo(
    () => `${candidateVehicleIds.join('|')}::${channel}`,
    [candidateVehicleIds, channel]
  );

  const requestStartLive = useCallback(async () => {
    const now = Date.now();
    const cooldownUntil = START_LIVE_COOLDOWNS.get(startLiveRequestKey) || 0;
    if (now < cooldownUntil) {
      return false;
    }

    const inflight = START_LIVE_REQUESTS.get(startLiveRequestKey);
    if (inflight) {
      return inflight;
    }

    const request = (async () => {
      for (const candidateId of candidateVehicleIds) {
        try {
          const response = await fetch(
            `/api/video-server/vehicles/${encodeURIComponent(candidateId)}/start-live`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ channel }),
              signal: AbortSignal.timeout(START_LIVE_TIMEOUT_MS),
            }
          );

          if (response.ok) {
            return true;
          }
        } catch {
          // Keep trying other candidate ids.
        }
      }

      START_LIVE_COOLDOWNS.set(startLiveRequestKey, Date.now() + START_LIVE_COOLDOWN_MS);
      return false;
    })().finally(() => {
      START_LIVE_REQUESTS.delete(startLiveRequestKey);
    });

    START_LIVE_REQUESTS.set(startLiveRequestKey, request);
    return request;
  }, [candidateVehicleIds, channel, startLiveRequestKey]);

  const streamUrl = useMemo(() => {
    const params = new URLSearchParams({
      channel: String(channel),
      waitMs: '2500',
      maxAgeMs: String(LIVE_WARM_MAX_AGE_MS),
      _ts: String(reloadToken || Date.now()),
    });
    if (fallbackKey) {
      params.set('fallbackIds', fallbackKey);
    }
    return `/api/live-preview/vehicles/${encodeURIComponent(vehicleId)}/live.mjpeg?${params.toString()}`;
  }, [channel, fallbackKey, reloadToken, vehicleId]);

  useEffect(() => {
    setStatus('Connecting live preview...');
    setError(false);
  }, [vehicleId, channel, fallbackKey, reloadToken]);

  useEffect(() => {
    let cancelled = false;

    const bootStream = async () => {
      setStatus('Starting stream...');
      await requestStartLive();
      if (cancelled) return;
      setStatus('Connecting live preview...');
      setReloadToken((value) => value + 1);
    };

    void bootStream();

    return () => {
      cancelled = true;
    };
  }, [vehicleId, channel, fallbackKey, requestStartLive]);

  useEffect(() => {
    if (!error) {
      return;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      setStatus('Retrying live preview...');
      await requestStartLive();
      if (cancelled) return;
      setError(false);
      setReloadToken((value) => value + 1);
    }, 3000);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [error, requestStartLive]);

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
        <img
          key={streamUrl}
          src={streamUrl}
          alt={vehicleName || `${vehicleId} channel ${channel}`}
          className={`w-full h-full object-cover bg-black ${error ? 'hidden' : 'block'}`}
          onLoad={() => {
            setStatus('Streaming');
            setError(false);
          }}
          onError={() => {
            setStatus('Live preview unavailable');
            setError(true);
          }}
        />
        {error && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center text-slate-400">
              <AlertCircle className="w-12 h-12 mx-auto mb-2" />
              <p className="text-sm">Live preview unavailable</p>
              <p className="text-xs mt-1">Vehicle may be offline or channel idle</p>
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
        MJPEG live preview | CH {channel}
      </div>
    </div>
  );
}
