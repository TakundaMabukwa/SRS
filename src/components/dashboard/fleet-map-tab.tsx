'use client';

import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { Search, MapPin, AlertTriangle, Gauge, Clock, Zap, EyeOff, Filter, ChevronDown, ChevronLeft } from 'lucide-react';
import { useGoogleMaps } from '@/hooks/use-google-maps';
import { useCostCenters } from '@/context/cost-centers-context';
import { getGeotabWsUrl } from '@/lib/utils';

type VehicleStatus = {
  device_id: string;
  plate: string;
  license_plate: string;
  fleet_number: string;
  engine_on: boolean;
  ignition_on: boolean;
  speed: number | null;
  latitude: number | null;
  longitude: number | null;
  last_log_time: string | null;
  last_update: string | null;
  alert_count?: number;
  latest_alert_ts?: string | null;
  alert_types?: string[] | null;
};

type VehicleIdentity = {
  deviceId: string;
  plate: string | null;
  fleetNumber: string | null;
  make: string | null;
  model: string | null;
  costCenter: string | null;
};

type Zone = {
  id: string;
  name: string;
  points: string | { x: number; y: number }[];
  is_high_risk: boolean;
  is_no_go: boolean;
};

type TelematicsEvent = {
  id: number;
  device_id: string;
  event_type: string;
  event_code: string | null;
  severity: string | null;
  latitude: number | null;
  longitude: number | null;
  speed: number | null;
  address: string | null;
  description: string | null;
  event_time: string;
  duration_seconds: number | null;
  distance: number | null;
  zone_name: string | null;
};

function parseZonePoints(raw: string | { x: number; y: number }[] | undefined): { x: number; y: number }[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try { const p = JSON.parse(raw); if (Array.isArray(p)) return p; } catch {}
  }
  return [];
}

function isMoving(v: VehicleStatus): boolean {
  return (v.speed ?? 0) > 5;
}

function getVehicleLabel(v: VehicleStatus, identity?: VehicleIdentity): string {
  return identity?.fleetNumber || v.fleet_number || identity?.plate || v.plate || v.license_plate || 'Unknown';
}

function findIdentity(v: VehicleStatus, map: Map<string, VehicleIdentity>): VehicleIdentity | undefined {
  const keys = [
    (v.device_id || '').trim().toUpperCase(),
    (v.fleet_number || '').trim().toUpperCase(),
    (v.plate || '').trim().toUpperCase(),
    (v.license_plate || '').trim().toUpperCase(),
  ];
  for (const k of keys) { if (k && map.has(k)) return map.get(k); }
  const plate = (v.plate || '').trim().toUpperCase();
  if (plate.includes(' - ')) {
    const regPart = plate.split(' - ')[1]?.trim();
    if (regPart && map.has(regPart)) return map.get(regPart);
  }
  return undefined;
}

function normalizeEvent(raw: any): TelematicsEvent {
  return {
    id: raw.id,
    device_id: raw.device_id || raw.deviceId || '',
    event_type: raw.event_type || raw.eventType || '',
    event_code: raw.event_code || raw.eventCode || null,
    severity: raw.severity || 'LOW',
    latitude: raw.latitude ?? raw.lat ?? null,
    longitude: raw.longitude ?? raw.lng ?? raw.lon ?? null,
    speed: raw.speed ?? null,
    address: raw.address || null,
    description: raw.description || null,
    event_time: raw.event_time || raw.eventTime || '',
    duration_seconds: raw.duration_seconds ?? raw.durationSeconds ?? null,
    distance: raw.distance ?? null,
    zone_name: raw.zone_name || raw.zoneName || null,
  };
}

const EPS = '/api/video-server';
const PIN_SIZE = 16;
const PIN_SIZE_ALERT = 22;
const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_TOKEN || '';

function createVehiclePin(color: string, size: number = PIN_SIZE): google.maps.Icon {
  const r = size / 2;
  const h = Math.round(size * 1.25);
  return {
    url: `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${h}" viewBox="0 0 ${size} ${h}"><circle cx="${r}" cy="${r}" r="${r}" fill="${color}" stroke="white" stroke-width="1.5"/><circle cx="${r}" cy="${r}" r="${r * 0.3}" fill="white" opacity="0.85"/></svg>`)}`,
    scaledSize: new google.maps.Size(size, h),
    anchor: new google.maps.Point(r, h),
  };
}

function createEventDot(color: string): google.maps.Icon {
  return {
    url: `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12"><circle cx="6" cy="6" r="5" fill="${color}" stroke="white" stroke-width="1"/></svg>`)}`,
    scaledSize: new google.maps.Size(12, 12),
    anchor: new google.maps.Point(6, 6),
  };
}

