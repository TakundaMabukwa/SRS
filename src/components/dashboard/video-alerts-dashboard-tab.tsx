"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";

import { useVideoWebSocket } from "@/hooks/use-video-websocket";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertTriangle,
  Clock,
  RefreshCw,
  Search,
  Siren,
  Video,
  Camera,
  User,
  ChevronRight,
  ShieldAlert,
  MinusCircle,
  Signal,
  ExternalLink,
  Pin,
  PinOff
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format, differenceInHours } from "date-fns";
import {
  ALERT_READY_WINDOW_OPTIONS,
  clearAlertPlaybackReadyCache,
  formatRawAlertTimestamp,
  getAlertDisplayTimestamp,
  getAlertFirstOccurrenceTimestamp,
  getAlertLastOccurrenceTimestamp,
  resolveAlertPlaybackReadyMap,
} from "@/lib/video-alert-playback";

type VideoAlertsDashboardTabProps = {
  onOpenAlertDetail?: (alert: any, trip?: any) => Promise<any> | any;
  standaloneSeverity?: "critical" | "high" | "medium" | "low" | "all" | null;
  standaloneMode?: boolean;
  suspendBackgroundWork?: boolean;
  selectedCostCenters?: string[];
};

type VehicleIdentity = {
  plate: string;
  fleetNumber: string;
  costCenter: string;
};

type ControlRoomVehicleCard = {
  deviceId: string;
  plate: string;
  fleetNumber: string;
  costCenter: string;
  hasAlert: boolean;
  alert: any | null;
  severity: "critical" | "high" | "medium" | "low";
  updatedAtMs: number;
};

type StructuredAlertDomain = "ADAS" | "DMS";

type AlertNameMapping = {
  title: string;
  domain?: StructuredAlertDomain;
  code?: number;
};

function areVehicleIdentityMapsEqual(
  a: Map<string, VehicleIdentity>,
  b: Map<string, VehicleIdentity>
) {
  if (a.size !== b.size) return false;
  for (const [key, value] of a.entries()) {
    const other = b.get(key);
    if (!other) return false;
    if (
      other.plate !== value.plate ||
      other.fleetNumber !== value.fleetNumber ||
      other.costCenter !== value.costCenter
    ) {
      return false;
    }
  }
  return true;
}

function areAlertListsEquivalent(a: any[], b: any[]) {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    const left = a[i];
    const right = b[i];
    if (
      String(left?.id || "") !== String(right?.id || "") ||
      String(left?.timestamp || left?.created_at || "") !== String(right?.timestamp || right?.created_at || "") ||
      String(left?.title || left?.alert_type || left?.type || "") !== String(right?.title || right?.alert_type || right?.type || "")
    ) {
      return false;
    }
  }
  return true;
}

const SIGNAL_CODE_MAP: Record<string, AlertNameMapping> = {
  platform_video_alarm_0101: { title: "Video Signal Lost", code: 0x0101 },
  platform_video_alarm_0102: { title: "Video Signal Occlusion", code: 0x0102 },
  platform_video_alarm_0103: { title: "Storage Failure", code: 0x0103 },
  platform_video_alarm_0104: { title: "Other Video Equipment Failure", code: 0x0104 },
  platform_video_alarm_0105: { title: "Passenger Overload", code: 0x0105 },
  platform_video_alarm_0106: { title: "Abnormal Driving Behavior", code: 0x0106 },
  platform_video_alarm_0107: { title: "Special Alarm Recording Threshold", code: 0x0107 },
  jtt1078_storage_failure: { title: "Storage Failure", code: 0x0103 },
};

const STRUCTURED_ALERT_TITLE_MAP: Record<StructuredAlertDomain, Record<number, string>> = {
  ADAS: {
    1: "ADAS: Forward Collision Alert",
    2: "ADAS: Lane Departure Alert",
    3: "ADAS: Too Close Distance Alert",
    4: "ADAS: Pedestrian Collision Alert",
    5: "ADAS: Frequent Lane Change Alert",
    6: "ADAS: Road Sign Exceedance Alert",
    7: "ADAS: Obstacle Alert",
    16: "ADAS: Road Sign Recognition Event",
    17: "ADAS: Active Snapshot Event",
  },
  DMS: {
    1: "DMS: Fatigue Driving Alert",
    2: "DMS: Calling Alert",
    3: "DMS: Smoking Alert",
    4: "DMS: Distracted Driving Alert",
    5: "DMS: Driver Abnormality Alert",
    6: "DMS: Steering Wheel Alert",
    7: "DMS: Infrared Blocking",
    8: "DMS: Seat Belt Alert",
    10: "DMS: Device Blocking",
    13: "DMS: Play Phone",
    16: "DMS: Automatic Snapshot Event",
    17: "DMS: Driver Change Event",
  },
};

const OFFICIAL_ALERT_ALIAS_MAP: Record<string, AlertNameMapping> = {
  "adas: forward collision alert": { title: "ADAS: Forward Collision Alert", domain: "ADAS", code: 1 },
  "adas: lane departure alert": { title: "ADAS: Lane Departure Alert", domain: "ADAS", code: 2 },
  "adas: too close distance alert": { title: "ADAS: Too Close Distance Alert", domain: "ADAS", code: 3 },
  "adas: pedestrian collision alert": { title: "ADAS: Pedestrian Collision Alert", domain: "ADAS", code: 4 },
  "adas: frequent lane change alert": { title: "ADAS: Frequent Lane Change Alert", domain: "ADAS", code: 5 },
  "adas: road sign exceedance alert": { title: "ADAS: Road Sign Exceedance Alert", domain: "ADAS", code: 6 },
  "adas: obstruction alarm": { title: "ADAS: Obstacle Alert", domain: "ADAS", code: 7 },
  "adas: road sign identification event": { title: "ADAS: Road Sign Recognition Event", domain: "ADAS", code: 16 },
  "adas: active capture event": { title: "ADAS: Active Snapshot Event", domain: "ADAS", code: 17 },
  "adas: forward collision warning": { title: "ADAS: Forward Collision Alert", domain: "ADAS", code: 1 },
  "adas: lane departure alarm": { title: "ADAS: Lane Departure Alert", domain: "ADAS", code: 2 },
  "adas: following distance too close": { title: "ADAS: Too Close Distance Alert", domain: "ADAS", code: 3 },
  "adas: pedestrian collision alarm": { title: "ADAS: Pedestrian Collision Alert", domain: "ADAS", code: 4 },
  "adas: frequent lane change alarm": { title: "ADAS: Frequent Lane Change Alert", domain: "ADAS", code: 5 },
  "adas: road sign over-limit alarm": { title: "ADAS: Road Sign Exceedance Alert", domain: "ADAS", code: 6 },
  "dms: fatigue driving alert": { title: "DMS: Fatigue Driving Alert", domain: "DMS", code: 1 },
  "dms: fatigue driving alarm": { title: "DMS: Fatigue Driving Alert", domain: "DMS", code: 1 },
  "dms: calling alert": { title: "DMS: Calling Alert", domain: "DMS", code: 2 },
  "dms: handheld phone alarm": { title: "DMS: Calling Alert", domain: "DMS", code: 2 },
  "dms: smoking alert": { title: "DMS: Smoking Alert", domain: "DMS", code: 3 },
  "dms: smoking alarm": { title: "DMS: Smoking Alert", domain: "DMS", code: 3 },
  "dms: distracted driving alert": { title: "DMS: Distracted Driving Alert", domain: "DMS", code: 4 },
  "dms: driver abnormal alarm": { title: "DMS: Driver Abnormality Alert", domain: "DMS", code: 5 },
  "dms: steering wheel alert": { title: "DMS: Steering Wheel Alert", domain: "DMS", code: 6 },
  "dms: infrared blocking": { title: "DMS: Infrared Blocking", domain: "DMS", code: 7 },
  "dms: seat belt alert": { title: "DMS: Seat Belt Alert", domain: "DMS", code: 8 },
  "dms: device blocking": { title: "DMS: Device Blocking", domain: "DMS", code: 10 },
  "dms: play phone": { title: "DMS: Play Phone", domain: "DMS", code: 13 },
  "dms: automatic capture event": { title: "DMS: Automatic Snapshot Event", domain: "DMS", code: 16 },
  "dms: driver change event": { title: "DMS: Driver Change Event", domain: "DMS", code: 17 },
  "storage failure": { title: "Storage Failure", code: 0x0103 },
  "main memory fault": { title: "Main Memory Fault" },
  "video signal lost": { title: "Video Signal Lost", code: 0x0101 },
  "video signal occlusion": { title: "Video Signal Occlusion", code: 0x0102 },
  "other video equipment failure": { title: "Other Video Equipment Failure", code: 0x0104 },
  "passenger overload": { title: "Passenger Overload", code: 0x0105 },
  "special alarm recording threshold": { title: "Special Alarm Recording Threshold", code: 0x0107 },
};

const MIN_READY_VIDEO_BYTES = 500 * 1024;
const MAX_EXACT_READY_CHECKS = 12;

const SILENCED_ALERT_LABELS = [
  "storage failure",
  "storage unit failure",
  "dms: forward camera invisible too long",
  "forward camera invisible too long",
  "other video equipment failure",
  "special alarm recording threshold",
];
const SILENCED_ALERT_SIGNALS = new Set([
  "jtt1078_storage_failure",
  "platform_video_alarm_0103",
  "platform_video_alarm_0104",
  "platform_video_alarm_0107",
  "custom_keyword_storage_failure",
  "dms_10104_forward_invisible_too_long",
]);

const VEHICLE_LOOKUP_STORAGE_KEY = "video_alerts_vehicle_lookup_v1";
const VEHICLE_LOOKUP_STORAGE_TTL_MS = 20 * 60 * 1000;
const ACTIVE_ALERTS_FETCH_MIN_INTERVAL_MS = 4000;

function shouldSilenceAlertValue(value: unknown) {
  const normalized = String(value || "").trim().toLowerCase();
  return !!normalized && SILENCED_ALERT_LABELS.some((matcher) => normalized.includes(matcher));
}

function normalizeCostCenter(value: unknown): string {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function parseVehicleLookupCache(raw: string | null): { savedAt: number; vehicles: any[] } | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    const savedAt = Number(parsed?.savedAt || 0);
    const vehicles = Array.isArray(parsed?.vehicles) ? parsed.vehicles : [];
    if (!Number.isFinite(savedAt) || vehicles.length === 0) return null;
    return { savedAt, vehicles };
  } catch {
    return null;
  }
}

