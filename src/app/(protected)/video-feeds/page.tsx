"use client";

import React, { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Video,
  Circle,
  WifiOff,
  ArrowLeft,
  Camera,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface CameraChannel {
  channelId: number;
  streamUrl: string;
}

interface VehicleStream {
  plateName: string;
  deviceId: string;
  channels: CameraChannel[];
  cameras: number;
}

function VideoFeedsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selectedCamera, setSelectedCamera] = useState<string | null>(null);
  const [vehicleStreams, setVehicleStreams] = useState<VehicleStream | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const videoRefs = useRef<{ [key: number]: HTMLVideoElement | null }>({});
  const playersRef = useRef<{ [key: number]: any }>({});
  
  const driverName = searchParams.get("driver") || "Unassigned";
  const vehiclePlate = searchParams.get("vehicle") || "Vehicle Info Unavailable";

  useEffect(() => {
    async function fetchVehicleStreams() {
      try {
        setLoading(true);
        const apiUrl = '/api/video/streams';
        console.log('Fetching vehicle list from:', apiUrl);
        
        const response = await fetch(apiUrl, {
          method: 'GET'
        });

        if (!response.ok) {
          console.error('API response not OK:', response.status);
          throw new Error('Failed to fetch streams');
        }
        
        const result = await response.json();
        const vehicles = result.data?.devices || result.data || result || [];
        console.log('Available vehicles:', vehicles.map((v: any) => v.plateName));
        
        const vehicle = vehicles.find((v: any) => 
          v.plateName.toLowerCase() === vehiclePlate.toLowerCase()
        );

        console.log('Found vehicle:', vehicle);
        if (vehicle) {
          // Fetch channels for this specific vehicle
          console.log('Fetching channels for device:', vehicle.deviceId);
          try {
            const channelsResponse = await fetch('/api/video/channels', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ deviceId: vehicle.deviceId })
            });
            
            console.log('Channels response status:', channelsResponse.status);
            
            if (channelsResponse.ok) {
              const channelsData = await channelsResponse.json();
              console.log('Channels data:', channelsData);
              const channels = (channelsData.channels || channelsData.data?.channels || []).filter((ch: any) => ch.streamUrl);
              setVehicleStreams({
                ...vehicle,
                channels
              });
              console.log('Set vehicle streams with', channels.length, 'channels');
            } else {
              console.error('Channels API error:', channelsResponse.status);
              setVehicleStreams({ ...vehicle, channels: [] });
              console.log('No channels available for vehicle');
            }
          } catch (channelErr) {
            console.error('Error fetching channels:', channelErr);
            setVehicleStreams({ ...vehicle, channels: [] });
          }
        } else {
          setError(`No video streams available for vehicle ${vehiclePlate}`);
          console.error('Vehicle not found in API response');
        }
      } catch (err) {
        console.error('Error fetching vehicle streams:', err);
        setError('Failed to load video streams');
      } finally {
        setLoading(false);
      }
    }

    if (vehiclePlate && vehiclePlate !== "Vehicle Info Unavailable") {
      fetchVehicleStreams();
    } else {
      setLoading(false);
      setError('No vehicle information provided');
    }
  }, [vehiclePlate]);

  useEffect(() => {
    let flvjs: any;
    const initPlayers = async () => {
      if (!vehicleStreams?.channels) {
        console.log('No vehicle streams or channels available');
        return;
      }

      console.log('Initializing video players for', vehicleStreams.channels.length, 'channels');

      try {
        flvjs = (await import('flv.js')).default;
        console.log('FLV.js loaded, supported:', flvjs.isSupported());
        
        if (!flvjs.isSupported()) {
          setError('FLV streaming not supported in this browser');
          return;
        }

        vehicleStreams.channels.forEach((channel) => {
          const videoEl = videoRefs.current[channel.channelId];
          console.log(`Channel ${channel.channelId}: video element exists:`, !!videoEl, 'player exists:', !!playersRef.current[channel.channelId]);
          
          if (!videoEl || playersRef.current[channel.channelId] || !channel.streamUrl) return;

          const proxyUrl = `/api/video/proxy?url=${encodeURIComponent(channel.streamUrl)}`;
          console.log(`Creating player for channel ${channel.channelId}:`, proxyUrl);

          const player = flvjs.createPlayer({
            type: 'flv',
            url: proxyUrl,
            isLive: true,
            hasAudio: false,
            cors: true,
          });

          player.attachMediaElement(videoEl);
          player.on(flvjs.Events.ERROR, (err: any) => {
            console.error(`Player error on channel ${channel.channelId}:`, err);
            setTimeout(() => {
              player.unload();
              player.load();
              player.play().catch(() => {});
            }, 3000);
          });

          player.load();
          player.play().then(() => {
            console.log(`Channel ${channel.channelId} started playing`);
          }).catch((err) => {
            console.error(`Failed to play channel ${channel.channelId}:`, err);
          });
          playersRef.current[channel.channelId] = player;
        });
      } catch (err) {
        console.error('Error initializing players:', err);
      }
    };

    initPlayers();

    return () => {
      Object.values(playersRef.current).forEach((player) => {
        if (player) {
          try {
            player.pause();
            player.unload();
            player.detachMediaElement();
            player.destroy();
          } catch (e) {}
        }
      });
      playersRef.current = {};
    };
  }, [vehicleStreams]);

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 via-slate-50 to-gray-100">
        <div className="text-center">
          <Loader2 className="w-16 h-16 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-lg font-semibold text-gray-700">Loading camera feeds...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-screen flex flex-col bg-gradient-to-br from-gray-50 via-slate-50 to-gray-100">
        <div className="flex-none z-50 px-4 py-3 border-b border-gray-300 bg-gray-100/95 backdrop-blur-lg shadow-md">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.back()}
            className="gap-2 text-gray-700 hover:text-gray-900 hover:bg-gray-200"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <WifiOff className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-lg font-semibold text-gray-700 mb-2">{error}</p>
            <Button onClick={() => window.location.reload()}>Retry</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-gray-50 via-slate-50 to-gray-100 overflow-hidden">
      {/* Fixed Header - Above Everything */}
      <div className="flex-none z-50 px-4 py-3 border-b border-gray-300 bg-gray-100/95 backdrop-blur-lg shadow-md">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.back()}
              className="gap-2 text-gray-700 hover:text-gray-900 hover:bg-gray-200"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </Button>
            <div className="h-6 w-px bg-gray-400" />
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-gray-800 flex items-center justify-center shadow-md">
                <Video className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-gray-900">Live Camera Feeds</h1>
                <div className="flex items-center gap-2 text-xs text-gray-700">
                  <span className="font-medium">{driverName}</span>
                  <span>•</span>
                  <span>{vehiclePlate}</span>
                </div>
              </div>
            </div>
          </div>
          <Button
            variant="default"
            onClick={() => router.push("/video-alerts")}
            className="gap-2 bg-red-600 hover:bg-red-700"
          >
            <AlertTriangle className="w-4 h-4" />
            View Alerts
          </Button>
        </div>
      </div>

      {/* Scrollable Camera Grid Container */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        <div className="p-4">
          {/* 2x2 Grid with Larger Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 max-w-[2000px] mx-auto">
            {vehicleStreams?.channels.map((channel) => (
              <Card
                key={channel.channelId}
                className="relative overflow-hidden transition-all duration-200 border-2 flex flex-col group hover:scale-[1.01] border-gray-300 hover:border-gray-400 bg-white"
              >
                {/* Camera Feed Container */}
                <div className="relative bg-black aspect-video lg:h-[calc(50vh-80px)]">
                  <video
                    ref={(el) => (videoRefs.current[channel.channelId] = el)}
                    className="w-full h-full object-contain"
                    muted
                    playsInline
                  />

                  {/* Camera Info Overlay */}
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-gray-900 via-gray-900/90 to-transparent p-4 pt-12">
                    <div className="flex items-center justify-between text-white">
                      <div className="flex items-center gap-3">
                        <Camera className="w-5 h-5" />
                        <span className="text-lg font-bold">Camera {channel.channelId}</span>
                        <span className="text-gray-300">•</span>
                        <span className="text-base text-gray-200">{vehicleStreams?.plateName}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function VideoFeedsPage() {
  return (
    <Suspense fallback={
      <div className="h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 via-slate-50 to-gray-100">
        <div className="text-center">
          <Loader2 className="w-16 h-16 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-lg font-semibold text-gray-700">Loading...</p>
        </div>
      </div>
    }>
      <VideoFeedsContent />
    </Suspense>
  );
}
