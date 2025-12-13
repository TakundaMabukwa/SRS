"use client";

import React, { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { useVideoAlerts } from "@/context/video-alerts-context/context";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
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
  Camera,
  Activity,
  TrendingUp,
  Eye,
  PlayCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import CloseAlertModal from "@/components/modals/close-alert-modal";

export default function AlertDetailPage({ params }) {
  const unwrappedParams = use(params);
  const alertId = unwrappedParams.id;
  const router = useRouter();
  const {
    selectedAlert,
    fetchAlert,
    updateAlertStatus,
    addNote,
    escalateAlert,
    refreshScreenshots,
  } = useVideoAlerts();

  const [newNote, setNewNote] = useState("");
  const [addingNote, setAddingNote] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [currentUser] = useState({ id: "user-1", name: "Current User", role: "Operator" });

  useEffect(() => {
    if (alertId) {
      fetchAlert(alertId);
    }
  }, [alertId]);

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
      userId: currentUser.id,
      userName: currentUser.name,
      is_internal: false,
    });
    
    if (result) {
      setNewNote("");
    }
    setAddingNote(false);
  };

  const handleEscalate = async () => {
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
      <div className="flex items-center justify-center h-screen bg-slate-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-600 font-medium">Loading alert details...</p>
        </div>
      </div>
    );
  }

  const getSeverityColor = (severity) => {
    switch (severity) {
      case "critical": return { bg: "bg-red-500", text: "text-red-500", light: "bg-red-50", border: "border-red-200" };
      case "high": return { bg: "bg-orange-500", text: "text-orange-500", light: "bg-orange-50", border: "border-orange-200" };
      case "medium": return { bg: "bg-yellow-500", text: "text-yellow-500", light: "bg-yellow-50", border: "border-yellow-200" };
      case "low": return { bg: "bg-blue-500", text: "text-blue-500", light: "bg-blue-50", border: "border-blue-200" };
      default: return { bg: "bg-slate-500", text: "text-slate-500", light: "bg-slate-50", border: "border-slate-200" };
    }
  };

  const getStatusConfig = (status) => {
    switch (status) {
      case "new": return { bg: "bg-red-500", label: "New", glow: "shadow-red-500/50" };
      case "acknowledged": return { bg: "bg-blue-500", label: "Acknowledged", glow: "shadow-blue-500/50" };
      case "investigating": return { bg: "bg-amber-500", label: "Investigating", glow: "shadow-amber-500/50" };
      case "resolved": return { bg: "bg-green-500", label: "Resolved", glow: "shadow-green-500/50" };
      case "escalated": return { bg: "bg-purple-500", label: "Escalated", glow: "shadow-purple-500/50" };
      default: return { bg: "bg-slate-500", label: status, glow: "shadow-slate-500/50" };
    }
  };

  const severityColor = getSeverityColor(selectedAlert.severity);
  const statusConfig = getStatusConfig(selectedAlert.status);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Top Bar */}
      <div className="bg-white border-b border-slate-200 shadow-sm">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push("/video-alerts")}
                className="hover:bg-slate-100"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Alerts
              </Button>
              <div className="h-6 w-px bg-slate-300"></div>
              <div className="flex items-center gap-3">
                <Badge className={cn("px-3 py-1 text-white", statusConfig.bg)}>
                  {statusConfig.label}
                </Badge>
                <span className="text-sm text-slate-500">
                  Alert ID: <span className="font-mono text-slate-700">{selectedAlert.id}</span>
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 mr-2">
                {format(new Date(selectedAlert.timestamp), "MMM dd, yyyy • HH:mm:ss")}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="p-6">
        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          {/* Severity Card */}
          <Card className={cn("p-3 border-l-4", severityColor.border)}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-0.5">Severity</p>
                <p className={cn("text-lg font-bold", severityColor.text)}>{selectedAlert.severity.toUpperCase()}</p>
              </div>
              <div className={cn("p-2 rounded-lg", severityColor.light)}>
                <AlertTriangle className={cn("w-4 h-4", severityColor.text)} />
              </div>
            </div>
          </Card>

          {/* Alert Type Card */}
          <Card className="p-3 bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-semibold text-blue-700 uppercase tracking-wide mb-0.5">Alert Type</p>
                <p className="text-sm font-bold text-blue-900 capitalize">{selectedAlert.alert_type.replace(/_/g, " ")}</p>
              </div>
              <div className="p-2 bg-blue-200/50 rounded-lg">
                <Activity className="w-4 h-4 text-blue-700" />
              </div>
            </div>
          </Card>

          {/* Response Time Card */}
          <Card className="p-3 bg-gradient-to-br from-purple-50 to-purple-100 border border-purple-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-semibold text-purple-700 uppercase tracking-wide mb-0.5">Response Time</p>
                <p className="text-lg font-bold text-purple-900">
                  {selectedAlert.acknowledged_at 
                    ? Math.round((new Date(selectedAlert.acknowledged_at) - new Date(selectedAlert.timestamp)) / 60000) + "m"
                    : "Pending"}
                </p>
              </div>
              <div className="p-2 bg-purple-200/50 rounded-lg">
                <Clock className="w-4 h-4 text-purple-700" />
              </div>
            </div>
          </Card>

          {/* Actions Card */}
          <Card className="p-3 bg-gradient-to-br from-emerald-50 to-emerald-100 border border-emerald-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-semibold text-emerald-700 uppercase tracking-wide mb-0.5">Actions Taken</p>
                <p className="text-lg font-bold text-emerald-900">{selectedAlert.notes?.length || 0}</p>
              </div>
              <div className="p-2 bg-emerald-200/50 rounded-lg">
                <FileText className="w-4 h-4 text-emerald-700" />
              </div>
            </div>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content - Left Side */}
          <div className="lg:col-span-2 space-y-6">
            {/* Alert Overview */}
            <Card className="bg-white border border-slate-200 shadow-sm">
              <div className="p-3 border-b border-slate-200 bg-slate-50">
                <h2 className="text-base font-bold text-slate-900">{selectedAlert.title}</h2>
                <p className="text-xs text-slate-600 mt-0.5">{selectedAlert.description}</p>
              </div>
              
              <div className="p-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <div className="flex items-start gap-2">
                      <div className="p-1.5 bg-blue-100 rounded-lg">
                        <Car className="w-4 h-4 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold text-slate-500 uppercase">Vehicle</p>
                        <p className="text-sm font-bold text-slate-900">{selectedAlert.vehicle_registration}</p>
                        <p className="text-[10px] text-slate-500">ID: {selectedAlert.vehicle_id}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-start gap-2">
                      <div className="p-1.5 bg-green-100 rounded-lg">
                        <User className="w-4 h-4 text-green-600" />
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold text-slate-500 uppercase">Driver</p>
                        <p className="text-sm font-bold text-slate-900">{selectedAlert.driver_name}</p>
                        <p className="text-[10px] text-slate-500">ID: {selectedAlert.driver_id}</p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-start gap-2">
                      <div className="p-1.5 bg-amber-100 rounded-lg">
                        <MapPin className="w-4 h-4 text-amber-600" />
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold text-slate-500 uppercase">Location</p>
                        <p className="text-xs font-semibold text-slate-900">{selectedAlert.location?.address || "Unknown"}</p>
                        <p className="text-[10px] text-slate-500">
                          {selectedAlert.location?.latitude?.toFixed(4)}, {selectedAlert.location?.longitude?.toFixed(4)}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-start gap-2">
                      <div className="p-1.5 bg-purple-100 rounded-lg">
                        <Camera className="w-4 h-4 text-purple-600" />
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold text-slate-500 uppercase">Cameras</p>
                        <p className="text-sm font-bold text-slate-900">{selectedAlert.camera_ids?.length || 0} Active</p>
                        <p className="text-[10px] text-slate-500">{selectedAlert.screenshots?.length || 0} screenshots</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </Card>

            {/* Visual Evidence Tabs */}
            <Card className="bg-white border border-slate-200 shadow-sm">
              <Tabs defaultValue="screenshots" className="w-full">
                <div className="border-b border-slate-200 bg-slate-50 px-4 pt-2">
                  <TabsList className="bg-transparent border-b-0">
                    <TabsTrigger 
                      value="screenshots" 
                      className="data-[state=active]:bg-white data-[state=active]:border data-[state=active]:border-b-0 data-[state=active]:border-slate-200 data-[state=active]:-mb-[1px] rounded-t-lg"
                    >
                      <Camera className="w-4 h-4 mr-2" />
                      Screenshots
                    </TabsTrigger>
                    <TabsTrigger 
                      value="videos"
                      className="data-[state=active]:bg-white data-[state=active]:border data-[state=active]:border-b-0 data-[state=active]:border-slate-200 data-[state=active]:-mb-[1px] rounded-t-lg"
                    >
                      <Video className="w-4 h-4 mr-2" />
                      Video Clips
                    </TabsTrigger>
                    <TabsTrigger 
                      value="timeline"
                      className="data-[state=active]:bg-white data-[state=active]:border data-[state=active]:border-b-0 data-[state=active]:border-slate-200 data-[state=active]:-mb-[1px] rounded-t-lg"
                    >
                      <Activity className="w-4 h-4 mr-2" />
                      Timeline
                    </TabsTrigger>
                  </TabsList>
                </div>

                <TabsContent value="screenshots" className="p-4 m-0">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">Camera Footage</h3>
                      <p className="text-xs text-slate-500 mt-0.5">Auto-refresh: Every 30 seconds</p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => refreshScreenshots(alertId)}
                      className="bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100"
                    >
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Refresh
                    </Button>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {selectedAlert.screenshots?.length > 0 ? (
                      selectedAlert.screenshots.map((screenshot) => (
                        <Card key={screenshot.id} className="overflow-hidden border border-slate-200 hover:shadow-lg transition-all group">
                          <div className="relative aspect-video bg-slate-900">
                            <img
                              src={screenshot.url}
                              alt={screenshot.camera_name}
                              className="w-full h-full object-cover"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent"></div>
                            <div className="absolute top-3 left-3">
                              <Badge className="bg-black/70 backdrop-blur-sm text-white border-0 shadow-lg">
                                {screenshot.camera_name}
                              </Badge>
                            </div>
                            <div className="absolute bottom-3 right-3">
                              <Badge className="bg-black/70 backdrop-blur-sm text-white border-0 shadow-lg font-mono">
                                {format(new Date(screenshot.timestamp), "HH:mm:ss")}
                              </Badge>
                            </div>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 hover:bg-white"
                            >
                              <Eye className="w-4 h-4 mr-2" />
                              View Full
                            </Button>
                          </div>
                          <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-between items-center">
                            <span className="text-xs font-medium text-slate-600">
                              {screenshot.capture_offset >= 0 ? "+" : ""}{screenshot.capture_offset}s from event
                            </span>
                            <Button variant="ghost" size="sm" className="h-8">
                              <Download className="w-4 h-4" />
                            </Button>
                          </div>
                        </Card>
                      ))
                    ) : (
                      <div className="col-span-2 text-center py-16">
                        <Camera className="w-16 h-16 mx-auto text-slate-300 mb-4" />
                        <p className="text-slate-500 font-medium">No screenshots available</p>
                      </div>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="videos" className="p-4 m-0">
                  <div className="mb-4">
                    <h3 className="text-sm font-bold text-slate-900">Video Evidence</h3>
                    <p className="text-xs text-slate-500 mt-0.5">30-second clips before and after the event</p>
                  </div>
                  
                  <div className="space-y-3">
                    {selectedAlert.video_clips?.length > 0 ? (
                      selectedAlert.video_clips.map((clip) => (
                        <Card key={clip.id} className="p-4 border border-slate-200 hover:shadow-md transition-shadow">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              <div className="p-3 bg-gradient-to-br from-blue-100 to-blue-200 rounded-lg">
                                <PlayCircle className="w-6 h-6 text-blue-600" />
                              </div>
                              <div>
                                <h4 className="font-bold text-slate-900">{clip.camera_name}</h4>
                                <p className="text-sm text-slate-500">
                                  {clip.duration}s • {format(new Date(clip.timestamp), "HH:mm:ss")}
                                </p>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <Button size="sm" className="bg-blue-600 hover:bg-blue-700">
                                <PlayCircle className="w-4 h-4 mr-2" />
                                Play
                              </Button>
                              <Button variant="outline" size="sm">
                                <Download className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        </Card>
                      ))
                    ) : (
                      <div className="text-center py-16">
                        <Video className="w-16 h-16 mx-auto text-slate-300 mb-4" />
                        <p className="text-slate-500 font-medium">No video clips available</p>
                        <p className="text-sm text-slate-400 mt-1">Videos are recorded for priority alerts</p>
                      </div>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="timeline" className="p-4 m-0">
                  <div className="mb-4">
                    <h3 className="text-sm font-bold text-slate-900">Alert Timeline</h3>
                    <p className="text-xs text-slate-500 mt-0.5">Complete audit trail of all actions</p>
                  </div>
                  
                  <div className="space-y-4">
                    {selectedAlert.history?.length > 0 ? (
                      <div className="relative">
                        <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gradient-to-b from-blue-500 via-purple-500 to-slate-300"></div>
                        {selectedAlert.history.map((entry, index) => (
                          <div key={entry.id} className="relative flex gap-4 pb-6">
                            <div className="relative z-10 flex items-center justify-center w-8 h-8 bg-blue-500 rounded-full border-4 border-white shadow-lg">
                              <div className="w-2 h-2 bg-white rounded-full"></div>
                            </div>
                            <Card className="flex-1 p-4 border border-slate-200 hover:shadow-md transition-shadow">
                              <div className="flex justify-between items-start mb-2">
                                <h4 className="font-bold text-slate-900 capitalize">
                                  {entry.action.replace(/_/g, " ")}
                                </h4>
                                <Badge variant="outline" className="text-xs">
                                  {format(new Date(entry.timestamp), "MMM dd, HH:mm")}
                                </Badge>
                              </div>
                              <p className="text-sm text-slate-600 mb-2">{entry.details}</p>
                              <p className="text-xs text-slate-500">by {entry.user_name}</p>
                            </Card>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-16">
                        <Activity className="w-16 h-16 mx-auto text-slate-300 mb-4" />
                        <p className="text-slate-500 font-medium">No timeline data</p>
                      </div>
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            </Card>
          </div>

          {/* Right Sidebar */}
          <div className="space-y-6">
            {/* Action Panel */}
            <Card className="bg-white border border-slate-200 shadow-sm">
              <div className="p-3 border-b border-slate-200 bg-gradient-to-r from-blue-50 to-purple-50">
                <h3 className="text-sm font-bold text-slate-900">Actions</h3>
              </div>
              <div className="p-3 space-y-1.5">
                {selectedAlert.status === "new" && (
                  <Button 
                    className="w-full bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-500/30"
                    onClick={() => handleStatusChange("acknowledged")}
                  >
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Acknowledge Alert
                  </Button>
                )}
                {(selectedAlert.status === "acknowledged" || selectedAlert.status === "new") && (
                  <Button 
                    className="w-full bg-amber-600 hover:bg-amber-700 shadow-lg shadow-amber-500/30"
                    onClick={() => handleStatusChange("investigating")}
                  >
                    <Activity className="w-4 h-4 mr-2" />
                    Start Investigation
                  </Button>
                )}
                {!selectedAlert.escalated && selectedAlert.status !== "closed" && (
                  <Button 
                    variant="outline"
                    className="w-full border-purple-300 text-purple-700 hover:bg-purple-50"
                    onClick={handleEscalate}
                  >
                    <ArrowUpCircle className="w-4 h-4 mr-2" />
                    Escalate to Management
                  </Button>
                )}
                {selectedAlert.status === "investigating" && (
                  <Button 
                    className="w-full bg-green-600 hover:bg-green-700 shadow-lg shadow-green-500/30"
                    onClick={() => handleStatusChange("resolved")}
                  >
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Mark as Resolved
                  </Button>
                )}
                {selectedAlert.status === "resolved" && (
                  <Button 
                    className="w-full bg-slate-700 hover:bg-slate-800"
                    onClick={() => setShowCloseModal(true)}
                  >
                    <XCircle className="w-4 h-4 mr-2" />
                    Close Alert
                  </Button>
                )}
              </div>
            </Card>

            {/* Add Note */}
            <Card className="bg-white border border-slate-200 shadow-sm">
              <div className="p-3 border-b border-slate-200 bg-gradient-to-r from-emerald-50 to-teal-50">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Add Note
                </h3>
              </div>
              <div className="p-3">
                <Textarea
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder="Document observations, actions taken, or relevant details..."
                  className="min-h-[80px] mb-2 resize-none text-sm"
                />
                <Button
                  onClick={handleAddNote}
                  disabled={!newNote.trim() || addingNote}
                  className="w-full bg-emerald-600 hover:bg-emerald-700"
                >
                  {addingNote ? "Adding..." : "Add Note"}
                </Button>
              </div>
            </Card>

            {/* Notes History */}
            <Card className="bg-white border border-slate-200 shadow-sm">
              <div className="p-3 border-b border-slate-200 bg-slate-50">
                <h3 className="text-sm font-bold text-slate-900">
                  Notes & Comments ({selectedAlert.notes?.length || 0})
                </h3>
              </div>
              <div className="p-3 space-y-2 max-h-[400px] overflow-y-auto">
                {selectedAlert.notes?.length > 0 ? (
                  selectedAlert.notes.map((note) => (
                    <Card key={note.id} className="p-2 bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-200">
                      <div className="flex items-start gap-2 mb-1">
                        <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
                          {note.user_name.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-xs text-slate-900">{note.user_name}</p>
                          <p className="text-[10px] text-slate-500">
                            {format(new Date(note.created_at), "MMM dd • HH:mm")}
                          </p>
                        </div>
                      </div>
                      <p className="text-xs text-slate-700 leading-relaxed pl-8">
                        {note.content}
                      </p>
                    </Card>
                  ))
                ) : (
                  <div className="text-center py-8">
                    <FileText className="w-12 h-12 mx-auto text-slate-300 mb-2" />
                    <p className="text-sm text-slate-500">No notes yet</p>
                  </div>
                )}
              </div>
            </Card>
          </div>
        </div>
      </div>

      <CloseAlertModal
        isOpen={showCloseModal}
        onClose={() => setShowCloseModal(false)}
        alertId={alertId}
      />
    </div>
  );
}
