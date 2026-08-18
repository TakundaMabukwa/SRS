'use client';
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { X, MapPin, Navigation, AlertTriangle, Gauge } from 'lucide-react';
import { cn } from '@/lib/utils';

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
  driverName: string | null;
  eventTime: string;
};

type Props = {
  deviceId: string;
  isOpen: boolean;
  onClose: () => void;
};

const EPS = '/api/video-server';

export function RealTimeMapModal({ deviceId, isOpen, onClose }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [zones, setZones] = useState<Zone[]>([]);
  const [vehicle, setVehicle] = useState<VehicleStatus | null>(null);
  const [path, setPath] = useState<LogRecord[]>([]);
  const [events, setEvents] = useState<TelematicsEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
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

      if (zonesData?.data) setZones(zonesData.data);
      if (statusData?.data) setVehicle(statusData.data);
      if (logsData?.data) setPath(logsData.data);
      if (eventsData?.data) setEvents(eventsData.data.filter((e: TelematicsEvent) => e.latitude && e.longitude));
    } catch (e) {
      console.error('Failed to fetch map data:', e);
    } finally {
      setLoading(false);
    }
  }, [deviceId]);

  useEffect(() => {
    if (isOpen) fetchData();
  }, [isOpen, fetchData]);

  // Draw map on canvas
  useEffect(() => {
    if (!canvasRef.current || !isOpen) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;

    // Clear
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, W, H);

    // Collect all coordinates for bounds
    const allCoords: { lat: number; lon: number }[] = [];

    // Parse zone points
    const parsedZones = zones.map((z) => {
      const pts = parseZonePoints(z.points);
      pts.forEach((p) => allCoords.push({ lat: p.y, lon: p.x }));
      return { ...z, parsedPoints: pts };
    });

    // Vehicle position
    if (vehicle?.latitude && vehicle?.longitude) {
      allCoords.push({ lat: vehicle.latitude, lon: vehicle.longitude });
    }

    // Path points
    path.forEach((p) => allCoords.push({ lat: p.latitude, lon: p.longitude }));

    // Telematics events
    events.forEach((e) => {
      if (e.latitude && e.longitude) allCoords.push({ lat: e.latitude, lon: e.longitude });
    });

    if (allCoords.length === 0) {
      ctx.fillStyle = '#64748b';
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('No location data available', W / 2, H / 2);
      return;
    }

    // Calculate bounds with padding
    const lats = allCoords.map((c) => c.lat);
    const lons = allCoords.map((c) => c.lon);
    const minLat = Math.min(...lats) - 0.005;
    const maxLat = Math.max(...lats) + 0.005;
    const minLon = Math.min(...lons) - 0.005;
    const maxLon = Math.max(...lons) + 0.005;

    const latRange = maxLat - minLat || 0.01;
    const lonRange = maxLon - minLon || 0.01;
    const padding = 40;
    const mapW = W - padding * 2;
    const mapH = H - padding * 2;

    const toX = (lon: number) => padding + ((lon - minLon) / lonRange) * mapW;
    const toY = (lat: number) => padding + ((maxLat - lat) / latRange) * mapH;

    // Draw grid lines
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= 4; i++) {
      const x = padding + (i / 4) * mapW;
      ctx.beginPath(); ctx.moveTo(x, padding); ctx.lineTo(x, H - padding); ctx.stroke();
      const y = padding + (i / 4) * mapH;
      ctx.beginPath(); ctx.moveTo(padding, y); ctx.lineTo(W - padding, y); ctx.stroke();
    }

    // Draw zones
    parsedZones.forEach((zone) => {
      if (zone.parsedPoints.length < 3) return;
      ctx.beginPath();
      ctx.moveTo(toX(zone.parsedPoints[0].x), toY(zone.parsedPoints[0].y));
      zone.parsedPoints.forEach((p) => ctx.lineTo(toX(p.x), toY(p.y)));
      ctx.closePath();

      if (zone.is_no_go) {
        ctx.fillStyle = 'rgba(239, 68, 68, 0.15)';
        ctx.strokeStyle = '#ef4444';
      } else if (zone.is_high_risk) {
        ctx.fillStyle = 'rgba(249, 115, 22, 0.15)';
        ctx.strokeStyle = '#f97316';
      } else {
        ctx.fillStyle = 'rgba(59, 130, 246, 0.1)';
        ctx.strokeStyle = '#3b82f6';
      }
      ctx.lineWidth = 1.5;
      ctx.fill();
      ctx.stroke();

      // Zone label
      const cx = zone.parsedPoints.reduce((s, p) => s + toX(p.x), 0) / zone.parsedPoints.length;
      const cy = zone.parsedPoints.reduce((s, p) => s + toY(p.y), 0) / zone.parsedPoints.length;
      ctx.fillStyle = zone.is_no_go ? '#ef4444' : zone.is_high_risk ? '#f97316' : '#3b82f6';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(zone.name, cx, cy);
    });

    // Draw path
    if (path.length > 1) {
      ctx.beginPath();
      ctx.moveTo(toX(path[0].longitude), toY(path[0].latitude));
      path.forEach((p) => ctx.lineTo(toX(p.longitude), toY(p.latitude)));
      ctx.strokeStyle = '#22d3ee';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 3]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Draw path points
    path.forEach((p) => {
      ctx.beginPath();
      ctx.arc(toX(p.longitude), toY(p.latitude), 3, 0, Math.PI * 2);
      ctx.fillStyle = '#22d3ee';
      ctx.fill();
    });

    // Draw telematics events (speeding, harsh braking, etc.)
    events.forEach((evt) => {
      if (!evt.latitude || !evt.longitude) return;
      const ex = toX(evt.longitude);
      const ey = toY(evt.latitude);
      const isSpeeding = /speed/i.test(evt.eventType || evt.eventCode || '');
      const isHarsh = /harsh|braking|cornering/i.test(evt.eventType || evt.eventCode || '');
      const color = isSpeeding ? '#ef4444' : isHarsh ? '#f97316' : '#eab308';

      // Pulse ring
      ctx.beginPath();
      ctx.arc(ex, ey, 10, 0, Math.PI * 2);
      ctx.fillStyle = color + '26'; // 15% opacity hex
      ctx.fill();

      // Event dot
      ctx.beginPath();
      ctx.arc(ex, ey, 5, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 2;
      ctx.fill();
      ctx.stroke();

      // Label
      ctx.fillStyle = color;
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(evt.eventType, ex, ey - 12);
    });

    // Draw vehicle marker (larger, on top)
    if (vehicle?.latitude && vehicle?.longitude) {
      const vx = toX(vehicle.longitude);
      const vy = toY(vehicle.latitude);

      // Outer ring
      ctx.beginPath();
      ctx.arc(vx, vy, 12, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(34, 211, 238, 0.3)';
      ctx.fill();

      // Inner dot
      ctx.beginPath();
      ctx.arc(vx, vy, 6, 0, Math.PI * 2);
      ctx.fillStyle = '#22d3ee';
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 2;
      ctx.fill();
      ctx.stroke();

      // Label
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(
        `${vehicle.fleet_number || vehicle.plate || vehicle.device_id}${vehicle.speed ? ` • ${Math.round(vehicle.speed)} km/h` : ''}`,
        vx + 16,
        vy + 4
      );
    }
  }, [zones, vehicle, path, events, isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="w-full max-w-5xl rounded-xl border border-slate-700 bg-slate-950 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
          <div>
            <div className="text-sm font-semibold text-white">
              {vehicle ? `${vehicle.fleet_number || vehicle.plate || ''} — Real-time Map` : 'Vehicle Map'}
            </div>
            <div className="text-[11px] text-slate-400">
              {zones.filter((z) => z.is_high_risk || z.is_no_go).length} high-risk/no-go zones
              {events.length > 0 ? ` • ${events.length} event${events.length === 1 ? '' : 's'} in last 15 min` : ''}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {loading && <span className="text-[10px] text-cyan-400 animate-pulse">Loading...</span>}
            <Button size="icon" variant="ghost" className="h-7 w-7 text-slate-400 hover:text-white" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="p-2">
          <canvas
            ref={canvasRef}
            width={960}
            height={540}
            className="w-full rounded-lg border border-slate-800"
            style={{ background: '#0f172a' }}
          />
        </div>
        <div className="flex items-center gap-4 border-t border-slate-800 px-4 py-2 text-[10px] text-slate-400">
          <span className="flex items-center gap-1"><span className="inline-block w-3 h-0.5 bg-cyan-400" /> Vehicle path</span>
          <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-full border-2 border-cyan-400 bg-cyan-400/30" /> Current location</span>
          <span className="flex items-center gap-1"><span className="inline-block w-3 h-2 bg-orange-500/30 border border-orange-500" /> High Risk</span>
          <span className="flex items-center gap-1"><span className="inline-block w-3 h-2 bg-red-500/30 border border-red-500" /> No Go Zone</span>
        </div>
      </div>
    </div>
  );
}
