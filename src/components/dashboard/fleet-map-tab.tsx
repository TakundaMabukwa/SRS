'use client';

import React, { useEffect, useState, useRef, useMemo } from 'react';
import { Search, MapPin, AlertTriangle, Gauge, Clock, Zap, EyeOff, Filter, ChevronDown } from 'lucide-react';
import { useGoogleMaps } from '@/hooks/use-google-maps';

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

function parseZonePoints(raw: string | { x: number; y: number }[] | undefined): { x: number; y: number }[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    } catch {}
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
  for (const k of keys) {
    if (k && map.has(k)) return map.get(k);
  }
  const plate = (v.plate || '').trim().toUpperCase();
  if (plate.includes(' - ')) {
    const regPart = plate.split(' - ')[1]?.trim();
    if (regPart && map.has(regPart)) return map.get(regPart);
  }
  return undefined;
}

function createVehicleIcon(color: string, size: number): google.maps.Icon {
  return {
    url: `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${Math.round(size * 1.4)}" viewBox="0 0 ${size} ${Math.round(size * 1.4)}"><path d="M${size/2} 0C${size*0.3} 0 0 ${size*0.3} 0 ${size*0.45}c0 ${size*0.35} ${size/2} ${size*0.95} ${size/2} ${size*0.95}s${size/2} -${size*0.6} ${size/2} -${size*0.95}C${size} ${size*0.3} ${size*0.7} 0 ${size/2} 0z" fill="${color}"/><circle cx="${size/2}" cy="${size*0.38}" r="${size*0.22}" fill="white" opacity="0.9"/></svg>`)}`,
    scaledSize: new google.maps.Size(size, Math.round(size * 1.4)),
    anchor: new google.maps.Point(size / 2, Math.round(size * 1.4)),
  };
}

const EPS = '/api/video-server';

export function FleetMapTab() {
  const mapRef = useRef<HTMLDivElement>(null);
  const googleMapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<Map<string, google.maps.Marker>>(new Map());
  const markerIntervalsRef = useRef<Map<string, ReturnType<typeof setInterval>>>(new Map());
  const zonePolygonsRef = useRef<google.maps.Polygon[]>([]);
  const { loaded: googleMapsLoaded, error: googleMapsError } = useGoogleMaps();

  const [vehicleStatuses, setVehicleStatuses] = useState<VehicleStatus[]>([]);
  const [vehicleIdentities, setVehicleIdentities] = useState<Map<string, VehicleIdentity>>(new Map());
  const [zones, setZones] = useState<Zone[]>([]);
  const [search, setSearch] = useState('');
  const [costCenterFilter, setCostCenterFilter] = useState<string>('all');
  const [costCenters, setCostCenters] = useState<string[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState<string | null>(null);
  const [flashingVehicles, setFlashingVehicles] = useState<Set<string>>(new Set());
  const [flashingMapMarkers, setFlashingMapMarkers] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [eventVehicleOrder, setEventVehicleOrder] = useState<string[]>([]);

  // Fetch Supabase vehicle identities + build cost center list
  useEffect(() => {
    const fetchIdentities = async () => {
      try {
        const res = await fetch('/api/vehicle-lookup?all=1', {
          cache: 'no-store',
          signal: AbortSignal.timeout(30000),
        });
        const json = await res.json();
        const rows: VehicleIdentity[] = Array.isArray(json?.vehicles) ? json.vehicles : [];
        const map = new Map<string, VehicleIdentity>();
        const centers = new Set<string>();
        for (const row of rows) {
          if (row.deviceId) map.set(row.deviceId.toUpperCase(), row);
          if (row.plate) map.set(row.plate.toUpperCase(), row);
          if (row.fleetNumber) map.set(row.fleetNumber.toUpperCase(), row);
          if (row.costCenter) centers.add(row.costCenter);
        }
        setVehicleIdentities(map);
        setCostCenters(Array.from(centers).sort());
      } catch (e) {
        console.warn('[FleetMap] Vehicle lookup failed:', e);
      }
    };
    fetchIdentities();
  }, []);

  // Fetch vehicle statuses and ALL zones in parallel
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const [vehicleRes, zoneRes] = await Promise.allSettled([
        fetch(`${EPS}/telematics/vehicle-status-all`, { cache: 'no-store' }),
        fetch(`${EPS}/telematics/zones`, { cache: 'no-store' }),
      ]);

      if (vehicleRes.status === 'fulfilled') {
        const data = await vehicleRes.value.json();
        if (data?.data) setVehicleStatuses(data.data);
      }

      if (zoneRes.status === 'fulfilled') {
        const data = await zoneRes.value.json();
        if (data?.data) setZones(data.data);
      }

      setLoading(false);
    };
    fetchData();
  }, []);

  // Filter to only vehicles in Supabase + cost center filter
  const supabaseVehicles = useMemo(() => {
    return vehicleStatuses.filter((v) => {
      const identity = findIdentity(v, vehicleIdentities);
      if (!identity) return false;
      if (costCenterFilter !== 'all' && identity.costCenter !== costCenterFilter) return false;
      return true;
    });
  }, [vehicleStatuses, vehicleIdentities, costCenterFilter]);

  const vehiclesWithPosition = useMemo(() => {
    return supabaseVehicles.filter((v) => v.latitude && v.longitude);
  }, [supabaseVehicles]);

  // Sort: event vehicles first, then by last_log_time desc
  const sortedVehicles = useMemo(() => {
    const withIdentity = vehiclesWithPosition.map((v) => ({
      v,
      identity: findIdentity(v, vehicleIdentities),
      isEvent: flashingVehicles.has(v.device_id),
    }));

    withIdentity.sort((a, b) => {
      if (a.isEvent && !b.isEvent) return -1;
      if (!a.isEvent && b.isEvent) return 1;
      const aIdx = eventVehicleOrder.indexOf(a.v.device_id);
      const bIdx = eventVehicleOrder.indexOf(b.v.device_id);
      if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
      if (aIdx !== -1) return -1;
      if (bIdx !== -1) return 1;
      return 0;
    });

    return withIdentity.map(({ v, identity }) => ({ v, identity }));
  }, [vehiclesWithPosition, vehicleIdentities, flashingVehicles, eventVehicleOrder]);

  // Connect WebSocket for live position updates + events
  useEffect(() => {
    const wsUrl = process.env.NEXT_PUBLIC_GEOTAB_WS_URL || `ws://${window.location.hostname}:3004`;
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
              // Flash in sidebar
              setFlashingVehicles((prev) => new Set(prev).add(deviceId));
              // Flash on map
              setFlashingMapMarkers((prev) => new Set(prev).add(deviceId));
              // Pull to top
              setEventVehicleOrder((prev) => [deviceId, ...prev.filter((id) => id !== deviceId)]);
              setTimeout(() => {
                setFlashingVehicles((prev) => {
                  const next = new Set(prev);
                  next.delete(deviceId);
                  return next;
                });
                setFlashingMapMarkers((prev) => {
                  const next = new Set(prev);
                  next.delete(deviceId);
                  return next;
                });
              }, 10000);
            }
          } catch {}
        };

        ws.onclose = () => {
          reconnectTimeout = setTimeout(connect, 5000);
        };

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

  // Initialize and update Google Map
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
        center,
        zoom: 7,
        mapTypeId: 'roadmap',
        mapTypeControl: false,
        fullscreenControl: false,
        streetViewControl: false,
        zoomControl: true,
      });
    }

    const map = googleMapRef.current;

    // Draw ALL zones
    zonePolygonsRef.current.forEach((p) => p.setMap(null));
    zonePolygonsRef.current = [];

    zones.forEach((zone) => {
      const pts = parseZonePoints(zone.points);
      if (pts.length < 3) return;

      let strokeColor = '#94a3b8';
      let fillColor = '#94a3b8';
      let fillOpacity = 0.05;
      let strokeWeight = 1;

      if (zone.is_no_go) {
        strokeColor = '#dc2626';
        fillColor = '#dc2626';
        fillOpacity = 0.15;
        strokeWeight = 2;
      } else if (zone.is_high_risk) {
        strokeColor = '#f97316';
        fillColor = '#f97316';
        fillOpacity = 0.10;
        strokeWeight = 2;
      }

      const polygon = new window.google.maps.Polygon({
        paths: pts.map((p) => ({ lat: p.y, lng: p.x })),
        strokeColor,
        strokeOpacity: 0.8,
        strokeWeight,
        fillColor,
        fillOpacity,
        clickable: false,
      });
      polygon.setMap(map);
      zonePolygonsRef.current.push(polygon);
    });

    // Draw vehicle markers
    vehiclesWithPosition.forEach((v) => {
      if (!v.latitude || !v.longitude) return;
      const identity = findIdentity(v, vehicleIdentities);
      const label = getVehicleLabel(v, identity);
      const moving = isMoving(v);
      const flashing = flashingMapMarkers.has(v.device_id);
      const selected = selectedVehicle === v.device_id;

      let color = moving ? '#2563eb' : '#64748b';
      let size = 18;
      if (flashing) { color = '#ef4444'; size = 26; }
      if (selected) { color = '#7c3aed'; size = 26; }

      const existing = markersRef.current.get(v.device_id);
      if (existing) {
        existing.setPosition({ lat: v.latitude, lng: v.longitude });
        existing.setIcon(createVehicleIcon(color, size));
        existing.setZIndex(flashing ? 300 : selected ? 200 : 100);
        // Flash animation: toggle visibility
        if (flashing && !markerIntervalsRef.current.has(v.device_id)) {
          let visible = true;
          const interval = setInterval(() => {
            visible = !visible;
            existing.setOpacity(visible ? 1 : 0.2);
          }, 400);
          markerIntervalsRef.current.set(v.device_id, interval);
          setTimeout(() => {
            clearInterval(interval);
            markerIntervalsRef.current.delete(v.device_id);
            existing.setOpacity(1);
            setFlashingMapMarkers((prev) => {
              const next = new Set(prev);
              next.delete(v.device_id);
              return next;
            });
          }, 10000);
        }
        return;
      }

      const marker = new window.google.maps.Marker({
        position: { lat: v.latitude, lng: v.longitude },
        map,
        icon: createVehicleIcon(color, size),
        title: `${label} — ${moving ? `${Math.round(v.speed!)} km/h` : 'Stationary'}`,
        zIndex: flashing ? 300 : selected ? 200 : 100,
      });

      marker.addListener('click', () => {
        setSelectedVehicle(v.device_id);
        map.setCenter({ lat: v.latitude!, lng: v.longitude! });
        map.setZoom(14);
      });

      markersRef.current.set(v.device_id, marker);
    });
  }, [googleMapsLoaded, vehiclesWithPosition, zones, flashingMapMarkers, selectedVehicle, vehicleIdentities]);

  const filteredVehicles = useMemo(() => {
    if (!search) return sortedVehicles;
    const q = search.toLowerCase();
    return sortedVehicles.filter(({ v, identity }) => {
      const label = getVehicleLabel(v, identity);
      return (
        label.toLowerCase().includes(q) ||
        (v.plate || '').toLowerCase().includes(q) ||
        (v.license_plate || '').toLowerCase().includes(q) ||
        (identity?.make || '').toLowerCase().includes(q) ||
        (identity?.costCenter || '').toLowerCase().includes(q)
      );
    });
  }, [sortedVehicles, search]);

  if (googleMapsError) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-rose-500">
        {googleMapsError}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-0 flex flex-col">
      {/* Map area */}
      <div className="relative flex-1">
        <div ref={mapRef} className="absolute inset-0" />

        {/* Loading overlay */}
        {loading && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/80">
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
              Loading fleet map...
            </div>
          </div>
        )}

        {/* Floating legend on map */}
        <div className="absolute top-3 left-3 z-10 flex items-center gap-3 rounded-lg bg-white/90 px-3 py-1.5 text-[10px] font-medium text-slate-600 shadow-md backdrop-blur-sm">
          <span className="flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-blue-600" /> Moving
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-slate-400" /> Stationary
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-red-500" /> Alert
          </span>
          <span className="text-slate-300">|</span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded-sm bg-orange-500/30 border border-orange-500" /> High Risk
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded-sm bg-red-500/30 border border-red-500" /> No-Go
          </span>
        </div>
      </div>

      {/* Right sidebar */}
      <div className="absolute top-14 right-0 bottom-0 z-10 flex w-80 flex-col border-l border-slate-200 bg-white shadow-2xl">
        {/* Header + search + cost center filter */}
        <div className="border-b border-slate-200 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600">
                <MapPin className="h-4 w-4 text-white" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">All Vehicles</h3>
                <p className="text-[11px] text-slate-500">{filteredVehicles.length} tracked</p>
              </div>
            </div>
          </div>

          {/* Search */}
          <div className="relative mt-3">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search plate or driver..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-3 text-sm outline-none transition-colors focus:border-blue-400 focus:bg-white focus:ring-1 focus:ring-blue-400"
            />
          </div>

          {/* Cost Center Dropdown */}
          {costCenters.length > 0 && (
            <div className="relative mt-2">
              <Filter className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <select
                value={costCenterFilter}
                onChange={(e) => setCostCenterFilter(e.target.value)}
                className="w-full appearance-none rounded-lg border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-8 text-sm text-slate-700 outline-none transition-colors focus:border-blue-400 focus:bg-white focus:ring-1 focus:ring-blue-400"
              >
                <option value="all">All Cost Centers</option>
                {costCenters.map((cc) => (
                  <option key={cc} value={cc}>{cc}</option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
            </div>
          )}
        </div>

        {/* Vehicle list */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
          {filteredVehicles.map(({ v, identity }) => {
            const label = getVehicleLabel(v, identity);
            const moving = isMoving(v);
            const flashing = flashingVehicles.has(v.device_id);
            const isSelected = selectedVehicle === v.device_id;

            return (
              <div
                key={v.device_id}
                onClick={() => {
                  setSelectedVehicle(v.device_id);
                  if (googleMapRef.current && v.latitude && v.longitude) {
                    googleMapRef.current.setCenter({ lat: v.latitude, lng: v.longitude });
                    googleMapRef.current.setZoom(14);
                  }
                }}
                className={`cursor-pointer rounded-xl border bg-white p-3.5 shadow-sm transition-all hover:shadow-md ${
                  flashing
                    ? 'border-red-300 bg-red-50 ring-2 ring-red-200 animate-pulse'
                    : isSelected
                    ? 'border-blue-300 bg-blue-50 ring-2 ring-blue-200'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                {/* Top row: label + status badge */}
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-slate-900">{label}</span>
                  {flashing ? (
                    <span className="flex items-center gap-0.5 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-600 animate-pulse">
                      <AlertTriangle className="h-2.5 w-2.5" /> ALERT
                    </span>
                  ) : (
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        moving
                          ? 'bg-green-100 text-green-700'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {moving ? 'Moving' : 'Stationary'}
                    </span>
                  )}
                </div>

                {/* Subtitle */}
                {identity?.make && (
                  <p className="mt-1 text-[11px] text-slate-500">
                    {identity.make}{identity.model ? ` ${identity.model}` : ''}
                    {identity.costCenter ? ` · ${identity.costCenter}` : ''}
                  </p>
                )}

                {/* Stats row */}
                <div className="mt-2.5 flex items-center gap-4 text-[11px] text-slate-600">
                  <span className="flex items-center gap-1">
                    <Gauge className="h-3 w-3 text-slate-400" />
                    {v.speed != null ? `${Math.round(v.speed)} km/h` : '—'}
                  </span>
                  <span className="flex items-center gap-1">
                    {moving ? (
                      <Zap className="h-3 w-3 text-green-500" />
                    ) : (
                      <EyeOff className="h-3 w-3 text-slate-400" />
                    )}
                    {moving ? 'Running' : 'Off'}
                  </span>
                </div>

                {/* Last seen */}
                {v.last_log_time && (
                  <div className="mt-2 flex items-center gap-1 text-[10px] text-slate-400">
                    <Clock className="h-3 w-3" />
                    Last seen: {new Date(v.last_log_time).toLocaleString()}
                  </div>
                )}
              </div>
            );
          })}
          {filteredVehicles.length === 0 && !loading && (
            <div className="p-6 text-center text-sm text-slate-400">
              {vehicleIdentities.size === 0
                ? 'Loading vehicle data...'
                : 'No vehicles found'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
