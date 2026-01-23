"use client";

import { useState, useEffect } from "react";
import HLSPlayer from "@/components/video/HLSPlayer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Video, Search, Grid3x3, List, RefreshCw } from "lucide-react";

interface ConnectedVehicle {
  id: string;
  name: string;
  channels: number[];
}

export default function LiveStreamTab() {
  const [vehicles, setVehicles] = useState<ConnectedVehicle[]>([]);
  const [selectedVehicles, setSelectedVehicles] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchConnectedVehicles();
  }, []);

  const fetchConnectedVehicles = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/video-vehicles');
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data) {
          setVehicles(data.data);
        }
      }
    } catch (error) {
      console.error('Failed to fetch vehicles:', error);
    }
    setLoading(false);
  };

  const toggleVehicle = (vehicleId: string) => {
    const newSelected = new Set(selectedVehicles);
    if (newSelected.has(vehicleId)) {
      newSelected.delete(vehicleId);
    } else {
      newSelected.add(vehicleId);
    }
    setSelectedVehicles(newSelected);
  };

  const filteredVehicles = vehicles.filter((v) =>
    (v.channels && v.channels.length > 0 && v.connected) &&
    (v.id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    v.name?.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Live Stream</h2>
          <p className="text-slate-500">Monitor connected vehicle cameras in real-time</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={fetchConnectedVehicles}
            title="Refresh"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === "grid" ? "default" : "outline"}
            size="icon"
            onClick={() => setViewMode("grid")}
          >
            <Grid3x3 className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === "list" ? "default" : "outline"}
            size="icon"
            onClick={() => setViewMode("list")}
          >
            <List className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input
          placeholder="Search vehicles..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Active Streams */}
      {selectedVehicles.size > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-4">Active Streams</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {Array.from(selectedVehicles).flatMap((vehicleId) => {
              const vehicle = vehicles.find((v) => v.id === vehicleId);
              if (!vehicle?.channels || vehicle.channels.length === 0) return [];
              
              return vehicle.channels.map((ch: any) => (
                <HLSPlayer
                  key={`${vehicleId}-${ch.logicalChannel}`}
                  vehicleId={vehicleId}
                  channel={ch.logicalChannel}
                  vehicleName={`${vehicle?.name || vehicleId} - Ch ${ch.logicalChannel}`}
                  onStop={() => toggleVehicle(vehicleId)}
                />
              ));
            })}
          </div>
        </div>
      )}

      {/* Vehicle List */}
      <div>
        <h3 className="text-lg font-semibold mb-4">Connected Vehicles ({filteredVehicles.length})</h3>
        {loading ? (
          <div className="text-center py-8">Loading vehicles...</div>
        ) : filteredVehicles.length === 0 ? (
          <div className="text-center py-8 text-slate-500">No connected vehicles found</div>
        ) : viewMode === "grid" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {filteredVehicles.map((vehicle) => (
              <Card
                key={vehicle.id}
                className={`p-4 cursor-pointer transition-all ${
                  selectedVehicles.has(vehicle.id)
                    ? "border-blue-500 bg-blue-50"
                    : "hover:border-slate-300"
                }`}
                onClick={() => toggleVehicle(vehicle.id)}
              >
                <div className="flex items-center gap-3">
                  <Video className="h-8 w-8 text-slate-600" />
                  <div>
                    <p className="font-bold">{vehicle.name || vehicle.id}</p>
                    <p className="text-xs text-slate-500">{vehicle.channels?.length || 0} channel(s)</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-lg border">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left">Vehicle ID</th>
                  <th className="px-4 py-3 text-left">Name</th>
                  <th className="px-4 py-3 text-left">Channels</th>
                  <th className="px-4 py-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredVehicles.map((vehicle) => (
                  <tr key={vehicle.id} className="border-t hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium">{vehicle.id}</td>
                    <td className="px-4 py-3 text-slate-600">{vehicle.name || "-"}</td>
                    <td className="px-4 py-3 text-slate-600">{vehicle.channels?.length || 0}</td>
                    <td className="px-4 py-3 text-center">
                      <Button
                        size="sm"
                        variant={selectedVehicles.has(vehicle.id) ? "destructive" : "default"}
                        onClick={() => toggleVehicle(vehicle.id)}
                      >
                        {selectedVehicles.has(vehicle.id) ? "Stop" : "Stream"}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
