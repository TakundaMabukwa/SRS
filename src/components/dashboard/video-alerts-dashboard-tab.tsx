"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useVideoAlerts } from "@/context/video-alerts-context/context";
import { useAlertPolling } from "@/hooks/use-alert-polling";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  AlertCircle,
  Info,
  CheckCircle2,
  Clock,
  TrendingUp,
  Download,
  RefreshCw,
  Eye,
  Search,
  ArrowUpCircle,
  LayoutList, 
  LayoutGrid, 
  Layers, 
  Siren,
  Video,
  Camera,
  Filter,
  User,
  ChevronRight,
  Bell
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format, differenceInHours } from "date-fns";

export default function VideoAlertsDashboardTab() {
  const router = useRouter();
  const {
    alerts,
    statistics,
    filters,
    loading,
    fetchAlerts,
    fetchStatistics,
  } = useVideoAlerts();

  const alertStats = useAlertPolling();
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("all"); 
  const [viewMode, setViewMode] = useState<"grid" | "list">("list");

  // Mock current user
  const [currentUser] = useState({ id: "user-1", name: "Operator" });

  useEffect(() => {
    fetchAlerts(filters);
    fetchStatistics();
  }, [filters]);

  // Auto-refresh 30s
  useEffect(() => {
    const interval = setInterval(() => {
      fetchAlerts(filters);
      fetchStatistics();
    }, 30000);
    return () => clearInterval(interval);
  }, [filters]);

  // Calculate statistics from alerts
  const calculatedStats = {
    critical_alerts: alerts.filter(a => a.priority === 'critical' && !['closed', 'resolved'].includes(a.status)).length,
    total_alerts: alerts.filter(a => !['closed', 'resolved'].includes(a.status)).length,
    resolved_today: alerts.filter(a => {
      if (!['closed', 'resolved'].includes(a.status)) return false;
      const today = new Date().toDateString();
      const resolvedDate = new Date(a.resolved_at || a.closed_at || a.updated_at).toDateString();
      return today === resolvedDate;
    }).length,
  };

  const displayStats = statistics || calculatedStats;

  const handleRefresh = () => {
    fetchAlerts(filters);
    fetchStatistics();
  };

  const handleViewAlert = (alertId: string) => {
    router.push(`/video-alerts/${alertId}`);
  };

  // Helper for "Unattended" logic (24h+)
  const isUnattended = (alert: any) => {
    if (alert.status === 'closed' || alert.status === 'resolved') return false;
    const diff = differenceInHours(new Date(), new Date(alert.timestamp));
    return diff >= 24;
  };

  // Filtering
  const filteredAlerts = alerts.filter((alert: any) => {
    // 1. Tab Filter
    if (activeTab === 'unattended') {
      if (!isUnattended(alert)) return false;
    } else if (activeTab === 'history') {
      if (!['closed', 'resolved'].includes(alert.status)) return false;
    } else if (activeTab !== 'all') {
      if (alert.status !== activeTab) return false;
    }

    // 2. Search
    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      return (
        alert.title?.toLowerCase().includes(s) ||
        alert.vehicle_registration?.toLowerCase().includes(s) ||
        alert.driver_name?.toLowerCase().includes(s) ||
        alert.id?.toLowerCase().includes(s)
      );
    }

    return true;
  });

  const unattendedCount = alerts.filter(isUnattended).length;
  const criticalCount = displayStats?.critical_alerts || 0;

  // Render Helpers
  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'text-red-600 bg-red-100 border-red-200';
      case 'high': return 'text-orange-600 bg-orange-100 border-orange-200';
      case 'medium': return 'text-yellow-600 bg-yellow-100 border-yellow-200';
      default: return 'text-blue-600 bg-blue-100 border-blue-200';
    }
  };

  return (
    <div className="flex flex-col space-y-6 animate-in fade-in duration-500">
      
      {/* Bell Notification */}
      <div className="flex justify-between items-center gap-2">
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => router.push('/video-alerts/management')}>
            Management
          </Button>
          <Button variant="outline" size="sm" onClick={() => router.push('/video-alerts/unattended')}>
            Unattended
          </Button>
          <Button variant="outline" size="sm" onClick={() => router.push('/video-alerts/escalations')}>
            Escalations
          </Button>
          <Button variant="outline" size="sm" onClick={() => router.push('/video-alerts/flooding')}>
            Flooding
          </Button>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          className="relative"
          onClick={() => router.push('/video-alerts')}
        >
          <Bell className="w-4 h-4" />
          {alertStats.newCount > 0 && (
            <Badge className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center p-0 bg-red-500">
              {alertStats.newCount}
            </Badge>
          )}
        </Button>
      </div>
      
      {/* Top Stats Row - "Control Center" Feel */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4 border-l-4 border-l-red-500 bg-white shadow-sm hover:shadow-md transition-shadow">
           <div className="flex items-center justify-between">
             <div>
               <p className="text-sm font-medium text-slate-500">Critical Alerts</p>
               <h3 className="text-2xl font-bold text-red-700">{criticalCount}</h3>
             </div>
             <div className="p-2 bg-red-100 rounded-full">
               <Siren className="w-5 h-5 text-red-600 animate-pulse" />
             </div>
           </div>
           <div className="mt-2 text-xs text-slate-400">Requires immediate attention</div>
        </Card>

        <Card className="p-4 border-l-4 border-l-orange-500 bg-white shadow-sm hover:shadow-md transition-shadow">
           <div className="flex items-center justify-between">
             <div>
               <p className="text-sm font-medium text-slate-500">Unattended (24h+)</p>
               <h3 className="text-2xl font-bold text-orange-700">{unattendedCount}</h3>
             </div>
             <div className="p-2 bg-orange-100 rounded-full">
               <Clock className="w-5 h-5 text-orange-600" />
             </div>
           </div>
           <div className="mt-2 text-xs text-slate-400">Pending over 24 hours</div>
        </Card>

        <Card className="p-4 border-l-4 border-l-blue-500 bg-white shadow-sm hover:shadow-md transition-shadow">
           <div className="flex items-center justify-between">
             <div>
               <p className="text-sm font-medium text-slate-500">Active Monitoring</p>
               <h3 className="text-2xl font-bold text-slate-800">{displayStats?.total_alerts || 0}</h3>
             </div>
             <div className="p-2 bg-blue-100 rounded-full">
               <Video className="w-5 h-5 text-blue-600" />
             </div>
           </div>
           <div className="mt-2 text-xs text-slate-400">Total active incidents</div>
        </Card>

        <Card className="p-4 border-l-4 border-l-green-500 bg-white shadow-sm hover:shadow-md transition-shadow">
           <div className="flex items-center justify-between">
             <div>
               <p className="text-sm font-medium text-slate-500">Resolved Today</p>
               <h3 className="text-2xl font-bold text-green-700">{displayStats?.resolved_today || 0}</h3>
             </div>
             <div className="p-2 bg-green-100 rounded-full">
               <CheckCircle2 className="w-5 h-5 text-green-600" />
             </div>
           </div>
           <div className="mt-2 text-xs text-slate-400">Efficiency metric</div>
        </Card>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
        
        {/* Tabs */}
        <div className="flex flex-wrap gap-2">
           <Button 
             variant={activeTab === 'all' ? 'default' : 'outline'} 
             size="sm" 
             onClick={() => setActiveTab('all')}
             className="rounded-full"
           >
             All
           </Button>
           <Button 
             variant={activeTab === 'new' ? 'default' : 'outline'} 
             size="sm" 
             onClick={() => setActiveTab('new')}
             className={cn("rounded-full", activeTab === 'new' && "bg-purple-600 hover:bg-purple-700")}
           >
             New
           </Button>
           <Button 
             variant={activeTab === 'unattended' ? 'default' : 'outline'} 
             size="sm" 
             onClick={() => setActiveTab('unattended')}
             className={cn("rounded-full", activeTab === 'unattended' && "bg-orange-600 hover:bg-orange-700")}
           >
             Unattended
           </Button>
           <Button 
             variant={activeTab === 'history' ? 'default' : 'outline'} 
             size="sm" 
             onClick={() => setActiveTab('history')}
             className="rounded-full"
           >
             History
           </Button>
        </div>

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
          
          <div className="flex items-center bg-white border rounded-lg p-1 shadow-sm">
             <Button
               variant={viewMode === 'list' ? 'secondary' : 'ghost'}
               size="icon"
               className="h-8 w-8"
               onClick={() => setViewMode('list')}
             >
               <LayoutList className="h-4 w-4" />
             </Button>
             <Button
               variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
               size="icon"
               className="h-8 w-8"
               onClick={() => setViewMode('grid')}
             >
               <LayoutGrid className="h-4 w-4" />
             </Button>
          </div>

          <Button variant="outline" size="icon" onClick={handleRefresh} title="Refresh Data">
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          </Button>
        </div>
      </div>

      {/* Main Content Area */}
      {filteredAlerts.length === 0 ? (
        <div className="text-center py-20 bg-slate-50 rounded-xl border border-slate-200 border-dashed">
          <div className="mx-auto bg-white p-4 rounded-full w-20 h-20 flex items-center justify-center shadow-sm mb-4">
            <Search className="h-8 w-8 text-slate-300" />
          </div>
          <h3 className="text-lg font-medium text-slate-900">No alerts found</h3>
          <p className="text-slate-500">Try adjusting your filters or search terms.</p>
          <Button variant="link" onClick={() => { setActiveTab('all'); setSearchTerm(''); }} className="mt-2">
            Clear all filters
          </Button>
        </div>
      ) : (
        viewMode === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredAlerts.map((alert: any) => (
              <Card 
                key={alert.id} 
                className="overflow-hidden hover:shadow-lg transition-all duration-300 group cursor-pointer border-slate-200"
                onClick={() => handleViewAlert(alert.id)}
              >
                {/* Image/Video Header Section */}
                <div className="relative aspect-video bg-slate-900">
                  {alert.screenshots?.[0]?.url ? (
                    <img 
                      src={alert.screenshots[0].url} 
                      alt="Alert Snapshot" 
                      className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-600">
                      <Camera className="h-12 w-12 opacity-20" />
                    </div>
                  )}
                  
                  {/* Overlay Badges */}
                  <div className="absolute top-3 right-3 flex gap-2">
                     <Badge className={cn("shadow-sm capitalize", getSeverityColor(alert.severity))}>
                       {alert.severity}
                     </Badge>
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-4">
                     <div className="flex items-center justify-between text-white">
                       <span className="font-mono text-sm font-bold tracking-wider">
                         {alert.vehicle_registration || "NO-PLATE"}
                       </span>
                       <span className="text-xs font-medium opacity-80 flex items-center gap-1">
                         <Clock className="w-3 h-3" />
                         {format(new Date(alert.timestamp), "HH:mm")}
                       </span>
                     </div>
                  </div>
                </div>

                {/* Card Body */}
                <div className="p-4 bg-white">
                  <div className="flex justify-between items-start mb-3">
                     <div>
                       <h4 className="font-semibold text-slate-900 line-clamp-1">{alert.title}</h4>
                       <p className="text-xs text-slate-500 uppercase tracking-wide mt-1">{alert.alert_type?.replace(/_/g, ' ')}</p>
                     </div>
                     <Badge variant="outline" className={cn(
                       "capitalize font-semibold",
                       alert.status === 'new' ? "border-purple-300 text-purple-700 bg-purple-50" : 
                       alert.status === 'escalated' ? "border-red-300 text-red-700 bg-red-50" :
                       alert.status === 'investigating' ? "border-blue-300 text-blue-700 bg-blue-50" :
                       "border-slate-200 text-slate-600"
                     )}>
                       {alert.status}
                     </Badge>
                  </div>
                  
                  <div className="space-y-2 mb-4">
                    <div className="flex items-center text-xs text-slate-600">
                       <User className="w-3.5 h-3.5 mr-2 text-slate-400" />
                       {alert.driver_name || "Unknown Driver"}
                    </div>
                    {isUnattended(alert) && (
                      <div className="flex items-center text-xs text-orange-600 bg-orange-50 px-2 py-1 rounded w-fit">
                         <AlertTriangle className="w-3.5 h-3.5 mr-1" />
                         Unattended for {differenceInHours(new Date(), new Date(alert.timestamp))}h
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                     <div className="text-xs text-slate-400">
                       ID: {alert.id.slice(0,8)}
                     </div>
                     <Button size="sm" variant="ghost" className="h-8 text-xs hover:bg-slate-100 hover:text-blue-600">
                       View Details <ChevronRight className="w-3 h-3 ml-1" />
                     </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
             <Table>
                <TableHeader>
                   <TableRow className="bg-slate-50 hover:bg-slate-50">
                      <TableHead className="w-[100px]">Status</TableHead>
                      <TableHead>Severity</TableHead>
                      <TableHead>Alert Details</TableHead>
                      <TableHead>Target</TableHead>
                      <TableHead>Time</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                   </TableRow>
                </TableHeader>
                <TableBody>
                   {filteredAlerts.map((alert: any) => (
                     <TableRow key={alert.id} className="cursor-pointer hover:bg-slate-50/50" onClick={() => handleViewAlert(alert.id)}>
                        <TableCell>
                           <Badge variant="secondary" className="capitalize text-xs">{alert.status}</Badge>
                        </TableCell>
                        <TableCell>
                           <Badge variant="outline" className={cn("capitalize text-xs", getSeverityColor(alert.severity))}>
                             {alert.severity}
                           </Badge>
                        </TableCell>
                        <TableCell>
                           <div className="flex flex-col">
                             <span className="font-medium text-slate-900">{alert.title}</span>
                             <span className="text-xs text-slate-500 capitalize">{alert.alert_type?.replace(/_/g, ' ')}</span>
                           </div>
                        </TableCell>
                        <TableCell>
                           <div className="flex flex-col">
                             <span className="font-mono text-xs font-bold">{alert.vehicle_registration || "N/A"}</span>
                             <span className="text-xs text-slate-500">{alert.driver_name || "Unknown"}</span>
                           </div>
                        </TableCell>
                        <TableCell>
                           <div className="text-xs text-slate-600">
                             {format(new Date(alert.timestamp), "MMM dd")}
                             <br />
                             {format(new Date(alert.timestamp), "HH:mm")}
                           </div>
                        </TableCell>
                        <TableCell className="text-right">
                           <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); handleViewAlert(alert.id); }}>
                             Details
                           </Button>
                        </TableCell>
                     </TableRow>
                   ))}
                </TableBody>
             </Table>
          </div>
        )
      )}
    </div>
  );
}
