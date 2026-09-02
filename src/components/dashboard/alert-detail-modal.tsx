"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, AlertTriangle, Video, Download, XCircle, CheckCircle, X, FileText, MapPin, ExternalLink, Copy, Gauge, Navigation, Clock, Timer, ShieldAlert, ChevronDown, Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import { toSAST } from "@/lib/utils/date-formatter";
import { useCostCenters } from "@/context/cost-centers-context";
import { DriverDropdown } from "@/components/ui/driver-dropdown";
import { UniversalVideoPlayer } from "@/components/dashboard/universal-video-player";
import { RealTimeMapInline } from "@/components/dashboard/real-time-map-inline";
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
  pendingDocuments?: Array<{
    type: string;
    timestamp: string;
    filled_by: string;
    link: string;
    documentName: string;
    documentType: string;
    formType: string;
  }>;
  onClose: () => void;
  onFalseAlert: () => Promise<void>;
  onResolve: () => Promise<void>;
  onResolveActive?: () => Promise<void>;
  onNcrFormSelect: (formType: string) => void;
  onReportFormSelect: (formType: string) => void;
  onOpenAlertDetail: (alert: any, trip: any, opts?: { silent?: boolean }) => void;
  onSidebarAction: (entry: any, action: "resolve" | "false_alert") => Promise<void>;
  onRefreshTrigger: () => void;
  triggerRealtimeLoad: () => void;
  onFollowUp?: (originalSeverity: string) => Promise<void>;
  driversByFleetNumber?: Map<string, {
    firstName: string;
    surname: string;
    cellNumber: string;
    fleetNumber: string;
    costCenterId: number | null;
  }>;
  drivers?: Array<{ id: string; first_name: string; surname: string; fleet_number?: string | null; cell_number?: string | null; assigned_vehicle?: { registration_number?: string } | null }>;
  onDriverAssign?: (driverId: string, driverName: string, fleetNumber?: string) => void;
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
      { lat: alert?.metadata?.gps?.latitude, lng: alert?.metadata?.gps?.longitude },
      { lat: alert?.metadata?.location?.latitude, lng: alert?.metadata?.location?.longitude },
      { lat: alert?.latitude, lng: alert?.longitude },
      { lat: alert?.lat, lng: alert?.lon || alert?.lng },
      { lat: alert?.gps?.latitude, lng: alert?.gps?.longitude },
      { lat: alert?.speedAlert?.latitude, lng: alert?.speedAlert?.longitude },
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
  pendingDocuments,
  onClose,
  onFalseAlert,
  onResolve,
  onResolveActive,
  onNcrFormSelect,
  onReportFormSelect,
  onOpenAlertDetail,
  onSidebarAction,
  onRefreshTrigger,
  triggerRealtimeLoad,
  onFollowUp,
  driversByFleetNumber,
  drivers = [],
  onDriverAssign,
}: AlertDetailModalProps) {
  const { costCenterMap } = useCostCenters();
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
  const [vehicleLookup, setVehicleLookup] = useState<Record<string, { fleetNumber: string; registration: string; driverName: string | null; costCenter: string; costCenterId: number | null }>>({});
  const [geotabDeviceId, setGeotabDeviceId] = useState<string | null>(null);

  const selectedAlertVehicleDisplay = useMemo(() => {
    if (!selectedAlert) return preservedVehicleRef.current || "Unknown Vehicle";
    
    // First try to get from vehicle lookup (fleet-reg format)
    const deviceId = String(selectedAlert?.device_id || selectedAlert?.deviceId || selectedAlert?.vehicleId || "").trim();
    const lookupData = vehicleLookup[deviceId];
    
    let fleet = lookupData?.fleetNumber || String(selectedAlert?.fleet_number || selectedAlert?.fleetNumber || "").trim();
    let reg = lookupData?.registration || String(selectedAlert?.vehicle_registration || selectedAlert?.plate || selectedAlert?.registration || "").trim();
    
    let display: string;
    if (fleet && reg && fleet.toUpperCase() !== reg.toUpperCase()) {
      display = `${fleet} - ${reg}`;
    } else if (reg) {
      display = reg;
    } else if (fleet) {
      display = fleet;
    } else {
      display = "";
    }
    
    if (display) {
      preservedVehicleRef.current = display;
      return display;
    }
    return preservedVehicleRef.current || "Unknown Vehicle";
  }, [selectedAlert, vehicleLookup]);

  const selectedAlertDriverInfo = useMemo(() => {
    if (!selectedAlert) return { name: "Unknown", phone: "", department: "" };
    const driverInfo = selectedAlert?.driverInfo || selectedAlert?.driver_info || selectedAlert?.metadata?.driver || {};
    const deviceId = String(selectedAlert?.device_id || selectedAlert?.deviceId || selectedAlert?.vehicleId || "").trim();
    const fleetNum = String(selectedAlert?.fleet_number || selectedAlert?.fleetNumber || "").trim().toUpperCase();
    const regPlate = String(selectedAlert?.vehicle_registration || selectedAlert?.plate || selectedAlert?.registration || "").trim().toUpperCase();
    const lookupByDevice = vehicleLookup[deviceId];
    const lookupByFleet = fleetNum ? vehicleLookup[fleetNum] : undefined;
    const lookupByReg = regPlate ? vehicleLookup[regPlate] : undefined;
    const lookup = lookupByDevice || lookupByFleet || lookupByReg;
    const lookupDriver = lookup?.driverName;
    const lookupCostCenter = lookup?.costCenter || "";
    const lookupCostCenterId = lookup?.costCenterId ?? null;
    const driverFromMap = fleetNum && driversByFleetNumber ? driversByFleetNumber.get(fleetNum) : null;
    const name = lookupDriver || (driverFromMap ? `${driverFromMap.firstName} ${driverFromMap.surname}`.trim() : String(driverInfo?.name || driverInfo?.driver_name || driverInfo?.full_name || selectedAlert?.driver_name || selectedAlert?.driverName || "Unknown").trim());
    const phone = driverFromMap?.cellNumber || String(driverInfo?.phone || driverInfo?.phone_number || driverInfo?.mobile || "").trim();
    const rawDepartment = String(driverInfo?.department || driverInfo?.dept || driverInfo?.cost_center || selectedAlert?.department || "").trim();
    const costCenterFromMap = driverFromMap?.costCenterId != null ? costCenterMap.get(driverFromMap.costCenterId) : null;
    const department = lookupCostCenter || rawDepartment || costCenterFromMap || "";
    return {
      name,
      phone,
      department,
      costCenterId: lookupCostCenterId ?? driverFromMap?.costCenterId ?? null,
    };
  }, [selectedAlert, vehicleLookup, driversByFleetNumber, costCenterMap]);

  const selectedAlertSpeedDisplay = useMemo(() => {
    // Try multiple paths where speed might be stored
    const speedVal = selectedAlert?.speed 
      ?? selectedAlert?.metadata?.speed 
      ?? selectedAlert?.gps?.speed
      ?? selectedAlert?.speedAlert?.speed
      ?? selectedAlert?.alarm_speed
      ?? selectedAlert?.event_speed
      ?? selectedAlert?.speed_value
      ?? selectedAlert?.speedKmh
      ?? selectedAlert?.speed_kmh
      ?? selectedAlert?.current_speed
      ?? selectedAlert?.vehicle_speed;
    
    // Also check if speed is embedded in alarm_text or description
    if (speedVal === null || speedVal === undefined) {
      const text = String(selectedAlert?.alarm_text || selectedAlert?.description || '');
      const match = text.match(/(\d+(?:\.\d+)?)\s*(?:km\/h|kmh|kph)/i);
      if (match) return `${match[1]} km/h`;
      return "N/A";
    }
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
  const [resolveDropdownOpen, setResolveDropdownOpen] = useState(false);
  const [selectedDriverId, setSelectedDriverId] = useState<string>("");
  const videoLoadInitiatedRef = useRef(false);
  const [videoPreview, setVideoPreview] = useState<{ url: string; label: string } | null>(null);
  const [selectedAlertPlaybackVideos, setSelectedAlertPlaybackVideos] = useState<Array<{ key: string; label: string; url: string; isFlv?: boolean }>>([]);
  const [selectedAlertPlaybackLoading, setSelectedAlertPlaybackLoading] = useState(false);
  const [selectedAlertPlaybackError, setSelectedAlertPlaybackError] = useState("");
  const [timelinePlaybackByAlert, setTimelinePlaybackByAlert] = useState<Record<string, Array<{ key: string; label: string; url: string; isFlv?: boolean }>>>({});
  const [timelinePlaybackLoading, setTimelinePlaybackLoading] = useState<Record<string, boolean>>({});
  const [derivedAlertScreenshots, setDerivedAlertScreenshots] = useState<Array<{ url: string; channel?: number; timestamp?: string; offset?: number }>>([]);
  const [derivedAlertScreenshotLoading, setDerivedAlertScreenshotLoading] = useState(false);
  const [alertScreenshotsExpanded, setAlertScreenshotsExpanded] = useState(false);
  const [mediaFetching, setMediaFetching] = useState(false);
  const [captureRequestTrigger, setCaptureRequestTrigger] = useState(0);
  const [skycamMediaChecked, setSkycamMediaChecked] = useState(false);
  const [vehicleAlerts, setVehicleAlerts] = useState<any[]>([]);
  const [nearestPoliceStations, setNearestPoliceStations] = useState<Array<{ name: string; distance_km: number; lat: number; lon: number }>>([]);
  const [policeLoading, setPoliceLoading] = useState(false);
  const alertVideoRequestStateRef = useRef<Record<string, any>>({});
  const alertMediaFetchBackoffRef = useRef<Record<string, number>>({});
  const videoProxyBase = "/api/video-server";
  const [contentOpacity, setContentOpacity] = useState(1);
  const prevAlertIdRef = useRef<string | undefined>(undefined);
  const googleMapsToken = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_TOKEN || process.env.GOOGLE_MAPS_API_TOKEN || "";

  // Follow-up timer state
  const [followUpLoading, setFollowUpLoading] = useState(false);
  const [followUpCountdown, setFollowUpCountdown] = useState<string | null>(null);
  const followUpTimerRef = useRef<NodeJS.Timeout | null>(null);
  const resolveDropdownRef = useRef<HTMLDivElement>(null);

  // Close resolve dropdown on outside click
  useEffect(() => {
    if (!resolveDropdownOpen) return;
    const handler = (e: MouseEvent) => {
      if (resolveDropdownRef.current && !resolveDropdownRef.current.contains(e.target as Node)) {
        setResolveDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [resolveDropdownOpen]);

  // Compute follow-up state from alert data
  const isFollowUpActive = useMemo(() => {
    if (!selectedAlert?.follow_up || !selectedAlert?.follow_up_at) return false;
    const followUpTime = new Date(selectedAlert.follow_up_at).getTime();
    const elapsed = Date.now() - followUpTime;
    return elapsed < 15 * 60 * 1000;
  }, [selectedAlert?.follow_up, selectedAlert?.follow_up_at]);

  // Countdown timer
  useEffect(() => {
    if (followUpTimerRef.current) clearInterval(followUpTimerRef.current);
    if (!isFollowUpActive || !selectedAlert?.follow_up_at) {
      setFollowUpCountdown(null);
      return;
    }
    const updateCountdown = () => {
      const followUpTime = new Date(selectedAlert.follow_up_at!).getTime();
      const remaining = Math.max(0, 15 * 60 * 1000 - (Date.now() - followUpTime));
      if (remaining <= 0) {
        setFollowUpCountdown(null);
        if (followUpTimerRef.current) clearInterval(followUpTimerRef.current);
        return;
      }
      const mins = Math.floor(remaining / 60000);
      const secs = Math.floor((remaining % 60000) / 1000);
      setFollowUpCountdown(`${mins}:${secs.toString().padStart(2, '0')}`);
    };
    updateCountdown();
    followUpTimerRef.current = setInterval(updateCountdown, 1000);
    return () => { if (followUpTimerRef.current) clearInterval(followUpTimerRef.current); };
  }, [isFollowUpActive, selectedAlert?.follow_up_at]);

  const handleFollowUp = useCallback(async () => {
    if (!onFollowUp || !selectedAlert) return;
    const originalSeverity = selectedAlert.original_severity || selectedAlert.severity || 'medium';
    setFollowUpLoading(true);
    try {
      await onFollowUp(originalSeverity);
    } finally {
      setFollowUpLoading(false);
    }
  }, [onFollowUp, selectedAlert]);

  const sidebarGroups = useMemo(() => {
    const raw = vehicleAlerts.length > 0 ? vehicleAlerts : (Array.isArray(selectedAlert?.recent_alerts) ? selectedAlert.recent_alerts : []);
    const groups = new Map<string, { entry: any; count: number; latestTs: string }>();
    for (const entry of raw) {
      const key = String(entry?.alert_type || entry?.type || entry?.title || "alert").toLowerCase().trim();
      const existing = groups.get(key);
      const ts = entry?.timestamp || entry?.created_at || "";
      if (existing) {
        existing.count++;
        if (ts > existing.latestTs) {
          existing.latestTs = ts;
          existing.entry = entry;
        }
      } else {
        groups.set(key, { entry, count: 1, latestTs: ts });
      }
    }
    return Array.from(groups.values())
      .sort((a, b) => new Date(b.latestTs || 0).getTime() - new Date(a.latestTs || 0).getTime());
  }, [vehicleAlerts, selectedAlert?.recent_alerts]);

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
      const deviceId = String(entry?.device_id || entry?.deviceId || '').trim();
      const alarmTs = entry?.alarm_ts || entry?.alarmTs || entry?.timestamp || '';

      const res = await fetch('/api/mettax/media', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alarmId: entryId, deviceId, startTime: alarmTs }),
      });
      const data = await res.json();
      const videos = (data?.videos || []).map((v: any) => ({
        key: v.id || v.url,
        label: "Event Video",
        url: v.url,
        isFlv: /\.flv/i.test(v.rawUrl || v.url),
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
    if (!alertId) return;
    setSelectedAlertPlaybackLoading(true);
    setSelectedAlertPlaybackError("");
    try {
      const deviceId = String(
        selectedAlert?.device_id || selectedAlert?.deviceId || selectedAlert?.vehicleId ||
        selectedAlert?.metadata?.vehicle?.vehicleId || ''
      ).trim();
      const alarmTs = selectedAlert?.alarm_ts || selectedAlert?.alarmTs || selectedAlert?.timestamp || '';

      const res = await fetch('/api/mettax/media', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alarmId: alertId, deviceId, startTime: alarmTs }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || 'Failed to fetch from Mettax');

      const videos = (data.videos || []).map((v: any) => ({
        key: v.id || v.url,
        label: "Event Video",
        url: v.url,
        isFlv: /\.flv/i.test(v.rawUrl || v.url),
      }));
      setSelectedAlertPlaybackVideos(videos);

      // Also grab screenshots if we have none
      if (data.screenshots?.length > 0 && derivedAlertScreenshots.length === 0) {
        setDerivedAlertScreenshots(
          data.screenshots.map((s: any) => ({ url: s.url, channel: 0, timestamp: '' }))
        );
      }
    } catch (err: any) {
      setSelectedAlertPlaybackError(err?.message || "Failed to load alert playback");
      setSelectedAlertPlaybackVideos([]);
    } finally {
      setSelectedAlertPlaybackLoading(false);
    }
  }, [selectedAlert?.id]);

  const selectedAlertVideoRequestState = alertVideoRequestStateRef.current[String(selectedAlert?.id || "").trim()] || {};

  useEffect(() => {
    if (activeTab === "videos" && !videoLoadInitiatedRef.current) {
      videoLoadInitiatedRef.current = true;
      loadAlertPlaybackVideos();
    }
  }, [activeTab, loadAlertPlaybackVideos, selectedAlert?.id]);

  // Request media on-demand when modal opens and no screenshots exist
  const mediaRequestInitiatedRef = useRef(false);
  useEffect(() => {
    mediaRequestInitiatedRef.current = false;
    videoLoadInitiatedRef.current = false;
    setMediaFetching(false);
    setSelectedAlertPlaybackLoading(false);
    setSelectedAlertPlaybackError("");
    setDerivedAlertScreenshots([]);
    setSelectedAlertPlaybackVideos([]);

    // Auto-open Map tab for telematics alerts and speed alerts (focus on location/speed)
    const sourceType = String(selectedAlert?.source_type || "").trim().toLowerCase();
    const alertType = String(selectedAlert?.type || selectedAlert?.alert_type || "").toLowerCase();
    const isSpeedAlert = /speed/i.test(alertType) || (selectedAlert?.speed != null && selectedAlert?.speed > 0);
    if (sourceType === "telematics" || isSpeedAlert) {
      setActiveTab("map");
    } else {
      setActiveTab("screenshots");
    }

    // If already on Event Video tab, fetch immediately
    const alertId = String(selectedAlert?.id || "").trim();
    if (activeTab === "videos" && alertId) {
      videoLoadInitiatedRef.current = true;
      loadAlertPlaybackVideos();
    }
  }, [selectedAlert?.id]);
  useEffect(() => {
    if (mediaRequestInitiatedRef.current) return;
    const alertId = String(selectedAlert?.id || "").trim();
    if (!alertId) return;
    const hasScreenshots = (selectedAlert?.media?.screenshots?.length || 0) > 0
      || (selectedAlert?.screenshotUrls?.length || 0) > 0
      || derivedAlertScreenshots.length > 0;
    if (hasScreenshots) return;
    mediaRequestInitiatedRef.current = true;
    setMediaFetching(true);
    setSkycamMediaChecked(false);

    const deviceId = String(
      selectedAlert?.device_id || selectedAlert?.deviceId || selectedAlert?.vehicleId ||
      selectedAlert?.metadata?.vehicle?.vehicleId || ''
    ).trim();
    const alarmTs = selectedAlert?.alarm_ts || selectedAlert?.alarmTs || selectedAlert?.timestamp || '';

    // Call Mettax directly — skip backend
    fetch('/api/mettax/media', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ alarmId: alertId, deviceId, startTime: alarmTs }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          if (data.screenshots?.length > 0) {
            setDerivedAlertScreenshots((prev) => {
              const existingUrls = new Set(prev.map((s) => s.url));
              const newShots = data.screenshots
                .filter((s: any) => s.url && !existingUrls.has(s.url))
                .map((s: any) => ({ url: s.url, channel: 0, timestamp: '' }));
              return [...prev, ...newShots];
            });
          }
          // Don't set videos here — let loadAlertPlaybackVideos handle the Event Video tab
        }
      })
      .catch(() => {})
      .finally(() => {
        setSkycamMediaChecked(true);
        setMediaFetching(false);
      });
  }, [selectedAlert?.id, selectedAlert?.media?.screenshots?.length, selectedAlert?.screenshotUrls?.length, derivedAlertScreenshots.length, captureRequestTrigger]);

  // Fetch other alerts for the same vehicle
  useEffect(() => {
    const deviceId = String(
      selectedAlert?.device_id ||
      selectedAlert?.deviceId ||
      selectedAlert?.vehicleId ||
      selectedAlert?.metadata?.vehicle?.vehicleId ||
      ''
    ).trim();
    if (!deviceId) return;

    fetch(`/api/video-server/eps/alerts/active?limit=2000`, { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        const all = Array.isArray(data?.alerts) ? data.alerts : [];
        const sameVehicle = all.filter((a: any) => {
          const aDevice = String(
            a?.device_id || a?.deviceId || a?.vehicleId ||
            a?.metadata?.vehicle?.vehicleId || ''
          ).trim();
          return aDevice === deviceId && String(a?.id || '') !== String(selectedAlert?.id || '');
        });
        setVehicleAlerts(sameVehicle);
      })
      .catch(() => {});
  }, [selectedAlert?.id, selectedAlert?.device_id, selectedAlert?.vehicleId]);

  // Fetch nearest police stations when coordinates are available
  const lastFetchedKeyRef = useRef<string>("");
  useEffect(() => {
    if (!isOpen) {
      setNearestPoliceStations([]);
      lastFetchedKeyRef.current = "";
      return;
    }
    if (!selectedAlertCoordinates?.latitude || !selectedAlertCoordinates?.longitude) return;

    const key = `${selectedAlertCoordinates.latitude.toFixed(6)},${selectedAlertCoordinates.longitude.toFixed(6)}`;
    if (lastFetchedKeyRef.current === key) return;
    lastFetchedKeyRef.current = key;

    setPoliceLoading(true);
    fetch(`/api/video-server/police/nearest?lat=${selectedAlertCoordinates.latitude}&lon=${selectedAlertCoordinates.longitude}&limit=3`, {
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    })
      .then((res) => res.json())
      .then((data) => {
        setNearestPoliceStations(Array.isArray(data?.stations) ? data.stations : []);
      })
      .catch(() => {})
      .finally(() => setPoliceLoading(false));
  }, [selectedAlertCoordinates?.latitude, selectedAlertCoordinates?.longitude, isOpen]);

  // Fetch vehicle lookup for fleet-reg format
  useEffect(() => {
    if (Object.keys(vehicleLookup).length > 0) return;
    fetch("/api/vehicle-lookup?all=1", { cache: "no-store", signal: AbortSignal.timeout(30000) })
      .then((res) => res.json())
      .then((data) => {
        const vehicles = Array.isArray(data?.vehicles) ? data.vehicles : [];
        const lookup: Record<string, { fleetNumber: string; registration: string; driverName: string | null; costCenter: string; costCenterId: number | null }> = {};
        for (const v of vehicles) {
          const entry = {
            fleetNumber: String(v?.fleetNumber || v?.fleet_number || "").trim(),
            registration: String(v?.registration || v?.plate || v?.plateNumber || "").trim(),
            driverName: String(v?.driverName || "").trim() || null,
            costCenter: String(v?.costCenter || v?.cost_centres || "").trim(),
            costCenterId: v?.costCenterId ?? v?.cost_center_id ?? null,
          };
          const deviceId = String(v?.deviceId || v?.device_id || v?.vehicleId || "").trim();
          if (deviceId) lookup[deviceId] = entry;
          if (entry.fleetNumber) lookup[entry.fleetNumber.toUpperCase()] = entry;
          if (entry.registration) lookup[entry.registration.toUpperCase()] = entry;
        }
        setVehicleLookup(lookup);
      })
      .catch(() => {});
  }, []);

  // Resolve Geotab device id for the selected alert vehicle
  useEffect(() => {
    if (!selectedAlert) return;
    const deviceId = String(selectedAlert?.device_id || selectedAlert?.deviceId || selectedAlert?.vehicleId || "").trim();
    const lookupData = vehicleLookup[deviceId];
    const fleet = String(lookupData?.fleetNumber || selectedAlert?.fleet_number || selectedAlert?.fleetNumber || "").trim().toUpperCase();
    const reg = String(lookupData?.registration || selectedAlert?.vehicle_registration || selectedAlert?.plate || selectedAlert?.registration || "").trim().toUpperCase();
    if (!fleet && !reg) return;

    fetch("/api/video-server/telematics/vehicle-status-all", { cache: "no-store", signal: AbortSignal.timeout(10000) })
      .then((res) => res.json())
      .then((data) => {
        const statuses = Array.isArray(data?.data) ? data.data : [];
        for (const s of statuses) {
          const geoFleet = String(s?.fleet_number || "").trim().toUpperCase();
          const geoReg = String(s?.license_plate || "").trim().toUpperCase();
          if ((fleet && geoFleet === fleet) || (reg && geoReg === reg)) {
            setGeotabDeviceId(String(s?.device_id || "").trim());
            return;
          }
        }
      })
      .catch(() => {});
  }, [selectedAlert, vehicleLookup]);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 backdrop-blur-sm p-2 sm:p-4 md:items-center md:p-6">
      <div className="flex w-[90vw] h-[90vh] min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-300 bg-slate-50 shadow-2xl">
        {/* Header - Compact */}
        <div className="flex-shrink-0 border-b border-slate-200 bg-gradient-to-r from-slate-950 via-slate-900 to-red-950 px-3 py-1.5 md:px-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <Button variant="outline" size="sm" className="h-5 border-white/20 bg-white/10 px-1.5 text-white hover:bg-white/20 hover:text-white" onClick={onClose}>
                <ArrowLeft className="w-3 h-3" />
              </Button>
              <h1 className="truncate text-sm font-bold tracking-tight text-white md:text-base">
                {selectedAlertVehicleDisplay}
              </h1>
              <Badge variant="outline" className={cn(
                "flex items-center gap-0.5 border text-[9px] px-1 py-0",
                selectedAlertSeverity === 'critical' ? 'bg-red-100 text-red-800 border-red-300' :
                selectedAlertSeverity === 'high' ? 'bg-orange-100 text-orange-800 border-orange-300' :
                selectedAlertSeverity === 'medium' ? 'bg-yellow-100 text-yellow-800 border-yellow-300' :
                'bg-blue-100 text-blue-800 border-blue-300'
              )}>
                <AlertTriangle className="w-2 h-2" />
                {selectedAlertSeverity.toUpperCase()}
              </Badge>
              {isFollowUpActive && (
                <Badge className="animate-pulse flex items-center gap-0.5 border border-amber-300 bg-amber-100 text-amber-800 text-[9px] px-1 py-0 font-bold shadow-sm shadow-amber-200/50" style={{ animationDuration: '2s' }}>
                  <Timer className="w-2 h-2" />
                  Follow-up {followUpCountdown || ""}
                </Badge>
              )}
              <span className="text-sm font-semibold text-white md:text-base">{selectedAlertTitle}</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <select
                className="h-5 rounded border border-slate-300 bg-white px-1.5 text-[10px] text-slate-900 outline-none focus:border-slate-400 disabled:opacity-50"
                value={alertReason}
                onChange={(e) => onAlertReasonChange(e.target.value)}
                disabled={selectedAlert?.resolved}
              >
                <option value="">SELECT REASON</option>
                {alertReasonOptions.map((reason) => (
                  <option key={reason} value={reason}>
                    {String(reason).toUpperCase()}
                  </option>
                ))}
              </select>
              {!selectedAlert?.resolved && (
                <>
                  <Button
                    variant="outline"
                    className={cn(
                      "h-5 border px-1.5 text-[9px] hover:bg-amber-50",
                      isFollowUpActive
                        ? "animate-pulse border-amber-400 bg-amber-100 text-amber-800 font-bold shadow-sm shadow-amber-200/50"
                        : "border-amber-300/70 bg-white text-amber-700"
                    )}
                    disabled={alertActionLoading || followUpLoading || isFollowUpActive}
                    onClick={handleFollowUp}
                    style={isFollowUpActive ? { animationDuration: '2s' } : undefined}
                    title={isFollowUpActive ? `Follow-up active (${followUpCountdown})` : "Set to low priority for 15 minutes"}
                  >
                    <Timer className="w-2.5 h-2.5 mr-0.5" />
                    {isFollowUpActive ? followUpCountdown || "Follow-up" : "Follow-up"}
                  </Button>
                  <Button variant="outline" className="h-5 border-red-300/70 bg-white px-1.5 text-[9px] text-red-700 hover:bg-red-50" disabled={alertActionLoading} onClick={onFalseAlert}>
                    <XCircle className="w-2.5 h-2.5 mr-0.5" />
                    False Alert
                  </Button>
                  <div className="relative" ref={resolveDropdownRef}>
                    <Button
                      variant="outline"
                      className="h-5 border-emerald-300/70 bg-white px-1.5 text-[9px] text-emerald-700 hover:bg-emerald-50"
                      disabled={alertActionLoading}
                      onClick={() => setResolveDropdownOpen(!resolveDropdownOpen)}
                    >
                      Resolve
                      <ChevronDown className="w-2.5 h-2.5 ml-0.5" />
                    </Button>
                    {resolveDropdownOpen && (
                      <div className="absolute top-full left-0 mt-1 z-50 bg-white border border-slate-200 rounded-md shadow-lg py-1 min-w-[140px]">
                        <button
                          className="w-full px-3 py-1.5 text-left text-[10px] text-slate-700 hover:bg-emerald-50 flex items-center gap-2"
                          onClick={async () => {
                            setResolveDropdownOpen(false);
                            if (onResolveActive) await onResolveActive();
                          }}
                        >
                          <CheckCircle className="w-3 h-3 text-emerald-600" />
                          Resolve Active
                        </button>
                        <button
                          className="w-full px-3 py-1.5 text-left text-[10px] text-slate-700 hover:bg-emerald-50 flex items-center gap-2"
                          onClick={async () => {
                            setResolveDropdownOpen(false);
                            await onResolve();
                          }}
                        >
                          <Shield className="w-3 h-3 text-emerald-600" />
                          Resolve All
                        </button>
                      </div>
                    )}
                  </div>
                  <select className="h-5 min-w-[100px] rounded border border-slate-300 bg-white px-1.5 text-[10px] text-slate-900 outline-none" onChange={(e) => { if (e.target.value) { onNcrFormSelect(e.target.value); e.target.value = ""; } }} defaultValue="">
                    <option value="">NCR FORM</option>
                    {ncrFormOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                  <select className="h-5 min-w-[80px] rounded border border-slate-300 bg-white px-1.5 text-[10px] text-slate-900 outline-none" onChange={(e) => { if (e.target.value) { onReportFormSelect(e.target.value); e.target.value = ""; } }} defaultValue="">
                    <option value="">REPORTS</option>
                    {reportFormOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </>
              )}
              {selectedAlert?.resolved && (
                <Badge className="h-5 border border-emerald-300 bg-emerald-100 text-emerald-800 text-[9px]">Resolved</Badge>
              )}
              <textarea
                className="min-h-[60px] max-h-[120px] min-w-[200px] rounded border border-slate-300 bg-white px-2 py-1 text-[10px] text-slate-900 outline-none placeholder:text-slate-400 resize-y"
                value={alertNotesDraft}
                onChange={(e) => onAlertNotesDraftChange(e.target.value)}
                placeholder="Notes..."
                maxLength={2000}
                disabled={selectedAlert?.resolved}
                readOnly={selectedAlert?.resolved}
              />
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
                  <TabsTrigger value="map">Map</TabsTrigger>
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
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      {/* Screenshots from media property (images only) */}
                      {Array.isArray(selectedAlert?.media?.screenshots) && selectedAlert.media.screenshots.length > 0 &&
                        selectedAlert.media.screenshots.map((ss: any, idx: number) => {
                          const ssUrl = ss?.url || ss?.src || ss?.path || (typeof ss === "string" ? ss : "");
                          const ts = ss?.timestamp ? new Date(ss.timestamp).toLocaleString() : '';
                          return ssUrl ? (
                            <div key={`media-ss-${idx}`} className="group relative overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                              <SafeImage
                                src={ssUrl}
                                alt={`Screenshot ${idx + 1}`}
                                className="h-56 w-full object-cover"
                              />
                              {ts && (
                                <div className="absolute top-0 left-0 right-0 flex items-center justify-end bg-gradient-to-b from-black/60 to-transparent p-1.5">
                                  <span className="text-[9px] text-white/70">{ts}</span>
                                </div>
                              )}
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
                            className="h-56 w-full object-cover"
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
                      mediaFetching ? (
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                          {[1, 2].map((i) => (
                            <div key={i} className="overflow-hidden rounded-lg border border-slate-200 bg-slate-100 animate-pulse">
                              <div className="h-56 w-full bg-slate-200" />
                              <div className="p-3 space-y-2">
                                <div className="h-3 bg-slate-200 rounded w-1/3" />
                                <div className="h-2 bg-slate-200 rounded w-1/2" />
                              </div>
                            </div>
                          ))}
                          <div className="col-span-full text-center py-2 text-xs text-slate-400">
                            Fetching media from skycamx...
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-8 text-slate-500">
                          {skycamMediaChecked ? (
                            <p className="mb-3">No media found on skycam for this alert.</p>
                          ) : (
                            <p className="mb-3">No screenshots available for this alert.</p>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            className="border-cyan-300 text-cyan-700 hover:bg-cyan-50"
                            onClick={async () => {
                              if (!selectedAlert?.id) return;
                              setMediaFetching(true);
                              try {
                                // Fetch media from skycamx API
                                const res = await fetch(`/api/video-server/eps/alerts/${encodeURIComponent(selectedAlert.id)}/media?ensureMedia=true`, {
                                  cache: "no-store",
                                });
                                const data = await res.json();
                                const serverScreenshots = data?.screenshots || [];
                                if (serverScreenshots.length > 0) {
                                  setDerivedAlertScreenshots((prev) => {
                                    const existingUrls = new Set(prev.map((s) => s.url));
                                    const newShots = serverScreenshots
                                      .filter((s: any) => s.url && !existingUrls.has(s.url))
                                      .map((s: any) => ({ url: s.url, channel: s.channel, timestamp: s.timestamp }));
                                    return [...prev, ...newShots];
                                  });
                                }
                                // Also update videos
                                const serverVideos = data?.videos || [];
                                if (serverVideos.length > 0) {
                                  setSelectedAlertPlaybackVideos((prev) => {
                                    if (prev.length > 0) return prev;
                                    return serverVideos.map((v: any) => ({
                                      key: v.key || v.id || v.url,
                                      label: v.label || "Alert Media",
                                      url: v.url || v.fileUrl,
                                      isFlv: v.isFlv === true,
                                    }));
                                  });
                                }
                                // Trigger re-render
                                mediaRequestInitiatedRef.current = false;
                                setCaptureRequestTrigger((n) => n + 1);
                              } catch {
                                // silent
                              } finally {
                                setMediaFetching(false);
                              }
                            }}
                          >
                            Request Screenshots
                          </Button>
                        </div>
                      )
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
                              isFlv={video.isFlv}
                              onScreenshotCapture={(blob) => handleDerivedAlertScreenshotCapture(idx, blob)}
                              className="w-full h-[48vh] min-h-[320px] max-h-[620px] rounded-none border-0 bg-black object-contain"
                            />
                          </Card>
                        ))}
                      </div>
                    ) : mediaFetching ? (
                      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                        {[1, 2].map((i) => (
                          <div key={i} className="overflow-hidden rounded-lg border border-slate-200 bg-slate-950 animate-pulse">
                            <div className="h-[48vh] min-h-[320px] w-full bg-slate-800" />
                            <div className="p-3 space-y-2 bg-slate-900">
                              <div className="h-3 bg-slate-700 rounded w-1/3" />
                              <div className="h-2 bg-slate-700 rounded w-1/2" />
                            </div>
                          </div>
                        ))}
                        <div className="col-span-full text-center py-2 text-xs text-slate-400">
                          Requesting video from device...
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-12 text-slate-500">
                        <p>
                          {selectedAlertPlaybackLoading
                            ? "Preparing alert video from stored footage..."
                            : "Waiting for video"}
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
                    <h3 className="text-lg font-semibold text-slate-900 mb-4">Alert Timeline & Documents</h3>
                    {(selectedAlert?.timeline?.length > 0 || pendingDocuments.length > 0) ? (
                      <div className="relative space-y-3">
                        <div className="absolute left-3 top-0 bottom-0 w-px bg-slate-200" />

                        {/* Pending documents (NCR/Reports just saved) */}
                        {pendingDocuments.map((doc, idx) => (
                          <div key={`pending-${idx}`} className="relative pl-8">
                            <span className="absolute left-[7px] top-3 h-2.5 w-2.5 rounded-full bg-amber-500" />
                            <Card className="border-amber-200 bg-amber-50 p-3">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <p className="font-medium text-slate-900 text-sm">{doc.documentType || doc.formType}</p>
                                <Badge className="text-[10px] px-2 py-0.5 bg-amber-100 text-amber-700 border border-amber-200">
                                  {doc.type}
                                </Badge>
                              </div>
                              <p className="text-xs text-slate-500 mt-1">
                                {doc.filled_by} — {new Date(doc.timestamp).toLocaleString()}
                              </p>
                              {doc.link && (
                                <a href={doc.link} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs text-cyan-600 hover:text-cyan-800 underline">
                                  <ExternalLink className="w-3 h-3" />
                                  View Document
                                </a>
                              )}
                            </Card>
                          </div>
                        ))}

                        {/* Timeline entries from backend */}
                        {selectedAlert?.timeline?.map((entry: any) => (
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
                                        isFlv={video.isFlv}
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
                                            onClick={async () => {
                                              const u = resolveMediaUrlForCurrentOrigin(video.url);
                                              try {
                                                const r = await fetch(u);
                                                const b = await r.blob();
                                                const a = document.createElement("a");
                                                a.href = URL.createObjectURL(b);
                                                a.download = `alert-video-${Date.now()}.flv`;
                                                a.click();
                                                URL.revokeObjectURL(a.href);
                                              } catch { window.open(u, "_blank"); }
                                            }}
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
                        No timeline or documents yet
                      </div>
                    )}
                  </Card>
                </TabsContent>

                {/* Documents Tab */}
                {/* Map Tab */}
                <TabsContent value="map" className="mt-4">
                  <Card className="p-4 border-slate-200 bg-white shadow-sm">
                    <h3 className="text-lg font-semibold text-slate-900 mb-4">
                      Alert Location & Geotab Zones
                    </h3>
                    {/* Speed alert: show speed prominently */}
                    {(() => {
                      const alertType = String(selectedAlert?.type || selectedAlert?.alert_type || "").toLowerCase();
                      const isSpeedAlert = /speed/i.test(alertType) || (selectedAlert?.speed != null && selectedAlert?.speed > 0);
                      const isTelematics = String(selectedAlert?.source_type || "").trim().toLowerCase() === "telematics";
                      return (isSpeedAlert || isTelematics) && (
                        <>
                          <div className="mb-4 flex items-center gap-4 rounded-lg border border-violet-200 bg-violet-50 p-3">
                            <div className="flex items-center gap-2 text-sm">
                              <Gauge className="w-4 h-4 text-violet-600" />
                              <span className="font-semibold text-violet-900">Speed:</span>
                              <span className="text-violet-800">{selectedAlertSpeedDisplay}</span>
                            </div>
                            {selectedAlert?.distance != null && (
                              <div className="flex items-center gap-2 text-sm">
                                <Navigation className="w-4 h-4 text-violet-600" />
                                <span className="font-semibold text-violet-900">Distance:</span>
                                <span className="text-violet-800">{Number(selectedAlert.distance).toFixed(0)}m</span>
                              </div>
                            )}
                            {selectedAlert?.duration_seconds != null && (
                              <div className="flex items-center gap-2 text-sm">
                                <Clock className="w-4 h-4 text-violet-600" />
                                <span className="font-semibold text-violet-900">Duration:</span>
                                <span className="text-violet-800">{Math.round(selectedAlert.duration_seconds)}s</span>
                              </div>
                            )}
                          </div>
                          <p className="text-xs text-slate-500 mb-4">Showing vehicle path and events ±15 minutes around alert time. Speed events are shown as red markers.</p>
                        </>
                      );
                    })()}
                    {selectedAlertCoordinates ? (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 text-sm text-slate-600">
                          <MapPin className="w-4 h-4" />
                          <span>{selectedAlertCoordinates.latitude.toFixed(6)}, {selectedAlertCoordinates.longitude.toFixed(6)}</span>
                        </div>
                        {/* Embedded real-time map with zones + vehicle path */}
                        <RealTimeMapInline
                          deviceId={geotabDeviceId || String(selectedAlert?.device_id || selectedAlert?.deviceId || selectedAlert?.vehicleId || '')}
                          alertLat={selectedAlertCoordinates.latitude}
                          alertLon={selectedAlertCoordinates.longitude}
                          alertTime={selectedAlert?.timestamp || selectedAlert?.alarm_ts || selectedAlert?.displayTimestamp}
                          policeStations={nearestPoliceStations}
                        />
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-xs"
                            onClick={() => window.open(`https://www.google.com/maps?q=${selectedAlertCoordinates.latitude},${selectedAlertCoordinates.longitude}`, "_blank")}
                          >
                            <ExternalLink className="w-3 h-3 mr-1" />
                            Open in Google Maps
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-xs"
                            onClick={() => {
                              navigator.clipboard.writeText(`${selectedAlertCoordinates.latitude}, ${selectedAlertCoordinates.longitude}`);
                            }}
                          >
                            Copy Coordinates
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-12 text-slate-500">
                        <MapPin className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                        <p>No location data available for this alert</p>
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
                  {sidebarGroups.length > 0 ? (
                    sidebarGroups.map(({ entry, count }, idx: number) => (
                        <div
                          key={`sidebar-incident-${entry?.id || idx}`}
                          className="rounded-md border border-slate-200 bg-slate-50 p-2"
                        >
                          <div className="flex items-center justify-between gap-1">
                            <p className="truncate text-xs font-semibold text-slate-900">
                              {entry?.title || "Alert"}
                              {count > 1 ? <span className="ml-1 text-[10px] text-slate-400">(×{count})</span> : null}
                            </p>
                            <Badge variant="outline" className="shrink-0 text-[10px]">
                              {String(entry?.severity || "info").toUpperCase()}
                            </Badge>
                          </div>
                          <p className="mt-0.5 text-[11px] text-slate-600">
                            {entry?.timestamp ? toSAST(entry.timestamp).toLocaleString() : "Unknown time"}
                          </p>
                          <div className="mt-2 flex flex-wrap items-center gap-1.5">
                            {entry?.resolved ? (
                              <div className="flex flex-col gap-0.5">
                                <Badge className="h-5 w-fit border-emerald-200 bg-emerald-50 text-[10px] text-emerald-700">Resolved</Badge>
                                {entry?.resolved_by ? (
                                  <span className="text-[10px] text-slate-400">
                                    by {entry.resolved_by}
                                    {entry?.resolved_at ? ` at ${new Date(entry.resolved_at).toLocaleString()}` : ""}
                                  </span>
                                ) : null}
                              </div>
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
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-6 border-slate-300 bg-white text-[10px] text-slate-700 hover:bg-slate-50"
                                  onClick={() => {
                                    onOpenAlertDetail(entry, null, { silent: true });
                                  }}
                                >
                                  Open
                                </Button>
                              </>
                            )}
                          </div>
                          {count > 1 && (
                            <p className="mt-1 text-[10px] text-slate-400">+ {count - 1} more of this type</p>
                          )}
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

              {/* Nearest Police Stations */}
              {(nearestPoliceStations.length > 0 || policeLoading) && (
                <Card className="border-slate-200 bg-white p-4 shadow-sm">
                  <div className="mb-2">
                    <div className="flex items-center gap-2">
                      <ShieldAlert className="w-4 h-4 text-blue-600" />
                      <h3 className="font-semibold text-slate-900">Nearest Police Station{nearestPoliceStations.length > 1 ? 's' : ''}</h3>
                    </div>
                    <p className="text-xs text-slate-500">Auto-routed to closest</p>
                  </div>
                  {policeLoading && (
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-400 py-2">
                      <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-500"></div>
                      Loading nearby police stations...
                    </div>
                  )}
                  <div className="space-y-1.5">
                    {nearestPoliceStations.map((station, i) => (
                      <div key={`ps-${i}`} className={`flex items-center justify-between text-[11px] rounded px-2 py-1.5 ${i === 0 ? 'bg-green-50 border border-green-200' : 'bg-slate-50 border border-slate-200'}`}>
                        <div className="flex items-center gap-1.5 min-w-0">
                          <MapPin className={`w-3 h-3 flex-shrink-0 ${i === 0 ? 'text-green-600' : 'text-blue-500'}`} />
                          <span className={`font-medium truncate ${i === 0 ? 'text-green-900' : 'text-slate-800'}`}>
                            {station.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {i === 0 && <span className="text-[9px] font-medium text-green-700 bg-green-100 px-1.5 py-0.5 rounded">Route plotted</span>}
                          <span className={`font-semibold ${i === 0 ? 'text-green-700' : 'text-slate-500'}`}>{station.distance_km} km</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {/* Responsible Vehicle */}
              <Card className="border-slate-200 bg-white p-4 shadow-sm">
                <div className="mb-2">
                  <div className="flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-slate-600" />
                    <h3 className="font-semibold text-slate-900">Responsible Vehicle</h3>
                  </div>
                </div>
                <div className="space-y-1.5 text-[11px]">
                  <div className="flex items-start gap-2">
                    <span className="text-slate-500 w-20 shrink-0">Driver:</span>
                    {selectedAlertDriverInfo.name && selectedAlertDriverInfo.name !== "Unknown" ? (
                      <span className="text-slate-800 font-medium">
                        {selectedAlertDriverInfo.name}
                        {selectedAlertDriverInfo.phone ? ` · ${selectedAlertDriverInfo.phone}` : ""}
                      </span>
                    ) : onDriverAssign ? (
                      <div className="flex-1 max-w-[220px]">
                        <DriverDropdown
                          value={selectedDriverId}
                          onChange={(driverId: string) => {
                            setSelectedDriverId(driverId);
                            const driver = drivers.find(d => d.id === driverId);
                            if (driver) {
                              const name = `${driver.first_name} ${driver.surname}`.trim();
                              onDriverAssign(driverId, name, driver.fleet_number || undefined);
                            }
                          }}
                          drivers={drivers as any}
                          placeholder="Select driver"
                          onOpen={() => {}}
                        />
                      </div>
                    ) : (
                      <span className="text-slate-400 italic">Unknown</span>
                    )}
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-slate-500 w-20 shrink-0">Vehicle:</span>
                    <span className="text-slate-800 font-medium">{selectedAlertVehicleDisplay}</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-slate-500 w-20 shrink-0">Cost Center:</span>
                    <span className="text-slate-800 font-medium">
                      {selectedAlertDriverInfo.department || "—"}
                    </span>
                  </div>
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
                <Button variant="outline" onClick={async () => {
                  const u = resolveMediaUrlForCurrentOrigin(videoPreview.url);
                  try {
                    const r = await fetch(u);
                    const b = await r.blob();
                    const a = document.createElement("a");
                    a.href = URL.createObjectURL(b);
                    a.download = `alert-video-${Date.now()}.flv`;
                    a.click();
                    URL.revokeObjectURL(a.href);
                  } catch { window.open(u, "_blank"); }
                }}>
                  <Download className="w-4 h-4 mr-2" />
                  Download
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
