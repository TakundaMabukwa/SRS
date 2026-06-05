"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, AlertTriangle, Video, Download, XCircle, CheckCircle, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { toSAST } from "@/lib/utils/date-formatter";
import { UniversalVideoPlayer } from "@/components/dashboard/universal-video-player";
import { SafeImage } from "@/components/ui/safe-image";
import {
  formatRawAlertTimestamp,
  resolveMediaUrlForCurrentOrigin,
} from "@/lib/video-alert-playback";
import {
  DASHBOARD_SIGNAL_CODE_MAP,
  DASHBOARD_STRUCTURED_ALERT_TITLE_MAP,
  DASHBOARD_OFFICIAL_ALERT_ALIAS_MAP,
  type DashboardStructuredAlertDomain,
} from "@/components/dashboard/alert-mappings";
import type { SavedAlertArtifact } from '@/components/video-alerts/report-support';

interface AlertDetailModalProps {
  isOpen: boolean;
  selectedAlert: any;
  alertReason: string;
  onAlertReasonChange: (reason: string) => void;
  alertNotesDraft: string;
  onAlertNotesDraftChange: (notes: string) => void;
  alertReasonOptions: string[];
  ncrFormOptions: readonly { value: string; label: string }[];
  reportFormOptions: readonly { value: string; label: string }[];
  alertActionLoading: boolean;
  onClose: () => void;
  onFalseAlert: () => Promise<void>;
  onResolve: () => Promise<void>;
  onNcrFormSelect: (formType: string) => void;
  onReportFormSelect: (formType: string) => void;
  onOpenAlertDetail: (alert: any, trip: any, opts?: { silent?: boolean }) => void;
  onSidebarAction: (entry: any, action: "resolve" | "false_alert") => Promise<void>;
  onRefreshTrigger: () => void;
  triggerRealtimeLoad: () => void;
}

const toFiniteNumber = (value: any): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

