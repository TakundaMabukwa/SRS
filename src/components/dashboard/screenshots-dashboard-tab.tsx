/* eslint-disable @next/next/no-img-element */
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw, Shield, ExternalLink, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useCostCenters } from "@/context/cost-centers-context";

type DbVehicle = {
  registration_number: string;
  fleet_number: string;
  cost_centres: string;
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
  capturing?: boolean;
};

const EPS_API = "/api/video-server";
const RETRY_INTERVAL_MS = 30000;
const SCREENSHOT_WINDOW_MS = 10 * 60 * 1000;
const AUTO_REFRESH_MS = 2 * 60 * 1000; // 2 minutes
const CAPTURE_RETRY_MS = 15000; // 15s retry for capturing vehicles
const GALLERY_BATCH_SIZE = 30; // devices per batch
const GALLERY_PER_DEVICE = 2; // last 2 files per device (CH1 + CH2)

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

function resolveScreenshotUrl(rawUrl: string): string {
  if (!rawUrl) return "";
  if (rawUrl.startsWith("https://www.skycamx.co.za/")) return rawUrl;
  if (rawUrl.startsWith("https://skycamx.co.za/")) return rawUrl;
  return `${EPS_API}/eps/stream/stream/proxy?url=${encodeURIComponent(rawUrl)}`;
}

