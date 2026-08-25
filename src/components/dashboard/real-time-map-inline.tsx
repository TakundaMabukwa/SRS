'use client';
import React, { useEffect, useState, useRef } from 'react';
import { Navigation } from 'lucide-react';
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
  zoneName: string | null;
};

type Props = {
  deviceId: string;
  alertLat: number;
  alertLon: number;
  alertTime?: string;
  policeStations?: Array<{ name: string; lat: number; lon: number; distance_km: number }>;
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
    zoneName: raw?.zone_name ?? raw?.zoneName ?? null,
  };
}

function getEventColor(eventType: string) {
  if (/speed/i.test(eventType)) return '#ef4444';
  if (/harsh|braking|cornering/i.test(eventType)) return '#f97316';
  return '#eab308';
}

export function RealTimeMapInline({ deviceId, alertLat, alertLon, alertTime, policeStations }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const googleMapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const polygonsRef = useRef<google.maps.Polygon[]>([]);
  const polylineRef = useRef<google.maps.Polyline | null>(null);
  const directionsRendererRef = useRef<google.maps.DirectionsRenderer | null>(null);
  const losMarkersRef = useRef<google.maps.Marker[]>([]);
  const { loaded: mapsLoaded, error: mapsError } = useGoogleMaps();

  const [zones, setZones] = useState<Zone[]>([]);
  const [path, setPath] = useState<LogRecord[]>([]);
  const [events, setEvents] = useState<TelematicsEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [losActive, setLosActive] = useState(false);
  const [losLoading, setLosLoading] = useState(false);

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
          fetch(`${EPS}/telematics/zones-lite`, { cache: 'no-store' }),
          fetch(`${EPS}/telematics/log-records/${deviceId}?from=${from}&to=${to}`, { cache: 'no-store' }),
          fetch(`${EPS}/telematics/events/${deviceId}?from=${from}&to=${to}&limit=500`, { cache: 'no-store' }),
        ]);
        const zonesData = await zonesRes.json().catch(() => ({}));
        const logsData = await logsRes.json().catch(() => ({}));
        const eventsData = await eventsRes.json().catch(() => ({}));
        if (!cancelled) {
          if (zonesData?.data) setZones(zonesData.data);
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
        center: { lat: alertLat, lng: alertLon },
        zoom: 16,
        mapTypeId: 'roadmap',
        mapTypeControl: false,
        fullscreenControl: false,
        streetViewControl: false,
      });
    } else {
      googleMapRef.current.setCenter({ lat: alertLat, lng: alertLon });
      googleMapRef.current.setZoom(16);
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

    // Zones - blue/orange/red, click to see name
    zones.forEach((zone) => {
      const pts = parseZonePoints(zone.points);
      if (pts.length < 3) return;
      let strokeColor = '#3b82f6';
      let fillColor = '#3b82f6';
      let fillOpacity = 0.06;
      let strokeWeight = 1;
      if (zone.is_no_go) { strokeColor = '#dc2626'; fillColor = '#dc2626'; fillOpacity = 0.15; strokeWeight = 2; }
      else if (zone.is_high_risk) { strokeColor = '#f97316'; fillColor = '#f97316'; fillOpacity = 0.12; strokeWeight = 2; }
      const paths = pts.map((p) => ({ lat: p.y, lng: p.x }));
      const cLat = paths.reduce((s, p) => s + p.lat, 0) / paths.length;
      const cLng = paths.reduce((s, p) => s + p.lng, 0) / paths.length;
      const polygon = new window.google.maps.Polygon({
        paths, strokeColor, strokeOpacity: 0.8, strokeWeight, fillColor, fillOpacity,
      });
      polygon.setMap(map);
      polygonsRef.current.push(polygon);

      // Click listener
      const infowindow = new google.maps.InfoWindow({
        content: `<div style="font-size:12px;padding:4px;min-width:120px">
          <b>${zone.name}</b><br/>
          <span style="color:${zone.is_no_go ? '#dc2626' : zone.is_high_risk ? '#f97316' : '#3b82f6'};font-size:10px">
            ${zone.is_no_go ? 'NO-GO ZONE' : zone.is_high_risk ? 'HIGH-RISK ZONE' : 'ZONE'}
          </span>
        </div>`,
      });
      google.maps.event.addListener(polygon, 'click', (e: google.maps.MapMouseEvent) => {
        infowindow.setPosition(e.latLng || { lat: cLat, lng: cLng });
        infowindow.open(map);
      });
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
            ${evt.zoneName ? `<div style="color:#3b82f6;font-weight:500;margin-bottom:4px;">Zone: ${evt.zoneName}</div>` : ''}
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

    map.setCenter({ lat: alertLat, lng: alertLon });
    map.setZoom(16);
  }, [mapsLoaded, zones, path, events, alertLat, alertLon, alertTime]);

  // Separate effect for police markers + directions (avoids re-running full map setup)
  const policeMarkersRef = useRef<google.maps.Marker[]>([]);
  useEffect(() => {
    const map = googleMapRef.current;
    if (!map || !window.google) return;

    const renderPolice = () => {
      // Clear previous police markers
      policeMarkersRef.current.forEach((m) => m.setMap(null));
      policeMarkersRef.current = [];
      clearLos();

      if (!policeStations || policeStations.length === 0) return;

      const closest = policeStations[0];

      policeStations.forEach((station) => {
        const isClosest = station.name === closest.name && station.lat === closest.lat;
        const policeMarker = new window.google.maps.Marker({
          position: { lat: station.lat, lng: station.lon },
          map,
          icon: {
            path: window.google.maps.SymbolPath.CIRCLE,
            fillColor: isClosest ? '#16a34a' : '#2563eb',
            fillOpacity: 0.9,
            strokeColor: isClosest ? '#166534' : '#1e40af',
            strokeWeight: 2,
            scale: isClosest ? 9 : 7,
          },
          title: isClosest ? `${station.name} (Closest)` : station.name,
        });
        policeMarkersRef.current.push(policeMarker);

        const policeInfo = new window.google.maps.InfoWindow({
          content: `
            <div style="font-size:12px;">
              <div style="font-weight:600;color:${isClosest ? '#16a34a' : '#2563eb'};">${station.name}${isClosest ? ' (Closest)' : ''}</div>
              <div style="color:#64748b;">${station.distance_km} km away</div>
            </div>
          `,
        });
        policeMarker.addListener('click', () => policeInfo.open(map, policeMarker));
      });

      // Auto-route from alert to closest police station
      if (window.google.maps.DirectionsService && window.google.maps.DirectionsRenderer) {
        const directionsService = new window.google.maps.DirectionsService();
        const directionsRenderer = new window.google.maps.DirectionsRenderer({
          map,
          suppressMarkers: true,
          polylineOptions: { strokeColor: '#2563eb', strokeWeight: 4, strokeOpacity: 0.8 },
        });
        directionsRendererRef.current = directionsRenderer;

        directionsService.route(
          {
            origin: { lat: alertLat, lng: alertLon },
            destination: { lat: closest.lat, lng: closest.lon },
            travelMode: window.google.maps.TravelMode.DRIVING,
          },
          (result, status) => {
            if (status === 'OK' && result) {
              directionsRenderer.setDirections(result);
              const bounds = new window.google.maps.LatLngBounds();
              bounds.extend({ lat: alertLat, lng: alertLon });
              bounds.extend({ lat: closest.lat, lng: closest.lon });
              map.fitBounds(bounds, 50);
            }
          }
        );
      }
    };

    // Wait for map to be idle before rendering directions
    if (map.getCenter()) {
      renderPolice();
    } else {
      const listener = map.addListener('idle', () => {
        renderPolice();
        google.maps.event.removeListener(listener);
      });
      return () => { google.maps.event.removeListener(listener); };
    }

    return () => {
      policeMarkersRef.current.forEach((m) => m.setMap(null));
      policeMarkersRef.current = [];
      clearLos();
    };
  }, [policeStations, alertLat, alertLon]);

  const clearLos = () => {
    if (directionsRendererRef.current) {
      directionsRendererRef.current.setMap(null);
      directionsRendererRef.current = null;
    }
    losMarkersRef.current.forEach((m) => m.setMap(null));
    losMarkersRef.current = [];
  };

  useEffect(() => {
    return () => { clearLos(); };
  }, []);

  const toggleLos = async () => {
    const map = googleMapRef.current;
    if (!map || !window.google?.maps) return;

    if (losActive) {
      clearLos();
      setLosActive(false);
      return;
    }

    if (events.length < 2) return;

    setLosLoading(true);

    const sorted = [...events]
      .filter((e) => e.latitude && e.longitude)
      .sort((a, b) => new Date(a.eventTime).getTime() - new Date(b.eventTime).getTime());

    if (sorted.length < 2) {
      setLosLoading(false);
      return;
    }

    const numLabelSvg = (num: number, color: string) => {
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="36" viewBox="0 0 28 36">
        <path d="M14 0C6.268 0 0 6.268 0 14c0 10.5 14 22 14 22s14-11.5 14-22C28 6.268 21.732 0 14 0z" fill="${color}"/>
        <circle cx="14" cy="14" r="10" fill="white"/>
        <text x="14" y="18" text-anchor="middle" font-size="12" font-weight="bold" fill="${color}">${num}</text>
      </svg>`;
      return `data:image/svg+xml,${encodeURIComponent(svg)}`;
    };

    sorted.forEach((evt, idx) => {
      const marker = new window.google.maps.Marker({
        position: { lat: evt.latitude!, lng: evt.longitude! },
        map,
        icon: {
          url: numLabelSvg(idx + 1, getEventColor(evt.eventType)),
          scaledSize: new window.google.maps.Size(28, 36),
          anchor: new window.google.maps.Point(14, 36),
        },
        zIndex: 100 + idx,
        title: `${idx + 1}. ${evt.eventType} — ${new Date(evt.eventTime).toLocaleString()}`,
      });
      losMarkersRef.current.push(marker);
    });

    const origin = sorted[0];
    const destination = sorted[sorted.length - 1];
    const waypoints = sorted.slice(1, -1).slice(0, 23).map((e) => ({
      location: { lat: e.latitude!, lng: e.longitude! },
      stopover: true,
    }));

    const directionsService = new window.google.maps.DirectionsService();
    const renderer = new window.google.maps.DirectionsRenderer({
      map,
      suppressMarkers: true,
      polylineOptions: {
        strokeColor: '#f97316',
        strokeOpacity: 0.9,
        strokeWeight: 3,
      },
    });

    try {
      const result = await directionsService.route({
        origin: { lat: origin.latitude!, lng: origin.longitude! },
        destination: { lat: destination.latitude!, lng: destination.longitude! },
        waypoints,
        travelMode: window.google.maps.TravelMode.DRIVING,
        optimizeWaypoints: false,
      });

      renderer.setDirections(result);
      directionsRendererRef.current = renderer;
      setLosActive(true);
    } catch (err) {
      console.error('Directions API error:', err);
      clearLos();
    } finally {
      setLosLoading(false);
    }
  };

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
        {events.length >= 2 && (
          <button
            type="button"
            onClick={toggleLos}
            disabled={losLoading}
            className={`ml-auto flex items-center gap-1 rounded border px-2 py-0.5 font-semibold transition-colors ${
              losActive
                ? 'border-emerald-500 bg-emerald-500/20 text-emerald-600 hover:bg-emerald-500/30'
                : 'border-slate-300 bg-slate-100 text-slate-600 hover:border-slate-400 hover:bg-slate-200'
            } disabled:opacity-50`}
          >
            <Navigation className="w-3 h-3" />
            {losLoading ? 'Loading...' : losActive ? 'LOS On' : 'LOS'}
          </button>
        )}
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
                    {evt.zoneName && <div className="text-blue-600 font-medium">Zone: {evt.zoneName}</div>}
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
