"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { X, Search, MapPin, Navigation, Loader2, Video, Fuel, FileText, User } from "lucide-react";
import { cn } from "@/lib/utils";

declare global {
  interface Window {
    mapboxgl: any;
  }
}

interface Vehicle {
  id: string;
  plate: string;
  driver?: string;
  status: "online" | "offline" | "idle";
  location?: {
    lat: number;
    lng: number;
    address?: string;
  };
  speed?: number;
  lastUpdate?: string;
  latitude?: number;
  longitude?: number;
  address?: string;
  timestamp?: string;
  hasVideo?: boolean;
}

export default function LiveMapView() {
  const router = useRouter();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [mapLoaded, setMapLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [vehiclesWithVideo, setVehiclesWithVideo] = useState<Set<string>>(new Set());
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<any>(null);
  const markers = useRef<any[]>([]);
  const fetchIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const mapInitialized = useRef(false);
  const boundsSet = useRef(false);

  // Fetch vehicles with video availability
  useEffect(() => {
    async function fetchVideoAvailability() {
      try {
        const videoApiUrl = `${process.env.NEXT_PUBLIC_VIDEO_SERVER_BASE_URL}/api/stream/vehicles/streams`;
        console.log('Fetching video availability from:', videoApiUrl);
        
        const response = await fetch(videoApiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ allChannels: true, onlineOnly: false, timeout: 5000 })
        });

        console.log('Video API response status:', response.status);
        
        if (response.ok) {
          const data = await response.json();
          console.log('Video API response data:', data);
          const platesWithVideo = new Set(
            data.data?.vehicles?.map((v: any) => v.plateName.toUpperCase()) || []
          );
          console.log('Plates with video:', Array.from(platesWithVideo));
          setVehiclesWithVideo(platesWithVideo);
        } else {
          console.error('Video API returned non-OK status:', response.status, response.statusText);
        }
      } catch (err) {
        console.error('Error fetching video availability:', err);
      }
    }

    fetchVideoAvailability();
    const interval = setInterval(fetchVideoAvailability, 60000);
    return () => clearInterval(interval);
  }, []);

  // Fetch vehicle data from API - only called after map loads
  const fetchVehicles = async () => {
    try {
      setLoading(true);
      const [epsResult, ctrackResult] = await Promise.allSettled([
        fetch('/api/eps-vehicles'),
        fetch('/api/ctrack-data')
      ]);

      let allVehicles: Vehicle[] = [];

      // Process EPS API data
      if (epsResult.status === 'fulfilled') {
        try {
          const epsData = await epsResult.value.json();
          const epsVehicles = (epsData.data || []).map((v: any) => ({
            id: v.plate || v.id,
            plate: v.plate || 'Unknown',
            driver: v.driver_name || v.driver || 'UNKNOWN',
            status: parseFloat(v.speed) > 0 ? 'online' : 'offline',
            location: v.latitude && v.longitude ? {
              lat: parseFloat(v.latitude),
              lng: parseFloat(v.longitude),
              address: v.address || 'Unknown location'
            } : undefined,
            speed: parseFloat(v.speed) || 0,
            lastUpdate: v.loc_time || v.timestamp,
            latitude: parseFloat(v.latitude),
            longitude: parseFloat(v.longitude),
            address: v.address,
            mileage: v.mileage ? parseFloat(v.mileage) : null,
            geozone: v.geozone,
            timestamp: v.loc_time || v.timestamp
          }));
          allVehicles = [...allVehicles, ...epsVehicles];
        } catch (e) {
          console.error('Error parsing EPS data:', e);
        }
      }

      // Process CTrack API data
      if (ctrackResult.status === 'fulfilled') {
        try {
          const ctrackData = await ctrackResult.value.json();
          const ctrackVehicles = (ctrackData.vehicles || []).map((v: any) => ({
            id: v.plate || v.id,
            plate: v.plate || 'Unknown',
            driver: v.driver || 'Unassigned',
            status: v.speed > 0 ? 'online' : (v.speed === 0 ? 'idle' : 'offline'),
            location: v.latitude && v.longitude ? {
              lat: v.latitude,
              lng: v.longitude,
              address: v.address || 'Unknown location'
            } : undefined,
            speed: v.speed || 0,
            lastUpdate: v.timestamp ? new Date(v.timestamp).toLocaleString() : 'N/A',
            latitude: v.latitude,
            longitude: v.longitude,
            address: v.address,
            timestamp: v.timestamp
          }));
          
          // Merge with EPS vehicles, avoiding duplicates
          const existingPlates = new Set(allVehicles.map(v => v.plate));
          const newVehicles = ctrackVehicles.filter((v: Vehicle) => !existingPlates.has(v.plate));
          allVehicles = [...allVehicles, ...newVehicles];
        } catch (e) {
          console.error('Error parsing CTrack data:', e);
        }
      }

      // Filter out vehicles without location data and ensure unique plates
      const vehiclesWithLocation = allVehicles.filter(v => v.location);
      
      // Remove duplicates by keeping the most recent entry for each plate
      // Normalize plates to handle case sensitivity and whitespace
      const uniqueVehicles = vehiclesWithLocation.reduce((acc, vehicle) => {
        const normalizedPlate = vehicle.plate?.trim().toUpperCase() || 'UNKNOWN';
        const existingIndex = acc.findIndex(v => 
          (v.plate?.trim().toUpperCase() || 'UNKNOWN') === normalizedPlate
        );
        
        if (existingIndex === -1) {
          acc.push(vehicle);
        } else {
          // Keep the one with more recent timestamp
          const existingTime = acc[existingIndex].timestamp ? new Date(acc[existingIndex].timestamp).getTime() : 0;
          const newTime = vehicle.timestamp ? new Date(vehicle.timestamp).getTime() : 0;
          if (newTime > existingTime) {
            acc[existingIndex] = vehicle;
          }
        }
        return acc;
      }, [] as Vehicle[]);
      
      // Filter to only include vehicles with 8-character plates
      // Note: hasVideo will be set by the update effect when video availability loads
      const filteredVehicles = uniqueVehicles.filter(v => {
        const cleanPlate = v.plate?.trim() || '';
        return cleanPlate.length === 8;
      }).map(v => ({
        ...v,
        hasVideo: false  // Will be updated by the video availability effect
      }));
      
      console.log(`Loaded ${filteredVehicles.length} vehicles with 8-char plates from ${allVehicles.length} total records`);
      setVehicles(filteredVehicles);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching vehicles:', error);
      setLoading(false);
    }
  };

  // Load vehicle data only after map is ready
  useEffect(() => {
    if (mapLoaded && !fetchIntervalRef.current) {
      // Initial fetch
      fetchVehicles();
      
      // Refresh every 30 seconds
      fetchIntervalRef.current = setInterval(fetchVehicles, 30000);
    }

    return () => {
      if (fetchIntervalRef.current) {
        clearInterval(fetchIntervalRef.current);
        fetchIntervalRef.current = null;
      }
    };
  }, [mapLoaded]);

  // Update vehicles with video availability when it changes (without re-fetching)
  useEffect(() => {
    if (vehicles.length > 0) {
      console.log('Video availability updated, updating vehicle flags...');
      setVehicles(prevVehicles => 
        prevVehicles.map(v => ({
          ...v,
          hasVideo: vehiclesWithVideo.has(v.plate?.trim().toUpperCase() || '')
        }))
      );
    }
  }, [vehiclesWithVideo]);

  // Load Mapbox script and initialize map immediately
  useEffect(() => {
    if (!mapContainer.current || mapInitialized.current) return;

    const loadMapboxAndInitialize = () => {
      // Check if Mapbox is already loaded
      if (window.mapboxgl) {
        initializeMap();
        return;
      }

      // Load Mapbox script
      const script = document.createElement('script');
      script.src = 'https://api.mapbox.com/mapbox-gl-js/v2.15.0/mapbox-gl.js';
      script.async = true;
      script.onload = () => {
        // Load CSS
        const link = document.createElement('link');
        link.href = 'https://api.mapbox.com/mapbox-gl-js/v2.15.0/mapbox-gl.css';
        link.rel = 'stylesheet';
        document.head.appendChild(link);
        
        initializeMap();
      };
      
      script.onerror = () => {
        console.error('Failed to load Mapbox script');
        setMapLoaded(true); // Show error state
      };
      
      document.head.appendChild(script);
    };

    const initializeMap = () => {
      if (!mapContainer.current || map.current || mapInitialized.current) return;

      const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
      
      if (!mapboxToken) {
        console.error("Mapbox token not found");
        setMapLoaded(true);
        return;
      }

      mapInitialized.current = true;
      window.mapboxgl.accessToken = mapboxToken;

      try {
        map.current = new window.mapboxgl.Map({
          container: mapContainer.current,
          style: "mapbox://styles/mapbox/streets-v12",
          center: [28.0473, -26.2041], // Johannesburg
          zoom: 10,
          attributionControl: false,
        });

        map.current.on('load', () => {
          setMapLoaded(true);
        });

        map.current.addControl(new window.mapboxgl.NavigationControl(), "top-right");
      } catch (error) {
        console.error("Error initializing map:", error);
        setMapLoaded(true);
      }
    };

    loadMapboxAndInitialize();

    return () => {
      markers.current.forEach((marker) => marker.remove());
      markers.current = [];
      if (map.current) {
        map.current.remove();
        map.current = null;
        mapInitialized.current = false;
      }
    };
  }, []);

  // Update markers when vehicles change
  useEffect(() => {
    if (!map.current || !mapLoaded || vehicles.length === 0) return;

    // Clear existing markers
    markers.current.forEach((marker) => marker.remove());
    markers.current = [];

    // Add markers for vehicles
    vehicles.forEach((vehicle) => {
      if (vehicle.location) {
        const el = document.createElement("div");
        el.className = "vehicle-marker";
        
        // Navy blue color for all trucks
        const statusColor = "#1e3a8a"; // Navy blue
        
        // Truck icon - scaled down to fit better in circle
        el.innerHTML = `
          <svg width="40" height="40" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(0 2px 4px rgba(0,0,0,0.2));">
            <circle cx="16" cy="16" r="14" fill="white" stroke="${statusColor}" stroke-width="2"/>
            <rect x="7" y="12" width="10" height="6" rx="0.5" fill="${statusColor}"/>
            <path d="M17 13.5h2.5l2 2v2h-1.5" stroke="${statusColor}" stroke-width="1.5" fill="none"/>
            <circle cx="11" cy="19" r="1.5" fill="white" stroke="${statusColor}" stroke-width="1"/>
            <circle cx="19.5" cy="19" r="1.5" fill="white" stroke="${statusColor}" stroke-width="1"/>
            <rect x="8" y="13" width="3" height="2" fill="white" opacity="0.8" rx="0.3"/>
            <rect x="12" y="13" width="3" height="2" fill="white" opacity="0.8" rx="0.3"/>
          </svg>
        `;
        
        el.style.cssText = `
          width: 40px;
          height: 40px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
        `;

        const marker = new window.mapboxgl.Marker(el)
          .setLngLat([vehicle.location.lng, vehicle.location.lat])
          .addTo(map.current);

        el.addEventListener("click", () => {
          setSelectedVehicle(vehicle);
          setSidebarOpen(true);
          map.current.flyTo({
            center: [vehicle.location!.lng, vehicle.location!.lat],
            zoom: 16,
            duration: 1200
          });
        });

        markers.current.push(marker);
      }
    });

    // Fit map to show all markers (only on initial load)
    if (vehicles.length > 0 && markers.current.length > 0 && map.current && !boundsSet.current) {
      try {
        const validLocations = vehicles
          .filter(v => v.location && 
                      typeof v.location.lng === 'number' && 
                      typeof v.location.lat === 'number' &&
                      !isNaN(v.location.lng) && 
                      !isNaN(v.location.lat) &&
                      Math.abs(v.location.lng) <= 180 &&
                      Math.abs(v.location.lat) <= 90)
          .map(v => [v.location!.lng, v.location!.lat] as [number, number]);
        
        if (validLocations.length > 1) {
          try {
            const bounds = new window.mapboxgl.LngLatBounds(validLocations[0], validLocations[0]);
            
            for (let i = 1; i < validLocations.length; i++) {
              bounds.extend(validLocations[i]);
            }
            
            // Attempt to fit bounds
            map.current.fitBounds(bounds, { 
              padding: 50, 
              maxZoom: 12, 
              duration: 1000 
            });
            
            // Mark bounds as set on success
            boundsSet.current = true;
          } catch (fitError) {
            console.log('Could not fit bounds, using default view');
            boundsSet.current = true; // Prevent retry
          }
        } else {
          boundsSet.current = true; // Not enough locations to fit
        }
      } catch (error) {
        console.error('Error processing vehicle locations:', error);
        boundsSet.current = true; // Prevent retry
      }
    }
  }, [vehicles, mapLoaded]);

  // Filter and sort vehicles - video available vehicles first
  const filteredVehicles = vehicles
    .filter((vehicle) =>
      vehicle.plate.toLowerCase().includes(searchQuery.toLowerCase()) ||
      vehicle.driver?.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => {
      // Sort by video availability first (vehicles with video on top)
      if (a.hasVideo && !b.hasVideo) return -1;
      if (!a.hasVideo && b.hasVideo) return 1;
      // Then by plate name
      return a.plate.localeCompare(b.plate);
    });

  return (
    <div className="absolute inset-0 w-full h-full overflow-hidden">
      {/* Loading State */}
      {!mapLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-blue-50 to-gray-100 z-50">
          <div className="text-center">
            <Loader2 className="w-16 h-16 animate-spin text-blue-600 mx-auto mb-4" />
            <p className="text-lg font-semibold text-gray-700">
              Initializing map...
            </p>
            <p className="text-sm text-gray-500 mt-1">
              Setting up map view
            </p>
          </div>
        </div>
      )}
      
      {/* Vehicle Loading Indicator (smaller, in corner) */}
      {mapLoaded && loading && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50">
          <div className="bg-white/95 backdrop-blur-sm rounded-lg shadow-lg px-4 py-2 flex items-center gap-2 border border-gray-200">
            <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
            <span className="text-sm font-medium text-gray-700">Loading vehicles...</span>
          </div>
        </div>
      )}

      {/* Map Container */}
      <div ref={mapContainer} className="absolute inset-0 w-full h-full" />

      {/* Right Sidebar */}
      <div
        className={cn(
          "absolute top-28 right-8 w-72 bg-white/95 backdrop-blur-md rounded-xl shadow-2xl border border-gray-200 transition-transform duration-300 max-h-[calc(100%-8rem)] flex flex-col",
          !sidebarOpen && "translate-x-[calc(100%+1rem)]"
        )}
      >
        {/* Compact Sidebar Header */}
        <div className="p-3 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-white flex items-center justify-between rounded-t-xl">
          <div className="flex items-center gap-2">
            <div className="p-1 bg-blue-600 rounded-lg">
              <MapPin className="w-3.5 h-3.5 text-white" />
            </div>
            <h3 className="font-bold text-sm text-gray-900">
              {selectedVehicle ? "Vehicle Info" : "All Vehicles"}
            </h3>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="h-8 w-8 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Search */}
        {!selectedVehicle && (
          <div className="p-4 border-b">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                type="text"
                placeholder="Search plate or driver..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-9 h-9 text-sm"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {selectedVehicle ? (
            <div className="space-y-2 p-2">
              {/* Selected Vehicle Card */}
              <div className="p-3 bg-white rounded-lg border-2 border-blue-200">
                <div className="mb-2">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-lg text-blue-900">
                      {selectedVehicle.plate}
                    </h4>
                    {selectedVehicle.hasVideo && (
                      <span className={cn(
                        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium",
                        selectedVehicle.status === 'online' 
                          ? "bg-blue-600 text-white" 
                          : "bg-gray-400 text-white"
                      )}>
                        <Video className="w-3 h-3" />
                        Video {selectedVehicle.status === 'offline' && '(Offline)'}
                      </span>
                    )}
                  </div>
                  <span
                    className={cn(
                      "inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-medium",
                      selectedVehicle.status === "online"
                        ? "bg-green-100 text-green-700"
                        : selectedVehicle.status === "idle"
                        ? "bg-amber-100 text-amber-700"
                        : "bg-gray-100 text-gray-700"
                    )}
                  >
                    {selectedVehicle.status}
                  </span>
                </div>
                
                {selectedVehicle.location && (
                  <div className="space-y-1.5 text-xs text-gray-600">
                    <div className="flex items-center gap-1.5">
                      <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      <span>{selectedVehicle.speed !== undefined ? selectedVehicle.speed.toFixed(1) : '0.0'} km/h</span>
                    </div>
                    
                    <div className="flex items-start gap-1.5">
                      <svg className="w-3.5 h-3.5 text-gray-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      <span className="line-clamp-1">{selectedVehicle.driver}</span>
                    </div>
                    
                    <div className="flex items-start gap-1.5">
                      <svg className="w-3.5 h-3.5 text-gray-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <span className="flex-1 line-clamp-2">
                        {selectedVehicle.location.address || selectedVehicle.address || "Unknown location"}
                      </span>
                    </div>
                    
                    <div className="text-xs text-gray-500 mt-1">
                      {Number(selectedVehicle.location.lat).toFixed(6)}, {Number(selectedVehicle.location.lng).toFixed(6)}
                    </div>
                    
                    <div className="text-xs text-gray-500 mt-1">
                      Last Update: {selectedVehicle.lastUpdate ? new Date(selectedVehicle.lastUpdate).toLocaleString('en-US', { 
                        month: 'short', 
                        day: 'numeric',
                        year: 'numeric',
                        hour: '2-digit', 
                        minute: '2-digit',
                        second: '2-digit'
                      }) : 'N/A'}
                    </div>
                  </div>
                )}
              </div>

              {/* Quick Actions Buttons */}
              <div className="space-y-2">
                <button
                  onClick={() => {
                    router.push(`/video-feeds?driver=${encodeURIComponent(selectedVehicle.driver || 'Unassigned')}&vehicle=${encodeURIComponent(selectedVehicle.plate)}`);
                  }}
                  disabled={!selectedVehicle.hasVideo}
                  className="w-full inline-flex items-center justify-start gap-3 rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4"
                >
                  <Video className="w-4 h-4" />
                  <span>Video</span>
                  {selectedVehicle.hasVideo && (
                    <span className="ml-auto px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">Available</span>
                  )}
                </button>

                <button
                  onClick={() => {
                    console.log('Fuel clicked for', selectedVehicle.plate);
                  }}
                  className="w-full inline-flex items-center justify-start gap-3 rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4"
                >
                  <Fuel className="w-4 h-4" />
                  <span>Fuel</span>
                </button>

                <button
                  onClick={() => {
                    console.log('Reports clicked for', selectedVehicle.plate);
                  }}
                  className="w-full inline-flex items-center justify-start gap-3 rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4"
                >
                  <FileText className="w-4 h-4" />
                  <span>Reports</span>
                </button>

                <button
                  onClick={() => {
                    console.log('Driver clicked for', selectedVehicle.plate);
                  }}
                  className="w-full inline-flex items-center justify-start gap-3 rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4"
                >
                  <User className="w-4 h-4" />
                  <span>Driver</span>
                </button>
              </div>

              <div className="pt-2">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    setSelectedVehicle(null);
                    map.current?.flyTo({
                      center: [28.0473, -26.2041],
                      zoom: 10,
                      duration: 1000
                    });
                  }}
                >
                  Back to All Vehicles
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-2 p-2">
              {filteredVehicles.length > 0 ? (
                filteredVehicles.map((vehicle) => (
                  <button
                    key={vehicle.id}
                    onClick={() => {
                      setSelectedVehicle(vehicle);
                      if (vehicle.location) {
                        map.current?.flyTo({
                          center: [vehicle.location.lng, vehicle.location.lat],
                          zoom: 16,
                          duration: 1200
                        });
                      }
                    }}
                    className="w-full p-3 text-left bg-white rounded-lg border-2 border-blue-100 hover:border-blue-300 transition-all duration-200 hover:shadow-md"
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <h4 className="font-bold text-lg text-blue-900">
                        {vehicle.plate}
                      </h4>
                      {vehicle.hasVideo && (
                        <span className={cn(
                          "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium",
                          vehicle.status === 'online' 
                            ? "bg-blue-600 text-white" 
                            : "bg-gray-400 text-white"
                        )}>
                          <Video className="w-3 h-3" />
                          Video {vehicle.status === 'offline' && '(Offline)'}
                        </span>
                      )}
                    </div>
                    
                    {vehicle.location ? (
                      <div className="space-y-1.5 text-xs text-gray-600">
                        <div className="flex items-center gap-1.5">
                          <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                          </svg>
                          <span>{vehicle.speed.toFixed(1)} km/h</span>
                        </div>
                        
                        <div className="flex items-start gap-1.5">
                          <svg className="w-3.5 h-3.5 text-gray-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                          <span className="line-clamp-1">{vehicle.driver}</span>
                        </div>
                        
                        <div className="flex items-start gap-1.5">
                          <svg className="w-3.5 h-3.5 text-gray-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          <span className="flex-1 line-clamp-2">{vehicle.address}</span>
                        </div>
                        
                        <div className="text-xs text-gray-500 mt-1">
                          Last seen: {vehicle.lastUpdate ? new Date(vehicle.lastUpdate).toLocaleString('en-US', { 
                            month: 'short', 
                            day: 'numeric', 
                            hour: '2-digit', 
                            minute: '2-digit' 
                          }) : 'Live'}
                        </div>
                      </div>
                    ) : (
                      <div className="text-xs text-gray-500">
                        No live data.
                      </div>
                    )}
                  </button>
                ))
              ) : (
                <div className="p-8 text-center">
                  <MapPin className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">No vehicles found</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Toggle Button (when sidebar is closed) */}
      {!sidebarOpen && (
        <Button
          onClick={() => setSidebarOpen(true)}
          className="absolute top-20 right-8 h-10 w-10 p-0 rounded-full shadow-2xl bg-blue-600 hover:bg-blue-700 border-2 border-white"
          variant="default"
        >
          <Navigation className="h-5 w-5" />
        </Button>
      )}


    </div>
  );
}