function withCacheBuster(url: string): string {
  if (!url) return "";
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}_ts=${Date.now()}`;
}

type ScreenshotsDashboardTabProps = {
  detachable?: boolean;
  selectedCostCenterIds?: number[];
};

export default function ScreenshotsDashboardTab({
  detachable = true,
  selectedCostCenterIds = [],
}: ScreenshotsDashboardTabProps) {
  const { costCenterMap } = useCostCenters();
  const supabase = createClient();
  const dbVehiclesRef = useRef<DbVehicle[] | null>(null);
  const [cards, setCards] = useState<VehicleCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastScreenshotAt, setLastScreenshotAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [gridColumns, setGridColumns] = useState(2);
  const [modalImage, setModalImage] = useState<string | null>(null);
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());
  const [nextRefresh, setNextRefresh] = useState(AUTO_REFRESH_MS / 1000);
  const activeRef = useRef(true);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const failedImagesRef = useRef<Set<string>>(new Set());
  const prevCardsRef = useRef<VehicleCard[]>([]);
  const fetchInProgressRef = useRef(false);
  const offlineConfirmRef = useRef(0);
  const capturingRef = useRef<Set<string>>(new Set());

  const fetchDbOnce = useCallback(async () => {
    if (dbVehiclesRef.current && dbVehiclesRef.current.length > 0) return dbVehiclesRef.current;
    try {
      const { data } = await supabase
        .from("vehiclesc")
        .select("registration_number, fleet_number, cost_centres, camera_sim_id");
      const rows = (data || []) as DbVehicle[];
      const unique = new Map<string, DbVehicle>();
      for (const r of rows) {
        const reg = (r.registration_number || "").trim().toUpperCase();
        if (!reg) continue;
        if (!unique.has(reg)) {
          unique.set(reg, { registration_number: reg, fleet_number: r.fleet_number || "", cost_centres: r.cost_centres || "", camera_sim_id: (r.camera_sim_id || "").trim() });
        }
      }
      const result = Array.from(unique.values());
      if (result.length > 0) {
        dbVehiclesRef.current = result;
      }
      return result;
    } catch {
      return dbVehiclesRef.current || [];
    }
  }, [supabase]);

  const fetchData = useCallback(async () => {
    if (fetchInProgressRef.current) return;
    fetchInProgressRef.current = true;

    try {
      const dbVehicles = await fetchDbOnce();
      if (!activeRef.current) return;

      let onlineRes = await fetch('/api/mettax/online', {
        method: "POST", headers: { "Content-Type": "application/json" }, body: "{}",
        cache: "no-store", signal: AbortSignal.timeout(15000),
      }).catch(() => null);
      if (!activeRef.current) return;

      let onlineData = onlineRes ? await onlineRes.json().catch(() => null) : null;

      // Retry once after 2s if first response had issues
      if (!onlineData || !onlineData.success || !onlineData.data?.devices?.length) {
        await new Promise(r => setTimeout(r, 2000));
        onlineRes = await fetch('/api/mettax/online', {
          method: "POST", headers: { "Content-Type": "application/json" }, body: "{}",
          cache: "no-store", signal: AbortSignal.timeout(15000),
        }).catch(() => null);
        onlineData = onlineRes ? await onlineRes.json().catch(() => null) : null;
      }

      // Build regMap: fleet OR reg -> {deviceId, online, cameras}
      const regMap = new Map<string, { deviceId: string; online: boolean; cameras: number }>();
      let onlineCount = 0;
      if (onlineData?.success && onlineData.data?.devices) {
        for (const d of onlineData.data.devices) {
          if (!d.deviceId) continue;
          const isOnline = d.online === true || d.online === "true";
          if (isOnline) onlineCount++;
          const plate = (d.plateName || "").trim();
          const parts = plate.split(" - ");
          const fleetNum = (parts[0] || "").trim();
          const regNum = (parts[1] || "").trim();
          if (fleetNum) regMap.set(fleetNum.toUpperCase(), { deviceId: d.deviceId, online: isOnline, cameras: d.cameras || 1 });
          if (regNum) regMap.set(regNum.toUpperCase(), { deviceId: d.deviceId, online: isOnline, cameras: d.cameras || 1 });
        }
      }

      // Build deviceIdMap only for camera_sim_id -> Mettax deviceId mapping (NOT for online status)
      const deviceIdMap = new Map<string, string>();
      if (onlineData?.success && onlineData.data?.devices) {
        for (const d of onlineData.data.devices) {
          if (d.deviceId) deviceIdMap.set(d.deviceId, d.deviceId);
        }
      }

      const matchedDeviceIds: string[] = [];
      const prevCards = prevCardsRef.current;

      const built: VehicleCard[] = dbVehicles.map((v) => {
        const fleetKey = (v.fleet_number || "").toUpperCase().trim();
        const regKey = (v.registration_number || "").toUpperCase().trim();
        const camKey = (v.camera_sim_id || "").trim();

        // Primary match: fleet OR reg key in regMap (strict - has online status)
        let fleetMatch = fleetKey ? regMap.get(fleetKey) : undefined;
        let regMatch = regKey ? regMap.get(regKey) : undefined;
        const match = fleetMatch || regMatch;

        // Only use camMatch if fleet/reg didn't match AND camera_sim_id exactly equals a Mettax deviceId
        // AND the matched device's fleet/reg also matches (to prevent cross-matching)
        let deviceId: string | null = null;
        if (match) {
          deviceId = match.deviceId;
        } else if (camKey && deviceIdMap.has(camKey)) {
          // camMatch only for deviceId lookup, NOT online status
          deviceId = camKey;
        }

        if (deviceId) matchedDeviceIds.push(deviceId);

        const prevCard = prevCards.find((c) =>
          c.registration === v.registration_number ||
          c.fleetNumber === v.fleet_number ||
          (deviceId && c.deviceId === deviceId)
        );

        // Only use Mettax online status if we got a fleet/reg match. camMatch vehicles show offline unless confirmed.
        const online = match ? match.online : false;

        return {
          registration: v.registration_number,
          fleetNumber: v.fleet_number,
          costCenter: v.cost_centres,
          deviceId: deviceId || prevCard?.deviceId || null,
          online,
          cameras: match ? match.cameras : (prevCard?.cameras || 0),
          ch1Url: prevCard?.ch1Url || null,
          ch2Url: prevCard?.ch2Url || null,
          ch1Time: prevCard?.ch1Time || null,
          ch2Time: prevCard?.ch2Time || null,
        };
      });

      console.log("[screenshots] Mettax devices:", onlineData?.data?.devices?.length || 0, "regMap online:", onlineCount, "dbVehicles:", dbVehicles.length);
      console.log("[screenshots] fleet/reg matched:", built.filter(c => c.online).length, "offline:", built.filter(c => !c.online).length);
      console.log("[screenshots] regMap keys sample:", Array.from(regMap.keys()).slice(0, 5));
      console.log("[screenshots] dbVehicles sample:", dbVehicles.slice(0, 3).map(v => ({ fleet: v.fleet_number, reg: v.registration_number })));

      // PHASE A — Show cached images IMMEDIATELY, then fire capture for vehicles without screenshots
      prevCardsRef.current = built;
      setCards(built); // instant paint with cached URLs

      // Fire capture for vehicles without screenshots — using current cycle's deviceId matches
      const needCaptureInitial = built.filter((c) => c.online && c.deviceId && !c.ch1Url && !c.ch2Url);
      if (needCaptureInitial.length > 0) {
        const captures = needCaptureInitial.flatMap((c) =>
          Array.from({ length: c.cameras || 1 }, (_, i) => ({ deviceId: c.deviceId!, channelId: i + 1 }))
        );
        for (const c of needCaptureInitial) { if (c.deviceId) capturingRef.current.add(c.deviceId); }
        setTimeout(() => {
          fetch(`${EPS_API}/eps/gallery/capture`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ captures }),
          }).catch(() => {});
        }, 0);
      }

      // PHASE B — Fetch gallery screenshots progressively per batch, updating only changed cards
      let galFailed = false;
      if (matchedDeviceIds.length > 0) {
        const now = new Date();
        const end = now.toISOString().replace("T", " ").slice(0, 19);
        const start = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString().replace("T", " ").slice(0, 19);

        for (let i = 0; i < matchedDeviceIds.length; i += GALLERY_BATCH_SIZE) {
          if (!activeRef.current) return;
          const batch = matchedDeviceIds.slice(i, i + GALLERY_BATCH_SIZE);

          const results = await Promise.allSettled(
            batch.map(deviceId =>
              fetch(`${EPS_API}/eps/gallery/files/page`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ pageSize: GALLERY_PER_DEVICE, pageIndex: 1, deviceIds: deviceId, startTime: start, endTime: end, queryType: "Device" }),
                cache: "no-store",
                signal: AbortSignal.timeout(12000),
              }).then(r => r.json()).then(d => ({ deviceId, files: d.data?.files || [] }))
            )
          );

          // Build per-device lookup for this batch
          const batchResult: Record<string, Record<number, GalleryFile>> = {};
          for (const r of results) {
            if (r.status === "fulfilled") {
              const { deviceId, files } = r.value;
              for (const f of files) {
                const ch = f.channelId || 1;
                if (!batchResult[deviceId]) batchResult[deviceId] = {};
                const existing = batchResult[deviceId][ch];
                if (!existing || (f.createTime || "") > (existing.createTime || "")) {
                  batchResult[deviceId][ch] = f;
                }
              }
            } else {
              galFailed = true;
            }
          }

          // Update only cards that got new URLs from this batch — in-place mutation
          let cardsUpdated = false;
          for (const card of built) {
            if (!card.deviceId) continue;
            const dev = batchResult[card.deviceId];
            if (!dev) continue;
            const newCh1 = dev[1] ? resolveScreenshotUrl(dev[1].fileUrl) : null;
            const newCh2 = dev[2] ? resolveScreenshotUrl(dev[2].fileUrl) : null;
            const newCh1Time = dev[1]?.createTime || null;
            const newCh2Time = dev[2]?.createTime || null;
            if (
              (newCh1 && newCh1 !== card.ch1Url) ||
              (newCh2 && newCh2 !== card.ch2Url) ||
              (newCh1Time && newCh1Time !== card.ch1Time) ||
              (newCh2Time && newCh2Time !== card.ch2Time)
            ) {
              if (newCh1) { card.ch1Url = newCh1; card.ch1Time = newCh1Time; }
              if (newCh2 && newCh2 !== card.ch1Url) { card.ch2Url = newCh2; card.ch2Time = newCh2Time; }
              if (card.deviceId) capturingRef.current.delete(card.deviceId);
              cardsUpdated = true;
            }
          }

          if (cardsUpdated) setCards(built); // same array ref — React only re-renders changed cards
        }
      }

      // PHASE C — Final state after all gallery batches complete
      for (const card of built) {
        if (card.deviceId && capturingRef.current.has(card.deviceId) && !card.ch1Url && !card.ch2Url) {
          card.capturing = true;
        }
      }

      if (!activeRef.current) return;

      if (!galFailed) setFailedImages(new Set());

      // Fire capture again for any vehicles still without screenshots after gallery
      const needCaptureFinal = built.filter((c) => c.online && c.deviceId && !c.ch1Url && !c.ch2Url);
      if (needCaptureFinal.length > 0) {
        const captures = needCaptureFinal.flatMap((c) =>
          Array.from({ length: c.cameras || 1 }, (_, i) => ({ deviceId: c.deviceId!, channelId: i + 1 }))
        );
        for (const c of needCaptureFinal) { if (c.deviceId) capturingRef.current.add(c.deviceId); }
        fetch(`${EPS_API}/eps/gallery/capture`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ captures }),
        }).catch(() => {});
      }

      prevCardsRef.current = built;
      if (built.some((c) => c.ch1Url || c.ch2Url)) setLastScreenshotAt(new Date());
      setError(null);
      setLoading(false);

      if (galFailed) scheduleRetry();
      if (capturingRef.current.size > 0) {
        if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
        retryTimerRef.current = setTimeout(() => { if (activeRef.current) fetchData(); }, CAPTURE_RETRY_MS);
      }
    } catch (e: any) {
      if (e.name === "AbortError") return;
      if (!activeRef.current) return;
      setError(e.message || "Failed to load");
      setLoading(false);
    } finally {
      fetchInProgressRef.current = false;
    }
  }, [fetchDbOnce]);

  const scheduleRetry = useCallback(() => {
    if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    retryTimerRef.current = setTimeout(() => {
      if (activeRef.current) fetchData();
    }, RETRY_INTERVAL_MS);
  }, [fetchData]);

  const refreshAll = useCallback(async () => {
    setRefreshing(true);
    fetchInProgressRef.current = false;
    try { await fetchData(); } finally { setRefreshing(false); }
  }, [fetchData]);

  useEffect(() => {
    activeRef.current = true;
    setNextRefresh(AUTO_REFRESH_MS / 1000);
    fetchData().finally(() => setLoading(false));

    // Auto-refresh every 2 minutes
    const refreshInterval = setInterval(() => {
      if (activeRef.current) {
        setNextRefresh(AUTO_REFRESH_MS / 1000);
        fetchData();
      }
    }, AUTO_REFRESH_MS);

    // Countdown timer
    const countdownInterval = setInterval(() => {
      setNextRefresh((prev) => (prev > 0 ? prev - 1 : AUTO_REFRESH_MS / 1000));
    }, 1000);

    return () => {
      activeRef.current = false;
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
      clearInterval(refreshInterval);
      clearInterval(countdownInterval);
    };
  }, [fetchData]);

  useEffect(() => {
    failedImagesRef.current = failedImages;
  }, [failedImages]);

  const selectedCostCenterSet = useMemo(() => {
    const set = new Set<string>();
    for (const id of selectedCostCenterIds) {
      const name = costCenterMap.get(id);
      if (name) set.add(name.toLowerCase());
    }
    return set;
  }, [selectedCostCenterIds, costCenterMap]);

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
              <span className="text-[10px] text-slate-500">
                Next: {Math.floor(nextRefresh / 60)}:{String(nextRefresh % 60).padStart(2, "0")}
              </span>
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
              const hasScreenshot = !!(
                (card.ch1Url && !failedImages.has(card.ch1Url)) ||
                (card.ch2Url && !failedImages.has(card.ch2Url))
              );
              return (
                <div key={card.registration} className="group relative overflow-hidden rounded bg-slate-900 border border-slate-700/50">
                  <div className="grid grid-cols-2 gap-px bg-slate-800">
                    {[1, 2].map((ch) => {
                      const rawUrl = ch === 1 ? card.ch1Url : (card.ch2Url !== card.ch1Url ? card.ch2Url : null);
                      const url = rawUrl && !failedImages.has(rawUrl) ? rawUrl : null;
                      return (
                        <div key={`${card.registration}-${ch}`} className="relative bg-slate-950 aspect-video">
                           {url ? (
                            <img
                              src={url}
                              alt={`${card.registration} CH${ch}`}
                              className="absolute inset-0 w-full h-full object-cover cursor-pointer"
                              loading="lazy"
                              onClick={() => setModalImage(url)}
                              onError={() => {
                                setFailedImages((prev) => {
                                  const next = new Set(prev);
                                  next.add(url);
                                  return next;
                                });
                              }}
                            />
                          ) : (
                            <div className="absolute inset-0 flex items-center justify-center">
                              <span className="text-[10px] text-slate-600">
                                {card.online ? (card.capturing ? "Capturing..." : "Waiting") : "Offline"}
                              </span>
                            </div>
                          )}
                          {gridColumns < 6 && (
                            <div className="absolute right-1 top-1 rounded bg-black/70 px-1 py-0.5 text-[9px] font-medium text-white/80">
                              CH{ch}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <div className="absolute left-0 top-0 right-0 flex items-center justify-between bg-gradient-to-b from-black/80 via-black/40 to-transparent px-2 py-1.5 pointer-events-none">
                    <span className="text-[11px] font-semibold text-white truncate">{card.fleetNumber || card.registration}</span>
                    {gridColumns < 6 && (
                      <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-medium ${
                        card.online ? (hasScreenshot ? "bg-emerald-500/90 text-white" : "bg-blue-500/90 text-white") : "bg-slate-600/90 text-slate-300"
                      }`}>
                        {card.online ? (hasScreenshot ? "LIVE" : "ON") : "OFF"}
                      </span>
                    )}
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
