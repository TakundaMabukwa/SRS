"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SecureButton } from "@/components/SecureButton";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Truck,
  Phone,
  Download,
  User,
  AlertTriangle,
  Clock,
  CheckCircle,
  TrendingUp,
  Users,
  MapPin,
  FileText,
  ChartBar,
  Briefcase,
  Car,
  Building2,
  Building,
  Settings,
  PlusSquare,
  Wrench,
  User2,
  ChevronDown,
  ChevronRight,
  Video,
} from "lucide-react";
import { getDashboardStats } from "@/lib/stats/dashboard";
import { createClient } from "@/lib/supabase/client";
import JobAssignmentsDashboard from "@/components/jobs/jobsStat";
import RecentActivityList from "@/components/dashboard/recentActivities";
import FinancialsPanel from "@/components/financials/FinancialsPanel";
import { SlidingNumber } from "@/components/ui/sliding-number";
import CardDemo from "@/components/userAvatar";
import Link from "next/link";
import DetailCard from "@/components/ui/detail-card";
import { onCreate } from "@/hooks/use-auth";
import VideoAlertsDashboardTab from "@/components/dashboard/video-alerts-dashboard-tab";
import { useGlobalContext } from "@/context/global-context/context";
import { ProgressWithWaypoints } from '@/components/ui/progress-with-waypoints'
import { Progress } from '@/components/ui/progress'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { FuelGaugesView } from "@/components/fuelGauge/FuelGaugesView";
import FuelCanBusDisplay from "@/components/FuelCanBusDisplay";
import DriverPerformanceDashboard from "@/components/dashboard/DriverPerformanceDashboard";
import TestRouteMap from "@/components/map/test-route-map";
import { DateTimePicker } from "@/components/ui/datetime-picker";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Area, AreaChart } from 'recharts';
import { EditTripModal } from "@/components/ui/edit-trip-modal";
import VideoAlertsPage from '@/app/(protected)/video-alerts/page';
import { NCRTemplate } from '@/components/reports/ncr-template';
import { createRoot } from 'react-dom/client';

