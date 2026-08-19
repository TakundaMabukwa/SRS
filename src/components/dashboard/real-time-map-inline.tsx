'use client';
import React, { useEffect, useState, useRef } from 'react';
import { useGoogleMaps } from '@/hooks/use-google-maps';

type Zone = {
  id: string;
  name: string;
  points: string | { x: number; y: number }[];
  is_high_risk: boolean;
  is_no_go: boolean;
};

function parseZonePoints(raw: string | { x: number; y: number }[] | undefined): { x: number; y: number }[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  try { return JSON.parse(raw); } catch { return []; }
}

type LogRecord = {
  latitude: number;
  longitude: number;
  speed: number | null;
  record_time: string;
};

type TelematicsEvent = {
  id: number;
  deviceId: string;
  fleetNumber: string;
  licensePlate: string;
  eventType: string;
  eventCode: string;
  severity: string;
  latitude: number | null;
  longitude: number | null;
  speed: number | null;
  distance: number | null;
  durationSeconds: number | null;
  driverName: string | null;
  address: string | null;
  eventTime: string;
};

type Props = {
  deviceId: string;
  alertLat: number;
  alertLon: number;
  alertTime?: string;
};

const EPS = '/api/video-server';

function normalizeEvent(raw: any): TelematicsEvent {
  return {
    id: raw?.id ?? raw?.ID ?? 0,
    deviceId: raw?.device_id ?? raw?.deviceId ?? '',
    fleetNumber: raw?.fleet_number ?? raw?.fleetNumber ?? '',
    licensePlate: raw?.license_plate ?? raw?.licensePlate ?? '',
    eventType: raw?.event_type ?? raw?.eventType ?? 'Event',
    eventCode: raw?.event_code ?? raw?.eventCode ?? '',
    severity: raw?.severity ?? '',
    latitude: raw?.latitude ?? null,
    longitude: raw?.longitude ?? null,
    speed: raw?.speed ?? null,
    distance: raw?.distance ?? null,
    durationSeconds: raw?.duration_seconds ?? raw?.durationSeconds ?? null,
    driverName: raw?.driver_name ?? raw?.driverName ?? null,
    address: raw?.address ?? null,
    eventTime: raw?.event_time ?? raw?.eventTime ?? raw?.created_at ?? new Date().toISOString(),
  };
}

function getEventColor(eventType: string) {
  if (/speed/i.test(eventType)) return '#ef4444';
  if (/harsh|braking|cornering/i.test(eventType)) return '#f97316';
  return '#eab308';
}

