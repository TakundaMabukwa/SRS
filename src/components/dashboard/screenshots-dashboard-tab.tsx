/* eslint-disable @next/next/no-img-element */
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw, Shield, ExternalLink, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type DbVehicle = {
  registration_number: string;
  fleet_number: string;
  cost_center: string;
  camera_sim_id: string;
};

type GalleryFile = {
  deviceName: string;
  deviceId: string;
  channelId: number;
  channelName: string;
  fileUrl: string;
  fileType: string;
  createTime: string;
};

type VehicleCard = {
  registration: string;
  fleetNumber: string;
  costCenter: string;
  deviceId: string | null;
  online: boolean;
  cameras: number;
  ch1Url: string | null;
  ch2Url: string | null;
  ch1Time: string | null;
  ch2Time: string | null;
};

const EPS_API = "/api/video-server";
const REFRESH_INTERVAL_MS = 30000;
const SCREENSHOT_WINDOW_MS = 10 * 60 * 1000;

function normalizeCostCenter(value: unknown): string {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function matchesCostCenterFilter(costCenter: string, selectedCostCenters: Set<string>) {
  if (selectedCostCenters.size === 0) return true;
  const normalized = normalizeCostCenter(costCenter);
  if (!normalized) return selectedCostCenters.has("unassigned");
  return selectedCostCenters.has(normalized);
}

function parseDate(value?: string | null): number {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function toProxiedUrl(rawUrl: string): string {
  if (!rawUrl) return "";
  return `${EPS_API}/eps/stream/stream/proxy?url=${encodeURIComponent(rawUrl)}`;
}

function withCacheBuster(url: string): string {
  if (!url) return "";
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}_ts=${Date.now()}`;
}

type ScreenshotsDashboardTabProps = {
  detachable?: boolean;
  selectedCostCenters?: string[];
};

export default function ScreenshotsDashboardTab({
  detachable = true,
  selectedCostCenters = [],
}: ScreenshotsDashboardTabProps) {
  const supabase = createClient();
  const dbVehiclesRef = useRef<DbVehicle[] | null>(null);
  const [cards, setCards] = useState<VehicleCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [lastScreenshotAt, setLastScreenshotAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [gridColumns, setGridColumns] = useState(2);
  const [modalImage, setModalImage] = useState<string | null>(null);
  const activeRef = useRef(true);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevCardsRef = useRef<VehicleCard[]>([]);

  const fetchDbOnce = useCallback(async () => {
    if (dbVehiclesRef.current) return dbVehiclesRef.current;
    try {
      const { data } = await supabase
        .from("vehiclesc")
        .select("registration_number, fleet_number, cost_center, camera_sim_id");
      const rows = (data || []) as DbVehicle[];
      const unique = new Map<string, DbVehicle>();
      for (const r of rows) {
        const reg = (r.registration_number || "").trim().toUpperCase();
        if (!reg) continue;
        if (!unique.has(reg)) {
          unique.set(reg, { registration_number: reg, fleet_number: r.fleet_number || "", cost_center: r.cost_center || "", camera_sim_id: (r.camera_sim_id || "").trim() });
        }
      }
      dbVehiclesRef.current = Array.from(unique.values());
      return dbVehiclesRef.current;
    } catch {
      return dbVehiclesRef.current || [];
    }
  }, [supabase]);

  const fetchData = useCallback(async () => {
    try {
      const dbVehicles = await fetchDbOnce();
      if (!activeRef.current) return;

      // Fetch online status (returns ALL devices with plateName + deviceId + online)
      const onlineRes = await fetch(`${EPS_API}/eps/stream/online`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: "{}",
        cache: "no-store", signal: AbortSignal.timeout(15000),
      }).catch(() => null);
      if (!activeRef.current) return;

      // Build fleet/reg -> {deviceId, online, cameras} map from EPS plateNames
      // plateName format: "FLEET - REG" e.g. "FM02 - LDG095MP"
      const regMap = new Map<string, { deviceId: string; online: boolean; cameras: number }>();
      if (onlineRes && onlineRes.ok) {
        const onlineData = await onlineRes.json();
        if (onlineData.success && onlineData.data?.devices) {
          for (const d of onlineData.data.devices) {
            if (!d.deviceId) continue;
            const plate = (d.plateName || "").trim();
            const parts = plate.split(" - ");
            const fleetNum = (parts[0] || "").trim();
            const regNum = (parts[1] || "").trim();
            if (fleetNum) {
              regMap.set(fleetNum.toUpperCase(), { deviceId: d.deviceId, online: d.online === true, cameras: d.cameras || 1 });
            }
            if (regNum) {
              regMap.set(regNum.toUpperCase(), { deviceId: d.deviceId, online: d.online === true, cameras: d.cameras || 1 });
            }
          }
        }
      }

      // Build vehicle cards from DB, matching fleet_number or registration_number -> plateName
      const matchedDeviceIds: string[] = [];
      const built: VehicleCard[] = dbVehicles.map((v) => {
        const fleetMatch = regMap.get((v.fleet_number || "").toUpperCase());
        const regMatch = regMap.get((v.registration_number || "").toUpperCase());
        const match = fleetMatch || regMatch;
        const deviceId = match ? match.deviceId : null;
        if (deviceId) matchedDeviceIds.push(deviceId);
        const online = match ? match.online : false;
        return {
          registration: v.registration_number,
          fleetNumber: v.fleet_number,
          costCenter: v.cost_center,
          deviceId,
          online,
          cameras: match ? match.cameras : 0,
          ch1Url: null, ch2Url: null, ch1Time: null, ch2Time: null,
        };
      });

      // Fetch gallery screenshots for matched devices
      if (matchedDeviceIds.length > 0) {
        const now = new Date();
        const end = now.toISOString().replace("T", " ").slice(0, 19);
        const start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().replace("T", " ").slice(0, 19);

        const galRes = await fetch(`${EPS_API}/eps/gallery/files/page`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pageSize: 500, pageIndex: 1, deviceIds: matchedDeviceIds.join(","), startTime: start, endTime: end, queryType: "Device" }),
          cache: "no-store",
          signal: AbortSignal.timeout(20000),
        });
        if (galRes.ok) {
          const galData = await galRes.json();
          const files: GalleryFile[] = galData.data?.files || [];
          const byDevice: Record<string, Record<number, GalleryFile>> = {};
          for (const f of files) {
            const ch = f.channelId || 1;
            if (!byDevice[f.deviceId]) byDevice[f.deviceId] = {};
            const existing = byDevice[f.deviceId][ch];
            if (!existing || (f.createTime || "") > (existing.createTime || "")) {
              byDevice[f.deviceId][ch] = f;
            }
          }
          for (const card of built) {
            if (!card.deviceId) continue;
            const dev = byDevice[card.deviceId];
            if (!dev) continue;
            if (dev[1]) { card.ch1Url = toProxiedUrl(dev[1].fileUrl); card.ch1Time = dev[1].createTime; }
            if (dev[2]) { card.ch2Url = toProxiedUrl(dev[2].fileUrl); card.ch2Time = dev[2].createTime; }
          }
        }
      }

      // Auto-trigger captures for online vehicles with no screenshots (fire-and-forget)
      const needCapture = built.filter((c) => c.online && c.deviceId && !c.ch1Url && !c.ch2Url);
      if (needCapture.length > 0) {
        const captures = needCapture.flatMap((c) => {
          const camCount = c.cameras || 1;
          return Array.from({ length: camCount }, (_, i) => ({ deviceId: c.deviceId!, channelId: i + 1 }));
        });
        fetch(`${EPS_API}/eps/gallery/capture`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ captures }),
        }).catch(() => {});
      }

      if (!activeRef.current) return;

      // Keep last images per-channel if no new data arrived
      const prevImages = prevCardsRef.current;
      for (const card of built) {
        const prev = prevImages.find((c) => c.registration === card.registration);
        if (prev) {
          if (!card.ch1Url && prev.ch1Url) { card.ch1Url = prev.ch1Url; card.ch1Time = prev.ch1Time; }
          if (!card.ch2Url && prev.ch2Url) { card.ch2Url = prev.ch2Url; card.ch2Time = prev.ch2Time; }
        }
      }

      prevCardsRef.current = built;
      setCards(built);
      setLastRefresh(new Date());
      if (built.some((c) => c.ch1Url || c.ch2Url)) setLastScreenshotAt(new Date());
      setError(null);
      setLoading(false);
    } catch (e: any) {
      if (e.name === "AbortError") return;
      if (!activeRef.current) return;
      setError(e.message || "Failed to load");
      setLoading(false);
    }
  }, [fetchDbOnce]);

  const refreshAll = useCallback(async () => {
    setRefreshing(true);
    try { await fetchData(); } finally { setRefreshing(false); }
  }, [fetchData]);

  useEffect(() => {
    activeRef.current = true;
    fetchData().finally(() => setLoading(false));
    timerRef.current = setInterval(() => fetchData(), REFRESH_INTERVAL_MS);
    return () => {
      activeRef.current = false;
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [fetchData]);

  const selectedCostCenterSet = useMemo(
    () => new Set(selectedCostCenters.map((v) => normalizeCostCenter(v)).filter(Boolean)),
    [selectedCostCenters]
  );

  const scopedCards = useMemo(
    () => cards
      .filter((c) => matchesCostCenterFilter(c.costCenter, selectedCostCenterSet))
      .sort((a, b) => {
        if (a.online !== b.online) return a.online ? -1 : 1;
        return a.registration.localeCompare(b.registration);
      }),
    [selectedCostCenterSet, cards]
  );

  const onlineCount = useMemo(() => scopedCards.filter((c) => c.online).length, [scopedCards]);

  const gridClassName = useMemo(() => {
    const gap = gridColumns <= 4 ? "gap-2" : "gap-1";
    if (gridColumns <= 2) return `grid grid-cols-1 ${gap} md:grid-cols-2`;
    if (gridColumns <= 4) return `grid grid-cols-2 ${gap} md:grid-cols-3 xl:grid-cols-4`;
    if (gridColumns <= 6) return `grid grid-cols-3 ${gap} md:grid-cols-4 xl:grid-cols-6`;
    if (gridColumns <= 8) return `grid grid-cols-4 ${gap} md:grid-cols-6 xl:grid-cols-8`;
    return `grid grid-cols-5 ${gap} md:grid-cols-7 xl:grid-cols-10 2xl:grid-cols-10`;
  }, [gridColumns]);

  const liveCount = useMemo(() => {
    const now = Date.now();
    return scopedCards.filter((c) => {
      const t1 = parseDate(c.ch1Time);
      const t2 = parseDate(c.ch2Time);
      return (t1 > 0 && now - t1 <= SCREENSHOT_WINDOW_MS) || (t2 > 0 && now - t2 <= SCREENSHOT_WINDOW_MS);
    }).length;
  }, [scopedCards]);

  return (
    <div className="space-y-3">
      <Card className="overflow-hidden border-slate-800 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-800 text-slate-100 shadow-xl">
        <div className="p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-500/10 px-3 py-1 text-xs font-medium text-cyan-300">
                <Shield className="h-3.5 w-3.5" />
                Monitoring
              </div>
              <h2 className="text-xl font-bold tracking-tight">Screenshots</h2>
              <div className="flex items-center gap-3 text-xs text-slate-400">
                <span>{scopedCards.length} vehicles</span>
                <span className="text-emerald-400">{onlineCount} online</span>
                <span>{liveCount} live</span>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1">
                <span className="text-[10px] font-medium uppercase tracking-wide text-slate-500">Grid</span>
                {[2, 4, 6, 8, 10].map((cols) => (
                  <Button
                    key={cols}
                    type="button"
                    size="sm"
                    variant={gridColumns === cols ? "default" : "outline"}
                    className={`h-7 px-2 text-[11px] ${gridColumns === cols ? "bg-slate-700 text-white hover:bg-slate-600" : "border-slate-600 bg-slate-800 text-slate-400 hover:bg-slate-700"}`}
                    onClick={() => setGridColumns(cols)}
                  >
                    {cols}
                  </Button>
                ))}
              </div>
              <Button onClick={() => void refreshAll()} disabled={refreshing} size="sm" className="h-7 bg-cyan-600 hover:bg-cyan-700">
                <RefreshCw className={`mr-1 h-3 w-3 ${refreshing ? "animate-spin" : ""}`} />
                Refresh
              </Button>
              {detachable && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 border-slate-600 bg-slate-800 text-slate-400 hover:bg-slate-700"
                  onClick={() => window.open("/dashboard/screenshots-monitor", "screenshots-monitor", "popup=yes,width=1600,height=1000,resizable=yes,scrollbars=yes")}
                >
                  <ExternalLink className="mr-1 h-3 w-3" />
                  Pop Out
                </Button>
              )}
            </div>
          </div>
        </div>
      </Card>

      {error && (
        <div className="rounded bg-red-900/50 border border-red-800 px-3 py-2 text-xs text-red-300">{error}</div>
      )}

      {loading ? (
        <div className="p-10 text-center text-slate-500 text-sm">Loading screenshot monitor...</div>
      ) : scopedCards.length === 0 ? (
        <div className="p-10 text-center text-slate-500 text-sm">No vehicles found in the database.</div>
      ) : (
        <div className={gridClassName}>
            {scopedCards.map((card) => {
              const hasScreenshot = !!(card.ch1Url || card.ch2Url);
              return (
                <div key={card.registration} className="group relative overflow-hidden rounded bg-slate-900 border border-slate-700/50">
                  <div className="grid grid-cols-2 gap-px bg-slate-800">
                    {[1, 2].map((ch) => {
                      const url = ch === 1 ? card.ch1Url : (card.ch2Url !== card.ch1Url ? card.ch2Url : null);
                      return (
                        <div key={`${card.registration}-${ch}`} className="relative bg-slate-950 aspect-video">
                          {url ? (
                            <img
                              src={withCacheBuster(url)}
                              alt={`${card.registration} CH${ch}`}
                              className="absolute inset-0 w-full h-full object-cover cursor-pointer"
                              loading="lazy"
                              onClick={() => setModalImage(url)}
                            />
                          ) : (
                            <div className="absolute inset-0 flex items-center justify-center">
                              <span className="text-[10px] text-slate-600">
                                {card.online ? "Waiting" : "Offline"}
                              </span>
                            </div>
                          )}
                          <div className="absolute right-1 top-1 rounded bg-black/70 px-1 py-0.5 text-[9px] font-medium text-white/80">
                            CH{ch}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="absolute left-0 top-0 right-0 flex items-center justify-between bg-gradient-to-b from-black/80 via-black/40 to-transparent px-2 py-1.5 pointer-events-none">
                    <span className="text-[11px] font-semibold text-white truncate">{card.fleetNumber || card.registration}</span>
                    <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-medium ${
                      card.online ? (hasScreenshot ? "bg-emerald-500/90 text-white" : "bg-blue-500/90 text-white") : "bg-slate-600/90 text-slate-300"
                    }`}>
                      {card.online ? (hasScreenshot ? "LIVE" : "ON") : "OFF"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
      )}

      {modalImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90"
          onClick={() => setModalImage(null)}
        >
          <button
            className="absolute right-4 top-4 rounded-full bg-black/50 p-2 text-white hover:bg-black/70"
            onClick={() => setModalImage(null)}
          >
            <X className="h-6 w-6" />
          </button>
          <img
            src={withCacheBuster(modalImage)}
            alt="Screenshot full view"
            className="max-h-[90vh] max-w-[90vw] object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
