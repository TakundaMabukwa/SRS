'use client';
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { X, MapPin, Navigation, AlertTriangle, Gauge } from 'lucide-react';
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

type VehicleStatus = {
  device_id: string;
  fleet_number: string;
  plate: string;
  speed: number | null;
  latitude: number | null;
  longitude: number | null;
  last_log_time: string | null;
};

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
  isOpen: boolean;
  onClose: () => void;
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

export function RealTimeMapModal({ deviceId, isOpen, onClose }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const googleMapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const polygonsRef = useRef<google.maps.Polygon[]>([]);
  const polylineRef = useRef<google.maps.Polyline | null>(null);
  const eventInfoWindowsRef = useRef<Map<number, google.maps.InfoWindow>>(new Map());
  const eventMarkersRef = useRef<Map<number, google.maps.Marker>>(new Map());
  const directionsRendererRef = useRef<google.maps.DirectionsRenderer | null>(null);
  const losMarkersRef = useRef<google.maps.Marker[]>([]);
  const { loaded: mapsLoaded, error: mapsError } = useGoogleMaps();

  const [zones, setZones] = useState<Zone[]>([]);
  const [vehicle, setVehicle] = useState<VehicleStatus | null>(null);
  const [path, setPath] = useState<LogRecord[]>([]);
  const [events, setEvents] = useState<TelematicsEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [losActive, setLosActive] = useState(false);
  const [losLoading, setLosLoading] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const now = Date.now();
      const from = new Date(now - 15 * 60 * 1000).toISOString();
      const to = new Date(now).toISOString();
      const [zonesRes, statusRes, logsRes, eventsRes] = await Promise.all([
        fetch(`${EPS}/telematics/zones`, { cache: 'no-store' }),
        fetch(`${EPS}/telematics/vehicle-status/${deviceId}`, { cache: 'no-store' }),
        fetch(`${EPS}/telematics/log-records/${deviceId}?from=${from}&to=${to}`, { cache: 'no-store' }),
        fetch(`${EPS}/telematics/events/${deviceId}?from=${from}&to=${to}&limit=500`, { cache: 'no-store' }),
      ]);

      const zonesData = await zonesRes.json().catch(() => ({}));
      const statusData = await statusRes.json().catch(() => ({}));
      const logsData = await logsRes.json().catch(() => ({}));
      const eventsData = await eventsRes.json().catch(() => ({}));

      if (zonesData?.data) {
        // Only show high-risk / no-go zones on the map
        setZones(zonesData.data.filter((z: Zone) => z.is_high_risk || z.is_no_go));
      }
      if (statusData?.data) setVehicle(statusData.data);
      if (logsData?.data) setPath(logsData.data);
      if (eventsData?.data) {
        setEvents(
          eventsData.data
            .filter((e: any) => e.latitude && e.longitude)
            .map(normalizeEvent)
        );
      }
    } catch (e) {
      console.error('Failed to fetch map data:', e);
      setError('Failed to fetch map data');
    } finally {
      setLoading(false);
    }
  }, [deviceId]);

  useEffect(() => {
    if (isOpen) fetchData();
  }, [isOpen, fetchData]);

  // Initialize / update Google Map
  useEffect(() => {
    if (!isOpen || !mapsLoaded || !mapRef.current || !window.google?.maps) return;

    const coords: { lat: number; lng: number }[] = [];
    if (vehicle?.latitude && vehicle?.longitude) {
      coords.push({ lat: vehicle.latitude, lng: vehicle.longitude });
    }
    path.forEach((p) => coords.push({ lat: p.latitude, lng: p.longitude }));
    events.forEach((e) => {
      if (e.latitude && e.longitude) coords.push({ lat: e.latitude, lng: e.longitude });
    });
    zones.forEach((z) => {
      parseZonePoints(z.points).forEach((p) => coords.push({ lat: p.y, lng: p.x }));
    });

    let center = { lat: -26.2041, lng: 28.0473 }; // Johannesburg fallback
    if (coords.length > 0) {
      center = {
        lat: coords.reduce((s, c) => s + c.lat, 0) / coords.length,
        lng: coords.reduce((s, c) => s + c.lng, 0) / coords.length,
      };
    } else if (vehicle?.latitude && vehicle?.longitude) {
      center = { lat: vehicle.latitude, lng: vehicle.longitude };
    }

    if (!googleMapRef.current) {
      googleMapRef.current = new window.google.maps.Map(mapRef.current, {
        center,
        zoom: 14,
        mapTypeId: 'roadmap',
        mapTypeControl: true,
        fullscreenControl: false,
        streetViewControl: false,
      });
    } else {
      googleMapRef.current.setCenter(center);
    }

    const map = googleMapRef.current;

    // Clear previous overlays
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];
    polygonsRef.current.forEach((p) => p.setMap(null));
    polygonsRef.current = [];
    if (polylineRef.current) {
      polylineRef.current.setMap(null);
      polylineRef.current = null;
    }
    eventInfoWindowsRef.current.forEach((iw) => iw.close());
    eventInfoWindowsRef.current.clear();
    eventMarkersRef.current.clear();

    // Draw high-risk / no-go zones as red polygons without labels
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

    // Draw path
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
          scale: 7,
        },
        title: evt.eventType,
      });
      markersRef.current.push(marker);

      const distText = evt.distance ? `${Number(evt.distance).toFixed(2)} km` : '';
      const durText = evt.durationSeconds ? `${Math.round(evt.durationSeconds / 60)} min` : '';
      const locationText = evt.address
        ? evt.address
        : `${Number(evt.latitude).toFixed(5)}, ${Number(evt.longitude).toFixed(5)}`;
      const infoContent = `
        <div style="font-size:12px;min-width:180px;">
          <div style="font-weight:600;margin-bottom:4px;">${evt.eventType}</div>
          <div style="color:#334155;"><strong>Time:</strong> ${new Date(evt.eventTime).toLocaleString()}</div>
          <div style="color:#334155;"><strong>Location:</strong> ${locationText}</div>
          ${distText ? `<div style="color:#334155;"><strong>Distance:</strong> ${distText}</div>` : ''}
          ${durText ? `<div style="color:#334155;"><strong>Duration:</strong> ${durText}</div>` : ''}
          ${evt.speed ? `<div style="color:#334155;"><strong>Speed:</strong> ${Math.round(evt.speed)} km/h</div>` : ''}
        </div>
      `;
      const infoWindow = new window.google.maps.InfoWindow({ content: infoContent });
      eventInfoWindowsRef.current.set(evt.id, infoWindow);
      eventMarkersRef.current.set(evt.id, marker);
      marker.addListener('click', () => {
        infoWindow.open(map, marker);
      });
    });

    // Vehicle marker with accuracy-style outer ring
    if (vehicle?.latitude && vehicle?.longitude) {
      const vehicleColor = '#0ea5e9';
      // Outer pulse ring
      const outerRing = new window.google.maps.Marker({
        position: { lat: vehicle.latitude, lng: vehicle.longitude },
        map,
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          fillColor: vehicleColor,
          fillOpacity: 0.2,
          strokeColor: vehicleColor,
          strokeOpacity: 0.4,
          strokeWeight: 1,
          scale: 22,
        },
        clickable: false,
        zIndex: 10,
      });
      markersRef.current.push(outerRing);

      // Main vehicle marker
      const svg = encodeURIComponent(`
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${vehicleColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/>
          <circle cx="7" cy="17" r="2"/>
          <circle cx="17" cy="17" r="2"/>
        </svg>
      `);
      const marker = new window.google.maps.Marker({
        position: { lat: vehicle.latitude, lng: vehicle.longitude },
        map,
        icon: {
          url: `data:image/svg+xml,${svg}`,
          scaledSize: new window.google.maps.Size(36, 36),
          anchor: new window.google.maps.Point(18, 18),
        },
        title: `${vehicle.fleet_number || vehicle.plate || vehicle.device_id} — ${vehicle.speed ? `${Math.round(vehicle.speed)} km/h` : 'stationary'}`,
        zIndex: 11,
      });
      markersRef.current.push(marker);

      const infoWindow = new window.google.maps.InfoWindow({
        content: `
          <div style="font-size:12px;">
            <div style="font-weight:600;">${vehicle.fleet_number || vehicle.plate || vehicle.device_id}</div>
            <div style="color:#64748b;">${vehicle.speed ? `${Math.round(vehicle.speed)} km/h` : 'Stationary'}</div>
            <div style="color:#94a3b8;font-size:10px;">${vehicle.last_log_time ? new Date(vehicle.last_log_time).toLocaleString() : ''}</div>
          </div>
        `,
      });
      marker.addListener('click', () => {
        infoWindow.open(map, marker);
      });
    }

    // Fit bounds if we have any coordinates
    if (coords.length > 0) {
      const bounds = new window.google.maps.LatLngBounds();
      coords.forEach((c) => bounds.extend(c));
      map.fitBounds(bounds, 40);
    }
  }, [isOpen, mapsLoaded, zones, vehicle, path, events]);

  // Cleanup on close
  useEffect(() => {
    if (!isOpen) {
      markersRef.current.forEach((m) => m.setMap(null));
      markersRef.current = [];
      polygonsRef.current.forEach((p) => p.setMap(null));
      polygonsRef.current = [];
      if (polylineRef.current) {
        polylineRef.current.setMap(null);
        polylineRef.current = null;
      }
      eventInfoWindowsRef.current.forEach((iw) => iw.close());
      eventInfoWindowsRef.current.clear();
      eventMarkersRef.current.clear();
      if (directionsRendererRef.current) {
        directionsRendererRef.current.setMap(null);
        directionsRendererRef.current = null;
      }
      losMarkersRef.current.forEach((m) => m.setMap(null));
      losMarkersRef.current = [];
      setLosActive(false);
      setLosLoading(false);
      googleMapRef.current = null;
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const hasAnyData = vehicle?.latitude || path.length > 0 || events.length > 0 || zones.length > 0;

  const handleEventClick = (evt: TelematicsEvent) => {
    const map = googleMapRef.current;
    const marker = eventMarkersRef.current.get(evt.id);
    const infoWindow = eventInfoWindowsRef.current.get(evt.id);
    if (map && marker && infoWindow && evt.latitude && evt.longitude) {
      map.setCenter({ lat: evt.latitude, lng: evt.longitude });
      map.setZoom(16);
      infoWindow.open(map, marker);
    }
  };

  const getEventColor = (eventType: string) => {
    if (/speed/i.test(eventType)) return '#ef4444';
    if (/harsh|braking|cornering/i.test(eventType)) return '#f97316';
    return '#eab308';
  };

  const clearLos = () => {
    if (directionsRendererRef.current) {
      directionsRendererRef.current.setMap(null);
      directionsRendererRef.current = null;
    }
    losMarkersRef.current.forEach((m) => m.setMap(null));
    losMarkersRef.current = [];
  };

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

    // Build numbered markers first
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

    // Use Directions API for the route
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

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="flex h-[85vh] w-full max-w-6xl flex-col overflow-hidden rounded-xl border border-slate-700 bg-slate-950 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
          <div>
            <div className="text-sm font-semibold text-white">
              {vehicle ? `${vehicle.fleet_number || vehicle.plate || ''} — Real-time Map` : 'Vehicle Map'}
            </div>
            <div className="text-[11px] text-slate-400">
              {zones.length} high-risk/no-go zone{zones.length === 1 ? '' : 's'}
              {events.length > 0 ? ` • ${events.length} event${events.length === 1 ? '' : 's'} in last 15 min` : ''}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {loading && <span className="text-[10px] text-cyan-400 animate-pulse">Loading...</span>}
            {mapsError && <span className="text-[10px] text-rose-400">{mapsError}</span>}
            {events.length >= 2 && (
              <button
                type="button"
                onClick={toggleLos}
                disabled={losLoading}
                className={`flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-semibold transition-colors ${
                  losActive
                    ? 'border-emerald-500 bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
                    : 'border-slate-600 bg-slate-800 text-slate-300 hover:border-slate-500 hover:bg-slate-700'
                } disabled:opacity-50`}
              >
                <Navigation className="w-3 h-3" />
                {losLoading ? 'Loading...' : losActive ? 'LOS On' : 'LOS'}
              </button>
            )}
            <Button size="icon" variant="ghost" className="h-7 w-7 text-slate-400 hover:text-white" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="flex flex-1 overflow-hidden">
          <div className="relative flex-1 bg-slate-900">
            {!mapsLoaded ? (
              <div className="flex h-full items-center justify-center text-sm text-slate-400">
                Loading Google Maps...
              </div>
            ) : error ? (
              <div className="flex h-full items-center justify-center text-sm text-rose-400">
                {error}
              </div>
            ) : !hasAnyData && !loading ? (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-slate-400">
                <MapPin className="h-10 w-10 text-slate-600" />
                <p className="text-sm">No location data available for this vehicle</p>
                <p className="text-[11px]">Device ID: {deviceId}</p>
              </div>
            ) : (
              <div ref={mapRef} className="h-full w-full" />
            )}
          </div>
          <div className="w-72 overflow-y-auto border-l border-slate-800 bg-slate-900/50 p-3">
            <div className="mb-3 text-xs font-semibold text-white">Vehicle Location</div>
            {vehicle?.latitude && vehicle?.longitude ? (
              <div className="mb-4 rounded-md border border-slate-700 bg-slate-800/60 p-2 text-[11px] text-slate-300">
                <div className="flex items-center gap-1.5">
                  <span className="inline-block h-2 w-2 rounded-full bg-sky-500" />
                  <span className="font-medium text-sky-400">{vehicle.fleet_number || vehicle.plate || 'Vehicle'}</span>
                </div>
                <div className="mt-1 text-slate-400">
                  {Number(vehicle.latitude).toFixed(5)}, {Number(vehicle.longitude).toFixed(5)}
                </div>
                {vehicle.speed != null && (
                  <div className="mt-0.5 text-slate-400">{Math.round(vehicle.speed)} km/h</div>
                )}
                {vehicle.last_log_time && (
                  <div className="mt-0.5 text-slate-500">{new Date(vehicle.last_log_time).toLocaleString()}</div>
                )}
              </div>
            ) : (
              <div className="mb-4 text-[11px] text-slate-500">No current vehicle location</div>
            )}

            <div className="mb-2 text-xs font-semibold text-white">Events ({events.length})</div>
            {events.length === 0 ? (
              <div className="text-[11px] text-slate-500">No events in the last 15 minutes</div>
            ) : (
              <div className="space-y-2">
                {events.map((evt) => {
                  const color = getEventColor(evt.eventType);
                  return (
                    <button
                      key={evt.id}
                      type="button"
                      onClick={() => handleEventClick(evt)}
                      className="w-full rounded-md border border-slate-700 bg-slate-800/60 p-2 text-left transition-colors hover:border-slate-600 hover:bg-slate-800"
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="inline-block h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                        <span className="truncate text-[11px] font-medium text-slate-200">{evt.eventType}</span>
                      </div>
                      <div className="mt-1 text-[10px] text-slate-400">
                        {new Date(evt.eventTime).toLocaleString()}
                      </div>
                      {evt.address ? (
                        <div className="truncate text-[10px] text-slate-500">{evt.address}</div>
                      ) : evt.latitude && evt.longitude ? (
                        <div className="text-[10px] text-slate-500">
                          {Number(evt.latitude).toFixed(5)}, {Number(evt.longitude).toFixed(5)}
                        </div>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-4 border-t border-slate-800 px-4 py-2 text-[10px] text-slate-400">
          <span className="flex items-center gap-1"><span className="inline-block w-3 h-0.5 bg-cyan-400" /> Vehicle path</span>
          <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-full border-2 border-sky-500 bg-sky-500/30" /> Current location</span>
          <span className="flex items-center gap-1"><span className="inline-block w-3 h-2 bg-red-500/30 border border-red-500" /> High Risk / No-Go</span>
          <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full bg-red-500" /> Speeding</span>
          <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full bg-orange-500" /> Harsh driving</span>
          <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full bg-yellow-500" /> Other event</span>
        </div>
      </div>
    </div>
  );
}
