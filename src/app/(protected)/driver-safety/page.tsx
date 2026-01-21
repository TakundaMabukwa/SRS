"use client";

import React, { useState } from "react";
import { 
  ShieldAlert, 
  Trophy, 
  FileText, 
  AlertTriangle, 
  Search, 
  Download, 
  Siren,
  User,
  Car,
  TrendingDown,
  TrendingUp,
  Gavel,
  ClipboardList
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";

// Mock Data
const DRIVERS = [
  {
    id: "DRV-001",
    name: "John Smith",
    vehicle: "VH-2291",
    safetyScore: 88, // 0-100
    demerits: 12,
    incidents: {
      speeding: 4,
      fatigue: 1,
      cornering: 2
    },
    status: "active",
    riskLevel: "medium", // low, medium, high, critical
    ncrCount: 1,
  },
  {
    id: "DRV-002",
    name: "Sarah Johnson", 
    vehicle: "VH-9921",
    safetyScore: 98,
    demerits: 0,
    incidents: {
      speeding: 0,
      fatigue: 0,
      cornering: 0
    },
    status: "active",
    riskLevel: "low",
    ncrCount: 0,
  },
  {
    id: "DRV-003",
    name: "Michael Brown",
    vehicle: "VH-1102",
    safetyScore: 45,
    demerits: 45,
    incidents: {
      speeding: 12, // Needs report (> 3)
      fatigue: 3,
      cornering: 5
    },
    status: "probation",
    riskLevel: "critical",
    ncrCount: 3,
  },
  {
    id: "DRV-004",
    name: "David Wilson",
    vehicle: "VH-3301", 
    safetyScore: 72,
    demerits: 25,
    incidents: {
      speeding: 5, // Needs report
      fatigue: 0,
      cornering: 1
    },
    status: "active",
    riskLevel: "high",
    ncrCount: 1,
  },
];

export default function DriverSafetyPage() {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const [filter, setFilter] = useState("all");

  const getScoreColor = (score: number) => {
    if (score >= 90) return "text-green-600";
    if (score >= 70) return "text-yellow-600";
    if (score >= 50) return "text-orange-600";
    return "text-red-600";
  };

  const getRiskBadge = (level: string) => {
    switch(level) {
      case 'critical': return "bg-red-100 text-red-700 border-red-200 hover:bg-red-200";
      case 'high': return "bg-orange-100 text-orange-700 border-orange-200 hover:bg-orange-200";
      case 'medium': return "bg-yellow-100 text-yellow-700 border-yellow-200 hover:bg-yellow-200";
      default: return "bg-green-100 text-green-700 border-green-200 hover:bg-green-200";
    }
  };

  const filteredDrivers = DRIVERS.filter(d => {
    const matchesSearch = d.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         d.id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filter === 'all' || d.riskLevel === filter;
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="min-h-screen bg-slate-50/50 p-6 space-y-6">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <ShieldAlert className="w-8 h-8 text-blue-600" />
            Driver Safety Scorecard
          </h1>
          <p className="text-slate-500 mt-1">Manage driver ratings, demerits, and automated compliance reports.</p>
        </div>
        <div className="flex gap-2">
           <Button variant="outline" className="bg-white">
             <Download className="w-4 h-4 mr-2" /> Export Summary
           </Button>
           <Button className="bg-blue-600 hover:bg-blue-700">
             <Gavel className="w-4 h-4 mr-2" /> Configure Rules
           </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 border-l-4 border-l-green-500 bg-white shadow-sm">
           <div className="flex justify-between items-start">
             <div>
               <p className="text-sm font-medium text-slate-500">Fleet Safety Score</p>
               <h3 className="text-3xl font-bold text-slate-900 mt-2">76<span className="text-sm text-slate-400 font-normal">/100</span></h3>
             </div>
             <div className="p-2 bg-green-100 rounded-full">
               <Trophy className="w-5 h-5 text-green-600" />
             </div>
           </div>
           <div className="mt-2 flex items-center text-xs text-green-600">
             <TrendingUp className="w-3 h-3 mr-1" /> +2.4% vs last month
           </div>
        </Card>

        <Card className="p-4 border-l-4 border-l-red-500 bg-white shadow-sm">
           <div className="flex justify-between items-start">
             <div>
               <p className="text-sm font-medium text-slate-500">High Risk Drivers</p>
               <h3 className="text-3xl font-bold text-red-700 mt-2">3</h3>
             </div>
             <div className="p-2 bg-red-100 rounded-full">
               <AlertTriangle className="w-5 h-5 text-red-600" />
             </div>
           </div>
           <p className="mt-2 text-xs text-slate-400">Require immediate intervention</p>
        </Card>

        <Card className="p-4 border-l-4 border-l-orange-500 bg-white shadow-sm">
           <div className="flex justify-between items-start">
             <div>
               <p className="text-sm font-medium text-slate-500">Speeding Violations</p>
               <h3 className="text-3xl font-bold text-orange-700 mt-2">24</h3>
             </div>
             <div className="p-2 bg-orange-100 rounded-full">
               <Siren className="w-5 h-5 text-orange-600" />
             </div>
           </div>
           <p className="mt-2 text-xs text-slate-400">Last 30 days total</p>
        </Card>

        <Card className="p-4 border-l-4 border-l-purple-500 bg-white shadow-sm">
           <div className="flex justify-between items-start">
             <div>
               <p className="text-sm font-medium text-slate-500">Pending NCRs</p>
               <h3 className="text-3xl font-bold text-purple-700 mt-2">5</h3>
             </div>
             <div className="p-2 bg-purple-100 rounded-full">
               <ClipboardList className="w-5 h-5 text-purple-600" />
             </div>
           </div>
           <p className="mt-2 text-xs text-slate-400">Non-Conformance Reports</p>
        </Card>
      </div>

      {/* Main Content */}
      <Card className="border-slate-200 shadow-sm bg-white overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row justify-between gap-4">
          <Tabs value={filter} onValueChange={setFilter} className="w-full sm:w-auto">
            <TabsList>
              <TabsTrigger value="all">All Drivers</TabsTrigger>
              <TabsTrigger value="critical">Critical Risk</TabsTrigger>
              <TabsTrigger value="high">High Risk</TabsTrigger>
              <TabsTrigger value="watchlist">Watchlist</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input 
              placeholder="Search driver name, ID..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>


        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50">
              <TableHead>Driver Details</TableHead>
              <TableHead className="w-[150px]">Safety Score</TableHead>
              <TableHead>Risk Level</TableHead>
              <TableHead>Demerit Points</TableHead>
              <TableHead>Incidents (30d)</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredDrivers.map((driver) => (
              <TableRow key={driver.id} className="hover:bg-slate-50/50">
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 font-bold">
                      {driver.name.charAt(0)}
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900">{driver.name}</p>
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <span className="font-mono">{driver.id}</span>
                        <span>•</span>
                        <div className="flex items-center">
                          <Car className="w-3 h-3 mr-1" /> {driver.vehicle}
                        </div>
                      </div>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div className="relative w-12 h-12 flex items-center justify-center">
                       {/* Circular Score Mockup */}
                       <svg className="w-full h-full transform -rotate-90">
                         <circle cx="24" cy="24" r="20" stroke="#e2e8f0" strokeWidth="4" fill="none" />
                         <circle 
                           cx="24" cy="24" r="20" 
                           stroke="currentColor" 
                           strokeWidth="4" 
                           fill="none" 
                           strokeDasharray={126} 
                           strokeDashoffset={126 - (126 * driver.safetyScore / 100)}
                           className={getScoreColor(driver.safetyScore)}
                         />
                       </svg>
                       <span className={cn("absolute text-xs font-bold", getScoreColor(driver.safetyScore))}>
                         {driver.safetyScore}
                       </span>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge className={cn("capitalize shadow-sm", getRiskBadge(driver.riskLevel))}>
                    {driver.riskLevel}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-medium">{driver.demerits}/100 Pts</span>
                    </div>
                    <div className="w-24 h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div 
                        className={cn("h-full rounded-full", driver.demerits > 50 ? "bg-red-500" : "bg-blue-500")} 
                        style={{ width: `${driver.demerits}%` }}
                      ></div>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="space-y-1">
                    <div className="flex items-center text-xs text-slate-600">
                      <Siren className="w-3 h-3 mr-2 text-red-500" /> 
                      Speeding: <span className={cn("font-bold ml-1", driver.incidents.speeding > 3 && "text-red-600")}>{driver.incidents.speeding}</span>
                      {driver.incidents.speeding > 3 && (
                        <span className="ml-2 text-[10px] bg-red-100 text-red-700 px-1 rounded animate-pulse">
                          Alert
                        </span>
                      )}
                    </div>
                    <div className="flex items-center text-xs text-slate-600">
                      <User className="w-3 h-3 mr-2 text-orange-500" /> 
                      Fatigue: <span className="font-bold ml-1">{driver.incidents.fatigue}</span>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    {driver.incidents.speeding > 3 && (
                      <Button 
                        size="sm" 
                        variant="destructive" 
                        className="h-8 px-2" 
                        title="Generate Report & NCR"
                        onClick={() => router.push("/ncr/SAB001-25")}
                      >
                        <FileText className="w-4 h-4 mr-1" />
                        NCR
                      </Button>
                    )}
                    <Button size="sm" variant="outline" className="h-8 px-2">
                       Details
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {/* Unattended / Pending NCR Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-4 bg-white border border-slate-200">
          <div className="flex items-center gap-2 mb-4">
             <ClipboardList className="w-5 h-5 text-purple-600" />
             <h3 className="font-bold text-slate-900">Auto-Generated NCR Queue</h3>
          </div>
          <div className="space-y-3">
             {DRIVERS.filter(d => d.incidents.speeding > 3).map(driver => (
               <div key={driver.id} className="flex items-center justify-between p-3 bg-purple-50 rounded-lg border border-purple-100">
                 <div>
                   <p className="text-sm font-bold text-slate-900">{driver.name}</p>
                   <p className="text-xs text-slate-600">Excessive Speeding ({driver.incidents.speeding} violations)</p>
                 </div>
                 <Button 
                    size="sm" 
                    className="bg-purple-600 hover:bg-purple-700"
                    onClick={() => router.push("/ncr/SAB001-25")}
                 >
                   Sign & Send
                 </Button>
               </div>
             ))}
             {DRIVERS.filter(d => d.incidents.speeding > 3).length === 0 && (
               <p className="text-sm text-slate-500 italic">No pending NCRs generated.</p>
             )}
          </div>
        </Card>
      </div>

    </div>
  );
}
