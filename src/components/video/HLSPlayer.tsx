/* eslint-disable @next/next/no-img-element */
'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';

interface HLSPlayerProps {
  vehicleId: string;
  channel: number;
  vehicleName?: string;
  onStop?: () => void;
  fallbackVehicleIds?: string[];
}

const LIVE_WARM_MAX_AGE_MS = 20000;

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

  const fallbackKey = useMemo(
    () =>
      Array.from(
        new Set(
          fallbackVehicleIds
            .map((value) => String(value || '').trim())
            .filter(Boolean)
        )
      ).join(','),
    [fallbackVehicleIds]
  );

  const streamUrl = useMemo(() => {
    const params = new URLSearchParams({
      channel: String(channel),
      waitMs: '12000',
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
    if (!error) {
      return;
    }

    const timer = setTimeout(() => {
      setStatus('Retrying live preview...');
      setError(false);
      setReloadToken((value) => value + 1);
    }, 3000);

    return () => clearTimeout(timer);
  }, [error]);

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
