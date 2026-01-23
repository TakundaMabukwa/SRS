"use client";

import React, { useState, useEffect, use } from "react";
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
    refreshScreenshots,
  } = useVideoAlerts();
  const { toast } = useToast();

  const [newNote, setNewNote] = useState("");
  const [addingNote, setAddingNote] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [currentUser] = useState({ id: "user-1", name: "Current User", role: "Operator" });

  useEffect(() => {
    if (alertId && alerts.length > 0) {
      const alert = alerts.find(a => a.id === alertId);
      if (alert) {
        fetchAlert(alert);
      }
    }
  }, [alertId, alerts]);

  // Auto-refresh screenshots every 30 seconds
  useEffect(() => {
    if (!selectedAlert || selectedAlert.status === "closed") return;
    
    const interval = setInterval(() => {
      refreshScreenshots(alertId);
    }, 30000);
    
    return () => clearInterval(interval);
  }, [alertId, selectedAlert]);

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
                  Alert ID: {selectedAlert.id} • {format(new Date(selectedAlert.timestamp), "PPpp")}
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
                      onClick={() => refreshScreenshots(alertId)}
                    >
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Refresh
                    </Button>
                  </div>
                  <p className="text-sm text-slate-600 mb-4">
                    Screenshots auto-refresh every 30 seconds
                  </p>
                  <div className="grid grid-cols-2 gap-4">
                    {selectedAlert.screenshots?.length > 0 ? (
                      selectedAlert.screenshots.map((screenshot) => (
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
                              {format(new Date(screenshot.timestamp), "HH:mm:ss")}
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
                        No screenshots available
                      </div>
                    )}
                  </div>
                </Card>
              </TabsContent>

              {/* Video Clips Tab */}
              <TabsContent value="videos" className="mt-4">
                <Card className="p-4">
                  <h3 className="text-lg font-semibold text-slate-900 mb-4">
                    Event Video (SD Card)
                  </h3>
                  <div className="space-y-4">
                    {selectedAlert.metadata?.videoPath ? (
                      <Card className="p-4">
                        <video controls className="w-full rounded mb-3">
                          <source src={`/api/video-server/alerts/${alertId}/video?type=camera`} type="video/mp4" />
                          Your browser does not support video playback.
                        </video>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Video className="w-5 h-5 text-slate-600" />
                            <div>
                              <p className="font-medium text-slate-900">Camera SD Card Recording</p>
                              <p className="text-sm text-slate-600">Event video from vehicle camera</p>
                            </div>
                          </div>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => window.open(`/api/video-server/alerts/${alertId}/video?type=camera&download=true`, '_blank')}
                          >
                            <Download className="w-4 h-4 mr-2" />
                            Download
                          </Button>
                        </div>
                      </Card>
                    ) : (
                      <div className="text-center py-12 text-slate-500">
                        <Video className="w-12 h-12 mx-auto mb-3 opacity-20" />
                        <p>Video is being retrieved from camera SD card...</p>
                        <p className="text-sm mt-2">This may take a few moments</p>
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
                              {format(new Date(entry.timestamp), "PPpp")}
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
                          {format(new Date(note.created_at), "MMM dd, HH:mm")}
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
