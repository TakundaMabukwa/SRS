"use client";

import React, { useState } from "react";
import { format } from "date-fns";
import { 
  FileText, 
  Search, 
  Filter, 
  Download, 
  Eye, 
  Printer, 
  AlertTriangle, 
  CheckCircle2,
  Clock
} from "lucide-react";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useRouter } from "next/navigation";

// Mock Data for the Audit List
const AUDIT_LOGS = [
  {
    id: "NCR-2025-001",
    ref: "SAB001/25",
    date: "2025-01-03T12:08:00",
    driver: "Jeremiah",
    vehicle: "B16",
    type: "Speeding Violation",
    riskLevel: "High",
    status: "Open",
    amount: "R 2,500.00", // Potential fine/cost implication
  },
  {
    id: "NCR-2025-002",
    ref: "SAB002/25",
    date: "2025-01-04T09:15:00",
    driver: "Thomas M.",
    vehicle: "H22",
    type: "Fuel Theft Suspicion",
    riskLevel: "Critical",
    status: "Investigating",
    amount: "R 4,200.00",
  },
  {
    id: "NCR-2025-003",
    ref: "GF088/25",
    date: "2025-01-05T14:30:00",
    driver: "Sarah L.",
    vehicle: "V09",
    type: "Route Deviation",
    riskLevel: "Medium",
    status: "Closed",
    amount: "R 850.00",
  },
  {
    id: "NCR-2025-004",
    ref: "GF089/25",
    date: "2025-01-06T08:45:00",
    driver: "Michael B.",
    vehicle: "B16",
    type: "Documentation Missing",
    riskLevel: "Low",
    status: "Resolved",
    amount: "R 0.00",
  },
  {
    id: "NCR-2025-005",
    ref: "SAB005/25",
    date: "2025-01-07T16:20:00",
    driver: "Jeremiah",
    vehicle: "B16",
    type: "Harsh Braking Event",
    riskLevel: "Medium",
    status: "Open",
    amount: "R 1,200.00",
  }
];

export function FinancialAuditTab() {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const filteredLogs = AUDIT_LOGS.filter(log => {
    const matchesSearch = 
      log.driver.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.vehicle.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.ref.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.type.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || log.status.toLowerCase() === statusFilter.toLowerCase();
    
    return matchesSearch && matchesStatus;
  });

  const getRiskColor = (risk: string) => {
    switch (risk.toLowerCase()) {
      case 'critical': return "bg-red-100 text-red-800 border-red-200";
      case 'high': return "bg-orange-100 text-orange-800 border-orange-200";
      case 'medium': return "bg-yellow-100 text-yellow-800 border-yellow-200";
      default: return "bg-green-100 text-green-800 border-green-200";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case 'closed':
      case 'resolved': return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case 'investigating': return <AlertTriangle className="w-4 h-4 text-orange-500" />;
      default: return <Clock className="w-4 h-4 text-blue-500" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* KPI Cards for Financial Impact */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Open NCRs</CardTitle>
            <AlertTriangle className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {AUDIT_LOGS.filter(l => l.status === 'Open').length}
            </div>
            <p className="text-xs text-muted-foreground">Requires immediate attention</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Financial Risk</CardTitle>
            <div className="h-4 w-4 text-red-500 font-bold">R</div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">R 8,750.00</div>
            <p className="text-xs text-muted-foreground">Total estimated impact (Open)</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Resolved This Month</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {AUDIT_LOGS.filter(l => l.status === 'Resolved' || l.status === 'Closed').length}
            </div>
            <p className="text-xs text-muted-foreground">+12% from last month</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Highest Risk Driver</CardTitle>
            <FileText className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Jeremiah</div>
            <p className="text-xs text-muted-foreground">3 Active Incidents</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <CardTitle>Non-Conformance Reports</CardTitle>
              <CardDescription>
                Financial and operational audit logs for compliance tracking.
              </CardDescription>
            </div>
            <Button variant="outline" className="gap-2">
              <Download className="w-4 h-4" />
              Export Register
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search drivers, vehicles, or NCR ref..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="investigating">Investigating</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Table */}
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>NCR Reference</TableHead>
                  <TableHead>Date & Time</TableHead>
                  <TableHead>Driver & Vehicle</TableHead>
                  <TableHead>Violation / Incident</TableHead>
                  <TableHead>Risk Level</TableHead>
                  <TableHead>Fin. Impact</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLogs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="font-medium text-blue-600">
                      {log.ref}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">{format(new Date(log.date), 'dd MMM yyyy')}</span>
                        <span className="text-xs text-muted-foreground">{format(new Date(log.date), 'HH:mm')}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">{log.driver}</span>
                        <span className="text-xs text-muted-foreground">{log.vehicle}</span>
                      </div>
                    </TableCell>
                    <TableCell>{log.type}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={getRiskColor(log.riskLevel)}>
                        {log.riskLevel}
                      </Badge>
                    </TableCell>
                    <TableCell>{log.amount}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getStatusIcon(log.status)}
                        <span className="text-sm capitalize">{log.status}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          title="View Details"
                          onClick={() => router.push(`/ncr/${log.id}`)}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          title="Print / Download PDF"
                          onClick={() => router.push(`/ncr/${log.id}`)} // Reusing the view page which has print
                        >
                          <Printer className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