export default function VideoAlertsDashboardTab({
  onOpenAlertDetail,
  standaloneSeverity = null,
  standaloneMode = false,
  suspendBackgroundWork = false,
  selectedCostCenters = [],
}: VideoAlertsDashboardTabProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const videoProxyBase = "/api/video-server";
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("all"); 
  const [showVideoOnly, setShowVideoOnly] = useState(true);
  const [showRawAlerts] = useState(false);
  const [pinnedVehicleIds, setPinnedVehicleIds] = useState<string[]>([]);
  const [levelFilter, setLevelFilter] = useState<"all" | "critical" | "high" | "medium" | "low">(
    standaloneSeverity && standaloneSeverity !== "all" ? standaloneSeverity : "all"
  );
  const [boardLevelFilter, setBoardLevelFilter] = useState<"all" | "critical" | "high" | "medium" | "low">(
    standaloneSeverity ?? "all"
  );
  const [sourceAlerts, setSourceAlerts] = useState<any[]>([]);
  const [realtimeAlerts, setRealtimeAlerts] = useState<any[]>([]);
  const [pinnedHistoryAlerts, setPinnedHistoryAlerts] = useState<any[]>([]);
  const [closedHistoryAlerts, setClosedHistoryAlerts] = useState<any[]>([]);
  const [videoAvailability, setVideoAvailability] = useState<Record<string, boolean>>({});
  const [exactVideoReady, setExactVideoReady] = useState<Record<string, boolean>>({});
  const [vehicleIdentityLookup, setVehicleIdentityLookup] = useState<Map<string, VehicleIdentity>>(new Map());
  const [vehicleIdentityLookupReady, setVehicleIdentityLookupReady] = useState(false);
  const [popoutTargets, setPopoutTargets] = useState<Record<string, HTMLElement | null>>({});
  const popoutTargetsRef = useRef<Record<string, HTMLElement | null>>({});
  const availabilityCacheRef = useRef<Map<string, any[]>>(new Map());
  const pendingAvailabilityKeysRef = useRef<Set<string>>(new Set());
  const exactReadyCacheRef = useRef<Map<string, boolean>>(new Map());
  const closedAlertSuppressUntilRef = useRef<Map<string, number>>(new Map());
  const activeAlertsFetchInFlightRef = useRef(false);
  const lastActiveAlertsFetchAtRef = useRef(0);

  const getAlertIdentityIds = useCallback((alert: any) => {
    const ids = new Set<string>();
    const directId = String(alert?.id || "").trim();
    if (directId) ids.add(directId);
    if (Array.isArray(alert?.groupedIds)) {
      for (const value of alert.groupedIds) {
        const id = String(value || "").trim();
        if (id) ids.add(id);
      }
    }
    return Array.from(ids.values());
  }, []);

  const purgeExpiredSuppressedAlerts = useCallback((now: number = Date.now()) => {
    const suppressMap = closedAlertSuppressUntilRef.current;
    for (const [id, expiresAt] of suppressMap.entries()) {
      if (!Number.isFinite(expiresAt) || expiresAt <= now) {
        suppressMap.delete(id);
      }
    }
  }, []);

  const isSuppressedAlert = useCallback((alert: any) => {
    const now = Date.now();
    purgeExpiredSuppressedAlerts(now);
    const suppressMap = closedAlertSuppressUntilRef.current;
    const ids = getAlertIdentityIds(alert);
    return ids.some((id) => {
      const expiresAt = suppressMap.get(id);
      return Number.isFinite(expiresAt) && Number(expiresAt) > now;
    });
  }, [getAlertIdentityIds, purgeExpiredSuppressedAlerts]);

  const registerSuppressedAlertIds = useCallback((detail: any, ttlMs: number = 5 * 60 * 1000) => {
    const now = Date.now();
    purgeExpiredSuppressedAlerts(now);
    const ids = getAlertIdentityIds(detail);
    if (ids.length === 0) return;
    const expiresAt = now + Math.max(60_000, ttlMs);
    const suppressMap = closedAlertSuppressUntilRef.current;
    for (const id of ids) {
      suppressMap.set(id, expiresAt);
    }
  }, [getAlertIdentityIds, purgeExpiredSuppressedAlerts]);

  const removeClosedAlertFromBoard = useCallback((detail: any) => {
    registerSuppressedAlertIds(detail);
    const idsToRemove = new Set(
      [detail?.id, ...(Array.isArray(detail?.groupedIds) ? detail.groupedIds : [])]
        .map((value) => String(value || "").trim())
        .filter(Boolean)
    );
    const groupDeviceId = String(detail?.deviceId || "").trim();
    const groupAlertType = String(detail?.alertType || "").trim();

    const filterClosed = (alerts: any[]) =>
      alerts.filter((alert) => {
        const alertId = String(alert?.id || "").trim();
        if (alertId && idsToRemove.has(alertId)) return false;
        const groupedIds = Array.isArray(alert?.groupedIds) ? alert.groupedIds.map((value: any) => String(value || "").trim()) : [];
        if (groupedIds.some((value: string) => idsToRemove.has(value))) return false;
        if (groupDeviceId && groupAlertType) {
          const ad = String(alert?.device_id || alert?.vehicleId || "").trim();
          const at = String(alert?.alert_type || alert?.type || "").trim();
          if (ad === groupDeviceId && at === groupAlertType) return false;
        }
        return true;
      });

    setSourceAlerts((prev) => filterClosed(prev));
    setRealtimeAlerts((prev) => filterClosed(prev));
    setPinnedHistoryAlerts((prev) => filterClosed(prev));
  }, [registerSuppressedAlertIds]);

  const getStructuredAlertMapping = useCallback((value: string) => {
    const text = String(value || "").trim();
    if (!text) return null;

    const signalMapped = SIGNAL_CODE_MAP[text];
    if (signalMapped) {
      return {
        title: signalMapped.title,
        domain: signalMapped.domain || null,
        code: signalMapped.code ?? null,
        level: null,
      };
    }

    const structuredMatch = text.match(/^(ADAS|DMS)\s+Alert\s+Type\s+(\d+)(?:\s*\(Level\s*(\d+)\))?$/i);
    if (structuredMatch) {
      const domain = structuredMatch[1].toUpperCase() as StructuredAlertDomain;
      const code = Number(structuredMatch[2]);
      const level = structuredMatch[3] ? Number(structuredMatch[3]) : null;
      return {
        title: STRUCTURED_ALERT_TITLE_MAP[domain]?.[code] || `${domain} Alert Type ${code}`,
        domain,
        code,
        level,
      };
    }

    const alias = OFFICIAL_ALERT_ALIAS_MAP[text.toLowerCase()];
    if (alias) {
      return {
        title: alias.title,
        domain: alias.domain || null,
        code: alias.code ?? null,
        level: null,
      };
    }

    return null;
  }, []);

  const getAlertPresentation = useCallback((incoming: any) => {
    const metadata = incoming?.metadata || {};
    const candidateValues = [
      incoming?.title,
      incoming?.alert_type,
      incoming?.type,
      metadata?.primaryAlertType,
      ...(Array.isArray(metadata?.alertSignalDetails) ? metadata.alertSignalDetails.map((detail: any) => detail?.label) : []),
      ...(Array.isArray(metadata?.alertSignals) ? metadata.alertSignals : []),
      ...(Array.isArray(metadata?.alertSignalDetails) ? metadata.alertSignalDetails.map((detail: any) => detail?.code) : []),
    ]
      .map((value) => String(value || "").trim())
      .filter(Boolean);

    const candidateSignals = [
      ...(Array.isArray(metadata?.alertSignals) ? metadata.alertSignals : []),
      ...(Array.isArray(metadata?.rawAlertSignals) ? metadata.rawAlertSignals : []),
      ...(Array.isArray(metadata?.activeSignalsSnapshot) ? metadata.activeSignalsSnapshot : []),
    ]
      .map((value) => String(value || "").trim().toLowerCase())
      .filter(Boolean);

    const silenced =
      candidateValues.some((value) => shouldSilenceAlertValue(value)) ||
      candidateSignals.some((signal) => SILENCED_ALERT_SIGNALS.has(signal));

    for (const value of candidateValues) {
      const structured = getStructuredAlertMapping(value);
      if (!structured) continue;
      const codeLabel = structured.domain && structured.code
        ? `${structured.domain} code ${structured.code}${structured.level !== null ? ` • Level ${structured.level}` : ""}`
        : structured.code
          ? `Code ${structured.code}`
        : "";
      return {
        title: structured.title,
        typeLabel: structured.title,
        codeLabel,
        silent: silenced,
      };
    }

    const fallback = candidateValues[0] || "Alert";
    return {
      title: fallback,
      typeLabel: fallback,
      codeLabel: "",
      silent: silenced,
    };
  }, [getStructuredAlertMapping]);

  const getAlertVehicleIdentifiers = useCallback((incoming: any) => {
    const vehicleMeta = incoming?.metadata?.vehicle || incoming?.vehicle || {};
    return Array.from(
      new Set(
        [
          incoming?.vehicleId,
          incoming?.device_id,
          incoming?.vehicle_id,
          vehicleMeta?.vehicleId,
          vehicleMeta?.terminalId,
        ]
          .map((value) => String(value || "").trim())
          .filter(Boolean)
      )
    );
  }, []);

  const resolveVehicleIdentity = useCallback((incoming: any) => {
    const identifiers = getAlertVehicleIdentifiers(incoming);
    for (const identifier of identifiers) {
      const details = vehicleIdentityLookup.get(identifier);
      if (details) {
        return {
          vehicleId: identifier,
          details,
        };
      }
    }

    return {
      vehicleId: identifiers[0] || "",
      details: null,
    };
  }, [getAlertVehicleIdentifiers, vehicleIdentityLookup]);

  const normalizeAlert = useCallback((incoming: any) => {
    if (!incoming || typeof incoming !== "object") return null;

    const vehicleMeta = incoming?.metadata?.vehicle || incoming?.vehicle || {};
    const presentation = getAlertPresentation(incoming);
    if (presentation.silent) return null;
    const sourceTimestamp = incoming.timestamp || incoming.created_at || incoming.alert_timestamp || new Date().toISOString();
    const firstOccurrenceTimestamp = getAlertFirstOccurrenceTimestamp(incoming) || sourceTimestamp;
    const lastOccurrenceTimestamp = getAlertLastOccurrenceTimestamp(incoming) || firstOccurrenceTimestamp;
    const displayTimestamp = getAlertDisplayTimestamp(incoming) || lastOccurrenceTimestamp || firstOccurrenceTimestamp;
    const id = String(incoming.id || incoming.alert_id || incoming.alertId || "").trim();
    const title = String(presentation.title || incoming.title || incoming.type || incoming.alert_type || "Alert").trim();
    const severity = String(incoming.severity || incoming.priority || "low").toLowerCase();
    const resolvedIdentity = resolveVehicleIdentity(incoming);
    const registration = String(resolvedIdentity.details?.plate || "").trim();
    const fleetNumber = String(resolvedIdentity.details?.fleetNumber || "").trim();
    const fallbackVehicleId = String(resolvedIdentity.vehicleId || "").trim();
    const costCenter = String(
      resolvedIdentity.details?.costCenter ||
      incoming?.cost_center ||
      incoming?.costCenter ||
      incoming?.metadata?.cost_center ||
      incoming?.metadata?.costCenter ||
      ""
    ).trim();

    return {
      ...incoming,
      id: id || `${fallbackVehicleId}-${title}-${displayTimestamp || Date.now()}`,
      title,
      alert_type: presentation.typeLabel || incoming.alert_type || incoming.type || title.toLowerCase().replace(/\s+/g, "_"),
      type: presentation.typeLabel || incoming.type || incoming.alert_type || title,
      severity,
      priority: severity,
      status: String(incoming.status || "new").toLowerCase(),
      fleet_number: fleetNumber,
      vehicle_registration: registration,
      codeLabel: presentation.codeLabel,
      vehicleId: String(incoming.vehicleId || incoming.device_id || incoming.vehicle_id || vehicleMeta.vehicleId || fallbackVehicleId || "").trim(),
      device_id: String(incoming.device_id || incoming.vehicleId || incoming.vehicle_id || vehicleMeta.vehicleId || fallbackVehicleId || "").trim(),
      cost_center: costCenter,
      costCenter,
      driver_name: incoming.driver_name || incoming.driver || incoming?.metadata?.driverName || "Unknown",
      timestamp: displayTimestamp || sourceTimestamp,
      lastOccurrenceTimestamp,
      firstOccurrenceTimestamp,
      displayTimestamp,
      playbackTimestamp: displayTimestamp || lastOccurrenceTimestamp || firstOccurrenceTimestamp,
      repeated_count: Number(incoming.repeated_count || incoming.repeatedCount || incoming.count || 1) || 1,
      count: Number(incoming.count || incoming.repeated_count || incoming.repeatedCount || 1) || 1,
    };
  }, [getAlertPresentation, resolveVehicleIdentity]);

  const hasInlineVideoEvidence = useCallback((alert: any) => {
    if (!alert || typeof alert !== "object") return false;
    const hasUrl = (value: unknown) => String(value || "").trim().length > 0;

    if (
      hasUrl(alert?.videoUrl) ||
      hasUrl(alert?.video_url) ||
      hasUrl(alert?.fileUrl) ||
      hasUrl(alert?.file_url) ||
      hasUrl(alert?.storage_url) ||
      hasUrl(alert?.url) ||
      hasUrl(alert?.videos?.pre_event) ||
      hasUrl(alert?.videos?.post_event) ||
      hasUrl(alert?.videos?.camera_sd)
    ) {
      return true;
    }

    const clips = alert?.metadata?.videoClips || {};
    const clipKeys = [
      "cameraVideo",
      "cameraUrl",
      "cameraStorageUrl",
      "cameraPreVideo",
      "cameraPostVideo",
      "preStorageUrl",
      "preUrl",
      "postStorageUrl",
      "postUrl",
    ];
    if (clipKeys.some((key) => hasUrl(clips?.[key]))) return true;

    const candidateLists = [
      alert?.media?.videos,
      alert?.videoCaptures,
      alert?.videoCapturesAllChannels,
      alert?.captures,
      alert?.alertCaptures,
      alert?.videos,
      alert?.metadata?.captures,
      alert?.metadata?.videos,
    ];

    for (const list of candidateLists) {
      if (!Array.isArray(list)) continue;
      for (const row of list) {
        if (
          hasUrl((row as any)?.fileUrl) ||
          hasUrl((row as any)?.file_url) ||
          hasUrl((row as any)?.storage_url) ||
          hasUrl((row as any)?.videoUrl) ||
          hasUrl((row as any)?.video_url) ||
          hasUrl((row as any)?.url)
        ) {
          return true;
        }
      }
    }

    return !!(alert?.has_video || alert?.hasVideo || alert?.videoReady);
  }, []);

  const getAlertVehicleDisplayLabel = useCallback((alert: any) => {
    const registration = String(
      alert?.vehicle_registration ||
      alert?.vehicle_reg ||
      alert?.registration ||
      alert?.reg ||
      ""
    ).trim();
    const fleetNumber = String(
      alert?.fleet_number ||
      alert?.fleetNumber ||
      ""
    ).trim();

    if (fleetNumber && registration && fleetNumber.toLowerCase() !== registration.toLowerCase()) {
      return `${fleetNumber} - ${registration}`;
    }
    return fleetNumber || registration || "";
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem("dashboard:pinnedVehicleIds");
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        setPinnedVehicleIds(parsed.map((value) => String(value || "").trim()).filter(Boolean));
      }
    } catch {
      // ignore malformed local storage
    }
  }, []);

  const persistPinnedVehicleIds = useCallback((next: string[]) => {
    setPinnedVehicleIds(next);
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem("dashboard:pinnedVehicleIds", JSON.stringify(next));
    } catch {
      // ignore storage write failures
    }
  }, []);

  const togglePinnedVehicle = useCallback((vehicleId: string) => {
    const normalized = String(vehicleId || "").trim();
    if (!normalized) return;
    const next = pinnedVehicleIds.includes(normalized)
      ? pinnedVehicleIds.filter((value) => value !== normalized)
      : [normalized, ...pinnedVehicleIds];
    persistPinnedVehicleIds(Array.from(new Set(next)));
  }, [persistPinnedVehicleIds, pinnedVehicleIds]);

  const isPinnedVehicle = useCallback((alert: any) => {
    const vehicleId = String(alert?.vehicleId || alert?.device_id || alert?.metadata?.vehicle?.vehicleId || "").trim();
    return !!vehicleId && pinnedVehicleIds.includes(vehicleId);
  }, [pinnedVehicleIds]);

  const readJsonSafely = useCallback(async (res: Response) => {
    const contentType = res.headers.get("content-type") || "";
    const text = await res.text();
    if (!contentType.toLowerCase().includes("application/json")) {
      throw new Error(`Expected JSON but received ${contentType || "unknown content type"}`);
    }
    try {
      return JSON.parse(text);
    } catch {
      throw new Error("Invalid JSON response");
    }
  }, []);

  const getGroupedAlertTimestamp = useCallback((alert: any) => {
    return (
      alert?.lastOccurrenceTimestamp ||
      alert?.last_occurrence ||
      alert?.last_occurrence_timestamp ||
      alert?.latestTimestamp ||
      getAlertLastOccurrenceTimestamp(alert) ||
      getAlertDisplayTimestamp(alert) ||
      alert?.timestamp ||
      null
    );
  }, []);

  const dedupeByIdAndSort = useCallback((items: any[]) => {
    const byId = new Map<string, any>();
    for (const item of items) {
      const normalized = normalizeAlert(item);
      if (!normalized) continue;
      byId.set(String(normalized.id), { ...(byId.get(String(normalized.id)) || {}), ...normalized });
    }
    return Array.from(byId.values()).sort(
      (a: any, b: any) => new Date(getAlertDisplayTimestamp(b) || b.timestamp || 0).getTime() - new Date(getAlertDisplayTimestamp(a) || a.timestamp || 0).getTime()
    );
  }, [normalizeAlert]);

  const latestAlertPerVehicle = useCallback((alerts: any[]) => {
    const byVehicle = new Map<string, { alert: any; ts: number }>();
    const fallbackAlerts = new Map<string, any>();

    alerts.forEach((alert: any, index: number) => {
      const vehicleKey = String(
        alert?.vehicleId ||
        alert?.device_id ||
        alert?.vehicle_id ||
        alert?.metadata?.vehicle?.vehicleId ||
        ""
      ).trim();
      const timestampMs = new Date(getGroupedAlertTimestamp(alert) || alert?.timestamp || alert?.created_at || 0).getTime();

      if (!vehicleKey) {
        const fallbackKey = String(alert?.id || alert?.alert_id || `unknown-${index}`);
        fallbackAlerts.set(fallbackKey, alert);
        return;
      }

      const existing = byVehicle.get(vehicleKey);
      if (!existing || timestampMs > existing.ts) {
        byVehicle.set(vehicleKey, { alert, ts: timestampMs });
      }
    });

    return [
      ...Array.from(byVehicle.values()).map((entry) => entry.alert),
      ...Array.from(fallbackAlerts.values()),
    ].sort(
      (a: any, b: any) =>
        new Date(getGroupedAlertTimestamp(b) || b?.timestamp || 0).getTime() -
        new Date(getGroupedAlertTimestamp(a) || a?.timestamp || 0).getTime()
    );
  }, [getGroupedAlertTimestamp]);

  const getAvailabilityDate = useCallback((alert: any) => {
    const displayTimestamp = getAlertDisplayTimestamp(alert);
    if (!displayTimestamp) return "";
    const date = new Date(displayTimestamp);
    if (Number.isNaN(date.getTime())) return "";
    return date.toISOString().slice(0, 10);
  }, []);

  const getAlertChannelCandidates = useCallback((alert: any) => {
    const candidates = [
      alert?.channel,
      alert?.metadata?.channel,
      alert?.metadata?.resourceChannel,
      alert?.metadata?.locationFix?.channel,
    ];

    let primaryChannel = 1;
    for (const candidate of candidates) {
      const value = Number(candidate);
      if (Number.isFinite(value) && value > 0) {
        primaryChannel = value;
        break;
      }
    }

    return Array.from(new Set([primaryChannel, 1, 2].filter((value) => Number.isFinite(value) && value > 0)));
  }, []);

  const alertHasVideoInChannels = useCallback((alert: any, channels: any[]) => {
    const timestamp = new Date(getAlertDisplayTimestamp(alert) || "");
    if (Number.isNaN(timestamp.getTime())) return false;

    const wantedChannels = getAlertChannelCandidates(alert);

    return wantedChannels.some((wantedChannel) => {
      const matchingChannel = channels.find((entry: any) => Number(entry?.channel || 1) === wantedChannel);
      const clips = Array.isArray(matchingChannel?.clips) ? matchingChannel.clips : [];

      return clips.some((clip: any) => {
        const clipStart = new Date(clip?.startTime || 0);
        const clipEnd = new Date(clip?.endTime || clip?.startTime || 0);
        if (Number.isNaN(clipStart.getTime()) || Number.isNaN(clipEnd.getTime())) return false;
        return clipStart.getTime() <= timestamp.getTime() && clipEnd.getTime() >= timestamp.getTime();
      });
    });
  }, [getAlertChannelCandidates]);

  const refreshVideoAvailability = useCallback(async (alerts: any[]) => {
    const normalizedAlerts = alerts
      .map((alert) => normalizeAlert(alert))
      .filter((alert): alert is any => Boolean(alert?.id));

    const nextMap: Record<string, boolean> = {};
    const requests: Array<Promise<void>> = [];

    for (const alert of normalizedAlerts) {
      const vehicleId = String(alert?.vehicleId || alert?.device_id || alert?.metadata?.vehicle?.vehicleId || "").trim();
      const date = getAvailabilityDate(alert);
      if (!vehicleId || !date) {
        nextMap[String(alert.id)] = false;
        continue;
      }

      const cacheKey = `${vehicleId}:${date}`;
      const cachedChannels = availabilityCacheRef.current.get(cacheKey);
      if (cachedChannels) {
        nextMap[String(alert.id)] = alertHasVideoInChannels(alert, cachedChannels);
        continue;
      }

      if (!pendingAvailabilityKeysRef.current.has(cacheKey)) {
        pendingAvailabilityKeysRef.current.add(cacheKey);
        requests.push(
          fetch(`${videoProxyBase}/vehicles/${encodeURIComponent(vehicleId)}/video/availability`, {
            cache: "no-store",
          })
            .then((res) => readJsonSafely(res))
            .then((json) => {
              const rows = Array.isArray(json?.rows)
                ? json.rows
                : Array.isArray(json?.data?.rows)
                  ? json.data.rows
                  : Array.isArray(json?.data)
                    ? json.data
                    : [];

              const dayStart = new Date(`${date}T00:00:00.000Z`);
              const dayEnd = new Date(`${date}T23:59:59.999Z`);
              const dayStartMs = dayStart.getTime();
              const dayEndMs = dayEnd.getTime();

              const channels = rows
                .map((row: any) => {
                  const channel = Number(row?.channel || 0);
                  if (!Number.isFinite(channel) || channel <= 0) return null;

                  const startRaw = String(
                    row?.approx_first_packet_time || row?.first_packet_time || ""
                  ).trim();
                  const endRaw = String(
                    row?.approx_last_packet_time || row?.last_packet_time || ""
                  ).trim();

                  const startMs = new Date(startRaw || 0).getTime();
                  const endMs = new Date(endRaw || 0).getTime();
                  if (
                    Number.isFinite(startMs) &&
                    Number.isFinite(endMs) &&
                    (endMs < dayStartMs || startMs > dayEndMs)
                  ) {
                    return null;
                  }

                  return {
                    channel,
                    clips:
                      startRaw && endRaw
                        ? [
                            {
                              startTime: startRaw,
                              endTime: endRaw,
                            },
                          ]
                        : [],
                  };
                })
                .filter(Boolean);

              availabilityCacheRef.current.set(cacheKey, channels);
            })
            .catch(() => {
              availabilityCacheRef.current.set(cacheKey, []);
            })
            .finally(() => {
              pendingAvailabilityKeysRef.current.delete(cacheKey);
            })
        );
      }
    }

    if (Object.keys(nextMap).length > 0) {
      setVideoAvailability((prev) => ({ ...prev, ...nextMap }));
    }

    if (requests.length === 0) return;

    await Promise.all(requests);

    const resolvedMap: Record<string, boolean> = {};
    for (const alert of normalizedAlerts) {
      const vehicleId = String(alert?.vehicleId || alert?.device_id || alert?.metadata?.vehicle?.vehicleId || "").trim();
      const date = getAvailabilityDate(alert);
      const cacheKey = `${vehicleId}:${date}`;
      const channels = availabilityCacheRef.current.get(cacheKey) || [];
      resolvedMap[String(alert.id)] = vehicleId && date ? alertHasVideoInChannels(alert, channels) : false;
    }

    setVideoAvailability((prev) => ({ ...prev, ...resolvedMap }));
  }, [alertHasVideoInChannels, getAvailabilityDate, normalizeAlert, readJsonSafely, videoProxyBase]);

  const refreshExactVideoReady = useCallback(async (alerts: any[]) => {
    const normalizedAlerts = alerts
      .map((alert) => normalizeAlert(alert))
      .filter((alert): alert is any => Boolean(alert?.id))
      .sort((a: any, b: any) => {
        const aPinned = isPinnedVehicle(a) ? 1 : 0;
        const bPinned = isPinnedVehicle(b) ? 1 : 0;
        if (aPinned !== bPinned) return bPinned - aPinned;

        const aRange = videoAvailability[String(a.id)] ? 1 : 0;
        const bRange = videoAvailability[String(b.id)] ? 1 : 0;
        if (aRange !== bRange) return bRange - aRange;

        const aTs = new Date(getGroupedAlertTimestamp(a) || a.timestamp || 0).getTime();
        const bTs = new Date(getGroupedAlertTimestamp(b) || b.timestamp || 0).getTime();
        return bTs - aTs;
      });

    const immediateMap: Record<string, boolean> = {};
    const alertsToCheck: any[] = [];

    for (const alert of normalizedAlerts) {
      const alertId = String(alert.id || "").trim();
      if (!alertId) continue;

      const status = String(alert?.status || "").trim().toLowerCase();
      if (status === "closed" || status === "resolved") {
        exactReadyCacheRef.current.set(alertId, true);
        immediateMap[alertId] = true;
        continue;
      }

      if (!videoAvailability[alertId]) {
        immediateMap[alertId] = false;
        continue;
      }

      if (exactReadyCacheRef.current.get(alertId) === true) {
        immediateMap[alertId] = true;
        continue;
      }

      alertsToCheck.push(alert);
    }

    if (Object.keys(immediateMap).length > 0) {
      setExactVideoReady((prev) => ({ ...prev, ...immediateMap }));
    }

    if (alertsToCheck.length === 0) return;

    const readyMap = await resolveAlertPlaybackReadyMap(
      alertsToCheck,
      videoProxyBase,
      ALERT_READY_WINDOW_OPTIONS,
      {
        falseTtlMs: 30000,
        maxConcurrency: 3,
      }
    );

    for (const [alertId, ready] of Object.entries(readyMap)) {
      if (ready) {
        exactReadyCacheRef.current.set(alertId, true);
      } else {
        exactReadyCacheRef.current.delete(alertId);
      }
    }

    if (Object.keys(readyMap).length > 0) {
      setExactVideoReady((prev) => ({ ...prev, ...readyMap }));
    }
  }, [getGroupedAlertTimestamp, isPinnedVehicle, normalizeAlert, videoAvailability, videoProxyBase]);

  const fetchTripRoutingStyleAlerts = useCallback(async (force: boolean = false) => {
    if (suspendBackgroundWork || !vehicleIdentityLookupReady) return;
    const now = Date.now();
    if (!force && now - lastActiveAlertsFetchAtRef.current < ACTIVE_ALERTS_FETCH_MIN_INTERVAL_MS) {
      return;
    }
    if (activeAlertsFetchInFlightRef.current) {
      return;
    }
    activeAlertsFetchInFlightRef.current = true;
    lastActiveAlertsFetchAtRef.current = now;
    try {
      const activeLimit = 1500;
      const res = await fetch(`${videoProxyBase}/eps/alerts/active?limit=${activeLimit}`, { cache: "no-store" });
      if (!res.ok) return;

      const json = await readJsonSafely(res);
      const activeList = Array.isArray(json?.alerts)
        ? json.alerts
        : Array.isArray(json?.data?.alerts)
          ? json.data.alerts
          : Array.isArray(json?.data)
            ? json.data
            : [];

      const deduped = dedupeByIdAndSort(activeList).filter((alert: any) => !isSuppressedAlert(alert));
      setSourceAlerts(latestAlertPerVehicle(deduped));
    } catch (error) {
      console.error("Failed to fetch video alerts board data:", error);
    } finally {
      activeAlertsFetchInFlightRef.current = false;
    }
  }, [dedupeByIdAndSort, isSuppressedAlert, latestAlertPerVehicle, readJsonSafely, suspendBackgroundWork, vehicleIdentityLookupReady, videoProxyBase]);

  const fetchPinnedVehicleHistoryAlerts = useCallback(async () => {
    const vehicleIds = pinnedVehicleIds.filter(Boolean);
    if (vehicleIds.length === 0) {
      setPinnedHistoryAlerts((prev) => (prev.length === 0 ? prev : []));
      return;
    }

    try {
      const results = await Promise.all(
        vehicleIds.map(async (vehicleId) => {
          const res = await fetch(
            `${videoProxyBase}/alerts/history?device_id=${encodeURIComponent(vehicleId)}&days=30&limit=20`,
            { cache: "no-store" }
          );
          const json = await readJsonSafely(res);
          return Array.isArray(json?.data) ? json.data : [];
        })
      );

      const deduped = new Map<string, any>();
      for (const alert of results.flat()) {
        const enriched = {
          ...alert,
          vehicleId: alert?.vehicleId || alert?.device_id,
          device_id: alert?.device_id || alert?.vehicleId,
          title: alert?.title || alert?.alert_type || alert?.type,
        };
        const key = String(
          enriched?.id ||
          enriched?.alert_id ||
          enriched?.alertId ||
          `${enriched?.device_id || enriched?.vehicleId || "unknown"}-${enriched?.title || "alert"}-${enriched?.timestamp || enriched?.created_at || ""}`
        );
        deduped.set(key, { ...(deduped.get(key) || {}), ...enriched });
      }

      const merged = Array.from(deduped.values()).sort(
        (a: any, b: any) =>
          new Date(getAlertDisplayTimestamp(b) || b?.timestamp || b?.created_at || 0).getTime() -
          new Date(getAlertDisplayTimestamp(a) || a?.timestamp || a?.created_at || 0).getTime()
      );

      const visiblePinnedHistory = merged.filter((alert: any) => !isSuppressedAlert(alert));
      setPinnedHistoryAlerts((prev) => (areAlertListsEquivalent(prev, visiblePinnedHistory) ? prev : visiblePinnedHistory));
    } catch (error) {
      console.error("Failed to fetch pinned vehicle alert history:", error);
      setPinnedHistoryAlerts((prev) => (prev.length === 0 ? prev : []));
    }
  }, [isSuppressedAlert, pinnedVehicleIds, readJsonSafely, videoProxyBase]);

  const fetchClosedHistoryAlerts = useCallback(async () => {
    if (suspendBackgroundWork) return;

    const normalizeHistoryList = (items: any[]) =>
      items.map((alert: any) => ({
        ...alert,
        vehicleId: alert?.vehicleId || alert?.device_id,
        device_id: alert?.device_id || alert?.vehicleId,
        title: alert?.title || alert?.alert_type || alert?.type,
      }));

    const readAlertArray = (json: any) =>
      Array.isArray(json?.alerts)
        ? json.alerts
        : Array.isArray(json?.data?.alerts)
          ? json.data.alerts
          : Array.isArray(json?.data)
            ? json.data
            : [];

    try {
      const [closedRes, resolvedRes] = await Promise.all([
        fetch(`${videoProxyBase}/alerts?status=closed&limit=200`, { cache: "no-store" }),
        fetch(`${videoProxyBase}/alerts?status=resolved&limit=200`, { cache: "no-store" }),
      ]);

      const closedJson = closedRes.ok ? await readJsonSafely(closedRes) : null;
      const resolvedJson = resolvedRes.ok ? await readJsonSafely(resolvedRes) : null;
      const merged = dedupeByIdAndSort([
        ...normalizeHistoryList(readAlertArray(closedJson)),
        ...normalizeHistoryList(readAlertArray(resolvedJson)),
      ]);

      if (merged.length > 0) {
        setClosedHistoryAlerts((prev) => (areAlertListsEquivalent(prev, merged) ? prev : merged));
        return;
      }

      const historyRes = await fetch(`${videoProxyBase}/alerts/history?days=30&limit=200`, { cache: "no-store" });
      if (!historyRes.ok) {
        setClosedHistoryAlerts((prev) => (prev.length === 0 ? prev : []));
        return;
      }

      const historyJson = await readJsonSafely(historyRes);
      const historyAlerts = normalizeHistoryList(readAlertArray(historyJson)).filter((alert: any) =>
        ["closed", "resolved"].includes(String(alert?.status || "").toLowerCase())
      );
      const dedupedHistory = dedupeByIdAndSort(historyAlerts);
      setClosedHistoryAlerts((prev) => (areAlertListsEquivalent(prev, dedupedHistory) ? prev : dedupedHistory));
    } catch (error) {
      console.error("Failed to fetch closed alert history:", error);
      setClosedHistoryAlerts((prev) => (prev.length === 0 ? prev : []));
    }
  }, [dedupeByIdAndSort, readJsonSafely, suspendBackgroundWork, videoProxyBase]);

  const handleClosedAlertEvent = useCallback((detail: any) => {
    removeClosedAlertFromBoard(detail);

    // Add a synthetic closed alert entry so it reflects immediately in history/count
    if (detail?.id) {
      setClosedHistoryAlerts((prev) => {
        if (prev.some((a: any) => String(a.id) === String(detail.id))) return prev;
        const title = String(detail?.alertTitle || detail?.alertType || "Alert").trim();
        return [{
          id: String(detail.id),
          device_id: String(detail?.deviceId || "").trim(),
          vehicleId: String(detail?.deviceId || "").trim(),
          alert_type: String(detail?.alertType || "").trim(),
          type: String(detail?.alertType || "").trim(),
          title,
          status: "resolved",
          resolved: true,
          resolved_by: String(detail?.resolvedBy || "").trim() || null,
          resolved_at: new Date().toISOString(),
          timestamp: new Date().toISOString(),
          count: 1,
        }, ...prev];
      });
    }
  }, [removeClosedAlertFromBoard]);

  useEffect(() => {
    if (!vehicleIdentityLookupReady) return;
    fetchTripRoutingStyleAlerts();
  }, [fetchTripRoutingStyleAlerts, vehicleIdentityLookupReady]);

  useEffect(() => {
    void fetchPinnedVehicleHistoryAlerts();
  }, [fetchPinnedVehicleHistoryAlerts]);

  useEffect(() => {
    if (activeTab !== "history") return;
    void fetchClosedHistoryAlerts();
  }, [activeTab, fetchClosedHistoryAlerts]);

  useEffect(() => {
    let cancelled = false;

    const toLookupMap = (rows: any[]) => {
      const nextLookup = new Map<string, VehicleIdentity>();
      for (const row of rows) {
        const deviceId = String(row?.deviceId || "").trim();
        if (!deviceId) continue;
        nextLookup.set(deviceId, {
          plate: String(row?.plate || "").trim(),
          fleetNumber: String(row?.fleetNumber || "").trim(),
          costCenter: String(row?.costCenter || "").trim(),
        });
      }
      return nextLookup;
    };

    const hydrateFromStorage = () => {
      if (typeof window === "undefined") return null;
      const cache = parseVehicleLookupCache(window.localStorage.getItem(VEHICLE_LOOKUP_STORAGE_KEY));
      if (!cache) return null;
      return cache;
    };

    const persistStorageCache = (rows: any[]) => {
      if (typeof window === "undefined") return;
      try {
        window.localStorage.setItem(
          VEHICLE_LOOKUP_STORAGE_KEY,
          JSON.stringify({
            savedAt: Date.now(),
            vehicles: rows,
          })
        );
      } catch {
        // Ignore storage quota/storage access failures.
      }
    };

    const preloadVehicleLookup = async () => {
      try {
        const res = await fetch("/api/vehicle-lookup?all=1", {
          cache: "no-store",
          signal: AbortSignal.timeout(30000),
        });
        const json = await readJsonSafely(res);
        const rows = Array.isArray(json?.vehicles) ? json.vehicles : [];
        const nextLookup = toLookupMap(rows);

        if (!cancelled) {
          setVehicleIdentityLookup((prev) => (
            areVehicleIdentityMapsEqual(prev, nextLookup) ? prev : nextLookup
          ));
          if (rows.length > 0) {
            persistStorageCache(rows);
          }
        }
      } catch (error) {
        console.warn("Vehicle lookup preload failed:", error);
      } finally {
        if (!cancelled) {
          setVehicleIdentityLookupReady(true);
        }
      }
    };

    const cached = hydrateFromStorage();
    const now = Date.now();
    const hasFreshCache = !!cached && now - cached.savedAt <= VEHICLE_LOOKUP_STORAGE_TTL_MS;
    const hasAnyCache = !!cached && Array.isArray(cached.vehicles) && cached.vehicles.length > 0;

    if (hasAnyCache && cached) {
      const cachedLookup = toLookupMap(cached.vehicles);
      setVehicleIdentityLookup((prev) => (
        areVehicleIdentityMapsEqual(prev, cachedLookup) ? prev : cachedLookup
      ));
      setVehicleIdentityLookupReady(true);
    }

    if (hasFreshCache) {
      return () => {
        cancelled = true;
      };
    }

    void preloadVehicleLookup();

    return () => {
      cancelled = true;
    };
  }, [readJsonSafely]);

  useEffect(() => {
    if (suspendBackgroundWork) return;
    const interval = setInterval(() => {
      fetchTripRoutingStyleAlerts();
      if (activeTab === "history") {
        void fetchClosedHistoryAlerts();
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [activeTab, fetchClosedHistoryAlerts, fetchTripRoutingStyleAlerts, suspendBackgroundWork]);

  useEffect(() => {
    const handleClosed = (event: Event) => {
      const customEvent = event as CustomEvent<any>;
      handleClosedAlertEvent(customEvent?.detail);
    };

    window.addEventListener("video-alert-closed", handleClosed as EventListener);
    return () => {
      window.removeEventListener("video-alert-closed", handleClosed as EventListener);
    };
  }, [handleClosedAlertEvent]);

  const normalizeRealtimeAlert = useCallback((incoming: any) => normalizeAlert(incoming), [normalizeAlert]);

  const handleRealtimeMessage = useCallback((data: any) => {
    if (suspendBackgroundWork) return;
    const eventType = String(data?.type || "").toLowerCase();
    const payloadAlert = normalizeRealtimeAlert(data?.alert || data?.data);

    if (!payloadAlert) {
      if (eventType === "new-alert" || eventType === "alert-created" || eventType === "alert-media-updated") {
        fetchTripRoutingStyleAlerts();
      }
      return;
    }

    if (isSuppressedAlert(payloadAlert)) {
      return;
    }

    clearAlertPlaybackReadyCache(payloadAlert, ALERT_READY_WINDOW_OPTIONS);
    exactReadyCacheRef.current.delete(String(payloadAlert?.id || "").trim());

    setRealtimeAlerts((prev) => dedupeByIdAndSort([payloadAlert, ...prev]));

    if (
      eventType === "alert-status-changed" ||
      eventType === "alert-resolved" ||
      eventType === "alert-updated" ||
      eventType === "alert-escalated" ||
      eventType === "video-clip-ready" ||
      eventType === "screenshot-received" ||
      eventType === "screenshot-linked" ||
      eventType === "alert-media-updated"
    ) {
      fetchTripRoutingStyleAlerts();
    }
  }, [dedupeByIdAndSort, fetchTripRoutingStyleAlerts, isSuppressedAlert, normalizeRealtimeAlert, suspendBackgroundWork]);

  const { connected: wsConnected } = useVideoWebSocket(handleRealtimeMessage);

  const getAlertLevel = (alert: any): "critical" | "high" | "medium" | "low" => {
    const raw = String(alert?.severity || alert?.priority || "").toLowerCase();
    if (raw === "critical") return "critical";
    if (raw === "high") return "high";
    if (raw === "medium") return "medium";
    return "low";
  };

  const mergedAlerts = useMemo(() => dedupeByIdAndSort([
    ...realtimeAlerts,
    ...sourceAlerts,
    ...pinnedHistoryAlerts,
    ...closedHistoryAlerts,
  ]), [closedHistoryAlerts, dedupeByIdAndSort, pinnedHistoryAlerts, realtimeAlerts, sourceAlerts]);

  const groupedAlerts = useMemo(() => {
    const groups = new Map<string, any>();

    for (const alert of mergedAlerts) {
      const normalized = normalizeAlert(alert);
      if (!normalized) continue;
      const level = getAlertLevel(normalized);
      const titleKey = String(normalized.title || normalized.alert_type || "Alert").trim().toLowerCase();
      const vehicleKey = String(
        normalized.fleet_number ||
        normalized.vehicle_registration ||
        normalized.vehicleId ||
        normalized.device_id ||
        normalized.id ||
        ""
      ).trim().toLowerCase();
      const groupKey = `${level}|${titleKey}|${vehicleKey}`;
      const existing = groups.get(groupKey);

      if (!existing) {
        groups.set(groupKey, {
          ...normalized,
          count: Number(normalized.repeated_count || 1) || 1,
          groupedIds: [normalized.id],
          latestTimestamp: normalized.lastOccurrenceTimestamp || normalized.timestamp,
          firstOccurrenceTimestamp: normalized.firstOccurrenceTimestamp || normalized.timestamp,
        });
        continue;
      }

      const nextCount = Number(existing.count || 1) + Math.max(1, Number(normalized.repeated_count || 1) || 1);
      const existingTs = new Date(existing.latestTimestamp || existing.lastOccurrenceTimestamp || existing.timestamp || 0).getTime();
      const currentTs = new Date(normalized.lastOccurrenceTimestamp || normalized.timestamp || 0).getTime();
      const existingFirstTs = new Date(existing.firstOccurrenceTimestamp || existing.timestamp || 0).getTime();
      const currentFirstTs = new Date(normalized.firstOccurrenceTimestamp || normalized.timestamp || 0).getTime();
      const latestBase = currentTs >= existingTs ? normalized : existing;
      groups.set(groupKey, {
        ...existing,
        ...latestBase,
        count: nextCount,
        groupedIds: Array.from(new Set([...(existing.groupedIds || []), normalized.id])),
        latestTimestamp: currentTs >= existingTs ? (normalized.lastOccurrenceTimestamp || normalized.timestamp) : existing.latestTimestamp,
        timestamp: existingFirstTs <= currentFirstTs ? (existing.firstOccurrenceTimestamp || existing.timestamp) : (normalized.firstOccurrenceTimestamp || normalized.timestamp),
        firstOccurrenceTimestamp: existingFirstTs <= currentFirstTs ? (existing.firstOccurrenceTimestamp || existing.timestamp) : (normalized.firstOccurrenceTimestamp || normalized.timestamp),
      });
    }

    return Array.from(groups.values());
  }, [mergedAlerts, normalizeAlert]);

  const alertCollection = useMemo(() => (
    showRawAlerts ? mergedAlerts : groupedAlerts
  ), [groupedAlerts, mergedAlerts, showRawAlerts]);

  const selectedCostCenterSet = useMemo(
    () =>
      new Set(
        selectedCostCenters
          .map((value) => normalizeCostCenter(value))
          .filter(Boolean)
      ),
    [selectedCostCenters]
  );

  const alertMatchesCostCenter = useCallback((alert: any) => {
    if (selectedCostCenterSet.size === 0) return true;

    const candidates = [
      alert?.cost_center,
      alert?.costCenter,
      alert?.metadata?.cost_center,
      alert?.metadata?.costCenter,
    ]
      .map((value) => normalizeCostCenter(value))
      .filter(Boolean);

    if (candidates.length === 0) {
      return selectedCostCenterSet.has("unassigned");
    }

    return candidates.some((value) => selectedCostCenterSet.has(value));
  }, [selectedCostCenterSet]);

  const costCenterScopedAlertCollection = useMemo(
    () => alertCollection.filter((alert) => alertMatchesCostCenter(alert)),
    [alertCollection, alertMatchesCostCenter]
  );

  useEffect(() => {
    // Use existing alert payload hints instead of per-alert availability/probe calls.
    // This keeps the board fast and avoids endpoint floods.
    const next: Record<string, boolean> = {};
    for (const alert of costCenterScopedAlertCollection) {
      const id = String(alert?.id || "").trim();
      if (!id) continue;
      next[id] = hasInlineVideoEvidence(alert);
    }
    setVideoAvailability((prev) => ({ ...prev, ...next }));
    setExactVideoReady((prev) => ({ ...prev, ...next }));
  }, [costCenterScopedAlertCollection, hasInlineVideoEvidence]);

  const passesVideoReadyGate = useCallback((alert: any) => {
    const status = String(alert?.status || "").toLowerCase();
    if (["closed", "resolved"].includes(status)) return true;
    const id = String(alert?.id || "");
    const mapReady = !!exactVideoReady[id];
    const inlineReady = hasInlineVideoEvidence(alert);
    if (!showVideoOnly) return mapReady || inlineReady;
    return mapReady || inlineReady;
  }, [exactVideoReady, hasInlineVideoEvidence, showVideoOnly]);

  const formatAverageHandlingTime = useCallback((minutes: number | null) => {
    if (minutes === null || !Number.isFinite(minutes) || minutes < 0) return "n/a";
    if (minutes < 1) return "<1m";
    if (minutes < 60) return `${Math.round(minutes)}m`;
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  }, []);

  const averageHandlingTimeBySeverity = useMemo(() => {
    const keys: Array<"critical" | "high" | "medium" | "low"> = ["critical", "high", "medium", "low"];
    const result: Record<string, string> = {};

    keys.forEach((key) => {
      const closedAlerts = costCenterScopedAlertCollection.filter((alert: any) => {
        if (getAlertLevel(alert) !== key) return false;
        return ["closed", "resolved"].includes(String(alert?.status || "").toLowerCase());
      });

      const durations = closedAlerts
        .map((alert: any) => {
          const openedAt = new Date(alert.timestamp || alert.created_at || alert.alert_timestamp || 0).getTime();
          const closedAt = new Date(alert.resolved_at || alert.closed_at || alert.updated_at || 0).getTime();
          if (!openedAt || !closedAt || closedAt < openedAt) return null;
          return (closedAt - openedAt) / 60000;
        })
        .filter((value: number | null): value is number => value !== null);

      const averageMinutes = durations.length
        ? durations.reduce((sum, value) => sum + value, 0) / durations.length
        : null;

      result[key] = formatAverageHandlingTime(averageMinutes);
    });

    return result;
  }, [costCenterScopedAlertCollection, formatAverageHandlingTime]);

  // Calculate statistics from alerts (always based on alert status, not video-ready gate)
  const isClosedStatus = (status: unknown) => {
    const normalized = String(status || "").toLowerCase();
    return normalized === "closed" || normalized === "resolved";
  };

  const calculatedStats = {
    critical_alerts: costCenterScopedAlertCollection.filter((a) => getAlertLevel(a) === 'critical' && !isClosedStatus(a?.status)).length,
    high_alerts: costCenterScopedAlertCollection.filter((a) => getAlertLevel(a) === 'high' && !isClosedStatus(a?.status)).length,
    medium_alerts: costCenterScopedAlertCollection.filter((a) => getAlertLevel(a) === 'medium' && !isClosedStatus(a?.status)).length,
    low_alerts: costCenterScopedAlertCollection.filter((a) => getAlertLevel(a) === 'low' && !isClosedStatus(a?.status)).length,
    total_alerts: costCenterScopedAlertCollection.filter((a) => !isClosedStatus(a?.status)).length,
    resolved_today: costCenterScopedAlertCollection.filter(a => {
      if (!isClosedStatus(a?.status)) return false;
      const today = new Date().toDateString();
      const resolvedDate = new Date(a.resolved_at || a.closed_at || a.updated_at).toDateString();
      return today === resolvedDate;
    }).length,
  };

  const displayStats = calculatedStats;

  const handleRefresh = () => {
    fetchTripRoutingStyleAlerts();
    void fetchClosedHistoryAlerts();
  };

  const handleViewAlert = async (alert: any) => {
    if (onOpenAlertDetail) {
      await onOpenAlertDetail(alert, null);
      return;
    }
    if (alert?.id) {
      router.push(`/video-alerts/${alert.id}`);
    }
  };

  // Helper for "Unattended" logic (24h+)
  const isUnattended = (alert: any) => {
    if (alert.status === 'closed' || alert.status === 'resolved') return false;
    const diff = differenceInHours(new Date(), new Date(alert.timestamp));
    return diff >= 24;
  };

  const matchesAlertSearch = (alert: any, query: string) => {
    const normalizedQuery = query.toLowerCase();
    return [
      alert?.title,
      alert?.fleet_number,
      alert?.vehicle_registration,
      alert?.driver_name,
      alert?.vehicleId,
      alert?.device_id,
      alert?.id,
    ].some((value) => String(value || "").toLowerCase().includes(normalizedQuery));
  };

  // Filtering
  const filteredAlerts = (() => {
    const baseFilteredAlerts = costCenterScopedAlertCollection.filter((alert: any) => {
      const status = String(alert?.status || "").toLowerCase();
      const isClosedAlert = ["closed", "resolved"].includes(status);

      // 1. Tab Filter
      if (activeTab === "unattended") {
        if (!isUnattended(alert)) return false;
      } else if (activeTab === "history") {
        if (!isClosedAlert) return false;
      } else if (activeTab !== "all") {
        if (status !== activeTab) return false;
      }

      if (activeTab !== "history" && isClosedAlert) {
        return false;
      }

      if (activeTab !== "history" && !passesVideoReadyGate(alert)) {
        return false;
      }

      if (levelFilter !== "all" && getAlertLevel(alert) !== levelFilter) {
        return false;
      }

      return true;
    });

    const trimmedSearchTerm = searchTerm.trim();
    if (!trimmedSearchTerm) return baseFilteredAlerts;

    const searchMatches = baseFilteredAlerts.filter((alert: any) => matchesAlertSearch(alert, trimmedSearchTerm));
    return searchMatches.length > 0 ? searchMatches : baseFilteredAlerts;
  })().sort((a: any, b: any) => {
    const aPinned = isPinnedVehicle(a) ? 1 : 0;
    const bPinned = isPinnedVehicle(b) ? 1 : 0;
    if (aPinned !== bPinned) return bPinned - aPinned;

    const aVideo = exactVideoReady[String(a.id)] ? 1 : 0;
    const bVideo = exactVideoReady[String(b.id)] ? 1 : 0;
    if (aVideo !== bVideo) return bVideo - aVideo;

    const aRange = videoAvailability[String(a.id)] ? 1 : 0;
    const bRange = videoAvailability[String(b.id)] ? 1 : 0;
    if (aRange !== bRange) return bRange - aRange;

    const aOpen = ["closed", "resolved"].includes(String(a?.status || "").toLowerCase()) ? 0 : 1;
    const bOpen = ["closed", "resolved"].includes(String(b?.status || "").toLowerCase()) ? 0 : 1;
    if (aOpen !== bOpen) return bOpen - aOpen;

    const aTs = new Date(getGroupedAlertTimestamp(a) || a.timestamp || 0).getTime();
    const bTs = new Date(getGroupedAlertTimestamp(b) || b.timestamp || 0).getTime();
    return bTs - aTs;
  });

  const criticalCount = calculatedStats.critical_alerts || 0;
  const highCount = calculatedStats.high_alerts || 0;
  const mediumCount = calculatedStats.medium_alerts || 0;
  const lowCount = calculatedStats.low_alerts || 0;
  const allOpenCount = displayStats?.total_alerts || 0;
  const closedAlertsCount = costCenterScopedAlertCollection.filter((alert: any) => ["closed", "resolved"].includes(String(alert?.status || "").toLowerCase())).length;
  const videoReadyCount = costCenterScopedAlertCollection.filter((alert: any) => {
    const status = String(alert?.status || "").toLowerCase();
    if (["closed", "resolved"].includes(status)) return false;
    return exactVideoReady[String(alert.id)];
  }).length;
  const pendingVideoCount = costCenterScopedAlertCollection.filter((alert: any) => {
    const status = String(alert?.status || "").toLowerCase();
    if (["closed", "resolved"].includes(status)) return false;
    return !exactVideoReady[String(alert.id)];
  }).length;
  const normalizedSearchVehicle = searchTerm.trim();
  const searchCanPin = /^\d{6,}$/.test(normalizedSearchVehicle);
  const searchPinned = searchCanPin && pinnedVehicleIds.includes(normalizedSearchVehicle);

  const controlRoomBoard = useMemo(() => {
    const vehicleCards = new Map<string, ControlRoomVehicleCard>();

    const includeCostCenter = (value: string) => {
      if (selectedCostCenterSet.size === 0) return true;
      const normalized = normalizeCostCenter(value);
      if (!normalized) return selectedCostCenterSet.has("unassigned");
      return selectedCostCenterSet.has(normalized);
    };

    for (const [deviceId, details] of vehicleIdentityLookup.entries()) {
      if (!deviceId) continue;
      if (!includeCostCenter(details?.costCenter || "")) continue;
      vehicleCards.set(deviceId, {
        deviceId,
        plate: String(details?.plate || "").trim(),
        fleetNumber: String(details?.fleetNumber || "").trim(),
        costCenter: String(details?.costCenter || "").trim(),
        hasAlert: false,
        alert: null,
        severity: "low",
        updatedAtMs: 0,
      });
    }

    const openAlerts = costCenterScopedAlertCollection
      .filter((alert: any) => !["closed", "resolved"].includes(String(alert?.status || "").toLowerCase()))
      .sort((a: any, b: any) => {
        const aTs = new Date(getGroupedAlertTimestamp(a) || a?.timestamp || 0).getTime();
        const bTs = new Date(getGroupedAlertTimestamp(b) || b?.timestamp || 0).getTime();
        return bTs - aTs;
      });

    for (const alert of openAlerts) {
      const identifiers = getAlertVehicleIdentifiers(alert);
      const fallback = String(alert?.vehicleId || alert?.device_id || "").trim();
      const ids = identifiers.length > 0 ? identifiers : (fallback ? [fallback] : []);
      if (ids.length === 0) continue;
      const severity = getAlertLevel(alert);
      const updatedAtMs = new Date(getGroupedAlertTimestamp(alert) || alert?.timestamp || 0).getTime() || Date.now();

      for (const id of ids) {
        const existing = vehicleCards.get(id);
        const alertCostCenter = String(
          alert?.cost_center ||
          alert?.costCenter ||
          alert?.metadata?.cost_center ||
          alert?.metadata?.costCenter ||
          existing?.costCenter ||
          ""
        ).trim();
        if (!includeCostCenter(alertCostCenter)) continue;

        const nextCard: ControlRoomVehicleCard = existing || {
          deviceId: id,
          plate: String(alert?.vehicle_registration || "").trim(),
          fleetNumber: String(alert?.fleet_number || "").trim(),
          costCenter: alertCostCenter,
          hasAlert: false,
          alert: null,
          severity: "low",
          updatedAtMs: 0,
        };

        if (updatedAtMs >= nextCard.updatedAtMs) {
          nextCard.hasAlert = true;
          nextCard.alert = alert;
          nextCard.severity = severity;
          nextCard.updatedAtMs = updatedAtMs;
          if (!nextCard.plate) {
            nextCard.plate = String(alert?.vehicle_registration || "").trim();
          }
          if (!nextCard.fleetNumber) {
            nextCard.fleetNumber = String(alert?.fleet_number || "").trim();
          }
          if (!nextCard.costCenter) {
            nextCard.costCenter = alertCostCenter;
          }
        }

        vehicleCards.set(id, nextCard);
      }
    }

    const unassigned: ControlRoomVehicleCard[] = [];
    const recentBySeverity: Record<"critical" | "high" | "medium" | "low", ControlRoomVehicleCard[]> = {
      critical: [],
      high: [],
      medium: [],
      low: [],
    };

    for (const card of vehicleCards.values()) {
      if (card.hasAlert) {
        recentBySeverity[card.severity].push(card);
      } else {
        unassigned.push(card);
      }
    }

    const labelSort = (a: ControlRoomVehicleCard, b: ControlRoomVehicleCard) => {
      const aLabel = `${a.fleetNumber} ${a.plate} ${a.deviceId}`.toLowerCase();
      const bLabel = `${b.fleetNumber} ${b.plate} ${b.deviceId}`.toLowerCase();
      return aLabel.localeCompare(bLabel);
    };

    unassigned.sort(labelSort);
    recentBySeverity.critical.sort((a, b) => b.updatedAtMs - a.updatedAtMs);
    recentBySeverity.high.sort((a, b) => b.updatedAtMs - a.updatedAtMs);
    recentBySeverity.medium.sort((a, b) => b.updatedAtMs - a.updatedAtMs);
    recentBySeverity.low.sort((a, b) => b.updatedAtMs - a.updatedAtMs);

    const searchQuery = searchTerm.trim().toLowerCase();
    if (searchQuery) {
      const matchesCard = (card: ControlRoomVehicleCard) => {
        const alertLabel = String(card.alert?.title || card.alert?.alert_type || card.alert?.type || "").toLowerCase();
        const label = `${card.fleetNumber} ${card.plate} ${card.deviceId} ${card.costCenter} ${alertLabel}`.toLowerCase();
        return label.includes(searchQuery);
      };

      const filteredUnassigned = unassigned.filter(matchesCard);
      const filteredRecentBySeverity = {
        critical: recentBySeverity.critical.filter(matchesCard),
        high: recentBySeverity.high.filter(matchesCard),
        medium: recentBySeverity.medium.filter(matchesCard),
        low: recentBySeverity.low.filter(matchesCard),
      };

      return {
        unassigned: filteredUnassigned,
        recentBySeverity: filteredRecentBySeverity,
        recentCount:
          filteredRecentBySeverity.critical.length +
          filteredRecentBySeverity.high.length +
          filteredRecentBySeverity.medium.length +
          filteredRecentBySeverity.low.length,
      };
    }

    return {
      unassigned,
      recentBySeverity,
      recentCount:
        recentBySeverity.critical.length +
        recentBySeverity.high.length +
        recentBySeverity.medium.length +
        recentBySeverity.low.length,
    };
  }, [
    costCenterScopedAlertCollection,
    getAlertLevel,
    getAlertVehicleIdentifiers,
    getGroupedAlertTimestamp,
    selectedCostCenterSet,
    searchTerm,
    vehicleIdentityLookup,
  ]);

  // Render Helpers
  const getSeverityColor = (severity: string) => {
    switch (severity.toLowerCase()) {
      case 'critical': return 'text-rose-700 bg-rose-100 border-rose-200';
      case 'high': return 'text-red-600 bg-red-100 border-red-200';
      case 'medium': return 'text-yellow-600 bg-yellow-100 border-yellow-200';
      default: return 'text-blue-600 bg-blue-100 border-blue-200';
    }
  };

  const getControlRoomLaneStyle = (severity: "critical" | "high" | "medium" | "low") => {
    switch (severity) {
      case "critical":
        return {
          lane: "border-rose-200 bg-gradient-to-b from-rose-50/70 to-white",
          accent: "border-l-rose-500",
          flash: "bg-rose-500",
          headerText: "text-rose-800",
          laneBadge: "border-rose-200 bg-rose-100 text-rose-700",
          countBadge: "border-rose-200 bg-rose-100/90 text-rose-700",
          title: "Critical",
        };
      case "high":
        return {
          lane: "border-red-200 bg-gradient-to-b from-red-50/65 to-white",
          accent: "border-l-red-500",
          flash: "bg-red-500",
          headerText: "text-red-800",
          laneBadge: "border-red-200 bg-red-100 text-red-700",
          countBadge: "border-red-200 bg-red-100/90 text-red-700",
          title: "High",
        };
      case "medium":
        return {
          lane: "border-amber-200 bg-gradient-to-b from-amber-50/70 to-white",
          accent: "border-l-amber-500",
          flash: "bg-amber-500",
          headerText: "text-amber-800",
          laneBadge: "border-amber-200 bg-amber-100 text-amber-700",
          countBadge: "border-amber-200 bg-amber-100/90 text-amber-700",
          title: "Medium",
        };
      default:
        return {
          lane: "border-blue-200 bg-gradient-to-b from-blue-50/70 to-white",
          accent: "border-l-blue-500",
          flash: "bg-blue-500",
          headerText: "text-blue-800",
          laneBadge: "border-blue-200 bg-blue-100 text-blue-700",
          countBadge: "border-blue-200 bg-blue-100/90 text-blue-700",
          title: "Low",
        };
    }
  };

  const renderControlRoomVehicleCard = (card: ControlRoomVehicleCard, mode: "unassigned" | "alert") => {
    const alert = card.alert;
    const severity = card.severity;
    const laneStyle = getControlRoomLaneStyle(severity);
    const vehicleLabel = [card.fleetNumber, card.plate].filter(Boolean).join(" - ") || card.deviceId;
    const lastAlertAt = alert ? formatRawAlertTimestamp(getGroupedAlertTimestamp(alert), "datetime") : "";
    const alertLabel = String(alert?.title || alert?.alert_type || alert?.type || "").trim();
    const alertCount = Math.max(1, Number(alert?.count || alert?.repeated_count || 1) || 1);

    return (
      <div
        key={`control-room-${card.deviceId}`}
        className={cn(
          "relative overflow-hidden rounded-md border bg-white/95 px-2 py-1.5 shadow-[0_1px_2px_rgba(15,23,42,0.10)] ring-1 ring-slate-200/60 transition-all hover:bg-white hover:shadow-[0_4px_14px_rgba(15,23,42,0.08)]",
          mode === "alert" ? cn("border-l-4", laneStyle.accent) : "border-slate-200"
        )}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="truncate text-[12px] font-semibold leading-4 text-slate-900">{vehicleLabel}</div>
            <div className="truncate text-[10px] leading-4 text-slate-500">
              {card.costCenter ? `Cost center: ${card.costCenter}` : "Cost center: Unassigned"}
            </div>
          </div>
          {mode !== "alert" ? (
            <Badge variant="outline" className="h-5 rounded-full border-slate-300 bg-slate-50 px-1.5 py-0 text-[10px] font-semibold text-slate-600">
              Unassigned
            </Badge>
          ) : null}
        </div>

        {mode === "alert" ? (
          <div className="mt-1.5 space-y-0.5">
            <div className="flex items-center gap-1.5">
              <div className="truncate text-[11px] font-semibold leading-4 text-slate-800">{alertLabel || "Recent alert"}</div>
              {alertCount > 1 ? (
                <Badge variant="outline" className={cn("h-5 rounded-full px-1.5 py-0 text-[10px] font-semibold", laneStyle.countBadge)}>
                  x{alertCount}
                </Badge>
              ) : null}
            </div>
            <div className="text-[10px] text-slate-500">{lastAlertAt || "Just now"}</div>
          </div>
        ) : (
          <div className="mt-1.5 text-[11px] text-slate-500">Waiting for live alerts</div>
        )}

        <div className="mt-1.5 flex items-center justify-between text-[10px] text-slate-500">
          <span>{mode === "alert" ? `${alertCount} occurrence${alertCount === 1 ? "" : "s"}` : "Monitoring"}</span>
          {mode === "alert" && alert ? (
            <button
              type="button"
              className="h-5 rounded-md border border-slate-300 bg-white px-1.5 text-[10px] font-semibold text-slate-700 transition-colors hover:border-slate-400 hover:bg-slate-50 hover:text-slate-900"
              onClick={() => void handleViewAlert(alert)}
            >
              Open
            </button>
          ) : (
            <span>Monitoring</span>
          )}
        </div>

        {mode === "alert" ? (
          <div className="pointer-events-none absolute right-1.5 top-1.5">
            <span className="relative flex h-2 w-2">
              <span className={cn("absolute inline-flex h-full w-full animate-ping rounded-full opacity-75", laneStyle.flash)} />
              <span className={cn("relative inline-flex h-2 w-2 rounded-full", laneStyle.flash)} />
            </span>
          </div>
        ) : null}
      </div>
    );
  };

  const getLevelMeta = (level: "all" | "critical" | "high" | "medium" | "low") => {
    switch (level) {
      case "critical":
        return {
          label: "Critical Alerts",
          value: criticalCount,
          description: "Immediate operator attention required",
          cardClass: "border-l-rose-600",
          iconWrapClass: "bg-rose-100",
          iconClass: "text-rose-700",
          activeClass: "ring-2 ring-rose-300 bg-rose-50"
        };
      case "high":
        return {
          label: "High Alerts",
          value: highCount,
          description: "Urgent alerts needing fast action",
          cardClass: "border-l-red-500",
          iconWrapClass: "bg-red-100",
          iconClass: "text-red-600",
          activeClass: "ring-2 ring-red-300 bg-red-50"
        };
      case "medium":
        return {
          label: "Medium Alerts",
          value: mediumCount,
          description: "Important alerts under review",
          cardClass: "border-l-amber-500",
          iconWrapClass: "bg-amber-100",
          iconClass: "text-amber-600",
          activeClass: "ring-2 ring-amber-300 bg-amber-50"
        };
      case "low":
        return {
          label: "Low Alerts",
          value: lowCount,
          description: "Lower-priority alerts for monitoring",
          cardClass: "border-l-blue-500",
          iconWrapClass: "bg-blue-100",
          iconClass: "text-blue-600",
          activeClass: "ring-2 ring-blue-300 bg-blue-50"
        };
      default:
        return {
          label: "All Open Alerts",
          value: allOpenCount,
          description: "All active alerts in the queue",
          cardClass: "border-l-emerald-500",
          iconWrapClass: "bg-emerald-100",
          iconClass: "text-emerald-600",
          activeClass: "ring-2 ring-emerald-300 bg-emerald-50"
        };
    }
  };

  const levelCards: Array<{ key: "all" | "critical" | "high" | "medium" | "low"; icon: React.ReactNode }> = [
    { key: "critical", icon: <AlertTriangle className="w-5 h-5" /> },
    { key: "high", icon: <ShieldAlert className="w-5 h-5" /> },
    { key: "medium", icon: <Siren className="w-5 h-5" /> },
    { key: "low", icon: <MinusCircle className="w-5 h-5" /> },
  ];

  const statusCards = [
    {
      key: "open",
      label: "Open Alerts",
      value: allOpenCount,
      description: "Currently active and unattended",
      icon: <Signal className="w-5 h-5" />,
      cardClass: "border-l-emerald-500",
      iconWrapClass: "bg-emerald-100",
      iconClass: "text-emerald-600",
    },
    {
      key: "closed",
      label: "Closed Alerts",
      value: closedAlertsCount,
      description: "Resolved or closed alerts",
      icon: <Clock className="w-5 h-5" />,
      cardClass: "border-l-slate-500",
      iconWrapClass: "bg-slate-100",
      iconClass: "text-slate-600",
    },
  ];

  const isStatusCardActive = (key: string) =>
    (key === "open" && activeTab !== "history") ||
    (key === "closed" && activeTab === "history");

  const boardColumns = [
    {
      key: "critical",
      title: "Critical",
      description: "Immediate action required",
      alerts: filteredAlerts.filter((alert: any) => getAlertLevel(alert) === "critical"),
      className: "border-t-rose-500",
    },
    {
      key: "high",
      title: "High",
      description: "Urgent alerts",
      alerts: filteredAlerts.filter((alert: any) => getAlertLevel(alert) === "high"),
      className: "border-t-red-400",
    },
    {
      key: "medium",
      title: "Medium",
      description: "Important alerts",
      alerts: filteredAlerts.filter((alert: any) => getAlertLevel(alert) === "medium"),
      className: "border-t-amber-400",
    },
    {
      key: "low",
      title: "Low",
      description: "Monitor and review",
      alerts: filteredAlerts.filter((alert: any) => getAlertLevel(alert) === "low"),
      className: "border-t-blue-400",
    },
  ];

  const controlRoomSeverityLanes: Array<"critical" | "high" | "medium" | "low"> =
    boardLevelFilter && boardLevelFilter !== "all"
      ? [boardLevelFilter]
      : ["critical", "high", "medium", "low"];

  const severityTableColumns = [
    {
      key: "critical",
      title: "Critical",
      className: "bg-rose-50/60",
      avgHandlingTime: averageHandlingTimeBySeverity.critical,
      alerts: filteredAlerts.filter((alert: any) => getAlertLevel(alert) === "critical"),
    },
    {
      key: "high",
      title: "High",
      className: "bg-red-50/60",
      avgHandlingTime: averageHandlingTimeBySeverity.high,
      alerts: filteredAlerts.filter((alert: any) => getAlertLevel(alert) === "high"),
    },
    {
      key: "medium",
      title: "Medium",
      className: "bg-amber-50/60",
      avgHandlingTime: averageHandlingTimeBySeverity.medium,
      alerts: filteredAlerts.filter((alert: any) => getAlertLevel(alert) === "medium"),
    },
    {
      key: "low",
      title: "Low",
      className: "bg-blue-50/60",
      avgHandlingTime: averageHandlingTimeBySeverity.low,
      alerts: filteredAlerts.filter((alert: any) => getAlertLevel(alert) === "low"),
    },
  ];

  const severityTableRowCount = Math.max(0, ...severityTableColumns.map((column) => column.alerts.length));

  const openSeverityPopout = useCallback((severity: "critical" | "high" | "medium" | "low" | "all") => {
    if (typeof window === "undefined") return;

    const existingTarget = popoutTargets[severity];
    const existingWindow = existingTarget?.ownerDocument?.defaultView;
    if (existingWindow && !existingWindow.closed) {
      existingWindow.focus();
      return;
    }

    const popup = window.open(
      "",
      `live-alerts-${severity}`,
      "popup=yes,width=1500,height=950,resizable=yes,scrollbars=yes"
    );

    if (!popup) return;

    popup.document.title = `${severity.toUpperCase()} Alerts`;
    popup.document.body.innerHTML = "";
    popup.document.body.style.margin = "0";
    popup.document.body.style.background = "#f1f5f9";

    Array.from(document.querySelectorAll("link[rel='stylesheet'], style")).forEach((node) => {
      popup.document.head.appendChild(node.cloneNode(true));
    });

    const container = popup.document.createElement("div");
    container.id = `popout-root-${severity}`;
    popup.document.body.appendChild(container);

    const cleanup = () => {
      setPopoutTargets((prev) => {
        const next = { ...prev };
        delete next[severity];
        return next;
      });
    };

    popup.addEventListener("beforeunload", cleanup);
    setPopoutTargets((prev) => ({ ...prev, [severity]: container }));
  }, [popoutTargets]);

  const openAllSeverityPopouts = useCallback(() => {
    ["critical", "high", "medium", "low"].forEach((severity) => {
      openSeverityPopout(severity as "critical" | "high" | "medium" | "low");
    });
  }, [openSeverityPopout]);

  useEffect(() => {
    popoutTargetsRef.current = popoutTargets;
  }, [popoutTargets]);

  useEffect(() => {
    return () => {
      Object.values(popoutTargetsRef.current).forEach((target) => {
        const popup = target?.ownerDocument?.defaultView;
        if (popup && !popup.closed) popup.close();
      });
    };
  }, []);

  const renderAlertClosureInfo = (alert: any) => {
    if (!alert?.resolved && !["closed", "resolved"].includes(String(alert?.status || "").toLowerCase())) return null;
    const badges: { label: string; className: string }[] = [];
    const docs = Array.isArray(alert?.documents) ? alert.documents : [];
    const ncrDoc = docs.find((d: any) => (d.type || "").toLowerCase() === "ncr");
    const reportDoc = docs.find((d: any) => (d.type || "").toLowerCase() === "report");
    if (alert.false_alert) badges.push({ label: "False Alert", className: "border-rose-300 bg-rose-50 text-rose-700" });
    if (ncrDoc) badges.push({ label: "NCR Filed", className: "border-orange-300 bg-orange-50 text-orange-700" });
    if (reportDoc) badges.push({ label: "Report Filed", className: "border-purple-300 bg-purple-50 text-purple-700" });
    if (badges.length === 0 && alert.resolved) badges.push({ label: "Resolved", className: "border-emerald-300 bg-emerald-50 text-emerald-700" });
    const resolvedBy = alert.resolved_by;
    const resolvedAt = alert.resolved_at ? new Date(alert.resolved_at).toLocaleString() : null;
    return (
      <div className="mt-2 space-y-1 border-t border-slate-100 pt-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {badges.map((b, i) => (
            <Badge key={i} className={cn("rounded-full border px-1.5 py-0 text-[10px] font-semibold", b.className)}>
              {b.label}
            </Badge>
          ))}
        </div>
        {resolvedBy ? (
          <p className="text-[10px] text-slate-400">
            by {resolvedBy}
            {resolvedAt ? ` at ${resolvedAt}` : ""}
          </p>
        ) : null}
      </div>
    );
  };

  const renderAlertBoardRow = (alert: any) => {
    const vehicleLabel = getAlertVehicleDisplayLabel(alert);
    const alertLabel = alert?.title || alert?.alert_type || alert?.type || "Alert";
    const codeLabel = String(alert?.codeLabel || "").trim();
    const hasVideo = !!exactVideoReady[String(alert.id)];
    const hasVideoInRange = !!videoAvailability[String(alert.id)];
    const pinned = isPinnedVehicle(alert);
    const vehicleId = String(alert?.vehicleId || alert?.device_id || alert?.metadata?.vehicle?.vehicleId || "").trim();

    return (
      <div key={alert.id} className="rounded-md border border-slate-200 bg-white px-2.5 py-2 shadow-sm">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="truncate text-[13px] font-semibold leading-4 text-slate-900">
              {alertLabel}
              {alert.count > 1 ? <span className="ml-1 text-[10px] text-slate-400">(×{alert.count})</span> : null}
              {vehicleLabel ? ` (${vehicleLabel})` : ""}
            </div>
            {codeLabel ? (
              <div className="mt-0.5 text-[10px] uppercase tracking-wide text-slate-400">
                {codeLabel}
              </div>
            ) : null}
            <div className="mt-1 flex items-center gap-1.5">
              {pinned ? (
                <Badge className="rounded-full border border-cyan-200 bg-cyan-50 px-1.5 py-0 text-[10px] font-semibold text-cyan-700">
                  Pinned
                </Badge>
              ) : null}
              {hasVideoInRange && !hasVideo ? (
                <Badge className="rounded-full border border-sky-200 bg-sky-50 px-1.5 py-0 text-[10px] font-semibold text-sky-700">
                  Video In Range
                </Badge>
              ) : null}
              {hasVideo ? (
                <Badge className="rounded-full border border-emerald-200 bg-emerald-50 px-1.5 py-0 text-[10px] font-semibold text-emerald-700">
                  Video Ready
                </Badge>
              ) : null}
              {Number(alert?.count || 1) > 1 ? (
                <Badge variant="secondary" className="rounded-full px-1.5 py-0 text-[10px] font-semibold">
                  x{alert.count}
                </Badge>
              ) : null}
            </div>
            <div className="mt-1 text-[10px] uppercase tracking-wide text-slate-400">
              {String(alert?.status || "new")}
            </div>
            <div className="mt-1 text-[10px] uppercase tracking-wide text-slate-400">
              Last Occurrence
            </div>
            <div className="text-[11px] leading-4 text-slate-500">
              {formatRawAlertTimestamp(getGroupedAlertTimestamp(alert), "datetime") || "Unknown time"}
            </div>
          </div>
          <Badge variant="outline" className={cn("shrink-0 capitalize text-[10px] font-semibold", getSeverityColor(getAlertLevel(alert)))}>
            {getAlertLevel(alert)}
          </Badge>
        </div>
        {renderAlertClosureInfo(alert)}
        <div className="mt-2 flex justify-between">
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-[11px]"
            onClick={(e) => {
              e.stopPropagation();
              togglePinnedVehicle(vehicleId);
            }}
          >
            {pinned ? <PinOff className="mr-1 h-3 w-3" /> : <Pin className="mr-1 h-3 w-3" />}
            {pinned ? "Unpin" : "Pin vehicle"}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-[11px]"
            onClick={(e) => {
              e.stopPropagation();
              handleViewAlert(alert);
            }}
          >
            Action Alert
          </Button>
        </div>
      </div>
    );
  };

  const renderSeverityTableCell = (alert: any, severityKey: string) => {
    if (!alert) {
      return (
        <div className="rounded-lg border border-dashed border-slate-200 bg-white/70 px-3 py-5 text-center text-xs text-slate-400">
          No alerts
        </div>
      );
    }

    return (
      <div
        className="rounded-md border border-slate-200 bg-white px-2.5 py-2 shadow-sm transition-colors hover:bg-slate-50"
        onClick={() => handleViewAlert(alert)}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            {(() => {
              const vehicleLabel = getAlertVehicleDisplayLabel(alert);
              return (
                <div className="truncate text-[13px] font-semibold leading-4 text-slate-900">
                  {alert.title}
                  {alert.count > 1 ? <span className="ml-1 text-[10px] text-slate-400">(×{alert.count})</span> : null}
                  {vehicleLabel ? ` (${vehicleLabel})` : ""}
                </div>
              );
            })()}
            <div className="mt-0.5 text-[11px] leading-4 text-slate-500">
              {String(alert?.codeLabel || alert?.alert_type || "alert").replace(/_/g, " ")}
            </div>
            {videoAvailability[String(alert.id)] && !exactVideoReady[String(alert.id)] ? (
              <div className="mt-1">
                <Badge className="rounded-full border border-sky-200 bg-sky-50 px-1.5 py-0 text-[10px] font-semibold text-sky-700">
                  Video In Range
                </Badge>
              </div>
            ) : null}
            {exactVideoReady[String(alert.id)] ? (
              <div className="mt-1">
                <Badge className="rounded-full border border-emerald-200 bg-emerald-50 px-1.5 py-0 text-[10px] font-semibold text-emerald-700">
                  Video Ready
                </Badge>
              </div>
            ) : null}
            <div className="mt-0.5 text-[10px] uppercase tracking-wide text-slate-400">
              {alert.status || "new"}
            </div>
            {Number(alert?.count || 1) > 1 ? (
              <div className="mt-0.5 text-[11px] font-semibold text-slate-600">Repeated x{alert.count}</div>
            ) : null}
          </div>
          <Badge
            variant="outline"
            className={cn("shrink-0 capitalize text-[10px] font-semibold", getSeverityColor(severityKey))}
          >
            {severityKey}
          </Badge>
        </div>

        <div className="mt-2 grid grid-cols-2 gap-2 text-[11px]">
          <div>
            <div className="text-[10px] uppercase tracking-wide text-slate-400">Target</div>
            {getAlertVehicleDisplayLabel(alert) ? (
              <div className="truncate font-mono font-semibold text-slate-900">{getAlertVehicleDisplayLabel(alert)}</div>
            ) : null}
            <div className="truncate text-slate-500">{alert.driver_name || "Unknown"}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wide text-slate-400">Last Occurrence</div>
            <div className="text-slate-900">{formatRawAlertTimestamp(getGroupedAlertTimestamp(alert), "date")}</div>
            <div className="text-slate-500">{formatRawAlertTimestamp(getGroupedAlertTimestamp(alert), "time")}</div>
          </div>
        </div>

        {renderAlertClosureInfo(alert)}

        <div className="mt-2 flex justify-end">
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-[11px]"
            onClick={(e) => {
              e.stopPropagation();
              handleViewAlert(alert);
            }}
          >
            Action Alert
          </Button>
        </div>
      </div>
    );
  };

  const renderDetachedSeverityRow = (alert: any, severityKey: string) => {
    if (!alert) {
      return (
        <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)_90px_80px_110px] items-center gap-3 border-b border-dashed border-slate-200 px-3 py-3 text-[11px] text-slate-400">
          <div>No alerts</div>
          <div>-</div>
          <div>-</div>
          <div>-</div>
          <div className="text-right">-</div>
        </div>
      );
    }

    return (
      <div
        key={`detached-${severityKey}-${alert.id}`}
        className="grid grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)_90px_80px_110px] items-center gap-3 border-b border-slate-200 px-3 py-2.5 text-[12px] hover:bg-slate-50"
        onClick={() => handleViewAlert(alert)}
      >
        <div className="min-w-0">
          <div className="truncate font-semibold text-slate-900">
            {alert.title}
            {alert.count > 1 ? <span className="ml-1 text-[10px] text-slate-400">(×{alert.count})</span> : null}
          </div>
          <div className="truncate text-[11px] text-slate-500">{(alert.alert_type || "alert").replace(/_/g, " ")}</div>
          {alert?.resolved || ["closed", "resolved"].includes(String(alert?.status || "").toLowerCase()) ? (
            <div className="mt-1">{renderAlertClosureInfo(alert)}</div>
          ) : null}
        </div>
        <div className="min-w-0">
          {getAlertVehicleDisplayLabel(alert) ? (
            <div className="truncate font-mono font-semibold text-slate-900">{getAlertVehicleDisplayLabel(alert)}</div>
          ) : null}
          <div className="truncate text-[11px] text-slate-500">{alert.driver_name || "Unknown"}</div>
        </div>
        <div className="min-w-0">
          <Badge variant="outline" className={cn("capitalize text-[10px] font-semibold", getSeverityColor(severityKey))}>
            {severityKey}
          </Badge>
          <div className="mt-1 text-[10px] uppercase tracking-wide text-slate-400">{alert.status || "new"}</div>
        </div>
        <div className="min-w-0 text-[11px] text-slate-600">
          {Number(alert?.count || 1) > 1 ? `x${alert.count}` : "x1"}
          <div className="text-[10px] text-slate-400">Last: {formatRawAlertTimestamp(getGroupedAlertTimestamp(alert), "time")}</div>
        </div>
        <div className="flex justify-end">
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-[11px]"
            onClick={(e) => {
              e.stopPropagation();
              handleViewAlert(alert);
            }}
          >
            Action
          </Button>
        </div>
      </div>
    );
  };

  const renderSeverityLane = (column: { key: string; title: string; className: string; alerts: any[]; avgHandlingTime?: string }, detached = false) => (
    <div className={cn("rounded-xl border border-slate-200 bg-slate-50", detached ? "min-h-screen p-3" : "p-0", column.className)}>
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white/90 px-3 py-2 backdrop-blur">
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-semibold text-slate-900">{column.title}</span>
          <Badge variant="secondary" className="rounded-full px-2 py-0.5 text-xs">
            {column.alerts.length}
          </Badge>
          <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium", wsConnected ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700")}>
            <span className={cn("h-1.5 w-1.5 rounded-full", wsConnected ? "bg-emerald-500" : "bg-amber-500")} />
            {wsConnected ? "Live" : "Polling"}
          </span>
        </div>
        <div className="text-[11px] text-slate-500">
          Avg handle: <span className="font-semibold text-slate-700">{column.avgHandlingTime || "n/a"}</span>
        </div>
      </div>
      {detached ? (
        <div className="overflow-auto rounded-b-xl bg-white">
          <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)_90px_80px_110px] gap-3 border-b border-slate-200 bg-slate-100 px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            <div>Alert</div>
            <div>Vehicle</div>
            <div>Status</div>
            <div>Count</div>
            <div className="text-right">Action</div>
          </div>
          <div>
            {column.alerts.length > 0
              ? column.alerts.map((alert: any) => renderDetachedSeverityRow(alert, column.key))
              : renderDetachedSeverityRow(null, column.key)}
          </div>
        </div>
      ) : (
        <div className="space-y-1.5 p-2">
          {column.alerts.length > 0 ? (
            column.alerts.map((alert: any) => renderSeverityTableCell(alert, column.key))
          ) : (
            <div className="rounded-md border border-dashed border-slate-200 bg-white px-2 py-4 text-center text-[11px] text-slate-400">
              No alerts
            </div>
          )}
        </div>
      )}
    </div>
  );

  return (
    <div className={cn("flex flex-col animate-in fade-in duration-500", standaloneMode ? "space-y-3 bg-slate-100 p-3 min-h-screen" : "space-y-4")}>
      
      {/* Top Stats Row - alert level filters */}
      {!standaloneMode && <div className="grid grid-cols-2 gap-3 xl:grid-cols-6">
        {levelCards.map(({ key, icon }) => {
          const meta = getLevelMeta(key);
          const isActive = boardLevelFilter === key;
          return (
            <Card
              key={key}
              className={cn(
                "p-3 border-l-4 bg-white shadow-sm transition-all cursor-pointer hover:shadow-md",
                meta.cardClass,
                isActive && meta.activeClass
              )}
              onClick={() => {
                if (boardLevelFilter === key) {
                  setBoardLevelFilter("all");
                  setLevelFilter("all");
                  return;
                }
                setBoardLevelFilter(key);
                setLevelFilter(key);
              }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-500">{meta.label}</p>
                  <h3 className="text-xl font-bold leading-6 text-slate-900">{meta.value}</h3>
                </div>
                <div className={cn("p-1.5 rounded-full", meta.iconWrapClass, key === "high" && "animate-pulse")}>
                  <span className={cn("scale-90", meta.iconClass)}>{icon}</span>
                </div>
              </div>
              <div className="mt-1 text-[11px] leading-4 text-slate-400">{meta.description}</div>
            </Card>
          );
        })}
        {statusCards.map((card) => (
          <Card
            key={card.key}
            className={cn(
              "p-3 border-l-4 bg-white shadow-sm transition-all cursor-pointer hover:shadow-md",
              card.cardClass,
              isStatusCardActive(card.key) && "ring-2 ring-slate-300 bg-slate-50"
            )}
            onClick={() => {
              setBoardLevelFilter("all");
              setLevelFilter("all");
              if (card.key === "closed") {
                setActiveTab("history");
              } else {
                setActiveTab("all");
              }
            }}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-500">{card.label}</p>
                <h3 className="text-xl font-bold leading-6 text-slate-900">{card.value}</h3>
              </div>
              <div className={cn("p-1.5 rounded-full", card.iconWrapClass)}>
                <span className={cn("scale-90", card.iconClass)}>{card.icon}</span>
              </div>
            </div>
            <div className="mt-1 text-[11px] leading-4 text-slate-400">{card.description}</div>
          </Card>
        ))}
      </div>}

      {/* Toolbar */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
        
        {/* Right Side Tools */}
        <div className="flex items-center gap-2 w-full lg:w-auto">
          <div className="relative flex-1 lg:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input 
              placeholder="Search vehicle, ID..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 bg-white"
            />
          </div>

          <Button
            variant={showVideoOnly ? "default" : "outline"}
            size="sm"
            onClick={() => setShowVideoOnly((prev) => !prev)}
            title="Only show active alerts once alert-time video is actually playable"
          >
            <Video className="mr-1 h-4 w-4" />
            {showVideoOnly ? `Video-ready only (${videoReadyCount})` : `Show all alerts`}
          </Button>

          {searchCanPin ? (
            <Button
              variant={searchPinned ? "default" : "outline"}
              size="sm"
              onClick={() => togglePinnedVehicle(normalizedSearchVehicle)}
              title="Pin this vehicle's alerts to the top"
            >
              {searchPinned ? <PinOff className="mr-1 h-4 w-4" /> : <Pin className="mr-1 h-4 w-4" />}
              {searchPinned ? "Unpin search vehicle" : "Pin search vehicle"}
            </Button>
          ) : null}
          
          {!standaloneMode && (
            <Button variant="outline" size="sm" onClick={openAllSeverityPopouts} title="Open all severity lanes on other screens">
              <ExternalLink className="mr-1 h-4 w-4" />
              Pop out all
            </Button>
          )}

          <Button variant="outline" size="icon" onClick={handleRefresh} title="Refresh Data">
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          </Button>
        </div>
      </div>

      {/* Main Content Area */}
      {!vehicleIdentityLookupReady ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-8 text-center text-slate-500">
          Loading vehicle registry for control-room cards...
        </div>
      ) : boardLevelFilter !== null ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <div>
                <div className="text-sm font-semibold text-slate-900">
                  {getLevelMeta(boardLevelFilter).label} board
                </div>
                <div className="text-xs text-slate-500">
                  Control-room board fed by websocket + API for all vehicles
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-2.5 xl:grid-cols-[320px_minmax(0,1fr)]">
              <div className="rounded-xl border border-slate-200 bg-white/95 p-2 shadow-sm">
                <div className="mb-1.5 flex items-center justify-between">
                  <div>
                    <div className="text-[13px] font-semibold text-slate-900">Unassigned Bucket</div>
                    <div className="text-[10px] text-slate-500">Vehicles waiting for active alerts</div>
                  </div>
                  <Badge variant="secondary" className="rounded-full px-2 py-0.5 text-xs">
                    {controlRoomBoard.unassigned.length}
                  </Badge>
                </div>
                <div className="max-h-[72vh] space-y-1.5 overflow-auto pr-1">
                  {controlRoomBoard.unassigned.length > 0 ? (
                    controlRoomBoard.unassigned.map((card) => renderControlRoomVehicleCard(card, "unassigned"))
                  ) : (
                    <div className="rounded-md border border-dashed border-slate-200 bg-slate-50 px-2 py-4 text-center text-[11px] text-slate-400">
                      All tracked vehicles currently have alerts
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-2.5 lg:grid-cols-2 xl:grid-cols-4">
                {controlRoomSeverityLanes.map((severityKey) => {
                  const laneStyle = getControlRoomLaneStyle(severityKey);
                  const cards = controlRoomBoard.recentBySeverity[severityKey];
                  return (
                    <div key={`lane-${severityKey}`} className={cn("rounded-xl border p-2 shadow-sm", laneStyle.lane)}>
                      <div className="mb-1.5 flex items-start justify-between gap-2">
                        <div>
                          <div className={cn("text-[13px] font-semibold", laneStyle.headerText)}>{laneStyle.title}</div>
                          <div className="text-[10px] text-slate-500">Recent active alerts</div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Badge variant="outline" className={cn("h-5 rounded-full px-1.5 py-0 text-[10px] font-semibold", laneStyle.laneBadge)}>
                            {cards.length}
                          </Badge>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-5 rounded-md border border-slate-300 bg-white/80 px-1.5 text-[10px] text-slate-600 hover:bg-white hover:text-slate-900"
                            onClick={() => openSeverityPopout(severityKey)}
                            title={`Pop out ${laneStyle.title} alerts`}
                          >
                            <ExternalLink className="mr-1 h-3 w-3" />
                            Pop out
                          </Button>
                        </div>
                      </div>

                      <div className="max-h-[72vh] space-y-1.5 overflow-auto pr-1">
                        {cards.length > 0 ? (
                          cards.map((card) => renderControlRoomVehicleCard(card, "alert"))
                        ) : (
                          <div className="rounded-md border border-dashed border-slate-200 bg-white px-2 py-4 text-center text-[11px] text-slate-400">
                            No recent {severityKey} alerts
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
      ) : filteredAlerts.length === 0 ? (
        <div className="text-center py-20 bg-slate-50 rounded-xl border border-slate-200 border-dashed">
          <div className="mx-auto bg-white p-4 rounded-full w-20 h-20 flex items-center justify-center shadow-sm mb-4">
            <Search className="h-8 w-8 text-slate-300" />
          </div>
          <h3 className="text-lg font-medium text-slate-900">
            {showVideoOnly && pendingVideoCount > 0 ? "Alerts are waiting for video" : "No alerts found"}
          </h3>
          <p className="text-slate-500">
            {showVideoOnly && pendingVideoCount > 0
              ? `${pendingVideoCount} active alert${pendingVideoCount === 1 ? "" : "s"} exist, but alert-time playback is not ready yet. They will appear here once video becomes playable.`
              : "Try adjusting your filters or search terms."}
          </p>
          <Button variant="link" onClick={() => { setActiveTab('all'); setLevelFilter('all'); setBoardLevelFilter("all"); setSearchTerm(''); }} className="mt-2">
            Clear all filters
          </Button>
        </div>
      ) : (
          <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
             <Table>
                <TableHeader>
                   <TableRow className="bg-slate-50 hover:bg-slate-50">
                      {severityTableColumns.map((column) => (
                        <TableHead key={column.key} className={cn("min-w-[260px] px-2 py-2 border-l border-slate-200 first:border-l-0", column.className)}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-[13px] font-semibold text-slate-900">{column.title}</span>
                              <Badge variant="secondary" className="rounded-full px-2 py-0.5 text-xs">
                                {column.alerts.length}
                              </Badge>
                            </div>
                            <div className="mr-auto pl-3 text-[11px] text-slate-500">
                              Avg handle: <span className="font-semibold text-slate-700">{column.avgHandlingTime || "n/a"}</span>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-[11px]"
                              onClick={() => openSeverityPopout(column.key as "critical" | "high" | "medium" | "low")}
                              title={`Detach ${column.title} lane`}
                            >
                              <ExternalLink className="mr-1 h-3.5 w-3.5" />
                              Pop out
                            </Button>
                          </div>
                        </TableHead>
                      ))}
                   </TableRow>
                </TableHeader>
                <TableBody>
                  {Array.from({ length: severityTableRowCount }).map((_, rowIndex) => (
                    <TableRow key={`severity-row-${rowIndex}`} className="align-top hover:bg-transparent">
                      {severityTableColumns.map((column) => (
                        <TableCell
                          key={`${column.key}-${rowIndex}`}
                          className={cn("align-top p-2 border-l border-slate-200 first:border-l-0", column.className)}
                        >
                          {renderSeverityTableCell(column.alerts[rowIndex], column.key)}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
             </Table>
          </div>
      )}
      {Object.entries(popoutTargets).map(([severity, target]) => {
        if (!target) return null;
        const column = severityTableColumns.find((item) => item.key === severity);
        if (!column) return null;
        return createPortal(
          <div className="min-h-screen bg-slate-100 p-2">
            {renderSeverityLane(column, true)}
          </div>,
          target
        );
      })}
    </div>
  );
}


