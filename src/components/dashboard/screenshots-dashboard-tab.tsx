/* eslint-disable @next/next/no-img-element */
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw, Shield, ExternalLink, X } from "lucide-react";
import { useSupabaseAuth } from "@/context/supabase-auth-context";
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

const AUTO_REFRESH_MS = 2 * 60 * 1000; // 2 minutes
const GALLERY_BATCH_SIZE = 5; // devices per parallel batch (reduced to avoid rate limits)
const CAPTURE_BATCH_SIZE = 10; // captures per batch (reduced to avoid rate limits)
const BATCH_DELAY_MS = 500; // delay between batches to avoid rate limits

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
  const { supabase } = useSupabaseAuth();
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
    // Check localStorage cache first (10 min TTL)
    const cacheKey = 'vehiclesc_cache';
    const cacheTTL = 10 * 60 * 1000;
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        if (data && Date.now() - timestamp < cacheTTL && data.length > 0) {
          dbVehiclesRef.current = data;
          return data;
        }
      }
    } catch {}

    // Fetch from Supabase
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
        // Cache in localStorage
        try { localStorage.setItem(cacheKey, JSON.stringify({ data: result, timestamp: Date.now() })); } catch {}
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

      // 1. Get online devices from Mettax
      let onlineRes = await fetch('/api/mettax/online', {
        method: "POST", headers: { "Content-Type": "application/json" }, body: "{}",
        cache: "no-store", signal: AbortSignal.timeout(15000),
      }).catch(() => null);

      let onlineData = onlineRes ? await onlineRes.json().catch(() => null) : null;

      if (!onlineData || !onlineData.success || !onlineData.data?.devices?.length) {
        await new Promise(r => setTimeout(r, 2000));
        onlineRes = await fetch('/api/mettax/online', {
          method: "POST", headers: { "Content-Type": "application/json" }, body: "{}",
          cache: "no-store", signal: AbortSignal.timeout(15000),
        }).catch(() => null);
        onlineData = onlineRes ? await onlineRes.json().catch(() => null) : null;
      }

      // 2. Build regMap: fleet OR reg -> {deviceId, online, cameras}
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
          if (fleetNum) regMap.set(fleetNum.toUpperCase(), { deviceId: d.deviceId, online: isOnline, cameras: d.cameras || 2 });
          if (regNum) regMap.set(regNum.toUpperCase(), { deviceId: d.deviceId, online: isOnline, cameras: d.cameras || 2 });
        }
      }

      // 3. Build cards from DB vehicles
      const matchedDeviceIds: string[] = [];
      const prevCards = prevCardsRef.current;

      const built: VehicleCard[] = dbVehicles.map((v) => {
        const fleetKey = (v.fleet_number || "").toUpperCase().trim();
        const regKey = (v.registration_number || "").toUpperCase().trim();
        const match = (fleetKey ? regMap.get(fleetKey) : undefined) || (regKey ? regMap.get(regKey) : undefined);

        const deviceId = match?.deviceId || null;
        if (deviceId) matchedDeviceIds.push(deviceId);

        const prevCard = prevCards.find((c) =>
          c.registration === v.registration_number ||
          c.fleetNumber === v.fleet_number ||
          (deviceId && c.deviceId === deviceId)
        );

        return {
          registration: v.registration_number,
          fleetNumber: v.fleet_number,
          costCenter: v.cost_centres,
          deviceId,
          online: match?.online || false,
          cameras: match?.cameras || prevCard?.cameras || 2,
          ch1Url: prevCard?.ch1Url || null,
          ch2Url: prevCard?.ch2Url || null,
          ch1Time: prevCard?.ch1Time || null,
          ch2Time: prevCard?.ch2Time || null,
        };
      });

      prevCardsRef.current = built;
      setCards(built);

      // 4. First pass: Fetch existing gallery for ALL devices (no capture yet - instant display)
      const onlineDeviceIds = matchedDeviceIds.filter((id) => {
        const card = built.find(c => c.deviceId === id);
        return card?.online;
      });

      let galFailed = false;
      if (onlineDeviceIds.length > 0) {
        for (let i = 0; i < onlineDeviceIds.length; i += GALLERY_BATCH_SIZE) {
          if (!activeRef.current) return;
          const batch = onlineDeviceIds.slice(i, i + GALLERY_BATCH_SIZE);

          const results = await Promise.allSettled(
            batch.map(deviceId =>
              fetch('/api/mettax/gallery', {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ deviceId, pageSize: 2 }),
                cache: "no-store",
                signal: AbortSignal.timeout(8000),
              }).then(r => r.json()).then(d => ({ deviceId, files: d.files || [] })).catch(() => ({ deviceId, files: [] }))
            )
          );

          let cardsUpdated = false;
          for (const r of results) {
            if (r.status !== "fulfilled") { galFailed = true; continue; }
            const { deviceId, files } = r.value;
            const card = built.find(c => c.deviceId === deviceId);
            if (!card) continue;

            const ch1 = files.find((f: any) => f.channelId === 1);
            const ch2 = files.find((f: any) => f.channelId === 2);

            if (ch1 && ch1.fileUrl) { card.ch1Url = ch1.fileUrl; card.ch1Time = ch1.createTime; cardsUpdated = true; }
            if (ch2 && ch2.fileUrl) { card.ch2Url = ch2.fileUrl; card.ch2Time = ch2.createTime; cardsUpdated = true; }
            if (card.deviceId) capturingRef.current.delete(card.deviceId);
          }

          if (cardsUpdated) setCards([...built]);
        }
      }

      if (!activeRef.current) return;

      // 5. Trigger captures only for devices that returned empty
      const needCapture = built.filter((c) => c.online && c.deviceId && !c.ch1Url && !c.ch2Url);
      if (needCapture.length > 0) {
        for (const c of needCapture) { if (c.deviceId) capturingRef.current.add(c.deviceId); }
        const captures = needCapture.flatMap((c) =>
          Array.from({ length: c.cameras || 2 }, (_, i) => ({ deviceId: c.deviceId!, channelId: i + 1 }))
        );
        for (let i = 0; i < captures.length; i += CAPTURE_BATCH_SIZE) {
          const batch = captures.slice(i, i + CAPTURE_BATCH_SIZE);
          for (const cap of batch) {
            fetch('/api/mettax/capture', {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(cap),
              signal: AbortSignal.timeout(8000),
            }).catch(() => {});
          }
        }
      }

      // 6. Short wait for captures to upload
      await new Promise(r => setTimeout(r, 3000));
      if (!activeRef.current) return;

      // 7. Second pass: Fetch gallery only for devices that were triggered
      if (needCapture.length > 0) {
        const retryDeviceIds = needCapture.map(c => c.deviceId!).filter(Boolean);
        for (let i = 0; i < retryDeviceIds.length; i += GALLERY_BATCH_SIZE) {
          if (!activeRef.current) return;
          const batch = retryDeviceIds.slice(i, i + GALLERY_BATCH_SIZE);

          const results = await Promise.allSettled(
            batch.map(deviceId =>
              fetch('/api/mettax/gallery', {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ deviceId, pageSize: 2 }),
                cache: "no-store",
                signal: AbortSignal.timeout(8000),
              }).then(r => r.json()).then(d => ({ deviceId, files: d.files || [] })).catch(() => ({ deviceId, files: [] }))
            )
          );

          let cardsUpdated = false;
          for (const r of results) {
            if (r.status !== "fulfilled") continue;
            const { deviceId, files } = r.value;
            const card = built.find(c => c.deviceId === deviceId);
            if (!card) continue;

            const ch1 = files.find((f: any) => f.channelId === 1);
            const ch2 = files.find((f: any) => f.channelId === 2);

            if (ch1 && ch1.fileUrl && ch1.fileUrl !== card.ch1Url) { card.ch1Url = ch1.fileUrl; card.ch1Time = ch1.createTime; cardsUpdated = true; }
            if (ch2 && ch2.fileUrl && ch2.fileUrl !== card.ch2Url) { card.ch2Url = ch2.fileUrl; card.ch2Time = ch2.createTime; cardsUpdated = true; }
            if (card.deviceId) capturingRef.current.delete(card.deviceId);
          }

          if (cardsUpdated) setCards([...built]);
        }
      }

      setLastScreenshotAt(new Date());
      setError(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      fetchInProgressRef.current = false;
    }
  }, [fetchDbOnce]);

  const scheduleRetry = useCallback(() => {
    if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    retryTimerRef.current = setTimeout(() => {
      if (activeRef.current) fetchData();
    }, AUTO_REFRESH_MS);
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
      return (t1 > 0 && now - t1 <= 10 * 60 * 1000) || (t2 > 0 && now - t2 <= 10 * 60 * 1000);
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
