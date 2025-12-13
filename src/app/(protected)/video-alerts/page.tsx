"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useVideoAlerts } from "@/context/video-alerts-context/context";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  Filter,
  Download,
  RefreshCw,
  Eye,
  Search,
  X,
  ArrowUpCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

export default function VideoAlertsPage() {
  const router = useRouter();
  const {
    alerts,
    statistics,
    filters,
    loading,
    fetchAlerts,
    fetchStatistics,
    setFilters,
    clearFilters,
    acknowledgeAlert,
  } = useVideoAlerts();

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTab, setSelectedTab] = useState("all");
  const [currentUser] = useState({ id: "user-1", name: "Current User" }); // Replace with actual auth

  useEffect(() => {
    fetchAlerts(filters);
    fetchStatistics();
  }, [filters]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchAlerts(filters);
    }, 30000);
    return () => clearInterval(interval);
  }, [filters]);

  const handleRefresh = () => {
    fetchAlerts(filters);
    fetchStatistics();
  };

  const handleAcknowledge = async (alertId) => {
    await acknowledgeAlert(alertId, currentUser.id);
  };

  const handleViewDetails = (alertId) => {
    router.push(`/video-alerts/${alertId}`);
  };

  const getSeverityConfig = (severity) => {
    const config = {
      critical: {
        color: "bg-red-100 text-red-800 border-red-300",
        icon: AlertTriangle,
        label: "Critical",
      },
      high: {
        color: "bg-orange-100 text-orange-800 border-orange-300",
        icon: AlertCircle,
        label: "High",
      },
      medium: {
        color: "bg-yellow-100 text-yellow-800 border-yellow-300",
        icon: Info,
        label: "Medium",
      },
      low: {
        color: "bg-blue-100 text-blue-800 border-blue-300",
        icon: Info,
        label: "Low",
      },
      info: {
        color: "bg-gray-100 text-gray-800 border-gray-300",
        icon: Info,
        label: "Info",
      },
    };
    return config[severity] || config.info;
  };

  const getStatusConfig = (status) => {
    const config = {
      new: {
        color: "bg-purple-100 text-purple-800 border-purple-300",
        label: "New",
        dot: "bg-purple-500",
      },
      acknowledged: {
        color: "bg-blue-100 text-blue-800 border-blue-300",
        label: "Acknowledged",
        dot: "bg-blue-500",
      },
      investigating: {
        color: "bg-yellow-100 text-yellow-800 border-yellow-300",
        label: "Investigating",
        dot: "bg-yellow-500",
      },
      escalated: {
        color: "bg-red-100 text-red-800 border-red-300",
        label: "Escalated",
        dot: "bg-red-500",
      },
      resolved: {
        color: "bg-green-100 text-green-800 border-green-300",
        label: "Resolved",
        dot: "bg-green-500",
      },
      closed: {
        color: "bg-gray-100 text-gray-800 border-gray-300",
        label: "Closed",
        dot: "bg-gray-500",
      },
    };
    return config[status] || config.new;
  };

  const filteredAlerts = alerts.filter((alert) => {
    if (selectedTab !== "all" && alert.status !== selectedTab) return false;
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      return (
        alert.title?.toLowerCase().includes(search) ||
        alert.vehicle_registration?.toLowerCase().includes(search) ||
        alert.driver_name?.toLowerCase().includes(search) ||
        alert.alert_type?.toLowerCase().includes(search)
      );
    }
    return true;
  });

  const statCards = [
    {
      title: "Total Alerts",
      value: statistics?.total_alerts || 0,
      icon: AlertTriangle,
      color: "text-slate-600",
      bgColor: "bg-slate-100",
    },
    {
      title: "Critical",
      value: statistics?.critical_alerts || 0,
      icon: AlertCircle,
      color: "text-red-600",
      bgColor: "bg-red-100",
    },
    {
      title: "New Alerts",
      value: statistics?.new_alerts || 0,
      icon: Clock,
      color: "text-purple-600",
      bgColor: "bg-purple-100",
    },
    {
      title: "Escalated",
      value: statistics?.escalated_alerts || 0,
      icon: ArrowUpCircle,
      color: "text-orange-600",
      bgColor: "bg-orange-100",
    },
    {
      title: "Resolved Today",
      value: statistics?.resolved_today || 0,
      icon: CheckCircle2,
      color: "text-green-600",
      bgColor: "bg-green-100",
    },
    {
      title: "Avg Response",
      value: `${statistics?.average_response_time_minutes || 0}m`,
      icon: TrendingUp,
      color: "text-blue-600",
      bgColor: "bg-blue-100",
    },
  ];

  const tabs = [
    { value: "all", label: "All Alerts", count: alerts.length },
    { value: "new", label: "New", count: alerts.filter((a) => a.status === "new").length },
    {
      value: "acknowledged",
      label: "Acknowledged",
      count: alerts.filter((a) => a.status === "acknowledged").length,
    },
    {
      value: "investigating",
      label: "Investigating",
      count: alerts.filter((a) => a.status === "investigating").length,
    },
    {
      value: "escalated",
      label: "Escalated",
      count: alerts.filter((a) => a.status === "escalated").length,
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Video Alerts</h1>
            <p className="text-slate-600 mt-1">
              Real-time monitoring and alert management system
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={handleRefresh} disabled={loading}>
              <RefreshCw className={cn("w-4 h-4 mr-2", loading && "animate-spin")} />
              Refresh
            </Button>
            <Button variant="outline">
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
            <Button variant="outline">
              <Filter className="w-4 h-4 mr-2" />
              Filters
            </Button>
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
          {statCards.map((stat) => (
            <Card key={stat.title} className="p-4 border-slate-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-600 uppercase tracking-wide">
                    {stat.title}
                  </p>
                  <p className="text-2xl font-bold text-slate-900 mt-1">{stat.value}</p>
                </div>
                <div className={cn("p-3 rounded-lg", stat.bgColor)}>
                  <stat.icon className={cn("w-5 h-5", stat.color)} />
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* Search and Tabs */}
        <div className="flex items-center gap-4 mb-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Search alerts, vehicles, drivers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-10"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm("")}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2">
          {tabs.map((tab) => (
            <Button
              key={tab.value}
              variant={selectedTab === tab.value ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedTab(tab.value)}
              className="whitespace-nowrap"
            >
              {tab.label}
              <Badge
                variant="secondary"
                className={cn(
                  "ml-2",
                  selectedTab === tab.value
                    ? "bg-white/20 text-white"
                    : "bg-slate-100 text-slate-700"
                )}
              >
                {tab.count}
              </Badge>
            </Button>
          ))}
        </div>
      </div>

      {/* Alerts Table */}
      <Card className="border-slate-200 shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-gradient-to-r from-slate-50 to-slate-100 border-b hover:bg-gradient-to-r">
              <TableHead className="h-10 px-3 font-semibold text-slate-700 text-xs uppercase">Severity</TableHead>
              <TableHead className="h-10 px-3 font-semibold text-slate-700 text-xs uppercase">Status</TableHead>
              <TableHead className="h-10 px-3 font-semibold text-slate-700 text-xs uppercase">Alert</TableHead>
              <TableHead className="h-10 px-3 font-semibold text-slate-700 text-xs uppercase">Vehicle</TableHead>
              <TableHead className="h-10 px-3 font-semibold text-slate-700 text-xs uppercase">Driver</TableHead>
              <TableHead className="h-10 px-3 font-semibold text-slate-700 text-xs uppercase">Time</TableHead>
              <TableHead className="h-10 px-3 font-semibold text-slate-700 text-xs uppercase text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && filteredAlerts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-slate-500">
                  Loading alerts...
                </TableCell>
              </TableRow>
            ) : filteredAlerts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-slate-500">
                  No alerts found
                </TableCell>
              </TableRow>
            ) : (
              filteredAlerts.map((alert, index) => {
                const severityConfig = getSeverityConfig(alert.severity);
                const statusConfig = getStatusConfig(alert.status);
                const SeverityIcon = severityConfig.icon;

                // Row background colors based on severity
                const getRowColor = (severity, index) => {
                  const baseColors = {
                    critical: index % 2 === 0 ? "bg-red-50" : "bg-red-50/60",
                    high: index % 2 === 0 ? "bg-orange-50" : "bg-orange-50/60",
                    medium: index % 2 === 0 ? "bg-yellow-50" : "bg-yellow-50/60",
                    low: index % 2 === 0 ? "bg-blue-50" : "bg-blue-50/60",
                  };
                  return baseColors[severity] || (index % 2 === 0 ? "bg-slate-50" : "bg-white");
                };

                const getBorderColor = (severity) => {
                  const borders = {
                    critical: "border-l-4 border-l-red-500",
                    high: "border-l-4 border-l-orange-500",
                    medium: "border-l-4 border-l-yellow-500",
                    low: "border-l-4 border-l-blue-500",
                  };
                  return borders[severity] || "";
                };

                return (
                  <TableRow
                    key={alert.id}
                    className={cn(
                      "cursor-pointer transition-colors border-b",
                      getRowColor(alert.severity, index),
                      getBorderColor(alert.severity),
                      "hover:brightness-95",
                      alert.status === "new" && "font-medium"
                    )}
                    onClick={() => handleViewDetails(alert.id)}
                  >
                    <TableCell className="px-3 py-2">
                      <Badge
                        variant="outline"
                        className={cn(
                          "flex items-center gap-1 w-fit font-semibold text-[10px] px-2 py-0.5 border",
                          severityConfig.color
                        )}
                      >
                        <SeverityIcon className="w-3 h-3" />
                        {severityConfig.label.toUpperCase()}
                      </Badge>
                    </TableCell>
                    <TableCell className="px-3 py-2">
                      <Badge
                        variant="outline"
                        className={cn(
                          "flex items-center gap-1.5 w-fit font-medium text-[10px] px-2 py-0.5 border",
                          statusConfig.color
                        )}
                      >
                        <span className={cn("w-1.5 h-1.5 rounded-full", statusConfig.dot)} />
                        {statusConfig.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="px-3 py-2">
                      <div>
                        <p className="font-semibold text-sm text-slate-900">{alert.title}</p>
                        <p className="text-[10px] text-slate-500 mt-0.5 uppercase tracking-wide">
                          {alert.alert_type.replace(/_/g, " ")}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="px-3 py-2">
                      <span className="font-semibold text-sm text-slate-800">
                        {alert.vehicle_registration || "N/A"}
                      </span>
                    </TableCell>
                    <TableCell className="px-3 py-2">
                      <span className="text-sm text-slate-700">{alert.driver_name || "N/A"}</span>
                    </TableCell>
                    <TableCell className="px-3 py-2">
                      <div className="text-xs">
                        <p className="text-slate-900 font-medium">
                          {format(new Date(alert.timestamp), "MMM dd, yyyy")}
                        </p>
                        <p className="text-slate-500 text-[10px]">{format(new Date(alert.timestamp), "HH:mm:ss")}</p>
                      </div>
                    </TableCell>
                    <TableCell className="px-3 py-2">
                      <div className="flex items-center justify-end gap-1.5">
                        {alert.status === "new" && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 text-xs"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAcknowledge(alert.id);
                            }}
                          >
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            Acknowledge
                          </Button>
                        )}
                        <Button
                          size="sm"
                          className="h-7 px-2 text-xs bg-blue-600 hover:bg-blue-700"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleViewDetails(alert.id);
                          }}
                        >
                          <Eye className="w-3 h-3 mr-1" />
                          View
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