export function FleetMapTab() {
  const mapRef = useRef<HTMLDivElement>(null);
  const googleMapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<Map<string, google.maps.Marker>>(new Map());
  const markerIntervalsRef = useRef<Map<string, ReturnType<typeof setInterval>>>(new Map());
  const eventMarkersRef = useRef<google.maps.Marker[]>([]);
  const eventPolylineRef = useRef<google.maps.Polyline | null>(null);
  const losPolylineRef = useRef<google.maps.Polyline | null>(null);
  const zonePolygonsRef = useRef<google.maps.Polygon[]>([]);
  const { loaded: googleMapsLoaded, error: googleMapsError } = useGoogleMaps();
  const { selectedCostCenterIds, costCenterMap } = useCostCenters();

  const [vehicleStatuses, setVehicleStatuses] = useState<VehicleStatus[]>([]);
  const [vehicleIdentities, setVehicleIdentities] = useState<Map<string, VehicleIdentity>>(new Map());
  const [priorityZones, setPriorityZones] = useState<Zone[]>([]);
  const [allZones, setAllZones] = useState<Zone[]>([]);
  const [search, setSearch] = useState('');
  const [selectedVehicle, setSelectedVehicle] = useState<string | null>(null);
  const [flashingVehicles, setFlashingVehicles] = useState<Set<string>>(new Set());
  const [flashingMapMarkers, setFlashingMapMarkers] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [eventVehicleOrder, setEventVehicleOrder] = useState<string[]>([]);

  const [viewMode, setViewMode] = useState<'vehicles' | 'events'>('vehicles');
  const [eventsDeviceId, setEventsDeviceId] = useState<string | null>(null);
  const [vehicleEvents, setVehicleEvents] = useState<TelematicsEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [timeFilter, setTimeFilter] = useState<string>('all');
  const [selectedEventIdx, setSelectedEventIdx] = useState<number | null>(null);

  useEffect(() => {
    const fetchIdentities = async () => {
      try {
        const res = await fetch('/api/vehicle-lookup?all=1', { cache: 'no-store', signal: AbortSignal.timeout(30000) });
        const json = await res.json();
        const rows: VehicleIdentity[] = Array.isArray(json?.vehicles) ? json.vehicles : [];
        const map = new Map<string, VehicleIdentity>();
        for (const row of rows) {
          if (row.deviceId) map.set(row.deviceId.toUpperCase(), row);
          if (row.plate) map.set(row.plate.toUpperCase(), row);
          if (row.fleetNumber) map.set(row.fleetNumber.toUpperCase(), row);
        }
        setVehicleIdentities(map);
      } catch (e) { console.warn('[FleetMap] Vehicle lookup failed:', e); }
    };
    fetchIdentities();
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [vehicleRes, priorityZoneRes] = await Promise.allSettled([
          fetch(`${EPS}/telematics/vehicle-status-all-enriched`, { cache: 'no-store', signal: AbortSignal.timeout(15000) }),
          fetch(`${EPS}/telematics/zones-priority`, { cache: 'no-store', signal: AbortSignal.timeout(10000) }),
        ]);

        if (vehicleRes.status === 'fulfilled') {
          const data = await vehicleRes.value.json().catch(() => null);
          if (data?.data) setVehicleStatuses(data.data);
        }

        if (priorityZoneRes.status === 'fulfilled') {
          const data = await priorityZoneRes.value.json().catch(() => null);
          if (data?.priority) setPriorityZones(data.priority);
        }
      } catch (e) {
        console.warn('[FleetMap] Data fetch error:', e);
      } finally {
        setLoading(false);
      }

      fetch(`${EPS}/telematics/zones-lite`, { cache: 'no-store', signal: AbortSignal.timeout(30000) })
        .then(r => r.json())
        .then(data => { if (data?.data) setAllZones(data.data); })
        .catch(() => {});
    };
    fetchData();
  }, []);

  const zonesToRender = useMemo(() => {
    const map = new Map<string, Zone>();
    for (const z of priorityZones) map.set(z.id, z);
    for (const z of allZones) map.set(z.id, z);
    return Array.from(map.values());
  }, [priorityZones, allZones]);

  const selectedCostCenterNames = useMemo(() => {
    if (selectedCostCenterIds.length === 0) return new Set<string>();
    const names = new Set<string>();
    for (const id of selectedCostCenterIds) {
      const name = costCenterMap.get(id);
      if (name) names.add(name.toLowerCase());
    }
    return names;
  }, [selectedCostCenterIds, costCenterMap]);

  const supabaseVehicles = useMemo(() => {
    return vehicleStatuses.filter((v) => {
      if (selectedCostCenterNames.size > 0) {
        const identity = findIdentity(v, vehicleIdentities);
        const cc = (identity?.costCenter || '').toLowerCase();
        if (!cc || !selectedCostCenterNames.has(cc)) return false;
      }
      return true;
    });
  }, [vehicleStatuses, vehicleIdentities, selectedCostCenterNames]);

  const vehiclesWithPosition = useMemo(() => {
    return supabaseVehicles.filter((v) => v.latitude && v.longitude);
  }, [supabaseVehicles]);

  const sortedVehicles = useMemo(() => {
    const withIdentity = vehiclesWithPosition.map((v) => ({
      v,
      identity: findIdentity(v, vehicleIdentities),
      isEvent: flashingVehicles.has(v.device_id),
      hasAlert: (v.alert_count ?? 0) > 0,
    }));

    withIdentity.sort((a, b) => {
      if (a.isEvent && !b.isEvent) return -1;
      if (!a.isEvent && b.isEvent) return 1;
      if (a.hasAlert && !b.hasAlert) return -1;
      if (!a.hasAlert && b.hasAlert) return 1;
      const aIdx = eventVehicleOrder.indexOf(a.v.device_id);
      const bIdx = eventVehicleOrder.indexOf(b.v.device_id);
      if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
      if (aIdx !== -1) return -1;
      if (bIdx !== -1) return 1;
      return 0;
    });

    return withIdentity.map(({ v, identity }) => ({ v, identity }));
  }, [vehiclesWithPosition, vehicleIdentities, flashingVehicles, eventVehicleOrder]);

  const fetchVehicleEvents = useCallback(async (deviceId: string) => {
    setEventsLoading(true);
    setViewMode('events');
    setEventsDeviceId(deviceId);
    try {
      const res = await fetch(`${EPS}/telematics/events-today/${deviceId}`, { cache: 'no-store', signal: AbortSignal.timeout(15000) });
      const data = await res.json();
      if (data?.data) setVehicleEvents(data.data.map(normalizeEvent));
    } catch (e) { console.warn('[FleetMap] Failed to fetch events:', e); }
    setEventsLoading(false);
  }, []);

  const backToVehicles = useCallback(() => {
    setViewMode('vehicles');
    setEventsDeviceId(null);
    setVehicleEvents([]);
    setTimeFilter('all');
    setSelectedEventIdx(null);
    eventMarkersRef.current.forEach(m => m.setMap(null));
    eventMarkersRef.current = [];
    if (eventPolylineRef.current) { eventPolylineRef.current.setMap(null); eventPolylineRef.current = null; }
    if (losPolylineRef.current) { losPolylineRef.current.setMap(null); losPolylineRef.current = null; }
  }, []);

  useEffect(() => {
    const wsUrl = getGeotabWsUrl();
    let ws: WebSocket | null = null;
    let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      if (ws?.readyState === WebSocket.OPEN) return;
      try {
        ws = new WebSocket(wsUrl);
        ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data);
            if (msg.type === 'vehicle_position' && msg.data) {
              setVehicleStatuses((prev) => {
                const idx = prev.findIndex((v) => v.device_id === msg.data.device_id);
                if (idx >= 0) {
                  const next = [...prev];
                  next[idx] = { ...next[idx], ...msg.data };
                  return next;
                }
                return [...prev, msg.data];
              });
            }
            if (msg.type === 'new_event' && msg.data?.deviceId) {
              const deviceId = msg.data.deviceId;
              setFlashingVehicles((prev) => new Set(prev).add(deviceId));
              setFlashingMapMarkers((prev) => new Set(prev).add(deviceId));
              setEventVehicleOrder((prev) => [deviceId, ...prev.filter((id) => id !== deviceId)]);
              setTimeout(() => {
                setFlashingVehicles((prev) => { const n = new Set(prev); n.delete(deviceId); return n; });
                setFlashingMapMarkers((prev) => { const n = new Set(prev); n.delete(deviceId); return n; });
              }, 10000);
            }
            if (msg.type === 'zone_breach' && msg.data?.deviceId) {
              const deviceId = msg.data.deviceId;
              setFlashingVehicles((prev) => new Set(prev).add(deviceId));
              setFlashingMapMarkers((prev) => new Set(prev).add(deviceId));
              setEventVehicleOrder((prev) => [deviceId, ...prev.filter((id) => id !== deviceId)]);
              setTimeout(() => {
                setFlashingVehicles((prev) => { const n = new Set(prev); n.delete(deviceId); return n; });
                setFlashingMapMarkers((prev) => { const n = new Set(prev); n.delete(deviceId); return n; });
              }, 10000);
            }
          } catch {}
        };
        ws.onclose = () => { reconnectTimeout = setTimeout(connect, 5000); };
        ws.onerror = () => ws?.close();
      } catch {}
    };
    connect();
    return () => {
      if (ws) ws.close();
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      markerIntervalsRef.current.forEach((interval) => clearInterval(interval));
    };
  }, []);

  const filteredEvents = useMemo(() => {
    if (timeFilter === 'all') return vehicleEvents;
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    let start: Date, end: Date;
    switch (timeFilter) {
      case 'morning': start = new Date(startOfDay.getTime() + 6*3600000); end = new Date(startOfDay.getTime() + 12*3600000); break;
      case 'afternoon': start = new Date(startOfDay.getTime() + 12*3600000); end = new Date(startOfDay.getTime() + 18*3600000); break;
      case 'evening': start = new Date(startOfDay.getTime() + 18*3600000); end = new Date(startOfDay.getTime() + 24*3600000); break;
      case 'night': start = startOfDay; end = new Date(startOfDay.getTime() + 6*3600000); break;
      default: return vehicleEvents;
    }
    return vehicleEvents.filter(e => {
      const t = new Date(e.event_time).getTime();
      return t >= start.getTime() && t <= end.getTime();
    });
  }, [vehicleEvents, timeFilter]);

  useEffect(() => {
    if (!googleMapsLoaded || !googleMapRef.current || !window.google?.maps) return;
    if (viewMode !== 'events' || filteredEvents.length === 0) return;

    const map = googleMapRef.current;
    eventMarkersRef.current.forEach(m => m.setMap(null));
    eventMarkersRef.current = [];
    if (eventPolylineRef.current) { eventPolylineRef.current.setMap(null); eventPolylineRef.current = null; }
    if (losPolylineRef.current) { losPolylineRef.current.setMap(null); losPolylineRef.current = null; }

    const validEvents = filteredEvents.filter(e => e.latitude && e.longitude);
    if (validEvents.length === 0) return;

    const bounds = new google.maps.LatLngBounds();

    // Show max 50 event dots (sample if too many)
    const maxDots = 50;
    const step = Math.max(1, Math.floor(validEvents.length / maxDots));
    const sampledEvents = validEvents.filter((_, i) => i % step === 0 || i === validEvents.length - 1);

    sampledEvents.forEach((e, idx) => {
      const pos = { lat: e.latitude!, lng: e.longitude! };
      bounds.extend(pos);

      const isLast = idx === sampledEvents.length - 1;
      const isFirst = idx === 0;
      const isHighSeverity = e.severity === 'CRITICAL' || e.severity === 'HIGH';
      const color = isLast ? '#16a34a' : isFirst ? '#2563eb' : isHighSeverity ? '#ef4444' : '#f97316';

      const marker = new google.maps.Marker({
        position: pos,
        map,
        icon: {
          url: `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><circle cx="5" cy="5" r="4" fill="${color}" stroke="white" stroke-width="1"/></svg>`)}`,
          scaledSize: new google.maps.Size(10, 10),
          anchor: new google.maps.Point(5, 5),
        },
        title: `${e.event_type} - ${new Date(e.event_time).toLocaleTimeString()}`,
        zIndex: isLast ? 200 : 100,
      });

      const infowindow = new google.maps.InfoWindow({
        content: `<div style="font-size:12px;padding:4px;min-width:150px">
          <b>${e.event_type}</b><br/>
          <span style="color:#666">${new Date(e.event_time).toLocaleTimeString()}</span><br/>
          ${e.speed != null ? `Speed: ${Math.round(e.speed)} km/h<br/>` : ''}
          ${e.address ? `${e.address}<br/>` : ''}
        </div>`,
      });
      marker.addListener('click', () => infowindow.open(map, marker));
      eventMarkersRef.current.push(marker);
    });

    // Use Google Directions API for route preview with arrows
    if (validEvents.length >= 2) {
      const origin = validEvents[0];
      const destination = validEvents[validEvents.length - 1];

      // Build waypoints from sampled events (max 23 for Directions API)
      const waypoints = sampledEvents.slice(1, -1).slice(0, 23).map(e => ({
        location: { lat: e.latitude!, lng: e.longitude! },
        stopover: false,
      }));

      const directionsService = new google.maps.DirectionsService();
      directionsService.route({
        origin: { lat: origin.latitude!, lng: origin.longitude! },
        destination: { lat: destination.latitude!, lng: destination.longitude! },
        waypoints,
        travelMode: google.maps.TravelMode.DRIVING,
        optimizeWaypoints: true,
      }, (result, status) => {
        if (status === 'OK' && result) {
          // Draw route with direction arrows
          const routePath: google.maps.LatLngLiteral[] = [];
          result.routes[0].legs.forEach(leg => {
            leg.steps.forEach(step => {
              step.path.forEach(p => routePath.push({ lat: p.lat(), lng: p.lng() }));
            });
          });

          if (routePath.length > 0) {
            eventPolylineRef.current = new google.maps.Polyline({
              path: routePath,
              geodesic: true,
              strokeColor: '#f97316',
              strokeOpacity: 0.8,
              strokeWeight: 3,
              map,
              icons: [{
                icon: { path: google.maps.SymbolPath.FORWARD_ARROW, scale: 3, strokeColor: '#f97316', fillColor: '#f97316', fillOpacity: 1 },
                offset: '0%',
                repeat: '100px',
              }],
            });
          }

          // LOS: line from first event to current vehicle location
          const vehicle = vehicleStatuses.find(v => v.device_id === eventsDeviceId);
          if (vehicle?.latitude && vehicle?.longitude) {
            const currentPos = { lat: vehicle.latitude, lng: vehicle.longitude };
            bounds.extend(currentPos);

            const losPath = result.routes[0].legs[result.routes[0].legs.length - 1].end_location;
            losPolylineRef.current = new google.maps.Polyline({
              path: [{ lat: destination.latitude!, lng: destination.longitude! }, currentPos],
              geodesic: true,
              strokeColor: '#2563eb',
              strokeOpacity: 0.6,
              strokeWeight: 3,
              map,
              icons: [{
                icon: { path: google.maps.SymbolPath.FORWARD_ARROW, scale: 3, strokeColor: '#2563eb', fillColor: '#2563eb', fillOpacity: 1 },
                offset: '50%',
              }],
            });

            // Current location marker
            const currentMarker = new google.maps.Marker({
              position: currentPos,
              map,
              icon: {
                url: `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18"><circle cx="9" cy="9" r="8" fill="#2563eb" stroke="white" stroke-width="2"/><circle cx="9" cy="9" r="3" fill="white"/></svg>`)}`,
                scaledSize: new google.maps.Size(18, 18),
                anchor: new google.maps.Point(9, 9),
              },
              title: 'Current Location',
              zIndex: 300,
            });
            eventMarkersRef.current.push(currentMarker);
          }

          map.fitBounds(bounds, 50);
        } else {
          // Fallback: straight line if Directions API fails
          const fallbackPath = validEvents.map(e => ({ lat: e.latitude!, lng: e.longitude! }));
          eventPolylineRef.current = new google.maps.Polyline({
            path: fallbackPath, geodesic: true, strokeColor: '#f97316', strokeOpacity: 0.8, strokeWeight: 2, map,
          });
          const vehicle = vehicleStatuses.find(v => v.device_id === eventsDeviceId);
          if (vehicle?.latitude && vehicle?.longitude) {
            bounds.extend({ lat: vehicle.latitude, lng: vehicle.longitude });
            const currentMarker = new google.maps.Marker({
              position: { lat: vehicle.latitude, lng: vehicle.longitude },
              map,
              icon: {
                url: `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18"><circle cx="9" cy="9" r="8" fill="#2563eb" stroke="white" stroke-width="2"/><circle cx="9" cy="9" r="3" fill="white"/></svg>`)}`,
                scaledSize: new google.maps.Size(18, 18),
                anchor: new google.maps.Point(9, 9),
              },
              title: 'Current Location', zIndex: 300,
            });
            eventMarkersRef.current.push(currentMarker);
          }
          map.fitBounds(bounds, 50);
        }
      });
    } else {
      map.fitBounds(bounds, 50);
    }
  }, [viewMode, filteredEvents, googleMapsLoaded, eventsDeviceId, vehicleStatuses]);

  useEffect(() => {
    if (!googleMapsLoaded || !mapRef.current || !window.google?.maps) return;

    const defaultCenter = { lat: -29.0, lng: 24.0 };
    const center = vehiclesWithPosition.length > 0
      ? {
          lat: vehiclesWithPosition.reduce((s, v) => s + v.latitude!, 0) / vehiclesWithPosition.length,
          lng: vehiclesWithPosition.reduce((s, v) => s + v.longitude!, 0) / vehiclesWithPosition.length,
        }
      : defaultCenter;

    if (!googleMapRef.current) {
      googleMapRef.current = new window.google.maps.Map(mapRef.current, {
        center, zoom: 7, mapTypeId: 'roadmap', mapTypeControl: false,
        fullscreenControl: false, streetViewControl: false, zoomControl: true,
      });
    }

    const map = googleMapRef.current;

    zonePolygonsRef.current.forEach((p) => p.setMap(null));
    zonePolygonsRef.current = [];

    zonesToRender.forEach((zone) => {
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
        paths,
        strokeColor, strokeOpacity: 0.8, strokeWeight, fillColor, fillOpacity,
      });

      // Click listener on polygon to show zone name
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

      polygon.setMap(map);
      zonePolygonsRef.current.push(polygon);
    });

    if (viewMode === 'vehicles') {
      vehiclesWithPosition.forEach((v) => {
        if (!v.latitude || !v.longitude) return;
        const identity = findIdentity(v, vehicleIdentities);
        const label = getVehicleLabel(v, identity);
        const moving = isMoving(v);
        const flashing = flashingMapMarkers.has(v.device_id);
        const selected = selectedVehicle === v.device_id;
        const hasAlert = (v.alert_count ?? 0) > 0;

        let color = moving ? '#2563eb' : '#64748b';
        let size = PIN_SIZE;
        if (!identity) { color = '#d97706'; size = PIN_SIZE; }
        if (flashing || hasAlert) { color = '#ef4444'; size = PIN_SIZE_ALERT; }
        if (selected) { color = '#7c3aed'; size = PIN_SIZE_ALERT; }

        const existing = markersRef.current.get(v.device_id);
        if (existing) {
          existing.setPosition({ lat: v.latitude, lng: v.longitude });
          existing.setIcon(createVehiclePin(color, size));
          existing.setZIndex(flashing ? 300 : selected ? 200 : 100);
          if (flashing && !markerIntervalsRef.current.has(v.device_id)) {
            let visible = true;
            const interval = setInterval(() => { visible = !visible; existing.setOpacity(visible ? 1 : 0.2); }, 400);
            markerIntervalsRef.current.set(v.device_id, interval);
            setTimeout(() => {
              clearInterval(interval);
              markerIntervalsRef.current.delete(v.device_id);
              existing.setOpacity(1);
              setFlashingMapMarkers((prev) => { const n = new Set(prev); n.delete(v.device_id); return n; });
            }, 10000);
          }
          return;
        }

        const marker = new window.google.maps.Marker({
          position: { lat: v.latitude, lng: v.longitude },
          map,
          icon: createVehiclePin(color, size),
          title: `${label} - ${moving ? `${Math.round(v.speed!)} km/h` : 'Stationary'}${hasAlert ? ' [ALERT]' : ''}`,
          zIndex: flashing ? 300 : selected ? 200 : 100,
        });

        marker.addListener('click', () => {
          setSelectedVehicle(v.device_id);
          map.setCenter({ lat: v.latitude!, lng: v.longitude! });
          map.setZoom(14);
        });

        markersRef.current.set(v.device_id, marker);
      });
    }
  }, [googleMapsLoaded, vehiclesWithPosition, zonesToRender, flashingMapMarkers, selectedVehicle, vehicleIdentities, viewMode]);

  const filteredVehicles = useMemo(() => {
    if (!search) return sortedVehicles;
    const q = search.toLowerCase();
    return sortedVehicles.filter(({ v, identity }) => {
      const label = getVehicleLabel(v, identity);
      return label.toLowerCase().includes(q) || (v.plate || '').toLowerCase().includes(q) ||
        (v.license_plate || '').toLowerCase().includes(q) || (identity?.make || '').toLowerCase().includes(q) ||
        (identity?.costCenter || '').toLowerCase().includes(q);
    });
  }, [sortedVehicles, search]);

  if (googleMapsError) {
    return <div className="flex h-full items-center justify-center text-sm text-rose-500">{googleMapsError}</div>;
  }

  return (
    <div className="fixed inset-0 z-0 flex flex-col">
      <div className="relative flex-1">
        <div ref={mapRef} className="absolute inset-0" />

        {loading && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/80">
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
              Loading fleet map...
            </div>
          </div>
        )}

        <div className="absolute top-3 left-3 z-10 flex items-center gap-3 rounded-lg bg-white/90 px-3 py-1.5 text-[10px] font-medium text-slate-600 shadow-md backdrop-blur-sm">
          <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-full bg-blue-600" /> Moving</span>
          <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-full bg-slate-400" /> Stationary</span>
          <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-full bg-amber-500" /> Unmatched</span>
          <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-full bg-red-500" /> Alert</span>
          <span className="text-slate-300">|</span>
          <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-sm bg-blue-500/30 border border-blue-500" /> Zone</span>
          <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-sm bg-orange-500/30 border border-orange-500" /> High Risk</span>
          <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-sm bg-red-500/30 border border-red-500" /> No-Go</span>
        </div>
      </div>

      <div className="absolute top-14 right-0 bottom-0 z-10 flex w-80 flex-col border-l border-slate-200 bg-white shadow-2xl">
        <div className="border-b border-slate-200 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {viewMode === 'events' && (
                <button onClick={backToVehicles} className="rounded-lg bg-slate-100 p-1.5 hover:bg-slate-200 transition-colors">
                  <ChevronLeft className="h-4 w-4 text-slate-600" />
                </button>
              )}
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600">
                <MapPin className="h-4 w-4 text-white" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  {viewMode === 'events' ? `Events - ${eventsDeviceId || ''}` : 'All Vehicles'}
                </h3>
                <p className="text-[11px] text-slate-500">
                  {viewMode === 'events' ? `${filteredEvents.length} events today` : (
                    <>
                      {filteredVehicles.length} tracked
                      {filteredVehicles.some(({ v }) => !findIdentity(v, vehicleIdentities)) && (
                        <span className="text-amber-500"> · {filteredVehicles.filter(({ v }) => !findIdentity(v, vehicleIdentities)).length} unmatched</span>
                      )}
                    </>
                  )}
                </p>
              </div>
            </div>
          </div>

          {viewMode === 'events' && (
            <div className="mt-3 flex flex-wrap gap-1">
              {[
                { key: 'all', label: 'All Day' },
                { key: 'morning', label: '06:00–12:00' },
                { key: 'afternoon', label: '12:00–18:00' },
                { key: 'evening', label: '18:00–24:00' },
                { key: 'night', label: '00:00–06:00' },
              ].map((p) => (
                <button key={p.key} onClick={() => setTimeFilter(p.key)}
                  className={`rounded-lg px-2 py-1 text-[10px] font-medium transition-colors ${timeFilter === p.key ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                  {p.label}
                </button>
              ))}
            </div>
          )}

          {viewMode === 'vehicles' && (
            <>
              <div className="relative mt-3">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input type="text" placeholder="Search plate or driver..." value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-3 text-sm outline-none transition-colors focus:border-blue-400 focus:bg-white focus:ring-1 focus:ring-blue-400" />
              </div>
            </>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
          {viewMode === 'events' ? (
            eventsLoading ? (
              <div className="flex items-center justify-center p-6 text-sm text-slate-500">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-500 border-t-transparent mr-2" />
                Loading events...
              </div>
            ) : filteredEvents.length === 0 ? (
              <div className="p-6 text-center text-sm text-slate-400">
                {vehicleEvents.length === 0 ? 'No events today' : 'No events in selected time range'}
              </div>
            ) : (
              filteredEvents.map((e, idx) => {
                const isHighSeverity = e.severity === 'CRITICAL' || e.severity === 'HIGH';
                const isEntering = e.event_type?.toUpperCase().includes('ENTERING');
                const isLeaving = e.event_type?.toUpperCase().includes('LEAVING');
                const isZone = isEntering || isLeaving;
                const zoneLabel = e.zone_name || (isEntering ? 'Entering Zone' : isLeaving ? 'Exiting Zone' : e.event_type);
                return (
                  <div key={e.id}
                    onClick={() => {
                      if (e.latitude && e.longitude && googleMapRef.current) {
                        googleMapRef.current.panTo({ lat: e.latitude, lng: e.longitude });
                        googleMapRef.current.setZoom(16);
                        setSelectedEventIdx(idx);
                        const marker = eventMarkersRef.current.find(m => {
                          const title = m.getTitle() || '';
                          return title.includes(e.event_type) && title.includes(new Date(e.event_time).toLocaleTimeString());
                        });
                        if (marker) google.maps.event.trigger(marker, 'click');
                      }
                    }}
                    className={`cursor-pointer rounded-xl border bg-white p-3.5 shadow-sm transition-all hover:shadow-md hover:border-blue-300 ${isHighSeverity ? 'border-red-200 bg-red-50/50' : 'border-slate-200'}`}>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-slate-900">
                        {isZone ? (
                          <span className="flex items-center gap-1">
                            <span className={`inline-block h-2 w-2 rounded-full ${isEntering ? 'bg-green-500' : 'bg-amber-500'}`} />
                            {zoneLabel}
                          </span>
                        ) : e.event_type}
                      </span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${isHighSeverity ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'}`}>
                        {e.severity || 'LOW'}
                      </span>
                    </div>
                    <div className="mt-2 space-y-1 text-[11px] text-slate-600">
                      <div className="flex items-center gap-1"><Clock className="h-3 w-3 text-slate-400" />{new Date(e.event_time).toLocaleTimeString()}</div>
                      {e.speed != null && <div className="flex items-center gap-1"><Gauge className="h-3 w-3 text-slate-400" />{Math.round(e.speed)} km/h</div>}
                      {e.address && <div className="text-slate-500 truncate">{e.address}</div>}
                      {e.description && <div className="text-slate-500">{e.description}</div>}
                      {isZone && e.zone_name && (
                        <div className={`mt-1 rounded-md px-2 py-0.5 text-[10px] font-medium ${isEntering ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                          {e.zone_name}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )
          ) : (
            filteredVehicles.map(({ v, identity }) => {
              const label = getVehicleLabel(v, identity);
              const moving = isMoving(v);
              const flashing = flashingVehicles.has(v.device_id);
              const isSelected = selectedVehicle === v.device_id;
              const hasAlert = (v.alert_count ?? 0) > 0;
              const noMatch = !identity;

              return (
                <div key={v.device_id}
                  onClick={() => {
                    setSelectedVehicle(v.device_id);
                    if (googleMapRef.current && v.latitude && v.longitude) {
                      googleMapRef.current.setCenter({ lat: v.latitude, lng: v.longitude });
                      googleMapRef.current.setZoom(14);
                    }
                  }}
                  className={`cursor-pointer rounded-xl border bg-white p-3.5 shadow-sm transition-all hover:shadow-md ${
                    noMatch ? 'border-dashed border-amber-300 bg-amber-50/30'
                    : flashing ? 'border-red-300 bg-red-50 ring-2 ring-red-200 animate-pulse'
                    : isSelected ? 'border-blue-300 bg-blue-50 ring-2 ring-blue-200'
                    : hasAlert ? 'border-red-200 bg-red-50/30'
                    : 'border-slate-200 hover:border-slate-300'
                  }`}>
                  <div className="flex items-center justify-between">
                    <span className={`text-sm font-bold ${noMatch ? 'text-amber-700' : 'text-slate-900'}`}>{label}</span>
                    {noMatch ? (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-600">
                        No Match
                      </span>
                    ) : flashing || hasAlert ? (
                      <span className="flex items-center gap-0.5 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-600 animate-pulse">
                        <AlertTriangle className="h-2.5 w-2.5" /> ALERT{v.alert_count ? ` x${v.alert_count}` : ''}
                      </span>
                    ) : (
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${moving ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                        {moving ? 'Moving' : 'Stationary'}
                      </span>
                    )}
                  </div>

                  {identity?.make ? (
                    <p className="mt-1 text-[11px] text-slate-500">
                      {identity.make}{identity.model ? ` ${identity.model}` : ''}{identity.costCenter ? ` \u00b7 ${identity.costCenter}` : ''}
                    </p>
                  ) : noMatch ? (
                    <p className="mt-1 text-[11px] text-amber-500">
                      Device: {v.device_id}{v.plate ? ` \u00b7 ${v.plate}` : ''}
                    </p>
                  ) : null}

                  <div className="mt-2.5 flex items-center gap-4 text-[11px] text-slate-600">
                    <span className="flex items-center gap-1"><Gauge className="h-3 w-3 text-slate-400" />{v.speed != null ? `${Math.round(v.speed)} km/h` : '\u2014'}</span>
                    <span className="flex items-center gap-1">
                      {moving ? <Zap className="h-3 w-3 text-green-500" /> : <EyeOff className="h-3 w-3 text-slate-400" />}
                      {moving ? 'Running' : 'Off'}
                    </span>
                  </div>

                  {v.last_log_time && (
                    <div className="mt-2 flex items-center gap-1 text-[10px] text-slate-400">
                      <Clock className="h-3 w-3" /> Last seen: {new Date(v.last_log_time).toLocaleString()}
                    </div>
                  )}

                  <div className="mt-2.5 flex gap-2">
                    <button onClick={(e) => { e.stopPropagation(); fetchVehicleEvents(v.device_id); }}
                      className="rounded-lg bg-blue-50 px-3 py-1.5 text-[11px] font-medium text-blue-700 hover:bg-blue-100 transition-colors">
                      View Events
                    </button>
                  </div>
                </div>
              );
            })
          )}

          {viewMode === 'vehicles' && filteredVehicles.length === 0 && !loading && (
            <div className="p-6 text-center text-sm text-slate-400">
              {vehicleIdentities.size === 0 ? 'Loading vehicle data...' : 'No vehicles found'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