function useReverseGeocode(selectedAlert: any, isOpen: boolean) {
  const [placeName, setPlaceName] = useState("");
  const [placeLoading, setPlaceLoading] = useState(false);
  const geocodeCacheRef = useRef<Record<string, string>>({});
  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";

  const getCoordinates = useCallback((alert: any): { latitude: number; longitude: number } | null => {
    const pairs: Array<{ lat: any; lng: any }> = [
      { lat: alert?.location?.latitude, lng: alert?.location?.longitude },
      { lat: alert?.metadata?.latitude, lng: alert?.metadata?.longitude },
      { lat: alert?.metadata?.locationFix?.latitude, lng: alert?.metadata?.locationFix?.longitude },
      { lat: alert?.latitude, lng: alert?.longitude },
      { lat: alert?.lat, lng: alert?.lng },
      { lat: alert?.gps?.latitude, lng: alert?.gps?.longitude },
    ];
    for (const pair of pairs) {
      const lat = toFiniteNumber(pair.lat);
      const lng = toFiniteNumber(pair.lng);
      if (lat !== null && lng !== null) {
        return { latitude: lat, longitude: lng };
      }
    }
    return null;
  }, []);

  const coordinates = getCoordinates(selectedAlert);
  const coordinateKey = coordinates
    ? `${coordinates.latitude.toFixed(6)},${coordinates.longitude.toFixed(6)}`
    : "";

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!isOpen || !coordinates) {
        setPlaceName("");
        setPlaceLoading(false);
        return;
      }
      if (!mapboxToken) {
        setPlaceName("");
        setPlaceLoading(false);
        return;
      }
      if (!coordinateKey) return;
      if (geocodeCacheRef.current[coordinateKey]) {
        setPlaceName(geocodeCacheRef.current[coordinateKey]);
        setPlaceLoading(false);
        return;
      }
      setPlaceLoading(true);
      try {
        const [latPart, lngPart] = coordinateKey.split(",");
        const lat = Number(latPart);
        const lng = Number(lngPart);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
          setPlaceName("");
          setPlaceLoading(false);
          return;
        }
        const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
          `${lng},${lat}`
        )}.json?access_token=${encodeURIComponent(mapboxToken)}&limit=1`;
        const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(7000) });
        if (!res.ok) throw new Error(`Mapbox geocode failed (${res.status})`);
        const data = await res.json();
        const place = String(data?.features?.[0]?.place_name || data?.features?.[0]?.text || "").trim();
        if (cancelled) return;
        if (place) {
          geocodeCacheRef.current[coordinateKey] = place;
          setPlaceName(place);
        } else {
          setPlaceName("");
        }
      } catch {
        if (!cancelled) setPlaceName("");
      } finally {
        if (!cancelled) setPlaceLoading(false);
      }
    };
    void run();
    return () => { cancelled = true; };
  }, [isOpen, mapboxToken, coordinateKey, coordinates]);

  return { coordinates, placeName, placeLoading };
}

export function AlertDetailModal({
  isOpen,
  selectedAlert,
  alertReason,
  onAlertReasonChange,
  alertNotesDraft,
  onAlertNotesDraftChange,
  alertReasonOptions,
  ncrFormOptions,
  reportFormOptions,
  alertActionLoading,
  onClose,
  onFalseAlert,
  onResolve,
  onNcrFormSelect,
  onReportFormSelect,
  onOpenAlertDetail,
  onSidebarAction,
  onRefreshTrigger,
  triggerRealtimeLoad,
}: AlertDetailModalProps) {
  const { coordinates: selectedAlertCoordinates, placeName: selectedAlertPlaceName, placeLoading: selectedAlertPlaceLoading } = useReverseGeocode(selectedAlert, isOpen);

  const cleanAlertLocationText = useCallback((value: unknown) => String(value || "").trim(), []);

  const looksLikeCoordinatePair = useCallback((value: unknown) => {
    const clean = cleanAlertLocationText(value);
    return /^-?\d+(?:\.\d+)?\s*,\s*-?\d+(?:\.\d+)?$/.test(clean);
  }, [cleanAlertLocationText]);

  const selectedAlertResolvedLocationName = useMemo(() => {
    const metadata = selectedAlert?.metadata && typeof selectedAlert.metadata === "object" ? selectedAlert.metadata : undefined;
    const locationObject =
      selectedAlert?.location && typeof selectedAlert.location === "object"
        ? selectedAlert.location
        : metadata?.location && typeof metadata.location === "object"
          ? metadata.location
          : undefined;
    const candidates = [
      selectedAlertPlaceName,
      selectedAlert?.location_name,
      selectedAlert?.place_name,
      selectedAlert?.locationName,
      selectedAlert?.address,
      selectedAlert?.location_address,
      selectedAlert?.formatted_address,
      locationObject?.address,
      metadata?.address,
      typeof selectedAlert?.location === "string" ? selectedAlert.location : "",
      typeof metadata?.location === "string" ? metadata.location : "",
    ]
      .map((value) => cleanAlertLocationText(value))
      .filter(Boolean);
    return candidates.find((value) => !looksLikeCoordinatePair(value)) || "";
  }, [cleanAlertLocationText, looksLikeCoordinatePair, selectedAlert, selectedAlertPlaceName]);

  const selectedAlertDisplayTs =
    formatRawAlertTimestamp(selectedAlert?.timestamp) ||
    selectedAlert?.screenshot_timestamps?.[0] ||
    selectedAlert?.media?.screenshots?.[0]?.timestamp ||
    selectedAlert?.timestamp ||
    selectedAlert?.alert_timestamp ||
    selectedAlert?.created_at ||
    null;

  const selectedAlertLastOccurrenceTs =
    selectedAlert?.lastOccurrenceTimestamp ||
    selectedAlert?.last_occurrence ||
    selectedAlert?.last_occurrence_timestamp ||
    selectedAlert?.latestTimestamp ||
    selectedAlertDisplayTs ||
    null;

  const selectedAlertLocationText =
    selectedAlertResolvedLocationName ||
    (selectedAlertCoordinates
      ? `${selectedAlertCoordinates.longitude.toFixed(6)}, ${selectedAlertCoordinates.latitude.toFixed(6)}`
      : typeof selectedAlert?.location === 'string'
      ? selectedAlert.location
      : 'Location from alert');

  const selectedAlertSeverity = String(selectedAlert?.priority || selectedAlert?.severity || "info").toLowerCase();

  const getDashboardStructuredAlertMapping = useCallback((value: string) => {
    const text = String(value || "").trim();
    if (!text) return null;
    const signalMapped = DASHBOARD_SIGNAL_CODE_MAP[text];
    if (signalMapped) {
      return { title: signalMapped.title, domain: signalMapped.domain || null, code: signalMapped.code ?? null, level: null };
    }
    const structuredMatch = text.match(/^(ADAS|DMS)\s+Alert\s+Type\s+(\d+)(?:\s*\(Level\s*(\d+)\))?$/i);
    if (structuredMatch) {
      const domain = structuredMatch[1].toUpperCase() as DashboardStructuredAlertDomain;
      const code = Number(structuredMatch[2]);
      const level = structuredMatch[3] ? Number(structuredMatch[3]) : null;
      return {
        title: DASHBOARD_STRUCTURED_ALERT_TITLE_MAP[domain]?.[code] || `${domain} Alert Type ${code}`,
        domain, code, level,
      };
    }
    const alias = DASHBOARD_OFFICIAL_ALERT_ALIAS_MAP[text.toLowerCase()];
    if (alias) {
      return { title: alias.title, domain: alias.domain || null, code: alias.code ?? null, level: null };
    }
    return null;
  }, []);

  const selectedAlertTitle = useMemo(() => {
    const metadata = selectedAlert?.metadata || {};
    const candidateValues = [
      selectedAlert?.title,
      selectedAlert?.alert_type,
      selectedAlert?.type,
      metadata?.primaryAlertType,
      ...(Array.isArray(metadata?.alertSignalDetails) ? metadata.alertSignalDetails.map((detail: any) => detail?.label) : []),
      ...(Array.isArray(metadata?.alertSignals) ? metadata.alertSignals : []),
      ...(Array.isArray(metadata?.alertSignalDetails) ? metadata.alertSignalDetails.map((detail: any) => detail?.code) : []),
    ]
      .map((value) => String(value || "").trim())
      .filter(Boolean) as string[];
    for (const value of candidateValues) {
      const mapped = getDashboardStructuredAlertMapping(value);
      if (mapped) return mapped.title;
    }
    return candidateValues[0] || "Alert";
  }, [getDashboardStructuredAlertMapping, selectedAlert]);

  const preservedVehicleRef = useRef("");

  const selectedAlertVehicleDisplay = useMemo(() => {
    if (!selectedAlert) return preservedVehicleRef.current || "Unknown Vehicle";
    const reg = String(selectedAlert?.vehicle_registration || selectedAlert?.plate || selectedAlert?.registration || "").trim();
    const fleet = String(selectedAlert?.fleet_number || selectedAlert?.fleetNumber || "").trim();
    let display: string;
    if (fleet && reg && fleet.toUpperCase() !== reg.toUpperCase()) {
      display = `${fleet} - ${reg}`;
    } else {
      display = reg || fleet || "";
    }
    if (display) {
      preservedVehicleRef.current = display;
      return display;
    }
    return preservedVehicleRef.current || "Unknown Vehicle";
  }, [selectedAlert]);

  const selectedAlertDriverInfo = useMemo(() => {
    if (!selectedAlert) return { name: "Unknown", phone: "", department: "" };
    const driverInfo = selectedAlert?.driverInfo || selectedAlert?.driver_info || selectedAlert?.metadata?.driver || {};
    return {
      name: String(driverInfo?.name || driverInfo?.driver_name || driverInfo?.full_name || selectedAlert?.driver_name || selectedAlert?.driverName || "Unknown").trim(),
      phone: String(driverInfo?.phone || driverInfo?.phone_number || driverInfo?.mobile || "").trim(),
      department: String(driverInfo?.department || driverInfo?.dept || driverInfo?.cost_center || selectedAlert?.department || "").trim(),
    };
  }, [selectedAlert]);

  const selectedAlertSpeedDisplay = useMemo(() => {
    const speedVal = selectedAlert?.speed ?? selectedAlert?.metadata?.speed ?? selectedAlert?.gps?.speed;
    if (speedVal === null || speedVal === undefined) return "N/A";
    return `${Number(speedVal).toFixed(0)} km/h`;
  }, [selectedAlert]);

  const selectedAlertReportDetails = useMemo(() => {
    if (!selectedAlert) return {};
    return {
      alertId: String(selectedAlert?.id || "").trim(),
      vehicleName: selectedAlertVehicleDisplay,
      driverName: selectedAlertDriverInfo.name,
      driverPhone: selectedAlertDriverInfo.phone,
      driverDepartment: selectedAlertDriverInfo.department,
      alertType: selectedAlertTitle,
      severity: selectedAlertSeverity,
      timestamp: selectedAlertDisplayTs,
      location: selectedAlertLocationText,
      speed: selectedAlertSpeedDisplay,
      rawAlert: selectedAlert,
    };
  }, [selectedAlert, selectedAlertVehicleDisplay, selectedAlertDriverInfo, selectedAlertTitle, selectedAlertSeverity, selectedAlertDisplayTs, selectedAlertLocationText, selectedAlertSpeedDisplay]);

  const [activeTab, setActiveTab] = useState("screenshots");
  const videoLoadInitiatedRef = useRef(false);
  const [videoPreview, setVideoPreview] = useState<{ url: string; label: string } | null>(null);
  const [selectedAlertPlaybackVideos, setSelectedAlertPlaybackVideos] = useState<Array<{ key: string; label: string; url: string }>>([]);
  const [selectedAlertPlaybackLoading, setSelectedAlertPlaybackLoading] = useState(false);
  const [selectedAlertPlaybackError, setSelectedAlertPlaybackError] = useState("");
  const [timelinePlaybackByAlert, setTimelinePlaybackByAlert] = useState<Record<string, Array<{ key: string; label: string; url: string }>>>({});
  const [timelinePlaybackLoading, setTimelinePlaybackLoading] = useState<Record<string, boolean>>({});
  const [derivedAlertScreenshots, setDerivedAlertScreenshots] = useState<Array<{ url: string; channel?: number; timestamp?: string; offset?: number }>>([]);
  const [derivedAlertScreenshotLoading, setDerivedAlertScreenshotLoading] = useState(false);
  const [alertScreenshotsExpanded, setAlertScreenshotsExpanded] = useState(false);
  const alertVideoRequestStateRef = useRef<Record<string, any>>({});
  const alertMediaFetchBackoffRef = useRef<Record<string, number>>({});
  const videoProxyBase = "/api/video-server";
  const [contentOpacity, setContentOpacity] = useState(1);
  const prevAlertIdRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    const newId = String(selectedAlert?.id || "").trim();
    if (prevAlertIdRef.current && prevAlertIdRef.current !== newId && prevAlertIdRef.current !== "undefined") {
      setContentOpacity(0);
      const timer = setTimeout(() => setContentOpacity(1), 200);
      return () => clearTimeout(timer);
    }
    prevAlertIdRef.current = newId;
  }, [selectedAlert?.id]);

  const loadTimelineAlertPlayback = useCallback(async (entry: any) => {
    const entryId = String(entry?.id || "").trim();
    if (!entryId) return;
    if (timelinePlaybackLoading[entryId]) return;
    setTimelinePlaybackLoading((prev) => ({ ...prev, [entryId]: true }));
    try {
      const res = await fetch(`/api/video-server/eps/alerts/${encodeURIComponent(entryId)}/media`);
      if (!res.ok) throw new Error(`Failed to load timeline playback: ${res.status}`);
      const data = await res.json();
      const videos = (data?.videos || data?.media || []).map((v: any) => ({
        key: v.key || v.id || v.url,
        label: v.label || v.name || v.channel || "Video",
        url: v.url || v.streamUrl || v.hlsUrl,
      }));
      setTimelinePlaybackByAlert((prev) => ({ ...prev, [entryId]: videos }));
    } catch (err) {
      setTimelinePlaybackByAlert((prev) => ({ ...prev, [entryId]: [] }));
    } finally {
      setTimelinePlaybackLoading((prev) => ({ ...prev, [entryId]: false }));
    }
  }, [timelinePlaybackLoading]);

  const handleDerivedAlertScreenshotCapture = useCallback((channel: number | string, blob: Blob) => {
    const url = URL.createObjectURL(blob);
    setDerivedAlertScreenshots((prev) => {
      const exists = prev.some((s) => s.url === url);
      if (exists) return prev;
      return [...prev, { url, channel: Number(channel) || 0, timestamp: new Date().toISOString() }];
    });
  }, []);

  const loadAlertPlaybackVideos = useCallback(async () => {
    const alertId = String(selectedAlert?.id || "").trim();
    if (!alertId || selectedAlertPlaybackLoading) return;
    setSelectedAlertPlaybackLoading(true);
    setSelectedAlertPlaybackError("");
    try {
      const res = await fetch(`/api/video-server/eps/alerts/${encodeURIComponent(alertId)}/media`);
      if (!res.ok) throw new Error(`Failed to load alert playback: ${res.status}`);
      const data = await res.json();
      const videos = (data?.videos || data?.media || []).map((v: any) => ({
        key: v.key || v.id || v.url,
        label: v.label || v.name || v.channel || "Video",
        url: v.url || v.streamUrl || v.hlsUrl,
      }));
      setSelectedAlertPlaybackVideos(videos);
    } catch (err: any) {
      setSelectedAlertPlaybackError(err?.message || "Failed to load alert playback");
      setSelectedAlertPlaybackVideos([]);
    } finally {
      setSelectedAlertPlaybackLoading(false);
    }
  }, [selectedAlert?.id, selectedAlertPlaybackLoading]);

  const selectedAlertVideoRequestState = alertVideoRequestStateRef.current[String(selectedAlert?.id || "").trim()] || {};

  useEffect(() => {
    if (activeTab === "videos" && !videoLoadInitiatedRef.current) {
      videoLoadInitiatedRef.current = true;
      loadAlertPlaybackVideos();
    }
  }, [activeTab, loadAlertPlaybackVideos]);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 backdrop-blur-sm p-2 sm:p-4 md:items-center md:p-6">
      <div className="flex w-full max-w-[1200px] max-h-[92vh] min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-300 bg-slate-50 shadow-2xl">
        {/* Header */}
        <div className="flex-shrink-0 border-b border-slate-200 bg-gradient-to-r from-slate-950 via-slate-900 to-red-950 px-3 py-3 md:px-4">
          <div className="mb-2 flex items-center justify-between gap-2">
            <Button variant="outline" size="sm" className="h-7 border-white/20 bg-white/10 px-2.5 text-white hover:bg-white/20 hover:text-white" onClick={onClose}>
              <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
              Back
            </Button>
            <p className="text-[11px] text-slate-300">Control room incident view</p>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/[0.05] p-3">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="truncate text-lg font-bold tracking-tight text-white md:text-xl">
                    {selectedAlertVehicleDisplay}
                  </h1>
                  <Badge variant="outline" className={cn(
                    "flex items-center gap-1 border text-[10px] px-2 py-0",
                    selectedAlertSeverity === 'critical' ? 'bg-red-100 text-red-800 border-red-300' :
                    selectedAlertSeverity === 'high' ? 'bg-orange-100 text-orange-800 border-orange-300' :
                    selectedAlertSeverity === 'medium' ? 'bg-yellow-100 text-yellow-800 border-yellow-300' :
                    'bg-blue-100 text-blue-800 border-blue-300'
                  )}>
                    <AlertTriangle className="w-3 h-3" />
                    {selectedAlertSeverity.toUpperCase()}
                  </Badge>
                </div>
                <p className="mt-1 truncate text-sm font-semibold text-slate-100">{selectedAlertTitle}</p>
                <p className="mt-1 truncate font-mono text-[11px] text-slate-300">ID: {String(selectedAlert?.id || "N/A").trim()}</p>
                <div className="mt-2 grid grid-cols-2 gap-1.5 text-[11px] text-slate-200">
                  <span className="rounded border border-white/10 bg-white/5 px-2 py-1">Driver: {selectedAlertDriverInfo.name || "Unknown"}</span>
                  <span className="rounded border border-white/10 bg-white/5 px-2 py-1">Speed: {selectedAlertSpeedDisplay}</span>
                  <span className="rounded border border-white/10 bg-white/5 px-2 py-1">Last: {selectedAlertLastOccurrenceTs ? formatRawAlertTimestamp(selectedAlertLastOccurrenceTs, "datetime") : "N/A"}</span>
                  <span className="rounded border border-white/10 bg-white/5 px-2 py-1">State: {selectedAlert?.resolved ? "Closed" : "Open"}</span>
                </div>
              </div>

              <div>
                <select
                  className="mb-2 h-7 w-full rounded-md border border-white/20 bg-white/10 px-2 text-xs text-white outline-none focus:border-white/40"
                  value={alertReason}
                  onChange={(e) => onAlertReasonChange(e.target.value)}
                >
                  <option value="" className="text-slate-900">SELECT REASON</option>
                  {alertReasonOptions.map((reason) => (
                    <option key={reason} value={reason} className="text-slate-900">
                      {String(reason).toUpperCase()}
                    </option>
                  ))}
                </select>
                {!selectedAlert?.resolved ? (
                  <div className="mb-2 flex flex-wrap items-center gap-1.5">
                    <Button
                      variant="outline"
                      className="h-7 border-red-300/70 bg-white px-2.5 text-xs text-red-700 hover:bg-red-50"
                      disabled={alertActionLoading}
                      onClick={onFalseAlert}
                    >
                      <XCircle className="w-3.5 h-3.5 mr-1.5" />
                      {alertActionLoading ? "Saving..." : "False Alert"}
                    </Button>
                    <Button
                      variant="outline"
                      className="h-7 border-emerald-300/70 bg-white px-2.5 text-xs text-emerald-700 hover:bg-emerald-50"
                      disabled={alertActionLoading}
                      onClick={onResolve}
                    >
                      {alertActionLoading ? "Saving..." : "Resolve"}
                    </Button>
                    <select
                      className="h-7 min-w-[155px] rounded-md border border-white/20 bg-white/10 px-2 text-xs text-white outline-none focus:border-white/40"
                      onChange={(e) => {
                        const formType = e.target.value;
                        if (formType) onNcrFormSelect(formType);
                      }}
                      defaultValue=""
                    >
                      <option value="" className="text-slate-900">SELECT NCR FORM</option>
                      {ncrFormOptions.map((option) => (
                        <option key={option.value} value={option.value} className="text-slate-900">
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <select
                      className="h-7 min-w-[130px] rounded-md border border-white/20 bg-white/10 px-2 text-xs text-white outline-none focus:border-white/40"
                      onChange={(e) => {
                        const formType = e.target.value;
                        if (formType) onReportFormSelect(formType);
                      }}
                      defaultValue=""
                    >
                      <option value="" className="text-slate-900">REPORTS</option>
                      {reportFormOptions.map((option) => (
                        <option key={option.value} value={option.value} className="text-slate-900">
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div className="mb-2">
                    <Badge className="border border-emerald-300 bg-emerald-100 text-emerald-800">Resolved</Badge>
                  </div>
                )}
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-slate-200">
                    Additional comments
                  </label>
                  <textarea
                    className="min-h-[58px] w-full rounded-md border border-white/20 bg-white/10 px-2 py-1.5 text-xs text-white outline-none placeholder:text-slate-300/80 focus:border-white/40"
                    value={alertNotesDraft}
                    onChange={(e) => onAlertNotesDraftChange(e.target.value)}
                    placeholder="Add extra context for this action (stored with alert resolution)"
                    maxLength={1200}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 md:px-6 py-6">
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6" style={{ opacity: contentOpacity, transition: "opacity 0.2s ease-in-out" }}>
            {/* Main Content */}
            <div className="xl:col-span-8">
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="w-full justify-start bg-slate-200/70 p-1 rounded-lg">
                  <TabsTrigger value="screenshots">Screenshots</TabsTrigger>
                  <TabsTrigger value="videos">Event Video</TabsTrigger>
                  <TabsTrigger value="timeline">Timeline</TabsTrigger>
                </TabsList>

                {/* Screenshots Tab */}
                <TabsContent value="screenshots" className="mt-4">
                  <Card className="p-4 border-slate-200 bg-white shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-slate-900">Alert Screenshots</h3>
                      {(selectedAlert?.screenshotUrls?.length > 0 || selectedAlert?.media?.screenshots?.length > 0 || derivedAlertScreenshots.length > 0) && (
                        <Badge variant="secondary" className="text-xs">
                          {(selectedAlert?.screenshotUrls?.length || 0) + (selectedAlert?.media?.screenshots?.length || 0) + derivedAlertScreenshots.length} screenshot(s)
                        </Badge>
                      )}
                    </div>

                    {/* Alert screenshots */}
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                      {/* Screenshots from the alert's screenshotUrl field */}
                      {Array.isArray(selectedAlert?.screenshotUrls) &&
                        selectedAlert.screenshotUrls.map((url: string, idx: number) => (
                          <div key={`alert-ss-${idx}`} className="group relative overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                            <SafeImage
                              src={url}
                              alt={`Screenshot ${idx + 1}`}
                              className="h-40 w-full object-cover"
                            />
                            {url && (
                              <div className="absolute bottom-0 left-0 right-0 flex items-center justify-center gap-1 bg-gradient-to-t from-black/60 to-transparent p-2 opacity-0 transition-opacity group-hover:opacity-100">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 bg-white/90 text-[10px] text-slate-800 hover:bg-white"
                                  onClick={() => window.open(url, "_blank")}
                                >
                                  Open
                                </Button>
                              </div>
                            )}
                          </div>
                        ))}
                      {/* Screenshots from media property */}
                      {Array.isArray(selectedAlert?.media?.screenshots) && selectedAlert.media.screenshots.length > 0 &&
                        selectedAlert.media.screenshots.map((ss: any, idx: number) => {
                          const ssUrl = ss?.url || ss?.src || ss?.path || (typeof ss === "string" ? ss : "");
                          return ssUrl ? (
                            <div key={`media-ss-${idx}`} className="group relative overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                              <SafeImage
                                src={ssUrl}
                                alt={`Media screenshot ${idx + 1}`}
                                className="h-40 w-full object-cover"
                              />
                              <div className="absolute bottom-0 left-0 right-0 flex items-center justify-center gap-1 bg-gradient-to-t from-black/60 to-transparent p-2 opacity-0 transition-opacity group-hover:opacity-100">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 bg-white/90 text-[10px] text-slate-800 hover:bg-white"
                                  onClick={() => window.open(ssUrl, "_blank")}
                                >
                                  Open
                                </Button>
                              </div>
                            </div>
                          ) : null;
                        })}
                      {/* Derived screenshots from video capture */}
                      {derivedAlertScreenshots.length > 0 && derivedAlertScreenshots.map((ss, idx) => (
                        <div key={`derived-ss-${idx}`} className="group relative overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                          <SafeImage
                            src={ss.url}
                            alt={`Captured screenshot ${idx + 1}`}
                            className="h-40 w-full object-cover"
                          />
                          <div className="absolute bottom-0 left-0 right-0 flex items-center justify-center gap-1 bg-gradient-to-t from-black/60 to-transparent p-2 opacity-0 transition-opacity group-hover:opacity-100">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 bg-white/90 text-[10px] text-slate-800 hover:bg-white"
                              onClick={() => window.open(ss.url, "_blank")}
                            >
                              Open
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>

                    {!selectedAlert?.screenshotUrls?.length && !selectedAlert?.media?.screenshots?.length && derivedAlertScreenshots.length === 0 && (
                      <div className="text-center py-8 text-slate-500">
                        <p>No screenshots available for this alert.</p>
                      </div>
                    )}
                  </Card>
                </TabsContent>

                {/* Videos Tab */}
                  <TabsContent value="videos" className="mt-4">
                  <Card className="p-4 border-slate-200 bg-white shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                      <h3 className="text-lg font-semibold text-slate-900">Alert Video Playback</h3>
                    </div>

                    {selectedAlertPlaybackVideos.length > 0 ? (
                      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                        {selectedAlertPlaybackVideos.map((video, idx) => (
                          <Card key={video.url} className="p-0 overflow-hidden border-slate-200 shadow-sm bg-slate-950 text-slate-100">
                            <UniversalVideoPlayer
                              url={video.url}
                              autoPlay={true}
                              onScreenshotCapture={(blob) => handleDerivedAlertScreenshotCapture(idx, blob)}
                              className="w-full h-[48vh] min-h-[320px] max-h-[620px] rounded-none border-0 bg-black object-contain"
                            />
                          </Card>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-12 text-slate-500">
                        <p>
                          {selectedAlertPlaybackLoading
                            ? "Preparing alert video from stored footage..."
                            : "Alert video is not ready yet for this alert."}
                        </p>
                        {selectedAlertPlaybackError ? (
                          <p className="mt-2 text-sm text-rose-600">{selectedAlertPlaybackError}</p>
                        ) : null}
                      </div>
                    )}
                  </Card>
                </TabsContent>

                {/* Timeline Tab */}
                <TabsContent value="timeline" className="mt-4">
                  <Card className="p-4 border-slate-200 bg-white shadow-sm">
                    <h3 className="text-lg font-semibold text-slate-900 mb-4">Resolved Alert Timeline</h3>
                    <p className="text-xs text-slate-500 mb-4">
                      This vehicle only. Ordered by latest resolution.
                    </p>
                    {selectedAlert?.timeline?.length > 0 ? (
                      <div className="relative space-y-3">
                        <div className="absolute left-3 top-0 bottom-0 w-px bg-slate-200" />
                        {selectedAlert.timeline.map((entry: any) => (
                          <div key={entry.id || `${entry.timestamp}-${entry.title}`} className="relative pl-8">
                            <span className="absolute left-[7px] top-3 h-2.5 w-2.5 rounded-full bg-slate-500" />
                            <Card className="border-slate-200 bg-slate-50 p-3">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <p className="font-medium text-slate-900 text-sm">{entry.title}</p>
                                <div className="flex items-center gap-2">
                                  <Badge className={cn(
                                    "text-[10px] px-2 py-0.5",
                                    entry.resolutionType === "false_alert"
                                      ? "bg-rose-100 text-rose-700 border border-rose-200"
                                      : entry.resolutionType === "ncr"
                                        ? "bg-amber-100 text-amber-700 border border-amber-200"
                                        : entry.resolutionType === "report"
                                          ? "bg-blue-100 text-blue-700 border border-blue-200"
                                          : "bg-emerald-100 text-emerald-700 border border-emerald-200"
                                  )}>
                                    {entry.resolutionLabel}
                                  </Badge>
                                  <Badge variant="outline" className="text-[10px]">
                                    {String(entry.severity || "info").toUpperCase()}
                                  </Badge>
                                </div>
                              </div>
                              <p className="text-xs text-slate-500 mt-1">
                                {entry.timestamp ? toSAST(entry.timestamp).toLocaleString() : "Unknown time"}
                              </p>
                              {entry.notes ? (
                                <p className="text-xs text-slate-700 mt-2 line-clamp-2">{entry.notes}</p>
                              ) : null}
                              <div className="mt-3 flex flex-wrap items-center gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="border-cyan-300 bg-white text-cyan-700 hover:bg-cyan-50"
                                  onClick={() => loadTimelineAlertPlayback(entry)}
                                  disabled={timelinePlaybackLoading[String(entry?.id || "").trim()]}
                                >
                                  <Video className="mr-2 h-4 w-4" />
                                  {timelinePlaybackLoading[String(entry?.id || "").trim()] ? "Loading video..." : "Load Playback"}
                                </Button>
                              </div>
                              {Array.isArray(timelinePlaybackByAlert[String(entry?.id || "").trim()]) &&
                              timelinePlaybackByAlert[String(entry?.id || "").trim()].length > 0 && (
                                <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
                                  {timelinePlaybackByAlert[String(entry?.id || "").trim()].map((video: any, idx: number) => (
                                    <Card key={`${entry.id}-${video.url}-${idx}`} className="p-3 border-slate-200 shadow-sm bg-slate-950 text-slate-100">
                                      <UniversalVideoPlayer
                                        url={video.url}
                                        autoPlay={idx === 0}
                                        className="w-full rounded mb-3 border border-slate-700"
                                      />
                                      <div className="flex items-center justify-between gap-2">
                                        <div>
                                          <p className="text-sm font-medium text-white">{video.label || `Video ${idx + 1}`}</p>
                                          <p className="text-xs text-slate-300">Alert-time playback</p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                          <Button
                                            variant="outline"
                                            size="sm"
                                            className="border-cyan-400/40 bg-slate-900 text-cyan-200 hover:bg-slate-800"
                                            onClick={() => window.open(resolveMediaUrlForCurrentOrigin(video.url), "_blank")}
                                          >
                                            Preview
                                          </Button>
                                          <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => window.open(resolveMediaUrlForCurrentOrigin(video.url), "_blank")}
                                          >
                                            <Download className="mr-2 h-4 w-4" />
                                            Download
                                          </Button>
                                        </div>
                                      </div>
                                    </Card>
                                  ))}
                                </div>
                              )}
                            </Card>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-12 text-slate-500">
                        No resolved history available for this vehicle yet
                      </div>
                    )}
                  </Card>
                </TabsContent>
              </Tabs>
            </div>

            {/* Sidebar */}
            <div className="xl:col-span-4 grid grid-cols-1 gap-4">
              <Card className="border-slate-200 bg-white p-4 shadow-sm">
                <div className="mb-3">
                  <h3 className="font-semibold text-slate-900">Vehicle Incident Timeline</h3>
                  <p className="text-xs text-slate-500">Time + incident with quick actions</p>
                </div>
                <div className="max-h-[52vh] space-y-2 overflow-auto pr-1">
                  {Array.isArray(selectedAlert?.recent_alerts) && selectedAlert.recent_alerts.length > 0 ? (
                    [...selectedAlert.recent_alerts]
                      .sort((a: any, b: any) => new Date(b?.timestamp || 0).getTime() - new Date(a?.timestamp || 0).getTime())
                      .map((entry: any, idx: number) => (
                        <div
                          key={`sidebar-incident-${entry?.id || idx}`}
                          className="rounded-md border border-slate-200 bg-slate-50 p-2"
                        >
                          <div className="flex items-center justify-between gap-1">
                            <p className="truncate text-xs font-semibold text-slate-900">{entry?.title || "Alert"}</p>
                            <Badge variant="outline" className="shrink-0 text-[10px]">
                              {String(entry?.severity || "info").toUpperCase()}
                            </Badge>
                          </div>
                          <p className="mt-0.5 text-[11px] text-slate-600">
                            {entry?.timestamp ? toSAST(entry.timestamp).toLocaleString() : "Unknown time"}
                          </p>
                          <div className="mt-2 flex flex-wrap items-center gap-1.5">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-6 border-cyan-300 bg-white text-[10px] text-cyan-700 hover:bg-cyan-50"
                              onClick={() => loadTimelineAlertPlayback(entry)}
                              disabled={timelinePlaybackLoading[String(entry?.id || "").trim()]}
                            >
                              <Video className="mr-1 h-3 w-3" />
                              {timelinePlaybackLoading[String(entry?.id || "").trim()] ? "Loading..." : "Playback"}
                            </Button>
                            {entry?.resolved ? (
                              <Badge className="h-5 border-emerald-200 bg-emerald-50 text-[10px] text-emerald-700">Resolved</Badge>
                            ) : (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-6 border-rose-300 bg-white text-[10px] text-rose-600 hover:bg-rose-50"
                                  onClick={async () => {
                                    if (!confirm("Mark this alert as a false alarm and close it?")) return;
                                    await onSidebarAction(entry, "false_alert");
                                    setActiveTab("screenshots");
                                  }}
                                >
                                  False Alert
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-6 border-emerald-300 bg-white text-[10px] text-emerald-700 hover:bg-emerald-50"
                                  onClick={async () => {
                                    await onSidebarAction(entry, "resolve");
                                    setActiveTab("screenshots");
                                  }}
                                >
                                  Resolve
                                </Button>
                              </>
                            )}
                          </div>
                          {Array.isArray(timelinePlaybackByAlert[String(entry?.id || "").trim()]) &&
                          timelinePlaybackByAlert[String(entry?.id || "").trim()].length > 0 && (
                            <div className="mt-2 space-y-1.5">
                              {timelinePlaybackByAlert[String(entry?.id || "").trim()].map((video: any, vidx: number) => (
                                <div key={`side-${entry?.id}-${vidx}`} className="flex items-center gap-1.5">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-5 text-[10px] text-cyan-600 hover:text-cyan-800"
                                    onClick={() => window.open(resolveMediaUrlForCurrentOrigin(video.url), "_blank")}
                                  >
                                    ▶ {video.label || `Video ${vidx + 1}`}
                                  </Button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))
                  ) : (
                    <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-center text-sm text-slate-500">
                      No incidents found for this vehicle.
                    </div>
                  )}
                </div>
              </Card>

              {/* Map Section */}
              <Card className="hidden p-4 border-slate-200 bg-white shadow-sm">
                <h3 className="font-semibold text-slate-900 mb-4">Map</h3>
                {selectedAlertCoordinates ? (
                  <div
                    key={`alert-map-${selectedAlert?.id || 'na'}-${selectedAlertCoordinates.latitude}-${selectedAlertCoordinates.longitude}`}
                    className="relative w-full h-56 overflow-hidden rounded border bg-slate-100"
                    ref={(el) => {
                      if (el && !el.dataset.mapInitialized) {
                        el.dataset.mapInitialized = 'true';
                        el.style.position = 'relative';
                        el.style.overflow = 'hidden';
                        const lat = selectedAlertCoordinates.latitude;
                        const lng = selectedAlertCoordinates.longitude;
                        const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
                        if (!mapboxToken) {
                          el.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#64748b;font-size:14px;">Map token missing</div>';
                          return;
                        }
                        el.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#64748b;font-size:14px;">Loading map...</div>';
                        const script = document.createElement('script');
                        script.src = 'https://api.mapbox.com/mapbox-gl-js/v2.15.0/mapbox-gl.js';
                        script.async = true;
                        script.onload = () => {
                          if (!document.querySelector('link[href*="mapbox-gl.css"]')) {
                            const link = document.createElement('link');
                            link.href = 'https://api.mapbox.com/mapbox-gl-js/v2.15.0/mapbox-gl.css';
                            link.rel = 'stylesheet';
                            document.head.appendChild(link);
                          }
                          el.innerHTML = '';
                          const mapRoot = document.createElement('div');
                          mapRoot.style.position = 'absolute';
                          mapRoot.style.inset = '0';
                          mapRoot.style.width = '100%';
                          mapRoot.style.height = '100%';
                          el.appendChild(mapRoot);
                          if (window.mapboxgl) {
                            window.mapboxgl.accessToken = mapboxToken;
                            const map = new window.mapboxgl.Map({
                              container: mapRoot,
                              style: 'mapbox://styles/mapbox/streets-v12',
                              center: [lng, lat],
                              zoom: 13,
                              attributionControl: false
                            });
                            new window.mapboxgl.Marker({ color: '#ef4444' })
                              .setLngLat([lng, lat])
                              .addTo(map);
                          }
                        };
                        if (!document.querySelector('script[src*="mapbox-gl.js"]')) {
                          document.head.appendChild(script);
                        } else if (window.mapboxgl) {
                          script.onload();
                        }
                      }
                    }}
                  />
                ) : (
                  <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 p-4 text-center">
                    <p className="text-sm text-slate-500">No map coordinates available</p>
                  </div>
                )}
              </Card>
            </div>
          </div>
        </div>
      </div>

      {/* Video Preview Modal */}
      {videoPreview && (
        <div className="fixed inset-0 z-[80] bg-black/70 backdrop-blur-sm p-4 flex items-center justify-center">
          <div className="w-full max-w-5xl rounded-xl border border-cyan-400/30 bg-slate-950 shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
              <div>
                <p className="text-[11px] uppercase tracking-wide text-cyan-300">Video Preview</p>
                <p className="text-sm font-semibold text-white">{videoPreview.label}</p>
              </div>
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 text-slate-300 hover:bg-slate-800 hover:text-white"
                onClick={() => setVideoPreview(null)}
                title="Close preview"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="p-4">
              <UniversalVideoPlayer
                url={videoPreview.url}
                autoPlay={true}
                className="w-full rounded border border-slate-700 bg-black"
              />
              <div className="mt-3 flex justify-end">
                <Button variant="outline" onClick={() => window.open(resolveMediaUrlForCurrentOrigin(videoPreview.url), "_blank")}>
                  <Download className="w-4 h-4 mr-2" />
                  Open Source
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
