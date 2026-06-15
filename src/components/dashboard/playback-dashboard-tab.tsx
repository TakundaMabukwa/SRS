"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Video, RefreshCw, Search, Wifi, WifiOff, Play, Loader2, X, ChevronLeft, Clock, Calendar } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { UniversalVideoPlayer } from "./universal-video-player";

const EPS_API = "/api/video-server";
const SOUTH_AFRICA_TIME_ZONE = "Africa/Johannesburg";

type DbVehicle = {
  registration_number: string;
  fleet_number: string;
  cost_center: string;
  camera_sim_id: string;
};

type PlaybackVehicle = {
  vehicleId: string;
  registration: string;
  fleetNumber: string;
  costCenter: string;
  deviceId: string;
  online: boolean;
};

type HistoryFile = {
  deviceName: string;
  channelId: number;
  fileSize: number;
  startTime: string;
  endTime: string;
  fileUrl: string | null;
};

function toSAST(date: Date): string {
  return date.toLocaleString("en-ZA", { timeZone: SOUTH_AFRICA_TIME_ZONE, hour12: false });
}

function formatTime(isoString: string): string {
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return "N/A";
  return toSAST(d).slice(11, 19);
}

function formatDateTime(isoString: string): string {
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return "N/A";
  return toSAST(d).slice(0, 16);
}

function normalizeCostCenter(value: unknown): string {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function matchesCostCenterFilter(costCenter: string, selectedCostCenters: Set<string>) {
  if (selectedCostCenters.size === 0) return true;
  const normalized = normalizeCostCenter(costCenter);
  if (!normalized) return selectedCostCenters.has("unassigned");
  return selectedCostCenters.has(normalized);
}

function getSouthAfricaDateParts(date: Date) {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: SOUTH_AFRICA_TIME_ZONE,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value || 0);
  return { year: get("year"), month: get("month"), day: get("day"), hour: get("hour"), minute: get("minute"), second: get("second") };
}