export function RealTimeMapInline({ deviceId, alertLat, alertLon, alertTime }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const googleMapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const polygonsRef = useRef<google.maps.Polygon[]>([]);
  const polylineRef = useRef<google.maps.Polyline | null>(null);
  const { loaded: mapsLoaded, error: mapsError } = useGoogleMaps();

  const [zones, setZones] = useState<Zone[]>([]);
  const [path, setPath] = useState<LogRecord[]>([]);
  const [events, setEvents] = useState<TelematicsEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!deviceId) { setLoading(false); return; }
    let cancelled = false;
    const fetchData = async () => {
      try {
        setLoading(true);
        // ±15 min around alert time
        const center = alertTime ? new Date(alertTime).getTime() : Date.now();
        const from = new Date(center - 15 * 60 * 1000).toISOString();
        const to = new Date(center + 15 * 60 * 1000).toISOString();

        const [zonesRes, logsRes, eventsRes] = await Promise.all([
          fetch(`${EPS}/telematics/zones`, { cache: 'no-store' }),
          fetch(`${EPS}/telematics/log-records/${deviceId}?from=${from}&to=${to}`, { cache: 'no-store' }),
          fetch(`${EPS}/telematics/events/${deviceId}?from=${from}&to=${to}&limit=500`, { cache: 'no-store' }),
        ]);
        const zonesData = await zonesRes.json().catch(() => ({}));
        const logsData = await logsRes.json().catch(() => ({}));
        const eventsData = await eventsRes.json().catch(() => ({}));
        if (!cancelled) {
          if (zonesData?.data) setZones(zonesData.data.filter((z: Zone) => z.is_high_risk || z.is_no_go));
          if (logsData?.data) setPath(logsData.data);
          if (eventsData?.data) {
            setEvents(
              eventsData.data
                .filter((e: any) => e.latitude && e.longitude)
                .map(normalizeEvent)
            );
          }
        }
      } catch {} finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchData();
    return () => { cancelled = true; };
  }, [deviceId, alertTime]);

  useEffect(() => {
    if (!mapsLoaded || !mapRef.current || !window.google?.maps) return;

    const coords: { lat: number; lng: number }[] = [{ lat: alertLat, lng: alertLon }];
    path.forEach((p) => coords.push({ lat: p.latitude, lng: p.longitude }));
    events.forEach((e) => {
      if (e.latitude && e.longitude) coords.push({ lat: e.latitude, lng: e.longitude });
    });
    zones.forEach((z) => {
      parseZonePoints(z.points).forEach((p) => coords.push({ lat: p.y, lng: p.x }));
    });

    const center = {
      lat: coords.reduce((s, c) => s + c.lat, 0) / coords.length,
      lng: coords.reduce((s, c) => s + c.lng, 0) / coords.length,
    };

    if (!googleMapRef.current) {
      googleMapRef.current = new window.google.maps.Map(mapRef.current, {
        center,
        zoom: 15,
        mapTypeId: 'roadmap',
        mapTypeControl: false,
        fullscreenControl: false,
        streetViewControl: false,
      });
    } else {
      googleMapRef.current.setCenter(center);
    }

    const map = googleMapRef.current;

    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];
    polygonsRef.current.forEach((p) => p.setMap(null));
    polygonsRef.current = [];
    if (polylineRef.current) {
      polylineRef.current.setMap(null);
      polylineRef.current = null;
    }

    // High-risk / no-go zones as red polygons without labels
    zones.forEach((zone) => {
      const pts = parseZonePoints(zone.points);
      if (pts.length < 3) return;
      const color = zone.is_no_go ? '#dc2626' : '#ef4444';
      const polygon = new window.google.maps.Polygon({
        paths: pts.map((p) => ({ lat: p.y, lng: p.x })),
        strokeColor: color,
        strokeOpacity: 0.9,
        strokeWeight: 2,
        fillColor: color,
        fillOpacity: 0.18,
      });
      polygon.setMap(map);
      polygonsRef.current.push(polygon);
    });

    // Path
    if (path.length > 1) {
      polylineRef.current = new window.google.maps.Polyline({
        path: path.map((p) => ({ lat: p.latitude, lng: p.longitude })),
        geodesic: true,
        strokeColor: '#22d3ee',
        strokeOpacity: 0.9,
        strokeWeight: 3,
      });
      polylineRef.current.setMap(map);
    }

    // Telematics events
    events.forEach((evt) => {
      if (!evt.latitude || !evt.longitude) return;
      const isSpeeding = /speed/i.test(evt.eventType || evt.eventCode || '');
      const isHarsh = /harsh|braking|cornering/i.test(evt.eventType || evt.eventCode || '');
      const color = isSpeeding ? '#ef4444' : isHarsh ? '#f97316' : '#eab308';

      const marker = new window.google.maps.Marker({
        position: { lat: evt.latitude, lng: evt.longitude },
        map,
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          fillColor: color,
          fillOpacity: 1,
          strokeColor: '#0f172a',
          strokeWeight: 2,
          scale: 6,
        },
        title: evt.eventType,
      });
      markersRef.current.push(marker);

      const distText = evt.distance ? `${Number(evt.distance).toFixed(2)} km` : '';
      const durText = evt.durationSeconds ? `${Math.round(evt.durationSeconds / 60)} min` : '';
      const locationText = evt.address
        ? evt.address
        : `${Number(evt.latitude).toFixed(5)}, ${Number(evt.longitude).toFixed(5)}`;
      const infoWindow = new window.google.maps.InfoWindow({
        content: `
          <div style="font-size:12px;min-width:180px;">
            <div style="font-weight:600;margin-bottom:4px;">${evt.eventType}</div>
            <div style="color:#334155;"><strong>Time:</strong> ${new Date(evt.eventTime).toLocaleString()}</div>
            <div style="color:#334155;"><strong>Location:</strong> ${locationText}</div>
            ${distText ? `<div style="color:#334155;"><strong>Distance:</strong> ${distText}</div>` : ''}
            ${durText ? `<div style="color:#334155;"><strong>Duration:</strong> ${durText}</div>` : ''}
            ${evt.speed ? `<div style="color:#334155;"><strong>Speed:</strong> ${Math.round(evt.speed)} km/h</div>` : ''}
          </div>
        `,
      });
      marker.addListener('click', () => infoWindow.open(map, marker));
    });

    // Alert marker
    const alertMarker = new window.google.maps.Marker({
      position: { lat: alertLat, lng: alertLon },
      map,
      icon: {
        path: window.google.maps.SymbolPath.CIRCLE,
        fillColor: '#ef4444',
        fillOpacity: 1,
        strokeColor: '#0f172a',
        strokeWeight: 2,
        scale: 9,
      },
      title: 'Alert location',
    });
    markersRef.current.push(alertMarker);

    const alertInfo = new window.google.maps.InfoWindow({
      content: `
        <div style="font-size:12px;">
          <div style="font-weight:600;color:#ef4444;">Alert Location</div>
          <div style="color:#64748b;">${alertLat.toFixed(6)}, ${alertLon.toFixed(6)}</div>
          ${alertTime ? `<div style="color:#94a3b8;font-size:10px;">${new Date(alertTime).toLocaleString()}</div>` : ''}
        </div>
      `,
    });
    alertMarker.addListener('click', () => alertInfo.open(map, alertMarker));

    const bounds = new window.google.maps.LatLngBounds();
    coords.forEach((c) => bounds.extend(c));
    map.fitBounds(bounds, 40);
  }, [mapsLoaded, zones, path, events, alertLat, alertLon, alertTime]);

  if (mapsError) {
    return <div className="h-64 w-full rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-600">{mapsError}</div>;
  }

  return (
    <div className="space-y-2">
      <div className="relative h-80 w-full overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
        {!mapsLoaded || loading ? (
          <div className="flex h-full items-center justify-center text-sm text-slate-500">
            {mapsError ? mapsError : 'Loading map...'}
          </div>
        ) : null}
        <div ref={mapRef} className="h-full w-full" />
      </div>
      <div className="flex flex-wrap items-center gap-3 rounded-md border border-slate-200 bg-white px-3 py-2 text-[10px] text-slate-600">
        <span className="flex items-center gap-1"><span className="inline-block w-3 h-0.5 bg-cyan-400" /> Path</span>
        <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full bg-red-500" /> Speeding</span>
        <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full bg-orange-500" /> Harsh driving</span>
        <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full bg-yellow-500" /> Other event</span>
        <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full bg-red-600" /> Alert</span>
      </div>
      {events.length > 0 && (
        <div className="rounded-md border border-slate-200 bg-white p-3">
          <div className="mb-2 text-xs font-semibold text-slate-800">Events in window ({events.length})</div>
          <div className="max-h-40 overflow-y-auto space-y-1.5">
            {events.map((evt) => {
              const color = getEventColor(evt.eventType);
              return (
                <div key={evt.id} className="flex items-start gap-2 rounded border border-slate-100 bg-slate-50 p-2 text-[11px]">
                  <span className="mt-0.5 inline-block h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />
                  <div className="min-w-0">
                    <div className="font-medium text-slate-800">{evt.eventType}</div>
                    <div className="text-slate-500">{new Date(evt.eventTime).toLocaleString()}</div>
                    {evt.address ? (
                      <div className="truncate text-slate-500">{evt.address}</div>
                    ) : evt.latitude && evt.longitude ? (
                      <div className="text-slate-500">{Number(evt.latitude).toFixed(5)}, {Number(evt.longitude).toFixed(5)}</div>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
