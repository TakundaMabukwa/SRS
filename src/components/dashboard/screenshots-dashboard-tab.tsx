/* eslint-disable @next/next/no-img-element */
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw, MonitorPlay, Shield, RadioTower, ExternalLink, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { toSAST } from "@/lib/utils/date-formatter";

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
  const [gridColumns, setGridColumns] = useState(4);
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
    switch (gridColumns) {
      case 1: return "grid grid-cols-1 gap-3";
      case 2: return "grid grid-cols-1 gap-3 md:grid-cols-2";
      case 3: return "grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3";
      case 4: return "grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4";
      case 5: return "grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5";
      case 6: return "grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-6";
      case 7: return "grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-7";
      case 8: return "grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-8";
      default: return "grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4";
    }
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
    <div className="space-y-6">
      <Card className="overflow-hidden border-slate-800 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-800 text-slate-100 shadow-xl">
        <div className="p-6 md:p-7">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-500/10 px-3 py-1 text-xs font-medium text-cyan-300">
                <Shield className="h-3.5 w-3.5" />
                Vehicle Screenshot Monitoring
              </div>
              <h2 className="mt-3 text-3xl font-bold tracking-tight">Screenshots</h2>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-slate-700 bg-slate-900/70 px-4 py-3">
                <p className="text-[11px] uppercase tracking-wide text-slate-400">Vehicles</p>
                <p className="mt-1 text-2xl font-bold text-emerald-300">{scopedCards.length}</p>
                <p className="mt-1 text-[11px] text-slate-400">{onlineCount} online</p>
              </div>
              <div className="rounded-lg border border-slate-700 bg-slate-900/70 px-4 py-3">
                <p className="text-[11px] uppercase tracking-wide text-slate-400">Live Channels</p>
                <p className="mt-1 text-2xl font-bold text-cyan-300">{liveCount}</p>
              </div>
              <div className="rounded-lg border border-slate-700 bg-slate-900/70 px-4 py-3">
                <p className="text-[11px] uppercase tracking-wide text-slate-400">Last Update</p>
                <p className="mt-1 text-sm font-semibold text-slate-100">
                  {lastScreenshotAt ? toSAST(lastScreenshotAt).toLocaleTimeString() : (lastRefresh ? toSAST(lastRefresh).toLocaleTimeString() : "Waiting...")}
                </p>
              </div>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button onClick={() => void refreshAll()} disabled={refreshing} className="bg-cyan-600 hover:bg-cyan-700">
              <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
              Refresh
            </Button>

            {detachable && (
              <Button
                variant="outline"
                onClick={() => window.open("/dashboard/screenshots-monitor", "screenshots-monitor", "popup=yes,width=1600,height=1000,resizable=yes,scrollbars=yes")}
                className="border-slate-600 bg-slate-900 text-slate-100 hover:bg-slate-800"
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                Pop Out Monitor
              </Button>
            )}
          </div>
        </div>
      </Card>

      {error && (
        <Card className="border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</Card>
      )}

      {loading ? (
        <Card className="p-10 text-center text-slate-600">Loading screenshot monitor...</Card>
      ) : scopedCards.length === 0 ? (
        <Card className="p-10 text-center text-slate-600">No vehicles found in the database.</Card>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-2">
              <RadioTower className="h-5 w-5 text-slate-700" />
              <h3 className="text-lg font-semibold text-slate-900">Vehicle Screenshot Grid</h3>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Grid</span>
              {[1, 2, 3, 4, 5, 6, 7, 8].map((cols) => (
                <Button
                  key={cols}
                  type="button"
                  size="sm"
                  variant={gridColumns === cols ? "default" : "outline"}
                  className={gridColumns === cols ? "bg-slate-900 text-white hover:bg-slate-800" : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"}
                  onClick={() => setGridColumns(cols)}
                >
                  {cols}x{cols}
                </Button>
              ))}
            </div>
          </div>
          <div className={gridClassName}>
            {scopedCards.map((card) => {
              const hasScreenshot = !!(card.ch1Url || card.ch2Url);
              const latestTs = Math.max(parseDate(card.ch1Time), parseDate(card.ch2Time));
              return (
                <Card key={card.registration} className="overflow-hidden border-slate-300 bg-white text-slate-900">
                  <div className="border-b border-slate-200 px-3 py-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{card.fleetNumber} - {card.registration}</p>
                        <p className="mt-1 text-[11px] text-slate-500">
                          {card.online
                            ? (hasScreenshot ? `Online - ${toSAST(latestTs).toLocaleTimeString()}` : "Online - No screenshots")
                            : "Offline"}
                        </p>
                      </div>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                        card.online ? (hasScreenshot ? "bg-emerald-100 text-emerald-700" : "bg-blue-100 text-blue-700") : "bg-slate-100 text-slate-600"
                      }`}>
                        {card.online ? (hasScreenshot ? "Live" : "Online") : "Offline"}
                      </span>
                    </div>
                  </div>
                  {(() => {
                    const chCount = Math.max(card.cameras || 1, card.ch2Url && card.ch2Url !== card.ch1Url ? 2 : 1);
                    const channels: { ch: number; url: string | null }[] = [];
                    for (let i = 1; i <= chCount; i++) {
                      const url = i === 1 ? card.ch1Url : (card.ch2Url !== card.ch1Url ? card.ch2Url : null);
                      channels.push({ ch: i, url });
                    }
                    const gridCols = chCount >= 2 ? "grid-cols-2" : "grid-cols-1";
                    return (
                      <div className={`grid ${gridCols} gap-2 p-2`}>
                        {channels.map(({ ch, url }) => (
                          <div key={`${card.registration}-${ch}`} className="overflow-hidden rounded-md border border-slate-300 bg-slate-950 text-slate-100">
                              <div className="relative flex items-center justify-center" style={{ minHeight: 320 }}>
                              {url ? (
                                <img
                                  src={withCacheBuster(url)}
                                  alt={`${card.registration} CH${ch}`}
                                  className="w-full h-full object-cover cursor-pointer"
                                  loading="lazy"
                                  style={{ minHeight: 320, maxHeight: 480 }}
                                  onClick={() => setModalImage(url)}
                                />
                              ) : (
                                <span className="text-xs text-slate-500 px-2 text-center">
                                  {card.online ? "Waiting for screenshot..." : "Offline"}
                                </span>
                              )}
                              <div className="absolute right-2 top-2 rounded bg-black/70 px-2 py-1 text-[11px] font-medium">
                                CH {ch}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </Card>
              );
            })}
          </div>
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