function sastNowYmd(): string {
  const p = getSouthAfricaDateParts(new Date());
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

function sastNowHms(): string {
  const p = getSouthAfricaDateParts(new Date());
  return `${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")}:${String(p.second).padStart(2, "0")}`;
}

function sastYesterdayYmd(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const p = getSouthAfricaDateParts(d);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

function todayStartEnd(): { start: string; end: string } {
  const now = new Date();
  const p = getSouthAfricaDateParts(now);
  const d = (h: number, m: number, s: number) => {
    const guess = Date.UTC(p.year, p.month - 1, p.day, h, m, s, 0);
    const utcDate = new Date(guess);
    const sp = getSouthAfricaDateParts(utcDate);
    const sastAsUtc = Date.UTC(p.year, p.month - 1, p.day, sp.hour, sp.minute, sp.second, 0);
    const targetAsUtc = Date.UTC(p.year, p.month - 1, p.day, h, m, s, 0);
    return new Date(guess + (targetAsUtc - sastAsUtc)).toISOString().replace("T", " ").slice(0, 19);
  };
  return { start: d(0, 0, 0), end: d(23, 59, 59) };
}

function sastDateToRange(dateStr: string): { start: string; end: string } {
  const [yearRaw, monthRaw, dayRaw] = dateStr.split("-").map(Number);
  const d = (h: number, m: number, s: number) => {
    const guess = Date.UTC(yearRaw, monthRaw - 1, dayRaw, h, m, s, 0);
    const utcDate = new Date(guess);
    const sp = getSouthAfricaDateParts(utcDate);
    const sastAsUtc = Date.UTC(yearRaw, monthRaw - 1, dayRaw, sp.hour, sp.minute, sp.second, 0);
    const targetAsUtc = Date.UTC(yearRaw, monthRaw - 1, dayRaw, h, m, s, 0);
    return new Date(guess + (targetAsUtc - sastAsUtc)).toISOString().replace("T", " ").slice(0, 19);
  };
  return { start: d(0, 0, 0), end: d(23, 59, 59) };
}

type PlaybackDashboardTabProps = {
  selectedCostCenters?: string[];
};

export default function PlaybackDashboardTab({ selectedCostCenters = [] }: PlaybackDashboardTabProps) {
  const supabase = createClient();
  const [vehicles, setVehicles] = useState<PlaybackVehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [vehicleSearch, setVehicleSearch] = useState("");
  const initialLoadRef = useRef(false);

  const [selectedVehicle, setSelectedVehicle] = useState<PlaybackVehicle | null>(null);
  const [selectedChannel, setSelectedChannel] = useState(1);
  const [selectedDate, setSelectedDate] = useState(sastNowYmd());
  const [startTime, setStartTime] = useState("00:00:00");
  const [endTime, setEndTime] = useState(sastNowHms());
  const [searching, setSearching] = useState(false);
  const [files, setFiles] = useState<HistoryFile[]>([]);
  const [filesSearched, setFilesSearched] = useState(false);
  const [replayUrl, setReplayUrl] = useState("");
  const [replayLoading, setReplayLoading] = useState(false);
  const [replayError, setReplayError] = useState("");
  const [earliestFootage, setEarliestFootage] = useState<string | null>(null);
  const [latestFootage, setLatestFootage] = useState<string | null>(null);

  const fetchVehicles = useCallback(async (): Promise<PlaybackVehicle[]> => {
    const { data: vehicleRows, error: vehiclesError } = await supabase
      .from("vehiclesc")
      .select("registration_number, fleet_number, cost_center, camera_sim_id");

    if (vehiclesError) throw new Error(vehiclesError.message || "Failed to load vehicles");

    const catalogVehicles: PlaybackVehicle[] = [];
    const seen = new Set<string>();

    for (const row of vehicleRows || []) {
      const simId = String((row as DbVehicle).camera_sim_id || "").trim();
      if (!simId || seen.has(simId)) continue;
      seen.add(simId);
      catalogVehicles.push({
        vehicleId: simId,
        registration: String((row as DbVehicle).registration_number || "").trim(),
        fleetNumber: String((row as DbVehicle).fleet_number || "").trim(),
        costCenter: String((row as DbVehicle).cost_center || "").trim(),
        deviceId: simId,
        online: false,
      });
    }

    try {
      const onlineRes = await fetch(`${EPS_API}/eps/stream/online`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
        cache: "no-store",
        signal: AbortSignal.timeout(10000),
      }).catch(() => null);

      if (onlineRes && onlineRes.ok) {
        const onlineData = await onlineRes.json().catch(() => ({}));
        if (onlineData.success && onlineData.data?.devices) {
          const deviceMap = new Map<string, boolean>();
          for (const d of onlineData.data.devices) {
            if (d.deviceId) deviceMap.set(d.deviceId, d.online === true);
          }
          for (const v of catalogVehicles) {
            if (deviceMap.has(v.deviceId)) v.online = deviceMap.get(v.deviceId) || false;
          }
        }
      }
    } catch {}

    return catalogVehicles.sort((a, b) => {
      const aLabel = [a.fleetNumber, a.registration].filter(Boolean).join(" - ");
      const bLabel = [b.fleetNumber, b.registration].filter(Boolean).join(" - ");
      return aLabel.localeCompare(bLabel);
    });
  }, [supabase]);

  const refreshAll = useCallback(async () => {
    setRefreshing(true);
    try {
      const result = await fetchVehicles();
      setVehicles(result);
    } catch {
      setVehicles([]);
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }, [fetchVehicles]);

  useEffect(() => {
    if (initialLoadRef.current) return;
    initialLoadRef.current = true;
    void refreshAll();
  }, [refreshAll]);

  const selectedCostCenterSet = useMemo(
    () => new Set(selectedCostCenters.map((v) => normalizeCostCenter(v)).filter(Boolean)),
    [selectedCostCenters]
  );

  const filteredVehicles = useMemo(() => {
    const needle = vehicleSearch.trim().toLowerCase();
    return vehicles
      .filter((v) => matchesCostCenterFilter(v.costCenter, selectedCostCenterSet))
      .filter((v) => {
        if (!needle) return true;
        return v.registration.toLowerCase().includes(needle) || v.fleetNumber.toLowerCase().includes(needle) || v.deviceId.includes(needle);
      });
  }, [vehicles, vehicleSearch, selectedCostCenterSet]);

  const vehicleLabel = useCallback((v: PlaybackVehicle) => {
    if (v.fleetNumber && v.registration) return `${v.fleetNumber} - ${v.registration}`;
    return v.registration || v.fleetNumber || v.vehicleId;
  }, []);

  const selectVehicle = useCallback((vehicle: PlaybackVehicle) => {
    setSelectedVehicle(vehicle);
    setFiles([]);
    setFilesSearched(false);
    setReplayUrl("");
    setReplayError("");
    setEarliestFootage(null);
    setLatestFootage(null);
    setSelectedChannel(1);
    setSelectedDate(sastNowYmd());
    setStartTime("00:00:00");
    setEndTime(sastNowHms());
  }, []);

  const backToVehicles = useCallback(() => {
    setSelectedVehicle(null);
    setFiles([]);
    setFilesSearched(false);
    setReplayUrl("");
    setReplayError("");
    setEarliestFootage(null);
    setLatestFootage(null);
  }, []);

  const searchFootage = useCallback(async () => {
    if (!selectedVehicle) return;
    setSearching(true);
    setReplayUrl("");
    setReplayError("");
    setFiles([]);
    setFilesSearched(false);
    setEarliestFootage(null);
    setLatestFootage(null);

    const range = sastDateToRange(selectedDate);

    try {
      const res = await fetch(`${EPS_API}/playback/history-list`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deviceId: selectedVehicle.deviceId,
          channelId: selectedChannel,
          startTime: range.start,
          endTime: range.end,
        }),
        cache: "no-store",
        signal: AbortSignal.timeout(15000),
      });
      const json = await res.json().catch(() => ({}));
      const fileList: HistoryFile[] = (json?.data?.files || []).map((f: HistoryFile) => ({ ...f, channelId: selectedChannel }));
      setFiles(fileList);
      setFilesSearched(true);

      if (fileList.length > 0) {
        setEarliestFootage(fileList[0].startTime);
        setLatestFootage(fileList[fileList.length - 1].endTime || fileList[fileList.length - 1].startTime);
        setStartTime(fileList[0].startTime.split(" ")[1] || "00:00:00");
        setEndTime(fileList[fileList.length - 1].endTime?.split(" ")[1] || "23:59:59");
      }
    } catch (e: any) {
      setFilesSearched(true);
      setReplayError(e.message || "Failed to search footage.");
    } finally {
      setSearching(false);
    }
  }, [selectedVehicle, selectedChannel, selectedDate]);

  const playVideo = useCallback(async () => {
    if (!selectedVehicle) return;
    setReplayLoading(true);
    setReplayError("");
    setReplayUrl("");

    const startCombined = `${selectedDate} ${startTime}`;
    const endCombined = `${selectedDate} ${endTime}`;

    try {
      const res = await fetch(`${EPS_API}/playback/history-replay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deviceId: selectedVehicle.deviceId,
          channelId: selectedChannel,
          startTime: startCombined,
          endTime: endCombined,
        }),
        cache: "no-store",
        signal: AbortSignal.timeout(30000),
      });
      const json = await res.json().catch(() => ({}));

      if (json.success && json.data?.replayUrl) {
        setReplayUrl(json.data.replayUrl);
      } else {
        setReplayError(json.message || "No replay available. Device may be offline.");
      }
    } catch (e: any) {
      setReplayError(e.message || "Failed to connect to device.");
    } finally {
      setReplayLoading(false);
    }
  }, [selectedVehicle, selectedChannel, selectedDate, startTime, endTime]);

  const playFullRange = useCallback(() => {
    if (earliestFootage && latestFootage) {
      setStartTime(earliestFootage.split(" ")[1] || "00:00:00");
      setEndTime(latestFootage.split(" ")[1] || "23:59:59");
      setTimeout(() => void playVideo(), 50);
    }
  }, [earliestFootage, latestFootage, playVideo]);

  const onlineCount = useMemo(() => filteredVehicles.filter((v) => v.online).length, [filteredVehicles]);

  return (
    <div className="flex h-[calc(100vh-120px)] gap-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex w-[340px] shrink-0 flex-col border-r border-slate-200">
        <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-slate-900">Devices</h3>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-[10px]">{filteredVehicles.length} vehicles</Badge>
              <Button size="sm" variant="ghost" onClick={() => void refreshAll()} disabled={refreshing} className="h-7 w-7 p-0">
                <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              value={vehicleSearch}
              onChange={(e) => setVehicleSearch(e.target.value)}
              placeholder="Search devices..."
              className="h-9 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-xs outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="space-y-2 p-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="animate-pulse rounded-lg border border-slate-200 bg-white p-3">
                  <div className="h-3 w-3/4 rounded bg-slate-200" />
                  <div className="mt-1.5 h-2.5 w-1/2 rounded bg-slate-200" />
                </div>
              ))}
            </div>
          ) : filteredVehicles.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-500">No vehicles found.</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredVehicles.map((vehicle) => {
                const isSelected = selectedVehicle?.vehicleId === vehicle.vehicleId;
                return (
                  <button
                    key={vehicle.vehicleId}
                    onClick={() => selectVehicle(vehicle)}
                    className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors ${
                      isSelected ? "bg-cyan-50 border-l-2 border-l-cyan-500" : "hover:bg-slate-50"
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-slate-900 truncate">
                        {vehicle.fleetNumber && vehicle.registration
                          ? `${vehicle.fleetNumber} - ${vehicle.registration}`
                          : vehicle.registration || vehicle.fleetNumber || vehicle.deviceId}
                      </p>
                      <p className="mt-0.5 text-[10px] text-slate-500 truncate">{vehicle.deviceId}</p>
                    </div>
                    <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                      vehicle.online ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"
                    }`}>
                      {vehicle.online ? "Online" : "Offline"}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-1 flex-col overflow-hidden">
        {!selectedVehicle ? (
          <div className="flex flex-1 items-center justify-center">
            <div className="text-center">
              <Video className="mx-auto h-12 w-12 text-slate-300" />
              <p className="mt-3 text-sm font-medium text-slate-500">Select a device to review footage</p>
              <p className="mt-1 text-xs text-slate-400">{onlineCount} device{onlineCount !== 1 ? "s" : ""} online</p>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3 border-b border-slate-200 bg-slate-50 px-5 py-3">
              <Button variant="ghost" size="sm" onClick={backToVehicles} className="h-8 w-8 p-0">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-900 truncate">{vehicleLabel(selectedVehicle)}</p>
                <p className="text-[11px] text-slate-500">{selectedVehicle.deviceId}</p>
              </div>
              <Badge variant={selectedVehicle.online ? "default" : "outline"} className={`text-[10px] ${selectedVehicle.online ? "bg-emerald-600" : ""}`}>
                {selectedVehicle.online ? "Online" : "Offline"}
              </Badge>
            </div>

            <div className="flex flex-1 overflow-hidden">
              <div className="w-[280px] shrink-0 border-r border-slate-200 bg-slate-50/50 p-4 space-y-4 overflow-y-auto">
                <div>
                  <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-slate-600">Channel</label>
                  <select
                    value={selectedChannel}
                    onChange={(e) => setSelectedChannel(Number(e.target.value))}
                    className="h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
                  >
                    <option value={1}>CH1</option>
                    <option value={2}>CH2</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-slate-600">Date</label>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
                  />
                </div>

                <Button
                  onClick={() => void searchFootage()}
                  disabled={searching}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {searching ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Search className="mr-2 h-3.5 w-3.5" />}
                  {searching ? "Searching..." : "Search"}
                </Button>

                {filesSearched && (
                  <div className="space-y-4">
                    {files.length > 0 && (
                      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                        <p className="text-[11px] font-medium text-emerald-700">{files.length} segment{files.length !== 1 ? "s" : ""} found</p>
                        <p className="mt-0.5 text-[10px] text-emerald-600">
                          {formatTime(earliestFootage || "")} — {formatTime(latestFootage || "")} SAST
                        </p>
                        <Button size="sm" variant="outline" className="mt-2 h-7 w-full text-[10px] border-emerald-300 text-emerald-700 hover:bg-emerald-100" onClick={() => void playFullRange()}>
                          <Play className="mr-1 h-3 w-3" /> Play Full Range
                        </Button>
                      </div>
                    )}

                    {files.length === 0 && !searching && (
                      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                        <p className="text-[11px] text-amber-700">No footage found for this date/channel.</p>
                      </div>
                    )}

                    <div>
                      <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-slate-600">Start Time</label>
                      <input
                        type="time"
                        step={1}
                        value={startTime}
                        onChange={(e) => setStartTime(e.target.value)}
                        className="h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-slate-600">End Time</label>
                      <input
                        type="time"
                        step={1}
                        value={endTime}
                        onChange={(e) => setEndTime(e.target.value)}
                        className="h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
                      />
                    </div>

                    <div className="flex gap-2">
                      <Button
                        onClick={() => void playVideo()}
                        disabled={replayLoading}
                        className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                      >
                        {replayLoading ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Play className="mr-1 h-3.5 w-3.5" />}
                        Play
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => { setReplayUrl(""); setReplayError(""); }}
                        className="border-slate-300"
                      >
                        Close
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex flex-1 flex-col bg-slate-950 p-4">
                {replayLoading && !replayUrl ? (
                  <div className="flex flex-1 items-center justify-center">
                    <div className="text-center">
                      <Loader2 className="mx-auto h-8 w-8 animate-spin text-cyan-500" />
                      <p className="mt-2 text-sm text-slate-400">Connecting to device stream...</p>
                    </div>
                  </div>
                ) : replayError ? (
                  <div className="flex flex-1 items-center justify-center">
                    <div className="text-center px-6">
                      <p className="text-sm font-medium text-red-400">{replayError}</p>
                      <p className="mt-1 text-xs text-slate-500">Check if the device is online and try again.</p>
                    </div>
                  </div>
                ) : replayUrl ? (
                  <div className="flex flex-1 flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-slate-400">
                        {selectedVehicle.fleetNumber} - {selectedVehicle.registration} · CH{selectedChannel} · {selectedDate}
                      </p>
                      <p className="text-[11px] text-slate-500">{startTime} — {endTime} SAST</p>
                    </div>
                    <UniversalVideoPlayer
                      url={replayUrl}
                      className="flex-1 w-full rounded-xl border border-slate-800 bg-black"
                      autoPlay
                    />
                  </div>
                ) : (
                  <div className="flex flex-1 items-center justify-center">
                    <div className="text-center">
                      <Video className="mx-auto h-10 w-10 text-slate-700" />
                      <p className="mt-2 text-sm text-slate-500">Search footage then click Play</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