// Reports Content Component
function ReportsContent() {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const [selectedDate, setSelectedDate] = useState(yesterday.toISOString().split('T')[0]);
  const [vehicleReports, setVehicleReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Auto-fetch on mount
  useEffect(() => {
    if (selectedDate) {
      fetchReports();
    }
  }, []);

  const fetchReports = async () => {
    setLoading(true);
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('dateFrom', selectedDate);
      params.append('dateTo', selectedDate);
      
      const res = await fetch(`/api/ncr/generate?${params}`);
      const data = await res.json();
      if (data.success) {
        // Group NCRs by vehicle
        const grouped = (data.ncrs || []).reduce((acc: any, ncr: any) => {
          const vehicle = ncr.ncr_data.fleetNumber;
          if (!acc[vehicle]) {
            acc[vehicle] = {
              vehicle,
              driver: ncr.ncr_data.driverName,
              violations: 0,
              riskRating: ncr.ncr_data.riskRating,
              ncr
            };
          }
          acc[vehicle].violations += ncr.speeding_events?.length || 0;
          return acc;
        }, {});
        setVehicleReports(Object.values(grouped));
      }
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  const downloadNCR = async (ncr: any) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>NCR ${ncr.ncr_id}</title>
          <script src="https://cdn.tailwindcss.com"></script>
          <style>
            @media print {
              body { margin: 0; padding: 0; }
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          <div id="root"></div>
          <div class="no-print p-4 text-center">
            <button onclick="window.print()" class="px-4 py-2 bg-blue-600 text-white rounded">Print / Save as PDF</button>
          </div>
        </body>
      </html>
    `);

    printWindow.document.close();

    setTimeout(() => {
      const root = createRoot(printWindow.document.getElementById('root')!);
      root.render(<NCRTemplate data={ncr.ncr_data} />);
    }, 500);
  };

  return (
    <div className="space-y-4">
      {/* Compact Date Selector */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-100">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3 flex-1">
            <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center shadow-sm">
              <FileText className="w-5 h-5 text-blue-600" />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Select Report Date</label>
              <input 
                type="date" 
                value={selectedDate} 
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              />
            </div>
          </div>
          <Button 
            onClick={fetchReports} 
            disabled={loading}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-medium rounded-lg transition-all shadow-sm hover:shadow"
          >
            {loading ? 'Loading...' : 'View Reports'}
          </Button>
        </div>
      </div>

      {/* Vehicle Reports Table */}
      {selectedDate && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="px-5 py-3 bg-slate-50 border-b border-slate-200">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-slate-900">Vehicle Reports</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {selectedDate ? new Date(selectedDate).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : 'No date selected'}
                </p>
              </div>
              {vehicleReports.length > 0 && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-100 rounded-lg">
                  <Truck className="w-4 h-4 text-blue-700" />
                  <span className="text-sm font-semibold text-blue-900">{vehicleReports.length} Vehicle{vehicleReports.length !== 1 ? 's' : ''}</span>
                </div>
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            {loading ? (
              <div className="text-center py-12">
                <div className="inline-block w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-3"></div>
                <p className="text-sm text-slate-500">Loading reports...</p>
              </div>
            ) : vehicleReports.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-14 h-14 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <FileText className="w-7 h-7 text-slate-400" />
                </div>
                <h4 className="text-sm font-medium text-slate-900 mb-1">No Reports Found</h4>
                <p className="text-xs text-slate-500">No NCR reports for this date</p>
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="px-5 py-2.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide">Vehicle</th>
                    <th className="px-5 py-2.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide">Driver</th>
                    <th className="px-5 py-2.5 text-center text-xs font-semibold text-slate-600 uppercase tracking-wide">Violations</th>
                    <th className="px-5 py-2.5 text-center text-xs font-semibold text-slate-600 uppercase tracking-wide">Risk Level</th>
                    <th className="px-5 py-2.5 text-right text-xs font-semibold text-slate-600 uppercase tracking-wide">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {vehicleReports.map((report, idx) => (
                    <tr 
                      key={idx} 
                      onClick={() => downloadNCR(report.ncr)}
                      className="hover:bg-blue-50 cursor-pointer transition-colors group"
                    >
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center shadow-sm">
                            <Truck className="w-4 h-4 text-white" />
                          </div>
                          <div>
                            <div className="text-sm font-semibold text-slate-900">{report.vehicle}</div>
                            <div className="text-xs text-slate-500">Fleet Vehicle</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <div className="text-sm font-medium text-slate-900">{report.driver}</div>
                        <div className="text-xs text-slate-500">Assigned Driver</div>
                      </td>
                      <td className="px-5 py-3 text-center">
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-red-100 rounded-full">
                          <AlertTriangle className="w-3.5 h-3.5 text-red-700" />
                          <span className="text-sm font-bold text-red-900">{report.violations}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-center">
                        <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                          report.riskRating === 'High' ? 'bg-red-100 text-red-800' :
                          report.riskRating === 'Medium' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-green-100 text-green-800'
                        }`}>
                          {report.riskRating || 'Low'}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 group-hover:border-blue-300 group-hover:bg-blue-50 group-hover:text-blue-700 transition-all">
                          <Download className="w-4 h-4" />
                          <span>Download</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Global vehicle data cache to prevent redundant API calls
const vehicleDataCache = {
  data: null as any,
  timestamp: 0,
  cacheDuration: 30000, // 30 seconds
  isLoading: false,
  pendingCallbacks: [] as Array<(data: any) => void>,
  
  async fetch(): Promise<any> {
    const now = Date.now();
    
    // Return cached data if still fresh
    if (this.data && now - this.timestamp < this.cacheDuration) {
      return this.data;
    }
    
    // If already loading, wait for that request
    if (this.isLoading) {
      return new Promise((resolve) => {
        this.pendingCallbacks.push(resolve);
      });
    }
    
    // Start new fetch
    this.isLoading = true;
    
    try {
      const [epsResult, ctrackResult] = await Promise.allSettled([
        fetch('/api/eps-vehicles'),
        fetch('/api/ctrack-data')
      ]);
      
      const vehicles: any[] = [];
      
      // Process EPS API
      if (epsResult.status === 'fulfilled') {
        try {
          const epsData = await epsResult.value.json();
          vehicles.push(...(epsData.data || []));
        } catch (e) {}
      }
      
      // Process CTrack API
      if (ctrackResult.status === 'fulfilled') {
        try {
          const ctrackData = await ctrackResult.value.json();
          vehicles.push(...(ctrackData.vehicles || []));
        } catch (e) {}
      }
      
      this.data = vehicles;
      this.timestamp = now;
      
      // Resolve pending callbacks
      this.pendingCallbacks.forEach(cb => cb(this.data));
      this.pendingCallbacks = [];
      
      return this.data;
    } finally {
      this.isLoading = false;
    }
  },
  
  findVehicle(plate: string): any {
    if (!this.data) return null;
    return this.data.find((v: any) => v.plate?.toLowerCase() === plate.toLowerCase());
  }
};

// Driver Card Component with fetched driver info
function DriverCard({ trip, userRole, handleViewMap, setCurrentTripForNote, setNoteText, setNoteOpen, setAvailableDrivers, setCurrentTripForChange, setChangeDriverOpen, setCurrentTripForClose, setCloseReason, setCloseTripOpen, setCurrentTripForEdit, setEditTripOpen, setCurrentTripForApproval, setApprovalModalOpen, setVideoModalOpen, setCurrentTripForVideo, isVisible = true }: any) {
  const router = useRouter()
  const [driverInfo, setDriverInfo] = useState<any>(null)
  const [vehicleInfo, setVehicleInfo] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [vehicleLocation, setVehicleLocation] = useState<any>(null)
  const [isFlashing, setIsFlashing] = useState(false)
  const [assignment, setAssignment] = useState<any>(null)

  // Check for unauthorized stops and trigger flash animation
  useEffect(() => {
    if (trip.unauthorized_stops_count > 0) {
      setIsFlashing(true)
      const timer = setTimeout(() => setIsFlashing(false), 3000) // Flash for 3 seconds
      return () => clearTimeout(timer)
    }
  }, [trip.unauthorized_stops_count])

  useEffect(() => {
    // Only fetch if this card is visible (not on another tab)
    if (!isVisible) {
      return;
    }

    async function fetchAssignmentInfo() {
      const assignments = trip.vehicleassignments || trip.vehicle_assignments || []
      if (!assignments.length) {
        setLoading(false)
        return
      }

      setLoading(true)
      try {
        const supabase = createClient()
        const assignment = assignments[0]
        setAssignment(assignment)
        
        // Switch to second driver if status is handover and second driver exists
        let driverToFetch = assignment.drivers?.[0]
        if (trip.status?.toLowerCase() === 'handover' && assignment.drivers?.[1]) {
          driverToFetch = assignment.drivers[1]
        }
        
        // Fetch driver info by ID from database
        if (driverToFetch?.id) {
          const { data: driver } = await supabase
            .from('drivers')
            .select('*')
            .eq('id', driverToFetch.id)
            .single()
          
          if (driver) {
            setDriverInfo(driver)
            
            // Try to find vehicle location using multiple strategies
            await findVehicleLocation(driver, assignment)
          } else {
            // Fallback to assignment data if driver not found in DB
            const driverInfo = {
              id: driverToFetch.id,
              first_name: driverToFetch.first_name || driverToFetch.name?.split(' ')[0] || '',
              surname: driverToFetch.surname || driverToFetch.name || 'Unknown',
              phone_number: driverToFetch.phone_number || '',
              available: true
            }
            setDriverInfo(driverInfo)
            await findVehicleLocation(driverInfo, assignment)
          }
        }
        
        // Set vehicle info from assignment
        if (assignment.vehicle?.name) {
          const vehicleInfo = {
            id: assignment.vehicle.id,
            registration_number: assignment.vehicle.name
          }
          setVehicleInfo(vehicleInfo)
        }
      } catch (err) {
        console.error('Error fetching assignment info:', err)
      }
      setLoading(false)
    }

    async function findVehicleLocation(driver: any, assignment: any) {
      const vehiclePlate = assignment?.vehicle?.name
      if (!vehiclePlate) return
      
      try {
        // Use cached vehicle data
        await vehicleDataCache.fetch();
        const found = vehicleDataCache.findVehicle(vehiclePlate);
        
        if (found && found.latitude && found.longitude) {
          setVehicleLocation(found);
        }
      } catch (e) {
        console.error('Error finding vehicle location:', e);
      }
    }

    fetchAssignmentInfo()
  }, [trip.id, JSON.stringify(trip.vehicleassignments || trip.vehicle_assignments), isVisible])

  const driverName = driverInfo ? `${driverInfo.first_name || ''} ${driverInfo.surname || ''}`.trim() || 'Unassigned' : 'Unassigned'
  const initials = driverName !== 'Unassigned' ? driverName.split(' ').map((s: string) => s[0]).slice(0,2).join('') : 'DR'

  if (loading) {
    return (
      <div className="w-[30%] bg-white rounded-lg border border-slate-200 shadow-sm p-3 animate-pulse">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 rounded-lg bg-slate-200"></div>
          <div className="flex-1">
            <div className="h-3 bg-slate-200 rounded w-3/4 mb-1"></div>
            <div className="h-2 bg-slate-200 rounded w-1/2"></div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={cn(
      "w-[30%] rounded-xl p-3 bg-white/30 backdrop-blur-md border border-white/10 shadow-lg transition-transform duration-200 hover:scale-[1.02] hover:shadow-2xl",
      trip.unauthorized_stops_count > 0 && trip.status?.toLowerCase() !== 'delivered'
        ? isFlashing
          ? "ring-2 ring-red-400 animate-pulse"
          : "ring-1 ring-red-300"
        : "border-slate-200/30"
    )}>
      {/* Top accent */}
      <div className="h-1 w-full rounded-full bg-gradient-to-r from-blue-400 via-blue-400  to-indigo-500 mb-3 opacity-90" />

      <div className="flex items-center gap-2 mb-2">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-semibold text-white"
          style={{
            background: "linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)",
            boxShadow: "0 6px 18px rgba(59,130,246,0.18)"
          }}
        >
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-xs font-semibold text-slate-900 truncate">{typeof driverInfo?.surname === 'string' ? driverInfo.surname : String(driverInfo?.surname || 'Unassigned')}</div>
          <div className="text-xs text-slate-600">{driverInfo ? driverInfo.phone_number : 'No driver assigned'}</div>
        </div>
        <div className="flex-shrink-0">
          <span className={cn(
            "px-1.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wide",
            driverInfo?.available ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
          )}>
            {driverInfo?.available ? 'Available' : 'Unavailable'}
          </span>
        </div>
      </div>

      {/* Rate Information */}
      {trip.rate && (
        <div className="mb-2 p-2 rounded-lg bg-white/20 border border-white/5">
          <div className="flex items-center gap-1 mb-1">
            <div className="w-1.5 h-1.5 bg-green-500 rounded-full" />
            <span className="text-xs font-medium text-slate-700 uppercase">Rate</span>
          </div>
          <div className="text-xs font-medium text-green-600">
            R{parseFloat(trip.rate).toLocaleString()}
          </div>
        </div>
      )}

      {/* Unauthorized Stop Alert */}
      {trip.unauthorized_stops_count > 0 && trip.status?.toLowerCase() !== 'delivered' && (
        <div className="mb-3 p-3 rounded-lg bg-red-50/70 border border-red-200/40 backdrop-blur-sm">
          <div className="flex items-start gap-2">
            <div className="flex-shrink-0">
              <AlertTriangle className="w-4 h-4 text-red-600" />
            </div>
            <div className="flex-1">
              <div className="text-xs font-semibold text-red-800 uppercase">Unauthorized Stop Alert</div>
              <div className="text-sm font-medium text-red-900">
                {trip.unauthorized_stops_count} unauthorized stop{trip.unauthorized_stops_count > 1 ? 's' : ''} detected
              </div>
              {trip.route_points && trip.route_points.length > 0 && (
                <div className="text-xs text-red-700 mt-1">
                  Last: {(() => {
                    const last = trip.route_points[trip.route_points.length - 1]
                    return last ? `${last.lat?.toFixed(4)}, ${last.lng?.toFixed(4)}` : 'Unknown'
                  })()}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="mb-2 p-2 rounded-lg bg-white/20 border border-white/5">
        <div className="flex items-center gap-1 mb-1">
          <div className="w-1.5 h-1.5 bg-slate-500 rounded-full" />
          <span className="text-xs font-medium text-slate-700 uppercase">Note</span>
        </div>
        <div className="text-xs text-slate-900">{trip.status_notes || 'No notes added'}</div>
      </div>

      <div className="mb-2 p-2 rounded-lg bg-white/20 border border-white/5">
        <div className="flex items-center gap-1 mb-1">
          <div className="w-1.5 h-1.5 bg-slate-500 rounded-full" />
          <span className="text-xs font-medium text-slate-700 uppercase">Vehicle</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-slate-900 truncate">
            {vehicleLocation?.plate || vehicleInfo?.registration_number || assignment?.vehicle?.name || 'Not assigned'}
          </span>
          <span className="text-xs text-slate-500">{vehicleLocation ? `${vehicleLocation.speed} km/h` : ''}</span>
        </div>
        {vehicleLocation && (
          <div className="mt-1 text-xs text-slate-600 truncate">
            {vehicleLocation.address}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Button
          size="sm"
          variant="link"
          className="h-8 text-xs border"
          onClick={async () => {
            // Use existing vehicle location or pass plate info for map to handle
            let matchedVehicleLocation = vehicleLocation;
            if (!matchedVehicleLocation && vehicleInfo?.registration_number) {
              // Create a placeholder with plate info for the map to handle
              matchedVehicleLocation = {
                plate: vehicleInfo.registration_number,
                needsLookup: true
              };
            }
            
            const tripData = {
              ...trip,
              vehicleInfo,
              driverInfo,
              vehicleLocation: matchedVehicleLocation
            };
            setCurrentTripForEdit(tripData);
            setEditTripOpen(true);
          }}
        >
          <FileText className="w-3 h-3" /> Edit
        </Button>

        <Button
          size="sm"
          variant="link"
          className="h-8 text-xs border"
          onClick={async () => {
            const supabase = createClient();
            let routeCoords = null;
            let stopPoints = [];
            let vehicleLocationData = vehicleLocation; // Use already fetched vehicle location

            // If no vehicle location was found during initialization, try one more time
            if (!vehicleLocationData && (vehicleInfo?.registration_number || driverName !== 'Unassigned')) {
              try {
                let vehicleData = null;
                
                // First try with vehicle plate
                if (vehicleInfo?.registration_number) {
                  console.log('Track button: Fetching vehicle location by plate:', vehicleInfo.registration_number);
                  const plateResponse = await fetch(`/api/eps-vehicles?endpoint=by-plate&plate=${encodeURIComponent(vehicleInfo.registration_number)}`);
                  if (plateResponse.ok) {
                    vehicleData = await plateResponse.json();
                    // Check if we got timeout/error response
                    if (vehicleData.error === 'Connection timeout') {
                      console.log('GPS service timeout - will show route only');
                      vehicleData = null;
                    }
                  }
                }
                
                // Fallback: try with driver name if plate fails
                if (!vehicleData && driverName && driverName !== 'Unassigned') {
                  console.log('Track button: Plate lookup failed, trying driver name:', driverName);
                  const driverResponse = await fetch(`/api/eps-vehicles?endpoint=by-driver&driver=${encodeURIComponent(driverName)}`);
                  if (driverResponse.ok) {
                    const driverData = await driverResponse.json();
                    if (driverData.error !== 'Connection timeout') {
                      vehicleData = driverData;
                    }
                  }
                }
                
                // Process vehicle data if found
                if (vehicleData && vehicleData.latitude && vehicleData.longitude) {
                  vehicleLocationData = {
                    latitude: parseFloat(vehicleData.latitude),
                    longitude: parseFloat(vehicleData.longitude),
                    plate: vehicleData.plate || vehicleInfo?.registration_number || 'Unknown',
                    speed: vehicleData.speed || 0,
                    address: vehicleData.address || 'GPS location available',
                    loc_time: vehicleData.loc_time || new Date().toISOString(),
                    mileage: vehicleData.mileage || 0,
                    geozone: vehicleData.geozone,
                    company: vehicleData.company || 'EPS'
                  };
                  console.log('Track button: Found external vehicle GPS data:', vehicleLocationData);
                }
              } catch (error) {
                console.log('Track button: External GPS lookup failed:', error.message);
              }
            }

            // Always generate preplanned route
            const pickupLocs = trip.pickup_locations || trip.pickuplocations || [];
            const dropoffLocs = trip.dropoff_locations || trip.dropofflocations || [];
            
            const pickup = pickupLocs[0]?.address || trip.origin;
            const dropoff = dropoffLocs[0]?.address || trip.destination;
            
            if (pickup && dropoff) {
              try {
                const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
                
                // Geocode pickup and dropoff addresses to coordinates
                const geocodeAddress = async (address) => {
                  const geocodeResponse = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json?access_token=${mapboxToken}&limit=1`);
                  const geocodeData = await geocodeResponse.json();
                  if (geocodeData.features && geocodeData.features[0]) {
                    return geocodeData.features[0].center; // [lng, lat]
                  }
                  return null;
                };
                
                const pickupCoords = await geocodeAddress(pickup);
                const dropoffCoords = await geocodeAddress(dropoff);
                
                if (!pickupCoords || !dropoffCoords) {
                  console.error('Failed to geocode addresses');
                  throw new Error('Geocoding failed');
                }
                
                let waypoints = `${pickupCoords[0]},${pickupCoords[1]};${dropoffCoords[0]},${dropoffCoords[1]}`;
                
                // Add stop points if available
                const selectedStopPoints = trip.selected_stop_points || trip.selectedstoppoints || [];
                if (selectedStopPoints.length > 0) {
                  const stopPointIds = selectedStopPoints.map(stop => typeof stop === 'object' ? stop.id : stop);
                  const { data: stopPointsData } = await supabase
                    .from('stop_points')
                    .select('coordinates')
                    .in('id', stopPointIds);
                  
                  const stopWaypoints = (stopPointsData || []).map(point => {
                    if (point.coordinates) {
                      const coords = point.coordinates.split(' ')[0].split(',');
                      return `${coords[0]},${coords[1]}`; // lng,lat
                    }
                  }).filter(Boolean);
                  
                  if (stopWaypoints.length > 0) {
                    waypoints = `${pickupCoords[0]},${pickupCoords[1]};${stopWaypoints.join(';')};${dropoffCoords[0]},${dropoffCoords[1]}`;
                  }
                }
                
                const response = await fetch(`https://api.mapbox.com/directions/v5/mapbox/driving/${waypoints}?access_token=${mapboxToken}&geometries=geojson&overview=full&exclude=ferry`);
                const routeData = await response.json();
                if (routeData.routes && routeData.routes[0]) {
                  routeCoords = routeData.routes[0].geometry.coordinates;
                  console.log('Generated preplanned route with', routeCoords.length, 'points');
                }
              } catch (error) {
                console.error('Error generating preplanned route:', error);
              }
            }
            
            // Fallback to stored route if generation fails
            if (!routeCoords && trip.route) {
              const { data: route } = await supabase
                .from('routes')
                .select('route_geometry, route_data')
                .eq('id', trip.route)
                .single();

              if (route) {
                if (route?.route_geometry?.coordinates) {
                  routeCoords = route.route_geometry.coordinates;
                } else if (route?.route_data?.geometry?.coordinates) {
                  routeCoords = route.route_data.geometry.coordinates;
                }
              }
            }
            
            // Generate best route if no route available
            if (!routeCoords && (pickup || dropoff || trip.origin || trip.destination)) {
              try {
                const origin = pickup || trip.origin;
                const destination = dropoff || trip.destination;
                
                if (origin && destination) {
                  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
                  
                  // Geocode addresses first
                  const geocodeAddress = async (address) => {
                    const geocodeResponse = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json?access_token=${mapboxToken}&limit=1`);
                    const geocodeData = await geocodeResponse.json();
                    if (geocodeData.features && geocodeData.features[0]) {
                      return geocodeData.features[0].center;
                    }
                    return null;
                  };
                  
                  const originCoords = await geocodeAddress(origin);
                  const destCoords = await geocodeAddress(destination);
                  
                  if (originCoords && destCoords) {
                    const response = await fetch(`https://api.mapbox.com/directions/v5/mapbox/driving/${originCoords[0]},${originCoords[1]};${destCoords[0]},${destCoords[1]}?access_token=${mapboxToken}&geometries=geojson&overview=full&alternatives=true`);
                    const routeData = await response.json();
                    if (routeData.routes && routeData.routes[0]) {
                      routeCoords = routeData.routes[0].geometry.coordinates;
                      console.log('Generated fallback route:', routeCoords.length, 'points');
                    }
                  }
                }
              } catch (error) {
                console.error('Error generating fallback route:', error);
              }
            }

            const selectedStopPoints = trip.selected_stop_points || trip.selectedstoppoints || [];
            if (selectedStopPoints.length > 0) {
              const stopPointIds = selectedStopPoints.map((stop: any) => typeof stop === 'object' ? stop.id : stop);
              const { data: stopPointsData } = await supabase
                .from('stop_points')
                .select('id, name, coordinates')
                .in('id', stopPointIds);

              stopPoints = (stopPointsData || []).map(point => {
                if (point.coordinates) {
                  const coordPairs = point.coordinates.split(' ')
                    .filter(coord => coord.trim())
                    .map(coord => {
                      const [lng, lat] = coord.split(',');
                      return [parseFloat(lng), parseFloat(lat)];
                    })
                    .filter(pair => !isNaN(pair[0]) && !isNaN(pair[1]));

                  if (coordPairs.length > 0) {
                    const avgLng = coordPairs.reduce((sum, coord) => sum + coord[0], 0) / coordPairs.length;
                    const avgLat = coordPairs.reduce((sum, coord) => sum + coord[1], 0) / coordPairs.length;
                    return {
                      name: point.name,
                      coordinates: [avgLng, avgLat],
                      polygon: coordPairs
                    };
                  }
                }
                return null;
              }).filter(Boolean);
            }

            // Fetch high risk zones
            let highRiskZones = [];
            try {
              const { data: riskZones } = await supabase
                .from('high_risk')
                .select('id, name, coordinates');
              
              highRiskZones = (riskZones || []).map(zone => {
                if (zone.coordinates) {
                  const coordPairs = zone.coordinates.split(' ')
                    .filter(coord => coord.trim())
                    .map(coord => {
                      const [lng, lat, z] = coord.split(',');
                      return [parseFloat(lng), parseFloat(lat)];
                    })
                    .filter(pair => !isNaN(pair[0]) && !isNaN(pair[1]));

                  if (coordPairs.length > 2) {
                    return {
                      name: zone.name,
                      polygon: coordPairs
                    };
                  }
                }
                return null;
              }).filter(Boolean);
            } catch (error) {
              console.error('Error fetching high risk zones:', error);
            }

            console.log('Final vehicle location data for map:', vehicleLocationData);
            console.log('Route coordinates for map:', routeCoords ? routeCoords.length : 'none');
            console.log('Stop points for map:', stopPoints.length);
            
            handleViewMap(driverName, { 
              ...trip, 
              vehicleLocation: vehicleLocationData, 
              routeCoords, 
              stopPoints, 
              highRiskZones 
            });
          }}
        >
          <MapPin className="w-3 h-3" /> Track
        </Button>

        <SecureButton
          page="dashboard"
          action="edit"
          size="sm"
          variant="link"
          className="h-8 text-xs border"
          onClick={() => {
            setCurrentTripForNote(trip);
            setNoteText(trip.status_notes || '');
            setNoteOpen(true);
          }}
        >
          <FileText className="w-3 h-3" /> Note
        </SecureButton>

        <SecureButton
          page="dashboard"
          action="edit"
          size="sm"
          variant="link"
          className="h-8 text-xs border"
          onClick={async () => {
            const supabase = createClient();
            const { data: drivers } = await supabase.from('drivers').select('*');
            setAvailableDrivers(drivers || []);
            setCurrentTripForChange(trip);
            setChangeDriverOpen(true);
          }}
        >
          <User className="w-3 h-3" /> Change
        </SecureButton>

        {userRole === 'admin' && (
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs border"
            onClick={() => {
              setCurrentTripForEdit({ ...trip, showHistoryOnly: true });
              setEditTripOpen(true);
            }}
          >
            <Clock className="w-3 h-3" /> History
          </Button>
        )}

        <SecureButton
          page="dashboard"
          action="delete"
          size="sm"
          variant="destructive"
          className="h-8 text-xs border"
          onClick={() => {
            setCurrentTripForClose(trip);
            setCloseReason('');
            setCloseTripOpen(true);
          }}
        >
          <X className="w-3 h-3" /> Close
        </SecureButton>
      </div>

      {/* Full-width Video Button */}
      <Button
        size="sm"
        variant="default"
        className="h-10 text-sm font-semibold w-full mt-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg hover:shadow-xl transition-all duration-200 border-0"
        onClick={() => {
          const driver = driverInfo 
            ? `${driverInfo.first_name || ''} ${driverInfo.surname || ''}`.trim() || 'Unassigned'
            : 'Unassigned';
          const vehicle = vehicleLocation?.plate || vehicleInfo?.registration_number || 'Vehicle Info Unavailable';
          
          router.push(`/video-feeds?driver=${encodeURIComponent(driver)}&vehicle=${encodeURIComponent(vehicle)}`);
        }}
      >
        <Video className="w-4 h-4 mr-2" />
        View Live Camera Feeds
      </Button>
    </div>
  )
}

// Enhanced routing components with proper waypoints
function RoutingSection({ userRole, handleViewMap, setCurrentTripForNote, setNoteText, setNoteOpen, setAvailableDrivers, setCurrentTripForChange, setChangeDriverOpen, refreshTrigger, setRefreshTrigger, setPickupTimeOpen, setDropoffTimeOpen, setCurrentTripForTime, setTimeType, setSelectedTime, currentUnauthorizedTrip, setCurrentUnauthorizedTrip, setUnauthorizedStopModalOpen, loadingPhotos, setLoadingPhotos, setCurrentTripPhotos, setPhotosModalOpen, setCurrentTripAlerts, setAlertsModalOpen, setCurrentTripForClose, setCloseReason, setCloseTripOpen, setCurrentTripForEdit, setEditTripOpen, setCurrentTripForApproval, setApprovalModalOpen, isVisible = true }: any) {
  const [trips, setTrips] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchTrips() {
      try {
        const supabase = createClient()
        const { data, error } = await supabase.from('trips').select('*')
        if (error) throw error
        setTrips(data || [])
        
        // Check for most recent unauthorized stop
        const recentUnauthorized = (data || [])
          .filter(trip => trip.unauthorized_stops_count > 0)
          .sort((a, b) => new Date(b.updated_at || 0).getTime() - new Date(a.updated_at || 0).getTime())[0]
        
        if (recentUnauthorized && !currentUnauthorizedTrip) {
          setCurrentUnauthorizedTrip(recentUnauthorized)
          // Removed automatic modal opening
        }
      } catch (err) {
        console.error('Error fetching trips:', err)
        setTrips([])
      } finally {
        setLoading(false)
      }
    }
    
    fetchTrips()
    
    // Real-time subscription
    const supabase = createClient()
    const channel = supabase
      .channel('trips-changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'trips' },
        () => fetchTrips()
      )
      .subscribe()
    
    return () => {
      supabase.removeChannel(channel)
    }
  }, [refreshTrigger])

  // Sort trips to put unauthorized stops at the top
  const tripsList = trips
    .filter(trip => trip.status?.toLowerCase() !== 'delivered' && trip.status?.toLowerCase() !== 'completed')
    .sort((a, b) => {
      // First sort by unauthorized stops (descending)
      const aUnauthorized = a.unauthorized_stops_count || 0
      const bUnauthorized = b.unauthorized_stops_count || 0
      if (aUnauthorized !== bUnauthorized) {
        return bUnauthorized - aUnauthorized
      }
      // Then by creation date (newest first)
      return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
    })

  const STATUS_OPTIONS = [
    { label: "Pending", value: "pending" },
    { label: "Accept", value: "accepted" },
    { label: "Reject", value: "rejected" },
    { label: "Arrived at Loading", value: "arrived-at-loading" },
    { label: "Staging Area", value: "staging-area" },
    { label: "Loading", value: "loading" },
    { label: "On Trip", value: "on-trip" },
    { label: "Completed", value: "completed" },
    { label: "Cancelled", value: "cancelled" },
    { label: "Stopped", value: "stopped" },
    { label: "Offloading", value: "offloading" },
    { label: "Weighing In/Out", value: "weighing" },
    { label: "Delivered", value: "delivered" },
  ]

  // Main workflow statuses for progress tracking
  const WORKFLOW_STATUSES = [
    { label: "Pending", value: "pending" },
    { label: "Accept", value: "accepted" },
    { label: "Arrived at Loading", value: "arrived-at-loading" },
    { label: "Staging Area", value: "staging-area" },
    { label: "Loading", value: "loading" },
    { label: "On Trip", value: "on-trip" },
    { label: "Offloading", value: "offloading" },
    { label: "Weighing In/Out", value: "weighing" },
    { label: "Depo", value: "depo" },
    { label: "Handover", value: "handover" },
    { label: "Delivered", value: "delivered" }
  ]

  const getWaypointsWithStops = (trip: any) => {
    const currentStatusIndex = WORKFLOW_STATUSES.findIndex(s => s.value === trip.status?.toLowerCase())
    const baseWaypoints = WORKFLOW_STATUSES.map((status, index) => ({
      position: (index / (WORKFLOW_STATUSES.length - 1)) * 100,
      label: status.label,
      completed: currentStatusIndex > index,
      current: currentStatusIndex === index,
      isStop: false
    }))

    // Insert stops between Loading (index 4) and On Trip (index 5)
    const stops = trip.selected_stop_points || trip.selectedstoppoints || []
    if (stops.length > 0) {
      const loadingPos = baseWaypoints[4].position
      const onTripPos = baseWaypoints[5].position
      const stopSpacing = (onTripPos - loadingPos) / (stops.length + 1)
      
      const stopWaypoints = stops.map((stop: any, index: number) => ({
        position: loadingPos + (stopSpacing * (index + 1)),
        label: `Stop ${index + 1}`,
        completed: currentStatusIndex > 4,
        current: false,
        isStop: true,
        stopId: stop
      }))
      
      // Adjust positions of waypoints after Loading
      const adjustedWaypoints = [...baseWaypoints]
      for (let i = 5; i < adjustedWaypoints.length; i++) {
        adjustedWaypoints[i].position = onTripPos + ((i - 5) / (WORKFLOW_STATUSES.length - 6)) * (100 - onTripPos)
      }
      
      return [...adjustedWaypoints.slice(0, 5), ...stopWaypoints, ...adjustedWaypoints.slice(5)]
    }
    
    return baseWaypoints
  }



  const getTripProgress = (status: string) => {
    const statusIndex = WORKFLOW_STATUSES.findIndex(s => s.value === status?.toLowerCase())
    if (statusIndex === -1) return 0
    return ((statusIndex + 1) / WORKFLOW_STATUSES.length) * 100
  }

  if (loading) {
    return <div className="text-center py-8">Loading trips...</div>
  }

  if (tripsList.length === 0) {
    return (
      <div className="space-y-4">
        <div className="text-center py-8 text-muted-foreground">
          No trips available in database
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {tripsList.map((trip: any) => {
        const waypoints = getWaypointsWithStops(trip)
        const progress = getTripProgress(trip.status)

        const clientDetails = typeof trip.clientdetails === 'string' ? JSON.parse(trip.clientdetails) : trip.clientdetails
        const title = clientDetails?.name || trip.selectedClient || trip.clientDetails?.name || `Trip ${trip.trip_id || trip.id}`
        const hasUnauthorizedStops = trip.unauthorized_stops_count > 0

        return (
          <div key={trip.id || trip.trip_id} className="flex gap-4 border-b-gray-500 border-b-2 pb-10">
            {/* Driver Card - 30% */}
            <DriverCard 
              trip={trip} 
              userRole={userRole}
              isVisible={isVisible}
              handleViewMap={handleViewMap}
              setCurrentTripForNote={setCurrentTripForNote}
              setNoteText={setNoteText}
              setNoteOpen={setNoteOpen}
              setAvailableDrivers={setAvailableDrivers}
              setCurrentTripForChange={setCurrentTripForChange}
              setChangeDriverOpen={setChangeDriverOpen}
              setCurrentTripForClose={setCurrentTripForClose}
              setCloseReason={setCloseReason}
              setCloseTripOpen={setCloseTripOpen}
              setCurrentTripForEdit={setCurrentTripForEdit}
              setEditTripOpen={setEditTripOpen}
              setCurrentTripForApproval={setCurrentTripForApproval}
              setApprovalModalOpen={setApprovalModalOpen}
            />
            {/* Trip Card - 70% */}
            <div className={cn(
              "w-[70%] rounded-xl p-3 bg-white shadow-sm border border-slate-200 transition-transform duration-200 hover:scale-[1.01] text-black",
              trip.unauthorized_stops_count > 0 && trip.status?.toLowerCase() !== 'delivered'
              ? "ring-2 ring-red-400"
              : "ring-0"
            )} style={{ backgroundImage: "linear-gradient(180deg, rgba(255,255,255,1), rgba(249,250,251,1))" }}>
              {/* Top accent */}
              <div className="h-1 w-full rounded-full bg-gradient-to-r from-blue-500 via-blue-400 to-blue-400 mb-3 opacity-100" />

              {/* Elevation Alert Banner */}
              {trip.elevate && (
                <div className="flex items-center justify-between p-2 mb-3 text-xs bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 rounded-lg">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-3 h-3 text-orange-600 flex-shrink-0" />
                    <span className="font-semibold text-orange-700 uppercase tracking-wide">Pending Approval</span>
                    <span className="text-orange-600">•</span>
                    <span className="text-orange-600">Requires management approval</span>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-6 px-2 text-xs border-orange-300 text-orange-700 hover:bg-orange-100"
                    onClick={() => {
                      setCurrentTripForApproval(trip);
                      setApprovalModalOpen(true);
                    }}
                  >
                    Review
                  </Button>
                </div>
              )}

              {/* Alert Banner */}
              {(() => {
                return ((trip.unauthorized_stops_count > 0 && trip.status?.toLowerCase() !== 'delivered') || 
                        (trip.alert_message && ((Array.isArray(trip.alert_message) && trip.alert_message.length > 0) || 
                         (typeof trip.alert_message === 'string' && trip.alert_message.trim() !== ''))));
              })() && (
              <div className="rounded-md p-2 mb-2 text-xs bg-red-50 border border-red-200">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-3 h-3 text-red-600 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    {(() => {
                      if (trip.alert_message) {
                        let latestAlert = null;
                        if (Array.isArray(trip.alert_message) && trip.alert_message.length > 0) {
                          latestAlert = trip.alert_message[trip.alert_message.length - 1];
                        } else if (typeof trip.alert_message === 'string' && trip.alert_message.trim() !== '') {
                          latestAlert = trip.alert_message;
                        }
                        
                        if (latestAlert) {
                          const message = typeof latestAlert === 'object' ? latestAlert.message : latestAlert;
                          const shortMessage = message.length > 60 ? message.substring(0, 60) + '...' : message;
                          return (
                            <div className="text-red-700 font-medium truncate">
                              {shortMessage}
                            </div>
                          );
                        }
                      }
                      
                      return (
                        <div className="text-red-700 font-medium">
                          Unauthorized Stop — {trip.unauthorized_stops_count} detected
                        </div>
                      );
                    })()
                    }
                  </div>
                  {trip.alert_message && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-5 px-2 text-xs border-red-300 text-red-700 hover:bg-red-100"
                      onClick={() => {
                        let alerts = [];
                        if (Array.isArray(trip.alert_message)) {
                          alerts = trip.alert_message;
                        } else if (typeof trip.alert_message === 'string' && trip.alert_message.trim() !== '') {
                          alerts = [trip.alert_message];
                        }
                        if (alerts.length > 0) {
                          setCurrentTripAlerts({ tripId: trip.trip_id || trip.id, alerts });
                          setAlertsModalOpen(true);
                        }
                      }}
                    >
                      View
                    </Button>
                  )}
                </div>
              </div>
              )}

              <div className="p-2">
              {/* Header Section */}
              <div className="flex items-start justify-between mb-2">
              <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
              <div className="w-7 h-7 bg-indigo-100 rounded-lg flex items-center justify-center border border-indigo-200">
              <Truck className="w-3 h-3 text-indigo-700" />
              </div>
              <div className="min-w-0">
              <h3 className="font-semibold text-black text-xs truncate">{title}</h3>
              <p className="text-xs text-gray-700">Trip #{trip.trip_id || trip.id}</p>
              </div>
              </div>
              </div>
              <div className="flex flex-col items-end">
              <span className={cn(
              "px-2 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wide",
              trip.status?.toLowerCase() === 'delivered' ? 'bg-emerald-100 text-emerald-800' :
              trip.status?.toLowerCase() === 'on-trip' ? 'bg-sky-100 text-sky-800' :
              ['pending', 'accepted'].includes(trip.status?.toLowerCase()) ? 'bg-amber-100 text-amber-800' :
              ['rejected', 'cancelled', 'stopped'].includes(trip.status?.toLowerCase()) ? 'bg-rose-100 text-rose-800' :
              ['completed', 'depo', 'handover'].includes(trip.status?.toLowerCase()) ? 'bg-lime-100 text-lime-800' :
              'bg-slate-100 text-slate-800'
              )}>
              {trip.status || 'Unknown'}
              </span>
              </div>
              </div>

              {/* Route Information */}
              <div className="grid grid-cols-2 gap-1 mb-2">
              <div className="bg-white rounded-lg p-1.5 border border-slate-100">
              <div className="flex items-center gap-1 mb-0.5">
              <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></div>
              <span className="text-xs font-medium text-gray-700 uppercase">Pickup</span>
              </div>
              <p className="text-xs font-medium text-black truncate">{trip.origin || 'Not specified'}</p>
              </div>
              <div className="bg-white rounded-lg p-1.5 border border-slate-100">
              <div className="flex items-center gap-1 mb-0.5">
              <div className="w-1.5 h-1.5 bg-red-500 rounded-full"></div>
              <span className="text-xs font-medium text-gray-700 uppercase">Drop-off</span>
              </div>
              <p className="text-xs font-medium text-black truncate">{trip.destination || 'Not specified'}</p>
              </div>
              </div>

              {/* Enhanced Timeline */}
              <div className="mb-3">
              <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-semibold text-black">Trip Progress</h4>
              <span className="text-xs text-gray-700">{Math.round(progress)}% Complete</span>
              </div>
              <div className="relative">
              <div className="flex justify-between items-center">
              {waypoints.map((waypoint, index) => (
              <div key={index} className="flex flex-col items-center relative z-10 group">
              <div className={cn(
              "w-7 h-7 rounded-full border-2 flex items-center justify-center text-xs font-bold transition-all duration-300",
              waypoint.isStop ? "bg-orange-500 border-orange-600 text-white" :
              waypoint.current ? "bg-blue-500 border-blue-700 text-white" :
              waypoint.completed ? "bg-emerald-600 border-emerald-700 text-white" :
              "bg-slate-100 border-slate-200 text-slate-600"
              )}>
              {waypoint.isStop ? (
                <MapPin className="w-3 h-3" />
              ) : waypoint.completed ? (
                <CheckCircle className="w-3 h-3" />
              ) : waypoint.current ? (
                <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
              ) : (
                index + 1
              )}
              </div>
              <span className={cn(
              "text-xs mt-1 text-center max-w-12 leading-tight",
              waypoint.isStop ? "text-orange-600 font-medium" :
              waypoint.current ? "text-sky-700 font-semibold" :
              waypoint.completed ? "text-emerald-700 font-medium" :
              "text-gray-600"
              )}>
              {waypoint.label.split(' ')[0]}
              </span>
              {waypoint.isStop && (
              <div className="absolute bottom-full mb-1 px-2 py-1 bg-white border rounded text-xs text-gray-700 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-20">
                {typeof waypoint.stopId === 'object' ? waypoint.stopId.name : waypoint.stopId}
              </div>
              )}
              </div>
              ))}
              </div>
              <div className="absolute top-3 left-3 right-3 h-1 bg-slate-100 -z-0 rounded">
              <div 
              className="h-full rounded bg-gradient-to-r from-blue-500 via-sky-500 to-blue-400 transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
              />
              </div>
              </div>
              </div>

              {/* Cargo Information */}
              {trip.cargo && (
              <div className="bg-white rounded-lg p-2 mb-3 border border-slate-100">
              <div className="flex items-center gap-1 mb-1">
              <div className="w-1.5 h-1.5 bg-slate-400 rounded-full"></div>
              <span className="text-xs font-medium text-gray-700 uppercase">Cargo</span>
              </div>
              <p className="text-sm font-medium text-black">
              {trip.cargo}{trip.cargo_weight && ` (${trip.cargo_weight})`}
              </p>
              </div>
              )}



              {/* Time Information */}
              {(() => {
              const pickupTime = trip.pickup_locations?.[0]?.scheduled_time || trip.pickuplocations?.[0]?.scheduled_time;
              const dropoffTime = trip.dropoff_locations?.[0]?.scheduled_time || trip.dropofflocations?.[0]?.scheduled_time;
              return (pickupTime || dropoffTime) && (
              <div className="bg-white rounded p-2 mb-2 border border-slate-100">
              <div className="flex items-center gap-1 mb-1">
              <Clock className="w-3 h-3 text-sky-500" />
              <span className="text-xs font-medium text-gray-700">Schedule</span>
              </div>
              <div className="space-y-1">
              {pickupTime && (
              <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1">
                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></div>
                <span className="font-medium text-gray-800">Pickup</span>
              </div>
              <span className="font-semibold text-black">
                {new Date(pickupTime).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} {new Date(pickupTime).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
              </span>
              </div>
              )}
              {dropoffTime && (
              <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1">
                <div className="w-1.5 h-1.5 bg-red-500 rounded-full"></div>
                <span className="font-medium text-gray-800">Drop-off</span>
              </div>
              <span className="font-semibold text-black">
                {new Date(dropoffTime).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} {new Date(dropoffTime).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
              </span>
              </div>
              )}
              </div>
              </div>
              );
              })()}

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-2 mt-1">
              <SecureButton 
              page="dashboard"
              action="edit"
              size="sm" 
              variant="outline" 
              className="h-8 text-xs"
              onClick={() => {
              setCurrentTripForTime(trip);
              setTimeType('pickup');
              const pickupLocs = trip.pickup_locations || trip.pickuplocations || [];
              setSelectedTime(pickupLocs[0]?.scheduled_time || '');
              setPickupTimeOpen(true);
              }}
              >
              <Clock className="w-3 h-3 mr-1" />
              {(trip.pickup_locations?.[0]?.scheduled_time || trip.pickuplocations?.[0]?.scheduled_time) ? 'Update Pickup' : 'Set Pickup'}
              </SecureButton>
              <SecureButton 
              page="dashboard"
              action="edit"
              size="sm" 
              variant="outline" 
              className="h-8 text-xs"
              onClick={() => {
              setCurrentTripForTime(trip);
              setTimeType('dropoff');
              const dropoffLocs = trip.dropoff_locations || trip.dropofflocations || [];
              setSelectedTime(dropoffLocs[0]?.scheduled_time || '');
              setDropoffTimeOpen(true);
              }}
              >
              <Clock className="w-3 h-3 mr-1" />
              {(trip.dropoff_locations?.[0]?.scheduled_time || trip.dropofflocations?.[0]?.scheduled_time) ? 'Update Drop-off' : 'Set Drop-off'}
              </SecureButton>
              <Button 
              size="sm"
              variant="link"
              className="h-8 text-xs ml-auto border border-gray-300"
              onClick={async () => {
              setLoadingPhotos(true);
              try {
              const supabase = createClient();
              const tripId = trip.id || trip.trip_id;
              
              // Fetch photos from both folders
              const { data: beforePhotos } = await supabase.storage
              .from('trip-photos')
              .list(`${tripId}/loadBefore`);
              
              const { data: duringPhotos } = await supabase.storage
              .from('trip-photos')
              .list(`${tripId}/loadDuring`);
              
              // Get Supabase URL and construct direct URLs
              const supabaseUrl = supabase.supabaseUrl;
              
              const beforeUrls = beforePhotos?.filter(item => item.name && !item.name.endsWith('/'))
              .map(photo => ({
              url: `${supabaseUrl}/storage/v1/object/public/trip-photos/${tripId}/loadBefore/${photo.name}`,
              name: photo.name
              })) || [];
              
              const duringUrls = duringPhotos?.filter(item => item.name && !item.name.endsWith('/'))
              .map(photo => ({
              url: `${supabaseUrl}/storage/v1/object/public/trip-photos/${tripId}/loadDuring/${photo.name}`,
              name: photo.name
              })) || [];
              
              console.log('Generated URLs:', { beforeUrls, duringUrls });
              
              setCurrentTripPhotos({ 
              tripId, 
              before: beforeUrls, 
              during: duringUrls 
              });
              setPhotosModalOpen(true);
              } catch (err) {
              console.error('Failed to load photos:', err);
              alert('Failed to load photos');
              } finally {
              setLoadingPhotos(false);
              }
              }}
              disabled={loadingPhotos}
              >
              <FileText className="w-3 h-3 mr-1" />
              {loadingPhotos ? 'Loading...' : 'View Loading Pictures'}
              </Button>
              </div>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// Trip Reports Section Component
function TripReportsSection() {
  const [completedTrips, setCompletedTrips] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedTrip, setExpandedTrip] = useState<string | null>(null)

  useEffect(() => {
    async function fetchCompletedTrips() {
      try {
        const supabase = createClient()
        const { data, error } = await supabase
          .from('trips')
          .select('*')
          .not('status', 'eq', 'pending')
          .order('updated_at', { ascending: false })
        
        if (error) throw error
        setCompletedTrips(data || [])
      } catch (err) {
        console.error('Error fetching completed trips:', err)
      } finally {
        setLoading(false)
      }
    }
    
    fetchCompletedTrips()
  }, [])

  const getTimingStatus = (scheduledTime: string, actualTime: string) => {
    if (!scheduledTime || !actualTime) return 'Unknown'
    
    const scheduled = new Date(scheduledTime)
    const actual = new Date(actualTime)
    const diffMinutes = (actual.getTime() - scheduled.getTime()) / (1000 * 60)
    
    if (diffMinutes <= -15) return 'Early'
    if (diffMinutes >= 15) return 'Late'
    return 'On Time'
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Early': return 'text-blue-700 bg-blue-50'
      case 'Late': return 'text-red-700 bg-red-50'
      case 'On Time': return 'text-green-700 bg-green-50'
      default: return 'text-gray-700 bg-gray-50'
    }
  }

  if (loading) {
    return <div className="text-center py-8">Loading trip reports...</div>
  }

  return (
    <div className="space-y-4">
      <div className="mb-4">
        <h2 className="text-3xl font-bold tracking-tight">Trip Reports</h2>
        <p className="text-muted-foreground">Performance analysis for active, completed and delivered trips</p>
      </div>

      <div className="space-y-3">
        {completedTrips.map((trip) => {
          const clientDetails = typeof trip.clientdetails === 'string' ? JSON.parse(trip.clientdetails) : trip.clientdetails
          const pickupLocations = trip.pickup_locations || trip.pickuplocations || []
          const dropoffLocations = trip.dropoff_locations || trip.dropofflocations || []
          
          const scheduledPickup = pickupLocations[0]?.scheduled_time
          const scheduledDropoff = dropoffLocations[0]?.scheduled_time
          const actualStart = trip.actual_start_time
          const actualEnd = trip.actual_end_time
          
          const startStatus = getTimingStatus(scheduledPickup, actualStart)
          const arrivalStatus = getTimingStatus(scheduledDropoff, actualEnd)
          
          // Check if trip is late based on estimated arrival
          const estimatedArrival = trip.dropoff_locations?.[0]?.scheduled_time || trip.dropofflocations?.[0]?.scheduled_time
          const isLate = estimatedArrival && !actualEnd && new Date() > new Date(estimatedArrival)
          const displayArrivalStatus = isLate ? 'Late' : arrivalStatus
          
          // Check for unauthorized stops in alert_message
          let unauthorizedStops = trip.unauthorized_stops_count || 0
          if (trip.alert_message && Array.isArray(trip.alert_message)) {
            const unauthorizedAlerts = trip.alert_message.filter(alert => 
              typeof alert === 'object' && alert.type && 
              alert.type.toLowerCase().includes('unauthorized')
            )
            unauthorizedStops = Math.max(unauthorizedStops, unauthorizedAlerts.length)
          }
          
          const isExpanded = expandedTrip === trip.id
          
          return (
            <Card key={trip.id} className="border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
              <CardHeader 
                className="cursor-pointer hover:bg-slate-50 transition-colors"
                onClick={() => setExpandedTrip(isExpanded ? null : trip.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center">
                      <Truck className="w-5 h-5 text-slate-600" />
                    </div>
                    <div>
                      <CardTitle className="text-lg font-semibold text-slate-900">
                        {clientDetails?.name || 'Unknown Client'} - Trip #{trip.trip_id || trip.id}
                      </CardTitle>
                      <p className="text-sm text-slate-600">
                        {trip.origin} → {trip.destination}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={cn('px-2 py-1 text-xs font-medium', 
                      trip.status === 'delivered' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'
                    )}>
                      {trip.status}
                    </Badge>
                    {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 w-4" />}
                  </div>
                </div>
              </CardHeader>
              
              {isExpanded && (
                <CardContent className="pt-0">
                  <div className="bg-slate-50 rounded-lg p-4">
                    <h4 className="font-semibold text-slate-900 mb-4">Trip Performance Analysis</h4>
                    
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-slate-100">
                            <TableHead className="font-semibold text-slate-700">Metric</TableHead>
                            <TableHead className="font-semibold text-slate-700">Scheduled</TableHead>
                            <TableHead className="font-semibold text-slate-700">Actual</TableHead>
                            <TableHead className="font-semibold text-slate-700">Status</TableHead>
                            <TableHead className="font-semibold text-slate-700">Notes</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          <TableRow className="hover:bg-slate-50">
                            <TableCell className="font-medium text-slate-900">Trip Start</TableCell>
                            <TableCell className="text-slate-600">
                              {scheduledPickup ? new Date(scheduledPickup).toLocaleString() : 'Not scheduled'}
                            </TableCell>
                            <TableCell className="text-slate-600">
                              {actualStart ? new Date(actualStart).toLocaleString() : 'Not recorded'}
                            </TableCell>
                            <TableCell>
                              <Badge className={cn('px-2 py-1 text-xs font-medium', getStatusColor(startStatus))}>
                                {startStatus}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-slate-600">
                              {scheduledPickup && actualStart ? (() => {
                                const diffMinutes = Math.abs(Math.round((new Date(actualStart).getTime() - new Date(scheduledPickup).getTime()) / (1000 * 60)))
                                const hours = Math.floor(diffMinutes / 60)
                                const minutes = diffMinutes % 60
                                return hours > 0 ? `${hours}h ${minutes}m difference` : `${minutes}m difference`
                              })() : 'No timing data'}
                            </TableCell>
                          </TableRow>
                          
                          <TableRow className="hover:bg-slate-50">
                            <TableCell className="font-medium text-slate-900">Trip Arrival</TableCell>
                            <TableCell className="text-slate-600">
                              {scheduledDropoff ? new Date(scheduledDropoff).toLocaleString() : 'Not scheduled'}
                            </TableCell>
                            <TableCell className="text-slate-600">
                              {actualEnd ? new Date(actualEnd).toLocaleString() : 'Not recorded'}
                            </TableCell>
                            <TableCell>
                              <Badge className={cn('px-2 py-1 text-xs font-medium', getStatusColor(displayArrivalStatus))}>
                                {displayArrivalStatus}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-slate-600">
                              {scheduledDropoff && actualEnd ? (() => {
                                const diffMinutes = Math.abs(Math.round((new Date(actualEnd).getTime() - new Date(scheduledDropoff).getTime()) / (1000 * 60)))
                                const hours = Math.floor(diffMinutes / 60)
                                const minutes = diffMinutes % 60
                                return hours > 0 ? `${hours}h ${minutes}m difference` : `${minutes}m difference`
                              })() : 'No timing data'}
                            </TableCell>
                          </TableRow>
                          
                          <TableRow className="hover:bg-slate-50">
                            <TableCell className="font-medium text-slate-900">Unauthorized Stops</TableCell>
                            <TableCell className="text-slate-600">0 expected</TableCell>
                            <TableCell className="text-slate-600">{unauthorizedStops} detected</TableCell>
                            <TableCell>
                              <Badge className={cn('px-2 py-1 text-xs font-medium', 
                                unauthorizedStops === 0 ? 'text-green-700 bg-green-50' : 'text-red-700 bg-red-50'
                              )}>
                                {unauthorizedStops === 0 ? 'Compliant' : 'Non-Compliant'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-slate-600">
                              {unauthorizedStops > 0 ? `${unauthorizedStops} unauthorized stop(s)` : 'No violations'}
                            </TableCell>
                          </TableRow>
                          
                          <TableRow className="hover:bg-slate-50">
                            <TableCell className="font-medium text-slate-900">Distance</TableCell>
                            <TableCell className="text-slate-600">
                              {trip.estimated_distance ? `${trip.estimated_distance} km` : 'Not estimated'}
                            </TableCell>
                            <TableCell className="text-slate-600">
                              {trip.total_distance ? `${trip.total_distance} km` : 'Not recorded'}
                            </TableCell>
                            <TableCell>
                              <Badge className="px-2 py-1 text-xs font-medium text-blue-700 bg-blue-50">
                                Completed
                              </Badge>
                            </TableCell>
                            <TableCell className="text-slate-600">
                              {trip.estimated_distance && trip.total_distance ? 
                                `${Math.round(((trip.total_distance - trip.estimated_distance) / trip.estimated_distance) * 100)}% variance` : 
                                'No comparison data'
                              }
                            </TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </div>
                    
                    <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {/* Timing Performance */}
                      <Card className="border-0 shadow-sm">
                        <CardHeader className="pb-3">
                          <CardTitle className="text-base font-semibold flex items-center gap-2">
                            <Clock className="w-4 h-4 text-blue-600" />
                            Timing Performance
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-4">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium text-slate-600">Trip Start</span>
                              <div className="flex items-center gap-2">
                                <div className={cn("w-3 h-3 rounded-full", 
                                  startStatus === 'On Time' ? 'bg-emerald-500' : 
                                  startStatus === 'Early' ? 'bg-blue-500' : 'bg-red-500'
                                )} />
                                <span className={cn("text-sm font-semibold",
                                  startStatus === 'On Time' ? 'text-emerald-700' : 
                                  startStatus === 'Early' ? 'text-blue-700' : 'text-red-700'
                                )}>{startStatus}</span>
                              </div>
                            </div>
                            <div className="w-full bg-slate-100 rounded-full h-2">
                              <div className={cn("h-2 rounded-full transition-all duration-500",
                                startStatus === 'On Time' ? 'bg-emerald-500 w-full' : 
                                startStatus === 'Early' ? 'bg-blue-500 w-4/5' : 'bg-red-500 w-1/3'
                              )} />
                            </div>
                            
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium text-slate-600">Trip Arrival</span>
                              <div className="flex items-center gap-2">
                                <div className={cn("w-3 h-3 rounded-full", 
                                  displayArrivalStatus === 'On Time' ? 'bg-emerald-500' : 
                                  displayArrivalStatus === 'Early' ? 'bg-blue-500' : 'bg-red-500'
                                )} />
                                <span className={cn("text-sm font-semibold",
                                  displayArrivalStatus === 'On Time' ? 'text-emerald-700' : 
                                  displayArrivalStatus === 'Early' ? 'text-blue-700' : 'text-red-700'
                                )}>{displayArrivalStatus}</span>
                              </div>
                            </div>
                            <div className="w-full bg-slate-100 rounded-full h-2">
                              <div className={cn("h-2 rounded-full transition-all duration-500",
                                displayArrivalStatus === 'On Time' ? 'bg-emerald-500 w-full' : 
                                displayArrivalStatus === 'Early' ? 'bg-blue-500 w-4/5' : 'bg-red-500 w-1/3'
                              )} />
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      {/* Route Compliance */}
                      <Card className="border-0 shadow-sm">
                        <CardHeader className="pb-3">
                          <CardTitle className="text-base font-semibold flex items-center gap-2">
                            <CheckCircle className="w-4 h-4 text-emerald-600" />
                            Route Compliance
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="flex items-center justify-center mb-4">
                            <div className="relative w-32 h-32">
                              <div className="absolute inset-0 rounded-full border-8 border-slate-100" />
                              <div className={cn("absolute inset-0 rounded-full border-8 border-t-8 transition-all duration-1000",
                                unauthorizedStops === 0 ? 'border-emerald-500 rotate-0' : 'border-red-500',
                                unauthorizedStops === 0 ? 'border-t-emerald-500' : 'border-t-red-500'
                              )} style={{
                                transform: `rotate(${unauthorizedStops === 0 ? '360deg' : '90deg'})`
                              }} />
                              <div className="absolute inset-0 flex items-center justify-center">
                                <div className="text-center">
                                  <div className={cn("text-2xl font-bold",
                                    unauthorizedStops === 0 ? 'text-emerald-600' : 'text-red-600'
                                  )}>
                                    {unauthorizedStops === 0 ? '100%' : '0%'}
                                  </div>
                                  <div className="text-xs text-slate-500">Compliant</div>
                                </div>
                              </div>
                            </div>
                          </div>
                          <div className="space-y-2">
                            <div className="flex items-center justify-between text-sm">
                              <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-emerald-500" />
                                <span className="text-slate-600">Compliant Route</span>
                              </div>
                              <span className="font-semibold text-emerald-700">
                                {unauthorizedStops === 0 ? '✓' : '✗'}
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                              <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-red-500" />
                                <span className="text-slate-600">Violations</span>
                              </div>
                              <span className="font-semibold text-red-700">
                                {unauthorizedStops}
                              </span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    {trip.notes && (
                      <div className="mt-4 p-3 bg-white rounded border border-slate-200">
                        <h5 className="font-medium text-slate-900 mb-2">Trip Notes</h5>
                        <p className="text-sm text-slate-600">{trip.notes}</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              )}
            </Card>
          )
        })}
        
        {completedTrips.length === 0 && (
          <div className="text-center py-12 text-slate-500">
            <Truck className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium mb-2">No trips found</p>
            <p className="text-sm">Trip reports will appear here for active and completed trips</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<string>("video-alerts");
  const [auditData, setAuditData] = useState<any[]>([]);
  const [auditLoading, setAuditLoading] = useState(true);
  const [userRole, setUserRole] = useState<string>("");
  const [mapOpen, setMapOpen] = useState(false);
  const [mapData, setMapData] = useState<any>(null);
  const [noteOpen, setNoteOpen] = useState(false);
  const [currentTripForNote, setCurrentTripForNote] = useState<any>(null);
  const [noteText, setNoteText] = useState('');
  const [changeDriverOpen, setChangeDriverOpen] = useState(false);
  const [currentTripForChange, setCurrentTripForChange] = useState<any>(null);
  const [availableDrivers, setAvailableDrivers] = useState<any[]>([]);
  const [allVehicles, setAllVehicles] = useState<any[]>([]);
  const [driverSearchTerm, setDriverSearchTerm] = useState('');
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [pickupTimeOpen, setPickupTimeOpen] = useState(false);
  const [dropoffTimeOpen, setDropoffTimeOpen] = useState(false);
  const [currentTripForTime, setCurrentTripForTime] = useState<any>(null);
  const [timeType, setTimeType] = useState<'pickup' | 'dropoff'>('pickup');
  const [selectedTime, setSelectedTime] = useState('');
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [selectedTrip, setSelectedTrip] = useState(null);
  const [tripDetailsOpen, setTripDetailsOpen] = useState(false);
  const [unauthorizedStopModalOpen, setUnauthorizedStopModalOpen] = useState(false);
  const [currentUnauthorizedTrip, setCurrentUnauthorizedTrip] = useState<any>(null);
  const [unauthorizedStopNote, setUnauthorizedStopNote] = useState('');
  const [photosModalOpen, setPhotosModalOpen] = useState(false);
  const [currentTripPhotos, setCurrentTripPhotos] = useState<any>(null);
  const [loadingPhotos, setLoadingPhotos] = useState(false);
  const [trips, setTrips] = useState<any[]>([]);
  const [alertsModalOpen, setAlertsModalOpen] = useState(false);
  const [currentTripAlerts, setCurrentTripAlerts] = useState<any>(null);
  const [closeTripOpen, setCloseTripOpen] = useState(false);
  const [currentTripForClose, setCurrentTripForClose] = useState<any>(null);
  const [closeReason, setCloseReason] = useState('');
  const [editTripOpen, setEditTripOpen] = useState(false);
  const [currentTripForEdit, setCurrentTripForEdit] = useState<any>(null);
  const [approvalModalOpen, setApprovalModalOpen] = useState(false);
  const [currentTripForApproval, setCurrentTripForApproval] = useState<any>(null);
  const [videoModalOpen, setVideoModalOpen] = useState(false);
  const [currentTripForVideo, setCurrentTripForVideo] = useState<any>(null);
  useEffect(() => {
    const getCookie = (name: string) => {
      const value = `; ${document.cookie}`;
      const parts = value.split(`; ${name}=`);
      if (parts.length === 2) return parts.pop()?.split(";").shift();
      return null;
    };
    const role = decodeURIComponent(getCookie("role") || "");
    setUserRole(role);
  }, []);

  // Fetch trips for alerts
  useEffect(() => {
    async function fetchTrips() {
      try {
        const supabase = createClient();
        const { data, error } = await supabase.from('trips').select('*');
        if (error) throw error;
        setTrips(data || []);
      } catch (err) {
        console.error('Error fetching trips:', err);
      }
    }
    fetchTrips();
  }, []);

  const handleViewMap = async (driverName: string, trip?: any) => {
    // Fetch high risk zones
    let highRiskZones = [];
    try {
      const supabase = createClient();
      const { data: riskZones } = await supabase
        .from('high_risk')
        .select('id, name, coordinates');
      
      highRiskZones = (riskZones || []).map(zone => {
        if (zone.coordinates) {
          const coordPairs = zone.coordinates.split(' ')
            .filter(coord => coord.trim())
            .map(coord => {
              const [lng, lat, z] = coord.split(',');
              return [parseFloat(lng), parseFloat(lat)];
            })
            .filter(pair => !isNaN(pair[0]) && !isNaN(pair[1]));

          if (coordPairs.length > 2) {
            return {
              name: zone.name,
              polygon: coordPairs
            };
          }
        }
        return null;
      }).filter(Boolean);
    } catch (error) {
      console.error('Error fetching high risk zones:', error);
    }

    if (trip?.vehicleLocation && trip.vehicleLocation.latitude && trip.vehicleLocation.longitude) {
      const vehicleData = {
        ...trip.vehicleLocation,
        trip,
        routeCoordinates: trip.routeCoords,
        stopPoints: trip.stopPoints,
        highRiskZones,
        driverDetails: {
          fullName: driverName,
          plate: trip.vehicleLocation.plate,
          speed: trip.vehicleLocation.speed,
          mileage: trip.vehicleLocation.mileage,
          address: trip.vehicleLocation.address,
          geozone: trip.vehicleLocation.geozone,
          company: trip.vehicleLocation.company,
          lastUpdate: trip.vehicleLocation.loc_time
        }
      };
      setMapData(vehicleData);
      setMapOpen(true);
    } else if (trip?.vehicleLocation) {
      const vehicleData = {
        ...trip.vehicleLocation,
        latitude: trip.vehicleLocation.latitude,
        longitude: trip.vehicleLocation.longitude,
        highRiskZones,
        driverDetails: {
          fullName: driverName,
          plate: trip.vehicleLocation.plate,
          speed: trip.vehicleLocation.speed,
          mileage: trip.vehicleLocation.mileage,
          address: trip.vehicleLocation.address,
          geozone: trip.vehicleLocation.geozone,
          company: trip.vehicleLocation.company,
          lastUpdate: trip.vehicleLocation.loc_time
        }
      };
      setMapData(vehicleData);
      setMapOpen(true);
    } else if (trip.routeCoords && trip.routeCoords.length > 0) {
      // Show pre-planned route when no vehicle coordinates available
      const routeOnlyData = {
        routeCoordinates: trip.routeCoords,
        stopPoints: trip.stopPoints,
        highRiskZones,
        showRouteOnly: true,
        driverDetails: {
          fullName: driverName,
          plate: 'No vehicle data',
          speed: 0,
          address: 'Location unavailable'
        }
      };
      setMapData(routeOnlyData);
      setMapOpen(true);
    } else if (trip?.origin || trip?.destination) {
      const basicMapData = {
        showBasicRoute: true,
        origin: trip.origin,
        destination: trip.destination,
        highRiskZones,
        driverDetails: {
          fullName: driverName,
          plate: trip.vehicleInfo?.registration_number || 'Unknown vehicle',
          speed: 0,
          address: 'No GPS data - showing trip route'
        }
      };
      console.log('Opening map with basic route:', basicMapData);
      setMapData(basicMapData);
      setMapOpen(true);
    } else {
      alert(`No location, route, or trip data available for ${driverName}. Please ensure the trip has origin/destination or GPS tracking is enabled.`);
    }
  };

  useEffect(() => {
    async function fetchAuditData() {
      try {
        const supabase = createClient()
        const { data: auditTrips, error } = await supabase
          .from('audit')
          .select('*')
          .ilike('status', 'delivered')
        if (error) throw error
        
        const formattedData = (auditTrips || []).map(trip => {
          const clientDetails = typeof trip.clientdetails === 'string' ? JSON.parse(trip.clientdetails) : trip.clientdetails
          return {
            id: trip.id,
            client: clientDetails?.name || 'Unknown Client',
            commodity: trip.cargo || 'N/A',
            rate: trip.rate || 'N/A',
            pickup: trip.origin || 'N/A',
            dropOff: trip.destination || 'N/A',
            status: trip.status || 'Unknown'
          }
        })
        setAuditData(formattedData)
      } catch (err) {
        console.error('Error fetching audit data:', err)
      } finally {
        setAuditLoading(false)
      }
    }
    
    if (activeTab === 'audit') {
      fetchAuditData()
    }
  }, [activeTab])

  // Full-page map view with overlay tabs
  if (activeTab === "live-map") {
    return (
      <>
        <div className="absolute inset-0 -m-6 z-0">
          <LiveMapView />
        </div>
        
        {/* Overlay Tabs */}
        <div className="relative z-10 mb-4">
          <Tabs
            value={activeTab}
            onValueChange={(v) => setActiveTab(v)}
            className="w-full"
          >
            <TabsList className="flex w-fit items-center rounded-lg bg-white/90 backdrop-blur-sm p-1 shadow-lg">
              <TabsTrigger
                value="routing"
                className="px-6 py-2 text-sm font-medium rounded-md data-[state=active]:bg-white data-[state=active]:shadow-sm"
              >
                Trip Routing
              </TabsTrigger>
              <TabsTrigger
                value="video-alerts"
                className="px-6 py-2 text-sm font-medium rounded-md data-[state=active]:bg-white data-[state=active]:shadow-sm"
              >
                Video Alerts
              </TabsTrigger>
              <TabsTrigger
                value="live-map"
                className="px-6 py-2 text-sm font-medium rounded-md data-[state=active]:bg-white data-[state=active]:shadow-sm"
              >
                Live Map
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="flex-1 space-y-4 p-4 pt-6">
        {/* Top Tabs Navigation */}
        {/* <div className="flex items-center justify-between">
          <Tabs
            value={activeTab}
            onValueChange={(v) => setActiveTab(v)}
            className="w-full"
          >
            <TabsList className="flex w-fit items-center rounded-full bg-white/80 dark:bg-slate-800 p-1.5 shadow-lg ring-1 ring-slate-200 dark:ring-slate-700">
              <TabsTrigger
                value="routing"
                className="px-4 py-2 text-sm font-medium rounded-full data-[state=active]:bg-primary data-[state=active]:text-white hover:brightness-95"
              >
                Routing
              </TabsTrigger>
              <TabsTrigger
                value="financials"
                className="px-4 py-2 text-sm font-medium rounded-full data-[state=active]:bg-primary data-[state=active]:text-white hover:brightness-95"
              >
                Financials
              </TabsTrigger>
              <TabsTrigger
                value="audit"
                className="px-4 py-2 text-sm font-medium rounded-full data-[state=active]:bg-primary data-[state=active]:text-white hover:brightness-95"
              >
                Audit
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div> */}



        {/* Top Tabs Navigation */}
        <div className="flex items-center justify-between mb-6">
          <Tabs
            value={activeTab}
            onValueChange={(v) => setActiveTab(v)}
            className="w-full"
          >
            <TabsList className="flex w-fit items-center rounded-lg bg-slate-100 p-1 shadow-sm">
              <TabsTrigger
                value="video-alerts"
                className="px-6 py-2 text-sm font-medium rounded-md data-[state=active]:bg-white data-[state=active]:shadow-sm"
              >
                Video Alerts
              </TabsTrigger>
              <TabsTrigger
                value="reports"
                className="px-6 py-2 text-sm font-medium rounded-md data-[state=active]:bg-white data-[state=active]:shadow-sm"
              >
                Reports
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Conditionally render the main views */}
        {activeTab === "routing" && (
          <div className="space-y-4">
            <div className="mb-4 flex justify-between items-center">
              <div>
                <h2 className="text-3xl font-bold tracking-tight">Trip Management</h2>
                <p className="text-muted-foreground">Monitor all trips with progress tracking and waypoints</p>
              </div>
            </div>
            <RoutingSection 
              userRole={userRole}
              isVisible={activeTab === "routing"}
              handleViewMap={handleViewMap}
              setCurrentTripForNote={setCurrentTripForNote}
              setNoteText={setNoteText}
              setNoteOpen={setNoteOpen}
              setAvailableDrivers={setAvailableDrivers}
              setCurrentTripForChange={setCurrentTripForChange}
              setChangeDriverOpen={setChangeDriverOpen}
              refreshTrigger={refreshTrigger}
              setRefreshTrigger={setRefreshTrigger}
              setPickupTimeOpen={setPickupTimeOpen}
              setDropoffTimeOpen={setDropoffTimeOpen}
              setCurrentTripForTime={setCurrentTripForTime}
              setTimeType={setTimeType}
              setSelectedTime={setSelectedTime}
              currentUnauthorizedTrip={currentUnauthorizedTrip}
              setCurrentUnauthorizedTrip={setCurrentUnauthorizedTrip}
              setUnauthorizedStopModalOpen={setUnauthorizedStopModalOpen}
              loadingPhotos={loadingPhotos}
              setLoadingPhotos={setLoadingPhotos}
              setCurrentTripPhotos={setCurrentTripPhotos}
              setPhotosModalOpen={setPhotosModalOpen}
              setCurrentTripAlerts={setCurrentTripAlerts}
              setAlertsModalOpen={setAlertsModalOpen}
              setCurrentTripForClose={setCurrentTripForClose}
              setCloseReason={setCloseReason}
              setCloseTripOpen={setCloseTripOpen}
              setCurrentTripForEdit={setCurrentTripForEdit}
              setEditTripOpen={setEditTripOpen}
              setCurrentTripForApproval={setCurrentTripForApproval}
              setApprovalModalOpen={setApprovalModalOpen}
            />
          </div>
        )}

        {activeTab === "video-alerts" && (
          <VideoAlertsDashboardTab />
        )}

        {activeTab === "reports" && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">NCR Reports</h2>
                <p className="text-sm text-slate-600 mt-1">Non-Conformance Reports for speeding violations</p>
              </div>
            </div>
            <ReportsContent />
          </div>
        )}

        {activeTab === "financials" && (
          <div className="space-y-4">
            <div className="mb-4">
              <h2 className="text-3xl font-bold tracking-tight">Financials</h2>
              <p className="text-muted-foreground">Track revenue, expenses, and financial performance</p>
            </div>
            <FinancialsPanel />
          </div>
        )}

        {activeTab === "audit" && (
          <div className="space-y-4">
            <div className="mb-4 flex justify-between items-center">
              <div>
                <h2 className="text-3xl font-bold tracking-tight">Audit</h2>
                <p className="text-muted-foreground">Transportation audit logs and history</p>
              </div>
              <Dialog.Root>
                <Dialog.Trigger asChild>
                  <Button variant="outline" className="flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    Summary
                  </Button>
                </Dialog.Trigger>
                <Dialog.Portal>
                  <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50" />
                  <Dialog.Content className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white rounded-lg shadow-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto z-50">
                    <div className="p-6">
                      <div className="flex items-center justify-between mb-6">
                        <Dialog.Title className="text-2xl font-bold">Audit Summary</Dialog.Title>
                        <Dialog.Close asChild>
                          <Button variant="ghost" size="sm">
                            <X className="h-4 w-4" />
                          </Button>
                        </Dialog.Close>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                        <Card>
                          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Total Trips</CardTitle>
                            <Truck className="h-4 w-4 text-muted-foreground" />
                          </CardHeader>
                          <CardContent>
                            <div className="text-2xl font-bold">{auditData.length}</div>
                            <p className="text-xs text-muted-foreground">
                              {auditData.filter(r => r.status?.toLowerCase() === 'delivered').length} delivered
                            </p>
                          </CardContent>
                        </Card>

                        <Card>
                          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
                            <DollarSign className="h-4 w-4 text-muted-foreground" />
                          </CardHeader>
                          <CardContent>
                            <div className="text-2xl font-bold">
                              R{auditData.reduce((sum, record) => {
                                const rate = parseFloat(record.rate?.toString().replace(/[^0-9.-]/g, '') || '0')
                                return sum + rate
                              }, 0).toLocaleString('en-ZA')}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              Avg: R{auditData.length > 0 ? (auditData.reduce((sum, record) => {
                                const rate = parseFloat(record.rate?.toString().replace(/[^0-9.-]/g, '') || '0')
                                return sum + rate
                              }, 0) / auditData.length).toLocaleString('en-ZA') : '0'} per trip
                            </p>
                          </CardContent>
                        </Card>

                        <Card>
                          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Clients Served</CardTitle>
                            <Users className="h-4 w-4 text-muted-foreground" />
                          </CardHeader>
                          <CardContent>
                            <div className="text-2xl font-bold">
                              {new Set(auditData.map(r => r.client)).size}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              Unique clients
                            </p>
                          </CardContent>
                        </Card>

                        <Card>
                          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Completion Rate</CardTitle>
                            <CheckCircle className="h-4 w-4 text-muted-foreground" />
                          </CardHeader>
                          <CardContent>
                            <div className="text-2xl font-bold">
                              {auditData.length > 0 ? Math.round((auditData.filter(r => r.status?.toLowerCase() === 'delivered').length / auditData.length) * 100) : 0}%
                            </div>
                            <p className="text-xs text-muted-foreground">
                              Delivered trips
                            </p>
                          </CardContent>
                        </Card>
                      </div>

                      <div className="space-y-4">
                        <h3 className="text-lg font-semibold">Top Clients by Revenue</h3>
                        <div className="space-y-2">
                          {Object.entries(
                            auditData.reduce((acc, record) => {
                              const client = record.client
                              const rate = parseFloat(record.rate?.toString().replace(/[^0-9.-]/g, '') || '0')
                              acc[client] = (acc[client] || 0) + rate
                              return acc
                            }, {})
                          )
                          .sort(([,a], [,b]) => b - a)
                          .slice(0, 5)
                          .map(([client, revenue]) => (
                            <div key={client} className="flex justify-between items-center p-3 bg-gray-50 rounded">
                              <span className="font-medium">{client}</span>
                              <span className="text-green-600 font-semibold">R{revenue.toLocaleString('en-ZA')}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </Dialog.Content>
                </Dialog.Portal>
              </Dialog.Root>
            </div>
            <Card className="rounded-2xl shadow-md">
              <CardHeader>
                <CardTitle className="text-lg font-semibold">Audit Table</CardTitle>
                <CardDescription>Transportation audit logs and history</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-blue-100">
                        <TableHead>Client</TableHead>
                        <TableHead>Cargo</TableHead>
                        <TableHead>Rate</TableHead>
                        <TableHead>Pickup Point</TableHead>
                        <TableHead>Drop Off Point</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {auditLoading ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-8">
                            Loading audit data...
                          </TableCell>
                        </TableRow>
                      ) : auditData.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                            No trips found
                          </TableCell>
                        </TableRow>
                      ) : auditData.map((row) => (
                        <TableRow 
                          key={row.id} 
                          className="hover:bg-muted/50 cursor-pointer" 
                          onClick={async () => {
                            try {
                              const supabase = createClient()
                              const { data: tripData, error } = await supabase
                                .from('audit')
                                .select('*')
                                .eq('id', row.id)
                                .single()
                              
                              if (error) throw error
                              setSelectedTrip(tripData)
                              setTripDetailsOpen(true)
                            } catch (error) {
                              console.error('Error fetching trip details:', error)
                            }
                          }}
                        >
                          <TableCell className="font-medium">{row.client}</TableCell>
                          <TableCell>{row.commodity}</TableCell>
                          <TableCell>{row.rate}</TableCell>
                          <TableCell className="max-w-32 truncate" title={row.pickup}>{row.pickup}</TableCell>
                          <TableCell className="max-w-32 truncate" title={row.dropOff}>{row.dropOff}</TableCell>
                          <TableCell>
                            <span className={cn(
                              "px-3 py-1 rounded-full text-xs font-medium",
                              row.status?.toLowerCase() === "delivered" || row.status?.toLowerCase() === "complete" ? "bg-green-100 text-green-800" :
                              row.status?.toLowerCase() === "on trip" || row.status?.toLowerCase() === "in transit" ? "bg-blue-100 text-blue-800" :
                              row.status?.toLowerCase() === "pending" ? "bg-yellow-100 text-yellow-800" :
                              "bg-gray-100 text-gray-800"
                            )}>
                              {row.status}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      <EditTripModal
        isOpen={editTripOpen}
        onClose={() => {
          setEditTripOpen(false)
          setCurrentTripForEdit(null)
        }}
        trip={currentTripForEdit}
        onUpdate={() => {
          setRefreshTrigger(prev => prev + 1)
        }}
      />

      {/* Change Driver Modal */}
      {changeDriverOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-md">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold">Change Driver</h3>
              <Button variant="ghost" size="sm" onClick={() => {
                setChangeDriverOpen(false);
                setDriverSearchTerm('');
              }}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="p-4">
              <div className="mb-4">
                <p className="text-sm text-gray-600 mb-2">Current Trip: {currentTripForChange?.trip_id || currentTripForChange?.id}</p>
                <p className="text-sm text-gray-600 mb-2">Select a new driver:</p>
                <input
                  type="text"
                  placeholder="Search by surname..."
                  value={driverSearchTerm}
                  onChange={(e) => setDriverSearchTerm(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="max-h-64 overflow-y-auto space-y-2">
                {availableDrivers
                  .filter(driver => 
                    driver.surname?.toLowerCase().includes(driverSearchTerm.toLowerCase()) ||
                    driver.first_name?.toLowerCase().includes(driverSearchTerm.toLowerCase())
                  )
                  .map((driver) => (
                  <div
                    key={driver.id}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 cursor-pointer"
                    onClick={async () => {
                      if (!confirm(`Assign ${driver.first_name} ${driver.surname} to this trip?`)) return;
                      try {
                        const supabase = createClient();
                        const currentAssignments = currentTripForChange.vehicleassignments || currentTripForChange.vehicle_assignments || [];
                        const updatedAssignments = currentAssignments.map(assignment => ({
                          ...assignment,
                          drivers: [{ id: driver.id, name: `${driver.first_name} ${driver.surname}` }]
                        }));
                        
                        const { error } = await supabase
                          .from('trips')
                          .update({ 
                            vehicleassignments: updatedAssignments,
                            vehicle_assignments: updatedAssignments 
                          })
                          .eq('id', currentTripForChange.id);
                        
                        if (error) throw error;
                        alert('Driver changed successfully');
                        setChangeDriverOpen(false);
                        setRefreshTrigger(prev => prev + 1);
                      } catch (err) {
                        console.error('Failed to change driver:', err);
                        alert('Failed to change driver');
                      }
                    }}
                  >
                    <div>
                      <div className="font-medium">{driver.first_name} {driver.surname}</div>
                      <div className="text-sm text-gray-500">{driver.phone_number}</div>
                    </div>
                    <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                      driver.available ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {driver.available ? 'Available' : 'Busy'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Time Setting Modal */}
      {(pickupTimeOpen || dropoffTimeOpen) && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-md">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold">
                Set {timeType === 'pickup' ? 'Pickup' : 'Drop-off'} Time
              </h3>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => {
                  setPickupTimeOpen(false);
                  setDropoffTimeOpen(false);
                  setSelectedTime('');
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <p className="text-sm text-gray-600 mb-2">
                  Trip: {currentTripForTime?.trip_id || currentTripForTime?.id}
                </p>
                <p className="text-sm text-gray-600 mb-4">
                  Select {timeType === 'pickup' ? 'pickup' : 'drop-off'} date and time:
                </p>
                <DateTimePicker
                  value={selectedTime}
                  onChange={setSelectedTime}
                  placeholder={`Select ${timeType} time`}
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setPickupTimeOpen(false);
                    setDropoffTimeOpen(false);
                    setSelectedTime('');
                  }}
                >
                  Cancel
                </Button>
                {selectedTime && (
                  <Button 
                    variant="destructive" 
                    onClick={async () => {
                      try {
                        const supabase = createClient();
                        const field = timeType === 'pickup' ? 'pickup_locations' : 'dropoff_locations';
                        const locations = currentTripForTime[field] || currentTripForTime[field.replace('_', '')] || [];
                        
                        const updatedLocations = locations.length > 0 
                          ? locations.map((loc, index) => index === 0 ? { ...loc, scheduled_time: null } : loc)
                          : [];
                        
                        const { error } = await supabase
                          .from('trips')
                          .update({ [field]: updatedLocations })
                          .eq('id', currentTripForTime.id);
                        
                        if (error) throw error;
                        
                        alert(`${timeType === 'pickup' ? 'Pickup' : 'Drop-off'} time removed successfully`);
                        setPickupTimeOpen(false);
                        setDropoffTimeOpen(false);
                        setSelectedTime('');
                        setRefreshTrigger(prev => prev + 1);
                      } catch (err) {
                        console.error(`Failed to remove ${timeType} time:`, err);
                        alert(`Failed to remove ${timeType} time`);
                      }
                    }}
                  >
                    Remove
                  </Button>
                )}
                <Button 
                  onClick={async () => {
                    if (!selectedTime) {
                      alert('Please select a time');
                      return;
                    }
                    try {
                      const supabase = createClient();
                      const field = timeType === 'pickup' ? 'pickup_locations' : 'dropoff_locations';
                      const locations = currentTripForTime[field] || currentTripForTime[field.replace('_', '')] || [];
                      
                      const updatedLocations = locations.length > 0 
                        ? locations.map((loc, index) => index === 0 ? { ...loc, scheduled_time: selectedTime } : loc)
                        : [{ scheduled_time: selectedTime }];
                      
                      const { error } = await supabase
                        .from('trips')
                        .update({ [field]: updatedLocations })
                        .eq('id', currentTripForTime.id);
                      
                      if (error) throw error;
                      
                      alert(`${timeType === 'pickup' ? 'Pickup' : 'Drop-off'} time set successfully`);
                      setPickupTimeOpen(false);
                      setDropoffTimeOpen(false);
                      setSelectedTime('');
                      setRefreshTrigger(prev => prev + 1);
                    } catch (err) {
                      console.error(`Failed to set ${timeType} time:`, err);
                      alert(`Failed to set ${timeType} time`);
                    }
                  }}
                >
                  Save Time
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Map Modal */}
      {mapOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-7xl h-full max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b flex-shrink-0">
              <h3 className="text-lg font-semibold">Driver Location</h3>
              <Button variant="ghost" size="sm" onClick={() => setMapOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex flex-col lg:flex-row gap-4 p-4 flex-1 min-h-0">
              {/* Render Map First - Priority Loading */}
              <div className="flex-1 min-h-0 order-1 lg:order-2">
                <div 
                  id="driver-map" 
                  className="w-full h-full min-h-[400px] rounded border bg-slate-100"
                  ref={(el) => {
                    if (el && mapData) {
                      // Show loading state
                      el.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#64748b;font-size:14px;"><div>Loading map...</div></div>';
                      
                      // Load map immediately with priority
                      const loadMap = () => {
                        const script = document.createElement('script');
                        script.src = 'https://api.mapbox.com/mapbox-gl-js/v2.15.0/mapbox-gl.js';
                        script.async = true;
                        script.onload = () => {
                          const link = document.createElement('link');
                          link.href = 'https://api.mapbox.com/mapbox-gl-js/v2.15.0/mapbox-gl.css';
                          link.rel = 'stylesheet';
                          document.head.appendChild(link);
                          
                          // Clear loading state
                          el.innerHTML = '';
                          
                          if (window.mapboxgl) {
                            window.mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
                            const map = new window.mapboxgl.Map({
                              container: el,
                              style: 'mapbox://styles/mapbox/streets-v12',
                              center: mapData.longitude && mapData.latitude ? 
                                [parseFloat(mapData.longitude), parseFloat(mapData.latitude)] : 
                                [28.0473, -26.2041],
                              zoom: mapData.showBasicRoute ? 10 : 15,
                              preserveDrawingBuffer: true,
                              attributionControl: false
                            });
                            
                            map.on('load', () => {
                            let vehicleMarker = null
                            
                            // Prioritize vehicle marker for immediate visibility
                            if (!mapData.showRouteOnly && !mapData.showBasicRoute && mapData.longitude && mapData.latitude) {
                              const vehicleEl = document.createElement('div')
                              vehicleEl.innerHTML = '🚛'
                              vehicleEl.style.cssText = `
                                font-size: 24px; width: 32px; height: 32px;
                                display: flex; align-items: center; justify-content: center;
                                background: #3b82f6; border: 3px solid #fff;
                                border-radius: 50%; box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                              `
                              
                              vehicleMarker = new window.mapboxgl.Marker(vehicleEl)
                                .setLngLat([parseFloat(mapData.longitude), parseFloat(mapData.latitude)])
                                .addTo(map)
                            }
                            
                            // Load additional features after map is visible
                            requestAnimationFrame(() => {
                              // Add high risk zones
                              if (mapData.highRiskZones && mapData.highRiskZones.length > 0) {
                                mapData.highRiskZones.forEach((area, index) => {
                                if (!area.polygon || area.polygon.length < 3) return;
                                
                                const sourceId = `risk-zone-${index}`;
                                
                                if (!map.getSource(sourceId)) {
                                  map.addSource(sourceId, {
                                    type: 'geojson',
                                    data: {
                                      type: 'Feature',
                                      properties: { name: area.name },
                                      geometry: {
                                        type: 'Polygon',
                                        coordinates: [area.polygon]
                                      }
                                    }
                                  });
                                  
                                  map.addLayer({
                                    id: `${sourceId}-fill`,
                                    type: 'fill',
                                    source: sourceId,
                                    paint: {
                                      'fill-color': '#ef4444',
                                      'fill-opacity': 0.5
                                    }
                                  });
                                  
                                  map.addLayer({
                                    id: `${sourceId}-border`,
                                    type: 'line',
                                    source: sourceId,
                                    paint: {
                                      'line-color': '#dc2626',
                                      'line-width': 3
                                    }
                                  });
                                  console.log('Added risk zone:', sourceId);
                                }
                              });
                            }

                            // Add route coordinates if available
                            if (mapData.routeCoordinates && mapData.routeCoordinates.length > 1) {
                              console.log('Adding route with', mapData.routeCoordinates.length, 'coordinates');
                              
                              try {
                                map.addSource('route', {
                                  type: 'geojson',
                                  data: {
                                    type: 'Feature',
                                    properties: {},
                                    geometry: {
                                      type: 'LineString',
                                      coordinates: mapData.routeCoordinates
                                    }
                                  }
                                });
                                
                                map.addLayer({
                                  id: 'route',
                                  type: 'line',
                                  source: 'route',
                                  layout: {
                                    'line-join': 'round',
                                    'line-cap': 'round'
                                  },
                                  paint: {
                                    'line-color': '#ef4444',
                                    'line-width': 4
                                  }
                                });
                                
                                // Add markers
                                new window.mapboxgl.Marker({ color: 'green' })
                                  .setLngLat(mapData.routeCoordinates[0])
                                  .addTo(map);
                                  
                                new window.mapboxgl.Marker({ color: 'red' })
                                  .setLngLat(mapData.routeCoordinates[mapData.routeCoordinates.length - 1])
                                  .addTo(map);
                                  
                                console.log('Route added successfully');
                              } catch (error) {
                                console.error('Error adding route:', error);
                              }
                              


                              // Add stop points if available
                              if (mapData.stopPoints && mapData.stopPoints.length > 0) {
                                mapData.stopPoints.forEach((stopPoint, index) => {
                                  // Add polygon if coordinates available
                                  if (stopPoint.polygon && stopPoint.polygon.length > 2) {
                                    map.addSource(`stop-polygon-${index}`, {
                                      type: 'geojson',
                                      data: {
                                        type: 'Feature',
                                        properties: { name: stopPoint.name },
                                        geometry: {
                                          type: 'Polygon',
                                          coordinates: [stopPoint.polygon]
                                        }
                                      }
                                    });
                                    
                                    map.addLayer({
                                      id: `stop-polygon-fill-${index}`,
                                      type: 'fill',
                                      source: `stop-polygon-${index}`,
                                      paint: {
                                        'fill-color': '#fbbf24',
                                        'fill-opacity': 0.3
                                      }
                                    });
                                    
                                    map.addLayer({
                                      id: `stop-polygon-outline-${index}`,
                                      type: 'line',
                                      source: `stop-polygon-${index}`,
                                      paint: {
                                        'line-color': '#f59e0b',
                                        'line-width': 2
                                      }
                                    });
                                  }
                                  
                                  // Add center marker
                                  const stopEl = document.createElement('div');
                                  stopEl.innerHTML = '🛑';
                                  stopEl.style.fontSize = '20px';
                                  
                                  const marker = new window.mapboxgl.Marker(stopEl)
                                    .setLngLat(stopPoint.coordinates)
                                    .addTo(map);
                                  
                                  const popup = new window.mapboxgl.Popup({ offset: 25 })
                                    .setHTML(`<div class="p-2"><strong>Stop Point ${index + 1}</strong><br/>${stopPoint.name}</div>`);
                                  marker.setPopup(popup);
                                });
                              }
                              
                              // Fit map to route
                              const bounds = new window.mapboxgl.LngLatBounds();
                              mapData.routeCoordinates.forEach(coord => bounds.extend(coord));
                              
                              if (!mapData.showRouteOnly && mapData.longitude && mapData.latitude) {
                                bounds.extend([parseFloat(mapData.longitude), parseFloat(mapData.latitude)]);
                              }
                              
                              map.fitBounds(bounds, { padding: 50 });
                            } else {
                              console.log('No route coordinates available');
                            }
                            
                            // Add popup with driver details if vehicle marker exists
                            if (mapData.driverDetails && vehicleMarker) {
                              const popup = new window.mapboxgl.Popup({ offset: 25 })
                                .setHTML(`
                                  <div class="p-3">
                                    <div class="font-bold text-blue-900 mb-2">${mapData.driverDetails.fullName}</div>
                                    <div class="text-sm space-y-1">
                                      <div><strong>Vehicle:</strong> ${mapData.driverDetails.plate}</div>
                                      <div><strong>Speed:</strong> ${mapData.driverDetails.speed} km/h</div>
                                      <div><strong>Company:</strong> ${mapData.driverDetails.company || 'N/A'}</div>
                                      <div class="text-xs text-gray-600 mt-2">
                                        Last updated: ${new Date(mapData.driverDetails.lastUpdate).toLocaleTimeString()}
                                      </div>
                                    </div>
                                  </div>
                                `)
                              vehicleMarker.setPopup(popup)
                            } else if (mapData.showRouteOnly) {
                              // Add a text overlay for route-only view
                              const routeInfo = document.createElement('div')
                              routeInfo.className = 'mapboxgl-ctrl mapboxgl-ctrl-group'
                              routeInfo.style.cssText = 'position: absolute; top: 10px; left: 10px; background: white; padding: 10px; border-radius: 4px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);'
                              routeInfo.innerHTML = `
                                <div class="text-sm">
                                  <div class="font-bold text-blue-900 mb-1">${mapData.driverDetails.fullName}</div>
                                  <div class="text-gray-600">Pre-planned route</div>
                                  <div class="text-xs text-gray-500 mt-1">Vehicle location unavailable</div>
                                </div>
                              `
                              map.getContainer().appendChild(routeInfo)
                            } else if (mapData.showBasicRoute && (mapData.origin || mapData.destination)) {
                              // Handle basic route from origin to destination
                              const routeInfo = document.createElement('div')
                              routeInfo.className = 'mapboxgl-ctrl mapboxgl-ctrl-group'
                              routeInfo.style.cssText = 'position: absolute; top: 10px; left: 10px; background: white; padding: 10px; border-radius: 4px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);'
                              routeInfo.innerHTML = `
                                <div class="text-sm">
                                  <div class="font-bold text-blue-900 mb-1">${mapData.driverDetails.fullName}</div>
                                  <div class="text-gray-600">Trip Route</div>
                                  <div class="text-xs text-gray-500 mt-1">No GPS tracking available</div>
                                </div>
                              `
                              map.getContainer().appendChild(routeInfo)
                              
                              // Generate route between origin and destination
                              if (mapData.origin && mapData.destination) {
                                fetch(`https://api.mapbox.com/directions/v5/mapbox/driving/${encodeURIComponent(mapData.origin)};${encodeURIComponent(mapData.destination)}?access_token=${process.env.NEXT_PUBLIC_MAPBOX_TOKEN}&geometries=geojson&overview=full`)
                                  .then(response => response.json())
                                  .then(data => {
                                    if (data.routes && data.routes[0]) {
                                      const routeCoords = data.routes[0].geometry.coordinates
                                      
                                      map.addSource('basic-route', {
                                        type: 'geojson',
                                        data: {
                                          type: 'Feature',
                                          properties: {},
                                          geometry: {
                                            type: 'LineString',
                                            coordinates: routeCoords
                                          }
                                        }
                                      })
                                      
                                      map.addLayer({
                                        id: 'basic-route',
                                        type: 'line',
                                        source: 'basic-route',
                                        layout: {
                                          'line-join': 'round',
                                          'line-cap': 'round'
                                        },
                                        paint: {
                                          'line-color': '#3b82f6',
                                          'line-width': 4
                                        }
                                      })
                                      
                                      // Add markers for origin and destination
                                      new window.mapboxgl.Marker({ color: 'green' })
                                        .setLngLat(routeCoords[0])
                                        .setPopup(new window.mapboxgl.Popup().setHTML(`<div class="p-2"><strong>Origin</strong><br/>${mapData.origin}</div>`))
                                        .addTo(map)
                                        
                                      new window.mapboxgl.Marker({ color: 'red' })
                                        .setLngLat(routeCoords[routeCoords.length - 1])
                                        .setPopup(new window.mapboxgl.Popup().setHTML(`<div class="p-2"><strong>Destination</strong><br/>${mapData.destination}</div>`))
                                        .addTo(map)
                                      
                                      // Fit map to route
                                      const bounds = new window.mapboxgl.LngLatBounds()
                                      routeCoords.forEach(coord => bounds.extend(coord))
                                      map.fitBounds(bounds, { padding: 50 })
                                    }
                                  })
                                  .catch(error => console.error('Error generating basic route:', error))
                              }
                            }
                            });  // Close requestAnimationFrame callback
                          });  // Close map.on('load')
                        }  // Close if (window.mapboxgl)
                      };  // Close script.onload
                      
                      // Check if mapbox is already loaded
                      if (!document.querySelector('script[src*="mapbox-gl.js"]')) {
                        document.head.appendChild(script);
                      } else if (window.mapboxgl) {
                        script.onload();
                      }
                    };  // Close loadMap
                    
                    // Use requestIdleCallback for non-critical script loading, or fallback to immediate
                    if ('requestIdleCallback' in window) {
                      requestIdleCallback(loadMap);
                    } else {
                      loadMap();
                    }
                  }
                }}
                />
              </div>
              
              {/* Driver Information Panel - Load After Map */}
              <div className="w-full lg:w-80 bg-gray-50 p-4 rounded-lg flex-shrink-0 max-h-64 lg:max-h-none overflow-y-auto order-2 lg:order-1">
                <h4 className="font-semibold mb-3">Driver Information</h4>
                {mapData?.driverDetails && (
                  <div className="space-y-3 text-sm">
                    <div className="bg-blue-50 p-3 rounded-lg">
                      <div className="font-medium text-blue-900">{mapData.driverDetails.fullName}</div>
                      <div className="text-blue-700 text-xs">Vehicle: {mapData.driverDetails.plate}</div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Speed:</span>
                        <span className="font-medium">{mapData.driverDetails.speed} km/h</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Mileage:</span>
                        <span className="font-medium">{parseFloat(mapData.driverDetails.mileage || 0).toLocaleString()} km</span>
                      </div>
                      <div className="text-xs text-gray-500">
                        <div className="font-medium mb-1">Current Location:</div>
                        <div>{mapData.driverDetails.address}</div>
                      </div>
                      {mapData.driverDetails.geozone && (
                        <div className="text-xs text-gray-500">
                          <div className="font-medium mb-1">Geozone:</div>
                          <div>{mapData.driverDetails.geozone}</div>
                        </div>
                      )}
                      <div className="text-xs text-gray-500">
                        <div className="font-medium mb-1">Last Update:</div>
                        <div>{new Date(mapData.driverDetails.lastUpdate).toLocaleString()}</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Trip Details Modal */}
      {tripDetailsOpen && selectedTrip && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-6xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b flex-shrink-0">
              <h3 className="text-lg font-semibold">Trip Summary - {selectedTrip.trip_id}</h3>
              <Button variant="ghost" size="sm" onClick={() => {
                setTripDetailsOpen(false)
                setSelectedTrip(null)
              }}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Trip Details</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Order #:</span>
                      <span className="font-medium">{selectedTrip.ordernumber || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Status:</span>
                      <Badge variant={selectedTrip.status === 'delivered' ? 'default' : 'secondary'}>
                        {selectedTrip.status}
                      </Badge>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Distance:</span>
                      <span className="font-medium">{selectedTrip.actual_distance?.toFixed(1) || 'N/A'} km</span>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Financial</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Rate:</span>
                      <span className="font-medium text-green-600">
                        {selectedTrip.rate ? `R${parseFloat(selectedTrip.rate).toLocaleString('en-ZA')}` : 'N/A'}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Total Cost:</span>
                      <span className="font-medium text-green-600">
                        R{selectedTrip.actual_total_cost?.toLocaleString('en-ZA', { minimumFractionDigits: 2 }) || 'N/A'}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Fuel Price:</span>
                      <span className="font-medium">R{selectedTrip.fuel_price_used || 'N/A'}</span>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Vehicle & Driver</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Vehicle Type:</span>
                      <span className="font-medium">{selectedTrip.vehicle_type || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Updated:</span>
                      <span className="font-medium">
                        {selectedTrip.updated_at ? new Date(selectedTrip.updated_at).toLocaleDateString('en-ZA') : 'N/A'}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Route Information</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <h4 className="font-medium text-sm text-gray-600">Origin</h4>
                      <p className="text-sm bg-green-50 p-2 rounded border-l-2 border-green-500">
                        {selectedTrip.origin || 'N/A'}
                      </p>
                    </div>
                    <div className="space-y-2">
                      <h4 className="font-medium text-sm text-gray-600">Destination</h4>
                      <p className="text-sm bg-red-50 p-2 rounded border-l-2 border-red-500">
                        {selectedTrip.destination || 'N/A'}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Client Information</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div>
                      <span className="text-sm font-medium text-gray-600">Client:</span>
                      <p className="text-sm font-medium">{selectedTrip.selectedclient || selectedTrip.selected_client || 'N/A'}</p>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Cargo Information</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div>
                      <span className="text-sm font-medium text-gray-600">Cargo Type:</span>
                      <p className="text-sm font-medium">{selectedTrip.cargo || 'N/A'}</p>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-gray-600">Weight:</span>
                      <p className="text-sm font-medium">{selectedTrip.cargo_weight || selectedTrip.cargoweight || 'N/A'}</p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {selectedTrip.notes && (
                <Card>
                  <CardHeader>
                    <CardTitle>Trip Notes</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm bg-blue-50 p-3 rounded">{selectedTrip.notes}</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Unauthorized Stop Note Modal */}
      {unauthorizedStopModalOpen && currentUnauthorizedTrip && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-md">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold text-red-800">Unauthorized Stop Detected</h3>
              <Button variant="ghost" size="sm" onClick={() => {
                setUnauthorizedStopModalOpen(false)
                setCurrentUnauthorizedTrip(null)
                setUnauthorizedStopNote('')
              }}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="p-4 space-y-4">
              <div className="bg-red-50 p-3 rounded border-l-4 border-red-500">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-4 h-4 text-red-600" />
                  <span className="font-medium text-red-800">Trip #{currentUnauthorizedTrip.trip_id || currentUnauthorizedTrip.id}</span>
                </div>
                <p className="text-sm text-red-700">
                  {currentUnauthorizedTrip.unauthorized_stops_count} unauthorized stop{currentUnauthorizedTrip.unauthorized_stops_count > 1 ? 's' : ''} detected
                </p>
                {(() => {
                  const routePoints = currentUnauthorizedTrip.route_points || []
                  const lastPoint = routePoints[routePoints.length - 1]
                  return lastPoint && (
                    <div className="mt-2 text-xs text-red-600">
                      <div>Last Location: {lastPoint.lat?.toFixed(6)}, {lastPoint.lng?.toFixed(6)}</div>
                      <div>Time: {new Date(lastPoint.datetime).toLocaleString()}</div>
                      <div>Speed: {lastPoint.speed} km/h</div>
                    </div>
                  )
                })()}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Add Note for Unauthorized Stop:
                </label>
                <textarea
                  value={unauthorizedStopNote}
                  onChange={(e) => setUnauthorizedStopNote(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                  rows={3}
                  placeholder="Enter details about the unauthorized stop..."
                />
              </div>
              
              <div className="flex gap-2 justify-end">
                <Button 
                  variant="outline" 
                  onClick={async () => {
                    try {
                      const supabase = createClient()
                      // Clear unauthorized stops count when dismissing
                      const { error } = await supabase
                        .from('trips')
                        .update({ unauthorized_stops_count: 0 })
                        .eq('id', currentUnauthorizedTrip.id)
                      
                      if (error) throw error
                      
                      setUnauthorizedStopModalOpen(false)
                      setCurrentUnauthorizedTrip(null)
                      setUnauthorizedStopNote('')
                      setRefreshTrigger(prev => prev + 1)
                    } catch (err) {
                      console.error('Failed to dismiss alert:', err)
                      alert('Failed to dismiss alert')
                    }
                  }}
                >
                  Dismiss
                </Button>
                <Button 
                  onClick={async () => {
                    try {
                      const supabase = createClient()
                      const noteToAdd = `[UNAUTHORIZED STOP] ${new Date().toLocaleString()}: ${unauthorizedStopNote}`
                      const existingNotes = currentUnauthorizedTrip.status_notes || ''
                      const updatedNotes = existingNotes ? `${existingNotes}\n${noteToAdd}` : noteToAdd
                      
                      // Clear unauthorized stops count when adding note
                      const { error } = await supabase
                        .from('trips')
                        .update({ 
                          status_notes: updatedNotes,
                          unauthorized_stops_count: 0
                        })
                        .eq('id', currentUnauthorizedTrip.id)
                      
                      if (error) throw error
                      
                      setUnauthorizedStopModalOpen(false)
                      setCurrentUnauthorizedTrip(null)
                      setUnauthorizedStopNote('')
                      setRefreshTrigger(prev => prev + 1)
                    } catch (err) {
                      console.error('Failed to add note:', err)
                      alert('Failed to add note')
                    }
                  }}
                >
                  Add Note
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Loading Photos Modal */}
      {photosModalOpen && currentTripPhotos && (
        <div className="fixed inset-0 bg-gray-900/80 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] overflow-hidden">
            <div className="bg-gray-50 border-b px-6 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">Loading Documentation</h2>
                  <p className="text-sm text-gray-600">Trip #{currentTripPhotos.tripId}</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => {
                  setPhotosModalOpen(false);
                  setCurrentTripPhotos(null);
                }}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
            
            <div className="overflow-y-auto max-h-[calc(90vh-80px)] bg-gray-50">
              {(currentTripPhotos.before.length > 0 || currentTripPhotos.during.length > 0) ? (
                <div className="grid grid-cols-1 lg:grid-cols-2">
                  <div className="p-6 border-r border-gray-200">
                    <div className="mb-4">
                      <h3 className="text-lg font-medium text-gray-900 mb-1">Before Loading</h3>
                      <p className="text-sm text-gray-500">{currentTripPhotos.before.length} photos</p>
                    </div>
                    {currentTripPhotos.before.length > 0 ? (
                      <div className="grid grid-cols-2 gap-4">
                        {currentTripPhotos.before.map((photo, index) => (
                          <div key={index} className="group cursor-pointer" onClick={() => window.open(photo.url, '_blank')}>
                            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
                              <img 
                                src={photo.url} 
                                alt={`Before ${index + 1}`}
                                className="w-full h-32 object-cover"
                              />
                              <div className="p-3">
                                <p className="text-xs text-gray-600 truncate">{photo.name}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-gray-500">
                        <p className="text-sm">No photos available</p>
                      </div>
                    )}
                  </div>
                  
                  <div className="p-6">
                    <div className="mb-4">
                      <h3 className="text-lg font-medium text-gray-900 mb-1">During Loading</h3>
                      <p className="text-sm text-gray-500">{currentTripPhotos.during.length} photos</p>
                    </div>
                    {currentTripPhotos.during.length > 0 ? (
                      <div className="grid grid-cols-2 gap-4">
                        {currentTripPhotos.during.map((photo, index) => (
                          <div key={index} className="group cursor-pointer" onClick={() => window.open(photo.url, '_blank')}>
                            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
                              <img 
                                src={photo.url} 
                                alt={`During ${index + 1}`}
                                className="w-full h-32 object-cover"
                              />
                              <div className="p-3">
                                <p className="text-xs text-gray-600 truncate">{photo.name}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-gray-500">
                        <p className="text-sm">No photos available</p>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-center py-16">
                  <div className="text-gray-400 mb-4">
                    <FileText className="w-12 h-12 mx-auto" />
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No Photos Available</h3>
                  <p className="text-gray-500">No loading documentation found for this trip.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Alerts Modal */}
      {alertsModalOpen && currentTripAlerts && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border-2 border-gray-200 w-full max-w-3xl max-h-[85vh] overflow-hidden">
            {/* Header */}
            <div className="px-4 py-3 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-red-500 rounded-full flex items-center justify-center">
                    <AlertTriangle className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <h2 className="text-base font-semibold text-gray-900">Alerts</h2>
                    <p className="text-xs text-gray-500">Trip #{currentTripAlerts.tripId}</p>
                  </div>
                </div>
                <button 
                  onClick={() => {
                    setAlertsModalOpen(false);
                    setCurrentTripAlerts(null);
                  }}
                  className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
                >
                  <X className="w-4 h-4 text-gray-600" />
                </button>
              </div>
            </div>
            
            {/* Alerts List */}
            <div className="overflow-y-auto max-h-[calc(85vh-80px)]">
              {currentTripAlerts.alerts && currentTripAlerts.alerts.length > 0 ? (
                <div className="divide-y divide-gray-100">
                  {currentTripAlerts.alerts.map((alert, index) => {
                    const isLatest = index === currentTripAlerts.alerts.length - 1;
                    const alertMessage = typeof alert === 'object' ? alert.message : alert;
                    
                    // Parse vehicle and location from message
                    const vehicleMatch = alertMessage.match(/Vehicle ([A-Z0-9]+)/);
                    const locationMatch = alertMessage.match(/at ([^:]+): ([^|]+)/);
                    const geozoneMatch = alertMessage.match(/Geozone: ([^,]+)/);
                    
                    const vehicle = vehicleMatch ? vehicleMatch[1] : null;
                    const location = locationMatch ? locationMatch[2].trim() : null;
                    const geozone = geozoneMatch ? geozoneMatch[1].trim() : null;
                    
                    return (
                      <div key={index} className={cn(
                        "p-4 transition-colors hover:bg-gray-50",
                        isLatest && "bg-red-50"
                      )}>
                        <div className="flex gap-3">
                          {/* Avatar */}
                          <div className={cn(
                            "w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0",
                            isLatest ? "bg-red-500" : "bg-gray-400"
                          )}>
                            <span className="text-white text-xs font-bold">
                              {vehicle ? vehicle.slice(-2) : "!"}
                            </span>
                          </div>
                          
                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              {vehicle && (
                                <span className="text-sm font-semibold text-gray-900">
                                  {vehicle}
                                </span>
                              )}
                              {isLatest && (
                                <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs font-medium rounded-full">
                                  New
                                </span>
                              )}
                              <span className="text-xs text-gray-500 ml-auto">
                                {typeof alert === 'object' && alert.timestamp ? 
                                  new Date(alert.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) :
                                  'now'
                                }
                              </span>
                            </div>
                            
                            <p className="text-sm text-gray-700 mb-2">
                              {location || 'At toll gate'}
                            </p>
                            
                            {geozone && (
                              <div className="flex items-center gap-1 text-xs text-gray-500">
                                <MapPin className="w-3 h-3" />
                                <span className="truncate">{geozone}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-12 px-4">
                  <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <AlertTriangle className="w-6 h-6 text-gray-400" />
                  </div>
                  <h3 className="text-sm font-medium text-gray-900 mb-1">No alerts</h3>
                  <p className="text-xs text-gray-500">All clear for this trip</p>
                </div>
              )}
            </div>
            
            {/* Action Bar */}
            <div className="border-t border-gray-100 p-4 bg-gray-50">
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  placeholder="Add reason for delay..."
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && e.target.value.trim()) {
                      const reason = e.target.value.trim();
                      console.log('Delay reason:', reason);
                      e.target.value = '';
                    }
                  }}
                />
                <button
                  onClick={(e) => {
                    const input = e.target.parentElement.querySelector('input');
                    if (input.value.trim()) {
                      const reason = input.value.trim();
                      console.log('Delay reason:', reason);
                      input.value = '';
                    }
                  }}
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors"
                >
                  Add Reason
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Close Trip Modal */}
      {closeTripOpen && currentTripForClose && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-md">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold text-red-800">Close Trip</h3>
              <Button variant="ghost" size="sm" onClick={() => {
                setCloseTripOpen(false);
                setCurrentTripForClose(null);
                setCloseReason('');
              }}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="p-4 space-y-4">
              <div className="bg-yellow-50 p-3 rounded border-l-4 border-yellow-500">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-4 h-4 text-yellow-600" />
                  <span className="font-medium text-yellow-800">Trip #{currentTripForClose.trip_id || currentTripForClose.id}</span>
                </div>
                <p className="text-sm text-yellow-700">
                  This will mark the trip as completed before all steps are finished.
                </p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Reason for closing trip early: *
                </label>
                <textarea
                  value={closeReason}
                  onChange={(e) => setCloseReason(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                  rows={3}
                  placeholder="Please provide a detailed reason for closing this trip early..."
                  required
                />
              </div>
              
              <div className="flex gap-2 justify-end">
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setCloseTripOpen(false);
                    setCurrentTripForClose(null);
                    setCloseReason('');
                  }}
                >
                  Cancel
                </Button>
                <Button 
                  variant="destructive"
                  disabled={!closeReason.trim()}
                  onClick={async () => {
                    if (!closeReason.trim()) return;
                    
                    try {
                      const supabase = createClient();
                      
                      // Get user email from cookies
                      const getCookie = (name: string) => {
                        const value = `; ${document.cookie}`;
                        const parts = value.split(`; ${name}=`);
                        if (parts.length === 2) return parts.pop()?.split(";").shift();
                        return null;
                      };
                      const userEmail = decodeURIComponent(getCookie("email") || "unknown@user.com");
                      
                      const closeNote = `Completed by: ${userEmail}\nReason: ${closeReason.trim()}`;
                      const existingNotes = currentTripForClose.statusnotes || currentTripForClose.status_notes || '';
                      const updatedNotes = existingNotes ? `${existingNotes}\n\n[TRIP COMPLETED EARLY] ${new Date().toLocaleString()}\n${closeNote}` : `[TRIP COMPLETED EARLY] ${new Date().toLocaleString()}\n${closeNote}`;
                      
                      // Update status history
                      const currentHistory = currentTripForClose.status_history || [];
                      const newHistory = [...currentHistory, `${new Date().toISOString()}: completed (early closure by ${userEmail})`];
                      
                      const { error } = await supabase
                        .from('trips')
                        .update({ 
                          status: 'completed',
                          statusnotes: updatedNotes,
                          status_history: newHistory,
                          updated_at: new Date().toISOString()
                        })
                        .eq('id', currentTripForClose.id);
                      
                      if (error) throw error;
                      
                      setCloseTripOpen(false);
                      setCurrentTripForClose(null);
                      setCloseReason('');
                      setRefreshTrigger(prev => prev + 1);
                      
                      // Success dialog
                      setTimeout(() => {
                        const successDialog = document.createElement('div');
                        successDialog.className = 'fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4';
                        successDialog.innerHTML = `
                          <div class="bg-white rounded-lg shadow-lg p-6 max-w-sm w-full">
                            <div class="text-center">
                              <div class="w-12 h-12 mx-auto mb-4 bg-green-100 rounded-full flex items-center justify-center">
                                <svg class="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                                </svg>
                              </div>
                              <h3 class="text-lg font-semibold text-gray-900 mb-2">Trip Completed</h3>
                              <p class="text-sm text-gray-600 mb-4">The trip has been marked as completed successfully.</p>
                              <button onclick="this.parentElement.parentElement.parentElement.remove()" class="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors">
                                OK
                              </button>
                            </div>
                          </div>
                        `;
                        document.body.appendChild(successDialog);
                      }, 100);
                      
                    } catch (err) {
                      console.error('Failed to close trip:', err);
                      
                      // Error dialog
                      const errorDialog = document.createElement('div');
                      errorDialog.className = 'fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4';
                      errorDialog.innerHTML = `
                        <div class="bg-white rounded-lg shadow-lg p-6 max-w-sm w-full">
                          <div class="text-center">
                            <div class="w-12 h-12 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
                              <svg class="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                              </svg>
                            </div>
                            <h3 class="text-lg font-semibold text-gray-900 mb-2">Error</h3>
                            <p class="text-sm text-gray-600 mb-4">Failed to close the trip. Please try again.</p>
                            <button onclick="this.parentElement.parentElement.parentElement.remove()" class="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors">
                              OK
                            </button>
                          </div>
                        </div>
                      `;
                      document.body.appendChild(errorDialog);
                    }
                  }}
                >
                  Complete Trip
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      <EditTripModal
        isOpen={approvalModalOpen}
        onClose={() => {
          setApprovalModalOpen(false)
          setCurrentTripForApproval(null)
        }}
        trip={currentTripForApproval}
        onUpdate={() => {
          setRefreshTrigger(prev => prev + 1)
        }}
        readOnly={true}
        showApprovalButtons={true}
        onApprove={async () => {
          try {
            const supabase = createClient();
            const { error } = await supabase
              .from('trips')
              .update({ elevate: false })
              .eq('id', currentTripForApproval.id);
            
            if (error) throw error;
            
            setApprovalModalOpen(false);
            setCurrentTripForApproval(null);
            setRefreshTrigger(prev => prev + 1);
          } catch (err) {
            console.error('Error approving trip:', err);
            alert('Failed to approve trip');
          }
        }}
        onDecline={async () => {
          try {
            const supabase = createClient();
            
            // Get the most recent history entry to restore previous data
            const { data: historyData } = await supabase
              .from('trip_history')
              .select('previous_data')
              .eq('trip_id', currentTripForApproval.id)
              .order('created_at', { ascending: false })
              .limit(1)
              .single();
            
            let updateData = {
              elevate: false,
              status_notes: (currentTripForApproval.status_notes || '') + '\n[DECLINED] Trip edit declined by management'
            };
            
            // If we have previous data, restore it
            if (historyData?.previous_data) {
              updateData = {
                ...historyData.previous_data,
                elevate: false,
                status_notes: (historyData.previous_data.status_notes || '') + '\n[DECLINED] Trip edit declined - reverted to previous version'
              };
            }
            
            const { error } = await supabase
              .from('trips')
              .update(updateData)
              .eq('id', currentTripForApproval.id);
            
            if (error) throw error;
            
            setApprovalModalOpen(false);
            setCurrentTripForApproval(null);
            setRefreshTrigger(prev => prev + 1);
          } catch (err) {
            console.error('Error declining trip:', err);
            alert('Failed to decline trip');
          }
        }}
      />
    </>
  );
}