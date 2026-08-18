'use client';
import React, { useEffect, useState, useRef, useCallback } from 'react';

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

type Props = {
  deviceId: string;
  alertLat: number;
  alertLon: number;
  alertTime?: string; // ISO timestamp of the alert
};

const EPS = '/api/video-server';

export function RealTimeMapInline({ deviceId, alertLat, alertLon, alertTime }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [zones, setZones] = useState<Zone[]>([]);
  const [path, setPath] = useState<LogRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!deviceId) { setLoading(false); return; }
    let cancelled = false;
    const fetchData = async () => {
      try {
        // ±15 min around alert time, or last 30 min if no alert time
        const center = alertTime ? new Date(alertTime).getTime() : Date.now();
        const from = new Date(center - 15 * 60 * 1000).toISOString();
        const to = new Date(center + 15 * 60 * 1000).toISOString();

        const [zonesRes, logsRes] = await Promise.all([
          fetch(`${EPS}/telematics/zones`, { cache: 'no-store' }),
          fetch(`${EPS}/telematics/log-records/${deviceId}?from=${from}&to=${to}`, { cache: 'no-store' }),
        ]);
        const zonesData = await zonesRes.json().catch(() => ({}));
        const logsData = await logsRes.json().catch(() => ({}));
        if (!cancelled) {
          if (zonesData?.data) setZones(zonesData.data);
          if (logsData?.data) setPath(logsData.data);
        }
      } catch {} finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchData();
    return () => { cancelled = true; };
  }, [deviceId, alertTime]);

  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, W, H);

    const allCoords: { lat: number; lon: number }[] = [{ lat: alertLat, lon: alertLon }];
    const parsedZones = zones.map((z) => {
      const pts = parseZonePoints(z.points);
      pts.forEach((p) => allCoords.push({ lat: p.y, lon: p.x }));
      return { ...z, parsedPoints: pts };
    });
    path.forEach((p) => allCoords.push({ lat: p.latitude, lon: p.longitude }));

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

    // Grid
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= 4; i++) {
      const x = padding + (i / 4) * mapW;
      ctx.beginPath(); ctx.moveTo(x, padding); ctx.lineTo(x, H - padding); ctx.stroke();
      const y = padding + (i / 4) * mapH;
      ctx.beginPath(); ctx.moveTo(padding, y); ctx.lineTo(W - padding, y); ctx.stroke();
    }

    // Zones
    parsedZones.forEach((zone) => {
      if (zone.parsedPoints.length < 3) return;
      ctx.beginPath();
      ctx.moveTo(toX(zone.parsedPoints[0].x), toY(zone.parsedPoints[0].y));
      zone.parsedPoints.forEach((p) => ctx.lineTo(toX(p.x), toY(p.y)));
      ctx.closePath();
      if (zone.is_no_go) { ctx.fillStyle = 'rgba(239,68,68,0.15)'; ctx.strokeStyle = '#ef4444'; }
      else if (zone.is_high_risk) { ctx.fillStyle = 'rgba(249,115,22,0.15)'; ctx.strokeStyle = '#f97316'; }
      else { ctx.fillStyle = 'rgba(59,130,246,0.1)'; ctx.strokeStyle = '#3b82f6'; }
      ctx.lineWidth = 1.5;
      ctx.fill(); ctx.stroke();
      const cx = zone.parsedPoints.reduce((s, p) => s + toX(p.x), 0) / zone.parsedPoints.length;
      const cy = zone.parsedPoints.reduce((s, p) => s + toY(p.y), 0) / zone.parsedPoints.length;
      ctx.fillStyle = zone.is_no_go ? '#ef4444' : zone.is_high_risk ? '#f97316' : '#3b82f6';
      ctx.font = '9px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(zone.name, cx, cy);
    });

    // Path
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
    path.forEach((p) => {
      ctx.beginPath();
      ctx.arc(toX(p.longitude), toY(p.latitude), 3, 0, Math.PI * 2);
      ctx.fillStyle = '#22d3ee';
      ctx.fill();
    });

    // Alert marker
    const ax = toX(alertLon);
    const ay = toY(alertLat);
    ctx.beginPath(); ctx.arc(ax, ay, 14, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(239,68,68,0.3)'; ctx.fill();
    ctx.beginPath(); ctx.arc(ax, ay, 7, 0, Math.PI * 2);
    ctx.fillStyle = '#ef4444'; ctx.strokeStyle = '#0f172a'; ctx.lineWidth = 2; ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#ffffff'; ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'left';
    ctx.fillText('Alert', ax + 16, ay + 4);
  }, [zones, path, alertLat, alertLon]);

  return (
    <canvas
      ref={canvasRef}
      width={960}
      height={400}
      className="w-full rounded-lg border border-slate-800"
      style={{ background: '#0f172a' }}
    />
  );
}
