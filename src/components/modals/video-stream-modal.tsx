"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Video,
  Maximize2,
  Volume2,
  VolumeX,
  Settings,
  Download,
  Camera,
  Wifi,
  WifiOff,
  Circle,
  AlertCircle,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface VideoStreamModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  driverName: string;
  vehicleInfo: string;
}

interface CameraFeed {
  id: string;
  name: string;
  location: string;
  status: "live" | "offline" | "reconnecting";
  quality: "HD" | "SD";
}

export function VideoStreamModal({
  open,
  onOpenChange,
  driverName,
  vehicleInfo,
}: VideoStreamModalProps) {
  const [selectedCamera, setSelectedCamera] = useState<string | null>(null);
  const [mutedCameras, setMutedCameras] = useState<Set<string>>(new Set());
  const [fullscreenCamera, setFullscreenCamera] = useState<string | null>(null);

  const cameras: CameraFeed[] = [
    { id: "cam1", name: "Camera 1", location: "Front View", status: "live", quality: "HD" },
    { id: "cam2", name: "Camera 2", location: "Rear View", status: "live", quality: "HD" },
    { id: "cam3", name: "Camera 3", location: "Side View", status: "live", quality: "HD" },
    { id: "cam4", name: "Camera 4", location: "Interior", status: "live", quality: "HD" },
  ];

  const videoUrls = [
    "https://www.youtube.com/embed/hFMQ5LkkS98?autoplay=1&mute=1&loop=1&playlist=hFMQ5LkkS98&controls=0&modestbranding=1&rel=0&showinfo=0&iv_load_policy=3&cc_load_policy=0&fs=0&disablekb=1",
    "https://www.youtube.com/embed/yXMjeRXglGc?autoplay=1&mute=1&loop=1&playlist=yXMjeRXglGc&controls=0&modestbranding=1&rel=0&showinfo=0&iv_load_policy=3&cc_load_policy=0&fs=0&disablekb=1",
    "https://www.youtube.com/embed/FI5ba4RRE8U?autoplay=1&mute=1&loop=1&playlist=FI5ba4RRE8U&controls=0&modestbranding=1&rel=0&showinfo=0&iv_load_policy=3&cc_load_policy=0&fs=0&disablekb=1",
    "https://www.youtube.com/embed/V6ROdRxw0d8?autoplay=1&mute=1&loop=1&playlist=V6ROdRxw0d8&controls=0&modestbranding=1&rel=0&showinfo=0&iv_load_policy=3&cc_load_policy=0&fs=0&disablekb=1",
  ];

  const toggleMute = (cameraId: string) => {
    const newMuted = new Set(mutedCameras);
    if (newMuted.has(cameraId)) {
      newMuted.delete(cameraId);
    } else {
      newMuted.add(cameraId);
    }
    setMutedCameras(newMuted);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "live":
        return "bg-green-500";
      case "offline":
        return "bg-red-500";
      case "reconnecting":
        return "bg-yellow-500";
      default:
        return "bg-gray-500";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "live":
        return <Wifi className="w-3 h-3" />;
      case "offline":
        return <WifiOff className="w-3 h-3" />;
      case "reconnecting":
        return <AlertCircle className="w-3 h-3" />;
      default:
        return <Camera className="w-3 h-3" />;
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl shadow-2xl w-full max-w-[95vw] h-full max-h-[95vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-5 py-3 border-b border-slate-200 bg-white flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center">
                  <Video className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Live Camera Feeds</h2>
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <span className="font-medium">{driverName}</span>
                    <span>•</span>
                    <span>{vehicleInfo}</span>
                  </div>
                </div>
              </div>
              <Badge variant="outline" className="px-2 py-1 bg-green-50 border-green-200 text-green-700 text-xs">
                <Circle className="w-1.5 h-1.5 mr-1 fill-green-500 text-green-500 animate-pulse" />
                {cameras.filter((c) => c.status === "live").length} Live
              </Badge>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="h-8 w-8 p-0 hover:bg-slate-100"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Camera Grid */}
        <div className="flex-1 p-4 overflow-y-auto min-h-0">
          <div className="grid grid-cols-2 gap-4 h-full">
            {cameras.map((camera, index) => (
              <Card
                key={camera.id}
                className={cn(
                  "relative group overflow-hidden transition-all duration-200 border flex flex-col h-full",
                  selectedCamera === camera.id
                    ? "border-blue-500 ring-2 ring-blue-200"
                    : "border-slate-300",
                  camera.status === "offline" && "opacity-60"
                )}
                onClick={() => setSelectedCamera(camera.id)}
              >
                {/* Camera Feed Container - Increased height */}
                <div className="relative flex-1 bg-black min-h-[450px]">
                  {/* Live Video Stream */}
                  {camera.status === "live" ? (
                    <div className="absolute inset-0">
                      <iframe
                        src={videoUrls[index]}
                        className="w-full h-full"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                        loading="eager"
                        title={camera.name}
                        style={{ border: 0 }}
                      />
                    </div>
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400">
                      <WifiOff className="w-16 h-16 mb-3 opacity-50" />
                      <span className="text-base font-medium">Camera Offline</span>
                    </div>
                  )}

                  {/* Live Indicator - Minimal */}
                  {camera.status === "live" && (
                    <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1.5 bg-red-500/95 backdrop-blur-sm rounded-md shadow-lg">
                      <Circle className="w-2 h-2 fill-white text-white animate-pulse" />
                      <span className="text-xs font-bold text-white uppercase tracking-wider">
                        Live
                      </span>
                    </div>
                  )}

                  {/* Camera Info Overlay - Minimal */}
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3">
                    <div className="flex items-center justify-between text-white">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold">{camera.name}</span>
                        <span className="text-xs text-slate-300">•</span>
                        <span className="text-xs text-slate-300">{camera.location}</span>
                      </div>
                      <Badge
                        variant="secondary"
                        className="bg-black/60 text-white border-0 font-semibold text-xs px-2 py-0.5"
                      >
                        {camera.quality}
                      </Badge>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>

        {/* Footer Info Bar */}
        <div className="px-5 py-2.5 border-t border-slate-200 bg-white flex-shrink-0">
          <div className="flex items-center justify-between text-xs text-slate-600">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5">
                <Circle className="w-2 h-2 text-green-500 fill-green-500 animate-pulse" />
                <span>Live Streaming</span>
              </span>
              <span className="text-slate-400">•</span>
              <span>{new Date().toLocaleTimeString()}</span>
            </div>
            <div className="flex items-center gap-1.5 text-slate-500">
              <span>Powered by</span>
              <span className="font-semibold text-blue-600">EPS Tracking</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}