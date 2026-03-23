"use client";

import React, { useState, useEffect, use, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useVideoAlerts } from "@/context/video-alerts-context/context";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertTriangle,
  AlertCircle,
  Info,
  ArrowLeft,
  MapPin,
  Clock,
  User,
  Car,
  Video,
  FileText,
  ArrowUpCircle,
  CheckCircle2,
  XCircle,
  Download,
  RefreshCw,
  Flag,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import CloseAlertModal from "@/components/modals/close-alert-modal";
import { getAlertDisplayTimestamp, resolveAlertPlaybackVideos } from "@/lib/video-alert-playback";

export default function AlertDetailPage({ params }) {
  const unwrappedParams = use(params);
  const alertId = unwrappedParams.id;
  const router = useRouter();
  const {
    alerts,
    selectedAlert,
    fetchAlert,
    updateAlertStatus,
    addNote,
    escalateAlert,
  } = useVideoAlerts();
  const { toast } = useToast();

  const [newNote, setNewNote] = useState("");
  const [addingNote, setAddingNote] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [eventVideos, setEventVideos] = useState<any[]>([]);
  const [loadingEventVideos, setLoadingEventVideos] = useState(false);
  const [eventVideoError, setEventVideoError] = useState("");
  const [currentUser] = useState({ id: "user-1", name: "Current User", role: "Operator" });
  const [resolvedScreenshots, setResolvedScreenshots] = useState([]);
  const [screenshotsLoading, setScreenshotsLoading] = useState(false);
  const [resolvedVideos, setResolvedVideos] = useState([]);
  const [videoLoading, setVideoLoading] = useState(false);

  const normalizeVideoUrl = (url) => {
    const clean = String(url || "").trim();
    if (!clean) return "";
    if (/^https?:\/\//i.test(clean)) return clean;
    if (clean.startsWith("/")) return clean;
    return `/${clean.replace(/^\/+/, "")}`;
  };

  const safeFormatDate = (value, pattern, fallback = "N/A") => {
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? fallback : format(date, pattern);
  };

  const normalizeScreenshotUrl = (url) => {
    const clean = String(url || "").trim();
    if (!clean) return "";
    if (/^https?:\/\//i.test(clean)) return clean;
    if (clean.startsWith("/")) return clean;
    return `/${clean.replace(/^\/+/, "")}`;
  };

  const normalizeScreenshots = (rows = []) =>
    rows
      .map((shot, index) => {
        const url = normalizeScreenshotUrl(shot?.url || shot?.storage_url || shot?.storageUrl);
        if (!url) return null;
        return {
          id: shot?.id || `shot-${index + 1}`,
          url,
          camera_name:
            shot?.camera_name ||
            shot?.cameraName ||
            (shot?.channel ? `Camera ${shot.channel}` : "Camera"),
          channel: Number(shot?.channel || 1),
          timestamp: shot?.timestamp || shot?.capturedAt || selectedAlert?.timestamp || new Date().toISOString(),
          capture_offset: Number(shot?.capture_offset ?? shot?.offset ?? 0),
        };
      })
      .filter(Boolean);

  const resolveStoredWindowVideo = async (alert) => {
    const vehicleId = String(
      alert?.vehicleId ||
      alert?.device_id ||
      alert?.metadata?.vehicle?.vehicleId ||
      alert?.metadata?.vehicle?.terminalPhone ||
      ""
    ).trim();
    const alertIdValue = String(alert?.id || "").trim();
    const timestamp = alert?.timestamp || alert?.metadata?.locationFix?.timestamp;
    const channel = Number(
      alert?.channel ||
      alert?.metadata?.channel ||
      alert?.metadata?.resourceChannel ||
      1
    );
    if (!vehicleId || !timestamp) return null;

    const alertTime = new Date(timestamp);
    if (Number.isNaN(alertTime.getTime())) return null;

    const startTime = new Date(alertTime.getTime() - 30 * 1000).toISOString();
    const endTime = new Date(alertTime.getTime() + 30 * 1000).toISOString();

    const createRes = await fetch(`/api/video-server/vehicles/${encodeURIComponent(vehicleId)}/videos/window`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channel, startTime, endTime }),
    });
    const createJson = await createRes.json().catch(() => ({}));
    if (!createRes.ok || !createJson?.success) return null;

    const data = createJson?.data || {};
    if (data?.streamUrl) {
      return {
        key: "alert_window_live",
        label: "Alert Window (Live Fallback)",
        url: normalizeVideoUrl(data.streamUrl),
      };
    }

    const jobId = String(data?.playbackJobId || "").trim();
    if (!jobId) return null;

    for (let attempt = 0; attempt < 40; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, attempt === 0 ? 800 : 1500));
      const statusRes = await fetch(`/api/video-server/videos/jobs/${encodeURIComponent(jobId)}`, {
        cache: "no-store",
      });
      const statusJson = await statusRes.json().catch(() => ({}));
      const job = statusJson?.data || {};
      if (job?.status === "completed") {
        const url = normalizeVideoUrl(
          String(job?.persistedVideoUrl || "").trim() ||
          (job?.persistedVideoId ? `/api/video-server/videos/${encodeURIComponent(String(job.persistedVideoId))}/file` : "") ||
          String(job?.outputUrl || "").trim() ||
          `/api/video-server/videos/jobs/${encodeURIComponent(jobId)}/file`
        );
        if (!url) return null;
        return {
          key: "alert_window",
          label: "Alert Window (30s before + 30s after)",
          url,
        };
      }
      if (job?.status === "failed") return null;
    }

    if (!alertIdValue) return null;

    try {
      await fetch(`/api/video-server/alerts/${encodeURIComponent(alertIdValue)}/collect-evidence`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ensureScreenshots: true,
          ensureVideo: true,
        }),
      }).catch(() => null);

      const cameraRes = await fetch(`/api/video-server/alerts/${encodeURIComponent(alertIdValue)}/request-report-video`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lookbackSeconds: 30,
          forwardSeconds: 30,
        }),
      });
      const cameraJson = await cameraRes.json().catch(() => ({}));
      if (cameraRes.ok && cameraJson?.success) {
        return {
          key: "camera_request",
          label: "CAMERA REQUEST",
          url: `/api/video-server/alerts/${encodeURIComponent(alertIdValue)}/video/camera`,
        };
      }
    } catch {
      // fall through
    }

    return null;
  };

  const fetchAlertScreenshots = useCallback(async (forceRequest = false) => {
    if (!alertId) return [];

    const parseRows = (payload) => {
      const rows =
        (Array.isArray(payload?.screenshots) ? payload.screenshots : null) ||
        (Array.isArray(payload?.data?.screenshots) ? payload.data.screenshots : null) ||
        [];
      return normalizeScreenshots(rows);
    };

    setScreenshotsLoading(true);
    try {
      const fetchRows = async () => {
        const res = await fetch(`/api/video-server/alerts/${encodeURIComponent(alertId)}/screenshots?includeFallback=true`, {
          cache: "no-store",
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) return [];
        return parseRows(json);
      };

      let shots = await fetchRows();
      if (shots.length === 0 || forceRequest) {
        await fetch(`/api/video-server/alerts/${encodeURIComponent(alertId)}/collect-evidence`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ensureScreenshots: true,
            ensureVideo: false,
          }),
        }).catch(() => null);

        await new Promise((resolve) => setTimeout(resolve, 1500));
        shots = await fetchRows();
      }

      setResolvedScreenshots(shots);
      return shots;
    } finally {
      setScreenshotsLoading(false);
    }
  }, [alertId]);

  useEffect(() => {
    if (alertId && alerts.length > 0) {
      const alert = alerts.find(a => a.id === alertId);
      if (alert) {
        fetchAlert(alertId);
      }
    }
  }, [alertId, alerts]);

  // Auto-refresh screenshots every 30 seconds
  useEffect(() => {
    if (!selectedAlert || selectedAlert.status === "closed") return;
    
    const interval = setInterval(() => {
      void fetchAlertScreenshots();
    }, 30000);
    
    return () => clearInterval(interval);
  }, [alertId, selectedAlert, fetchAlertScreenshots]);

  useEffect(() => {
    if (!selectedAlert) {
      setResolvedScreenshots([]);
      return;
    }
    void fetchAlertScreenshots();
  }, [selectedAlert, fetchAlertScreenshots]);

  useEffect(() => {
    let cancelled = false;

    const loadVideos = async () => {
      if (!selectedAlert) {
        setResolvedVideos([]);
        return;
      }

      setVideoLoading(true);
      try {
        const fallbackVideo = await resolveStoredWindowVideo(selectedAlert);
        if (!cancelled) {
          setResolvedVideos(fallbackVideo ? [fallbackVideo] : []);
        }
      } finally {
        if (!cancelled) setVideoLoading(false);
      }
    };

    void loadVideos();
    return () => {
      cancelled = true;
    };
  }, [selectedAlert]);

  useEffect(() => {
    let cancelled = false;

    async function loadEventVideos() {
      if (!selectedAlert?.id) {
        setEventVideos([]);
        setEventVideoError("");
        return;
      }

      setLoadingEventVideos(true);
      setEventVideoError("");
      try {
        const videos = await resolveAlertPlaybackVideos(selectedAlert);
        if (!cancelled) {
          setEventVideos(videos);
        }
      } catch (error: any) {
        if (!cancelled) {
          setEventVideos([]);
          setEventVideoError(error?.message || "Failed to load alert-time playback.");
        }
      } finally {
        if (!cancelled) {
          setLoadingEventVideos(false);
        }
      }
    }

    void loadEventVideos();

    return () => {
      cancelled = true;
    };
  }, [selectedAlert?.id]);

  const handleAddNote = async () => {
    if (!newNote.trim()) return;
    
    setAddingNote(true);
    const result = await addNote(alertId, {
      content: newNote,
      user_id: currentUser.id,
      user_name: currentUser.name,
      user_role: currentUser.role,
      is_internal: false,
    });
    
    if (result) {
      setNewNote("");
    }
    setAddingNote(false);
  };

  const handleEscalate = async () => {
    // In production, show a modal to select who to escalate to
    await escalateAlert(alertId, {
      escalate_to: "manager-1",
      escalate_to_name: "Fleet Manager",
      reason: "Requires management attention",
    });
  };

  const handleStatusChange = async (newStatus) => {
    if (newStatus === "closed") {
      setShowCloseModal(true);
    } else {
      await updateAlertStatus(alertId, newStatus, currentUser.id);
    }
  };

  if (!selectedAlert) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <Clock className="w-12 h-12 text-slate-400 mx-auto mb-4 animate-spin" />
          <p className="text-slate-600">Loading alert details...</p>
        </div>
      </div>
    );
  }

  const getSeverityConfig = (severity) => {
    const config = {
      critical: { color: "bg-red-100 text-red-800 border-red-300", icon: AlertTriangle },
      high: { color: "bg-orange-100 text-orange-800 border-orange-300", icon: AlertCircle },
      medium: { color: "bg-yellow-100 text-yellow-800 border-yellow-300", icon: Info },
      low: { color: "bg-blue-100 text-blue-800 border-blue-300", icon: Info },
      info: { color: "bg-gray-100 text-gray-800 border-gray-300", icon: Info },
    };
    return config[severity] || config.info;
  };

  const severityConfig = getSeverityConfig(selectedAlert.severity);
  const SeverityIcon = severityConfig.icon;
  const selectedAlertDisplayTimestamp = getAlertDisplayTimestamp(selectedAlert);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 pb-20">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-slate-200 shadow-sm">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" onClick={() => router.back()}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <div className="h-6 w-px bg-slate-300" />
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h1 className="text-xl font-bold text-slate-900">
                    {selectedAlert.title}
                  </h1>
                  <Badge variant="outline" className={cn("flex items-center gap-1", severityConfig.color)}>
                    <SeverityIcon className="w-3 h-3" />
                    {selectedAlert.severity?.toUpperCase() || 'INFO'}
                  </Badge>
                  {selectedAlert.escalated && (
                    <Badge variant="outline" className="bg-red-100 text-red-800 border-red-300">
                      <ArrowUpCircle className="w-3 h-3 mr-1" />
                      Escalated
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-slate-600">
                  Alert ID: {selectedAlert.id} • {safeFormatDate(selectedAlertDisplayTimestamp || selectedAlert.timestamp, "PPpp")}
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2">
              {selectedAlert.status !== "closed" && selectedAlert.status !== "resolved" && (
                <>
                  <Button 
                    variant="outline" 
                    className="border-red-300 text-red-700 hover:bg-red-50"
                    onClick={() => {
                      if (confirm('Mark this alert as a false alarm?')) {
                        updateAlertStatus(alertId, 'closed', currentUser.id, { false_positive: true });
                        toast({ title: "False Alert", description: "Alert marked as false alarm" });
                      }
                    }}
                  >
                    <XCircle className="w-4 h-4 mr-2" />
                    False Alert
                  </Button>
                  <Button 
                    className="bg-green-600 hover:bg-green-700"
                    onClick={() => setShowCloseModal(true)}
                  >
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Save Report
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="px-6 py-6">
        <div className="grid grid-cols-12 gap-6">
          {/* Main Content */}
          <div className="col-span-8">
            <Tabs defaultValue="screenshots" className="w-full">
              <TabsList className="w-full justify-start">
                <TabsTrigger value="screenshots">Screenshots</TabsTrigger>
                <TabsTrigger value="videos">Event Video</TabsTrigger>
                <TabsTrigger value="timeline">Timeline</TabsTrigger>
              </TabsList>

              {/* Screenshots Tab */}
              <TabsContent value="screenshots" className="mt-4">
                <Card className="p-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-slate-900">
                      Camera Screenshots
                    </h3>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void fetchAlertScreenshots(true)}
                    >
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Refresh
                    </Button>
                  </div>
                  <p className="text-sm text-slate-600 mb-4">
                    Screenshots auto-refresh every 30 seconds and request fresh evidence if needed
                  </p>
                  <div className="grid grid-cols-2 gap-4">
                    {resolvedScreenshots.length > 0 ? (
                      resolvedScreenshots.map((screenshot) => (
                        <Card key={screenshot.id} className="overflow-hidden">
                          <div className="relative aspect-video bg-slate-900">
                            <img
                              src={screenshot.url}
                              alt={screenshot.camera_name}
                              className="w-full h-full object-cover"
                            />
                            <div className="absolute top-2 left-2 bg-black/80 text-white px-3 py-1 rounded text-xs font-medium">
                              {screenshot.camera_name}
                            </div>
                            <div className="absolute bottom-2 right-2 bg-black/80 text-white px-3 py-1 rounded text-xs">
                              {safeFormatDate(screenshot.timestamp, "HH:mm:ss")}
                            </div>
                          </div>
                          <div className="p-2 border-t flex justify-between items-center">
                            <span className="text-xs text-slate-600">
                              {screenshot.capture_offset >= 0 ? "+" : ""}
                              {screenshot.capture_offset}s
                            </span>
                            <Button variant="ghost" size="sm">
                              <Download className="w-3 h-3" />
                            </Button>
                          </div>
                        </Card>
                      ))
                    ) : (
                      <div className="col-span-2 text-center py-12 text-slate-500">
                        {screenshotsLoading ? "Resolving alert screenshots..." : "No screenshots available yet"}
                      </div>
                    )}
                  </div>
                </Card>
              </TabsContent>

              {/* Video Clips Tab */}
              <TabsContent value="videos" className="mt-4">
                <Card className="p-4">
                  <h3 className="text-lg font-semibold text-slate-900 mb-4">
                    Event Video
                  </h3>
                  <div className="space-y-4">
                    {loadingEventVideos ? (
                      <div className="text-center py-12 text-slate-500">
                        <RefreshCw className="w-12 h-12 mx-auto mb-3 opacity-50 animate-spin" />
                        <p>Loading alert-time playback...</p>
                        <p className="text-sm mt-2">Using the same timestamp-window playback flow as the playback tab.</p>
                      </div>
                    ) : eventVideos.length > 0 ? (
                      eventVideos.map((video, index) => (
                        <Card key={video.key || index} className="p-4">
                          <video controls className="w-full rounded mb-3 bg-black">
                            <source src={video.url} />
                            Your browser does not support video playback.
                          </video>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <Video className="w-5 h-5 text-slate-600" />
                              <div>
                                <p className="font-medium text-slate-900">{video.label || `Event Video ${index + 1}`}</p>
                                <p className="text-sm text-slate-600">Timestamp-matched playback for this alert</p>
                              </div>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => window.open(video.url, "_blank")}
                            >
                              <Download className="w-4 h-4 mr-2" />
                              Open
                            </Button>
                          </div>
                        </Card>
                      ))
                    ) : eventVideoError ? (
                      <div className="text-center py-12 text-slate-500">
                        <Video className="w-12 h-12 mx-auto mb-3 opacity-20" />
                        <p>{eventVideoError}</p>
                        <p className="text-sm mt-2">No timestamp-matched playback was ready for this alert.</p>
                      </div>
                    ) : (
                      <div className="text-center py-12 text-slate-500">
                        <Video className="w-12 h-12 mx-auto mb-3 opacity-20" />
                        <p>{videoLoading ? "Resolving playback from stored video..." : "No alert-time playback available."}</p>
                        <p className="text-sm mt-2">
                          {videoLoading
                            ? "We fall back to vehicle + channel + alert time window when direct alert evidence is missing."
                            : "Try again once the timestamp window has been recorded."}
                        </p>
                      </div>
                    )}
                  </div>
                </Card>
              </TabsContent>

              {/* Timeline Tab */}
              <TabsContent value="timeline" className="mt-4">
                <Card className="p-4">
                  <h3 className="text-lg font-semibold text-slate-900 mb-4">Alert History</h3>
                  <div className="space-y-4">
                    {selectedAlert.history?.length > 0 ? (
                      selectedAlert.history.map((entry, index) => (
                        <div key={entry.id} className="flex gap-4">
                          <div className="flex flex-col items-center">
                            <div className="w-2 h-2 rounded-full bg-blue-500" />
                            {index < selectedAlert.history.length - 1 && (
                              <div className="w-px h-full bg-slate-300 my-1" />
                            )}
                          </div>
                          <div className="flex-1 pb-4">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium text-slate-900">{entry.action}</span>
                              {entry.user_name && (
                                <>
                                  <span className="text-slate-400">by</span>
                                  <span className="text-slate-700">{entry.user_name}</span>
                                </>
                              )}
                            </div>
                            <p className="text-sm text-slate-600">{entry.details}</p>
                            <p className="text-xs text-slate-400 mt-1">
                              {safeFormatDate(entry.timestamp, "PPpp")}
                            </p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-12 text-slate-500">
                        No history available
                      </div>
                    )}
                  </div>
                </Card>
              </TabsContent>
            </Tabs>
          </div>

          {/* Sidebar */}
          <div className="col-span-4 space-y-4">
            {/* Alert Details */}
            <Card className="p-4">
              <h3 className="font-semibold text-slate-900 mb-4">Alert Details</h3>
              <div className="space-y-3 text-sm">
                <div className="flex items-start gap-2">
                  <Car className="w-4 h-4 text-slate-500 mt-0.5" />
                  <div>
                    <p className="text-slate-600">Vehicle</p>
                    <p className="font-medium text-slate-900">
                      {selectedAlert.vehicle_registration || "N/A"}
                    </p>
                  </div>
                </div>
                <Separator />
                <div className="flex items-start gap-2">
                  <User className="w-4 h-4 text-slate-500 mt-0.5" />
                  <div>
                    <p className="text-slate-600">Driver</p>
                    <p className="font-medium text-slate-900">
                      {selectedAlert.driver_name || "N/A"}
                    </p>
                  </div>
                </div>
                <Separator />
                <div className="flex items-start gap-2">
                  <MapPin className="w-4 h-4 text-slate-500 mt-0.5" />
                  <div>
                    <p className="text-slate-600">Location</p>
                    <p className="font-medium text-slate-900">
                      {selectedAlert.location?.address || "No location data"}
                    </p>
                  </div>
                </div>
                <Separator />
                <div className="flex items-start gap-2">
                  <Flag className="w-4 h-4 text-slate-500 mt-0.5" />
                  <div>
                    <p className="text-slate-600">Alert Type</p>
                    <p className="font-medium text-slate-900">
                      {selectedAlert.alert_type?.replace(/_/g, " ").toUpperCase() || "N/A"}
                    </p>
                  </div>
                </div>
                <Separator />
                <div className="flex items-start gap-2">
                  <Clock className="w-4 h-4 text-slate-500 mt-0.5" />
                  <div>
                    <p className="text-slate-600">Alert Time</p>
                    <p className="font-medium text-slate-900">
                      {selectedAlertDisplayTimestamp ? safeFormatDate(String(selectedAlertDisplayTimestamp), "PPpp") : "N/A"}
                    </p>
                  </div>
                </div>
              </div>
            </Card>

            {/* Notes Section */}
            <Card className="p-4">
              <h3 className="font-semibold text-slate-900 mb-4">Notes</h3>
              
              {/* Add Note */}
              {selectedAlert.status !== "closed" && (
                <div className="mb-4">
                  <Textarea
                    placeholder="Add a note..."
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    rows={3}
                    className="mb-2"
                  />
                  <Button
                    size="sm"
                    onClick={handleAddNote}
                    disabled={!newNote.trim() || addingNote}
                  >
                    <FileText className="w-4 h-4 mr-2" />
                    Add Note
                  </Button>
                </div>
              )}

              {/* Notes List */}
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {selectedAlert.notes?.length > 0 ? (
                  selectedAlert.notes.map((note) => (
                    <div key={note.id} className="p-3 bg-slate-50 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-sm text-slate-900">{note.user_name}</span>
                        <span className="text-xs text-slate-500">
                          {safeFormatDate(note.created_at, "MMM dd, HH:mm")}
                        </span>
                      </div>
                      <p className="text-sm text-slate-700">{note.content}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-500 text-center py-4">No notes yet</p>
                )}
              </div>
            </Card>
          </div>
        </div>
      </div>

      {/* Close Alert Modal */}
      <CloseAlertModal
        open={showCloseModal}
        onClose={() => setShowCloseModal(false)}
        alertId={alertId}
        alertTitle={selectedAlert.title}
      />
    </div>
  );
}
