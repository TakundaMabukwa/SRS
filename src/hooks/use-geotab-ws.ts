'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { getGeotabWsUrl } from '@/lib/utils';

type ZoneBreach = {
  id: number;
  deviceId: string;
  fleetNumber: string;
  licensePlate: string;
  zoneId: string;
  zoneName: string;
  riskLevel: string;
  latitude: number;
  longitude: number;
  speed: number;
  entryTime: string;
};

type WsMessage = {
  type: string;
  data: any;
  timestamp: string;
};

const WS_URL = typeof window !== 'undefined' ? getGeotabWsUrl() : '';

export function useGeotabWs() {
  const [zoneBreaches, setZoneBreaches] = useState<ZoneBreach[]>([]);
  const [newEvents, setNewEvents] = useState<any[]>([]);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    try {
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        console.log('[WS] Connected');
      };

      ws.onmessage = (event) => {
        try {
          const msg: WsMessage = JSON.parse(event.data);
          switch (msg.type) {
            case 'zone_breach':
              setZoneBreaches((prev) => {
                // Keep max 20, newest first
                const next = [msg.data as ZoneBreach, ...prev];
                return next.slice(0, 20);
              });
              break;
            case 'new_event':
              setNewEvents((prev) => {
                const next = [msg.data, ...prev];
                return next.slice(0, 50);
              });
              break;
          }
        } catch {}
      };

      ws.onclose = () => {
        setConnected(false);
        wsRef.current = null;
        // Reconnect after 5s
        reconnectRef.current = setTimeout(connect, 5000);
      };

      ws.onerror = () => {
        ws.close();
      };
    } catch {}
  }, []);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      if (wsRef.current) wsRef.current.close();
    };
  }, [connect]);

  const dismissBreach = useCallback((id: number) => {
    setZoneBreaches((prev) => prev.filter((b) => b.id !== id));
  }, []);

  const clearEvents = useCallback(() => {
    setNewEvents([]);
  }, []);

  return { zoneBreaches, newEvents, connected, dismissBreach, clearEvents };
}
