"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Wrench, RefreshCw, ChevronLeft, ChevronRight, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

const API = "/api/video-server/repair-requests";

interface Repair {
  id: number;
  alert_id: string | null;
  fleet_number: string | null;
  registration: string | null;
  device_id: string | null;
  cost_center_id: number | null;
  status: string;
  notes: string | null;
  created_by: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  available_at: string | null;
  issue_description: string | null;
  job_description: string | null;
  priority: string | null;
  account_code: string | null;
  external_job_number: string | null;
  external_job_type: string | null;
  external_status: string | null;
  created_at: string;
  updated_at: string;
}

const EXT_STATUS_COLORS: Record<string, string> = {
  created: "bg-green-100 text-green-800 border-green-300",
  failed: "bg-red-100 text-red-800 border-red-300",
  pending: "bg-amber-100 text-amber-800 border-amber-300",
};

const STATUS_OPTIONS = ["pending", "in-progress", "completed", "cancelled"];

function fmt(value: string | null | undefined): string {
  return value ? String(value) : "—";
}

function fmtDT(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString("en-ZA", {
    timeZone: "Africa/Johannesburg",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export default function RepairsPage() {
  const [repairs, setRepairs] = useState<Repair[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});

  const [fleetNumber, setFleetNumber] = useState("");
  const [status, setStatus] = useState("ALL");
  const [saving, setSaving] = useState<Record<number, boolean>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (fleetNumber.trim()) params.set("fleet_number", fleetNumber.trim());
      if (status !== "ALL") params.set("status", status);
      params.set("limit", String(pageSize));
      params.set("offset", String((page - 1) * pageSize));

      const res = await fetch(`${API}?${params.toString()}`, { cache: "no-store" });
      const data = await res.json();
      if (data.success) {
        setRepairs(data.repairs || []);
        setTotal(data.total || 0);
      } else {
        toast.error(data.message || "Failed to load repairs");
      }
    } catch {
      toast.error("Failed to load repairs");
    } finally {
      setLoading(false);
    }
  }, [fleetNumber, status, page, pageSize]);

  useEffect(() => {
    load();
  }, [load]);

  const updateStatus = async (id: number, newStatus: string) => {
    setSaving((s) => ({ ...s, [id]: true }));
    try {
      const res = await fetch(`${API}/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Repair #${id} marked ${newStatus}`);
        setRepairs((rows) => rows.map((r) => (r.id === id ? { ...r, status: newStatus } : r)));
      } else {
        toast.error(data.message || "Failed to update status");
      }
    } catch {
      toast.error("Failed to update status");
    } finally {
      setSaving((s) => ({ ...s, [id]: false }));
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Wrench className="h-5 w-5 text-amber-600" />
          <h1 className="text-xl font-semibold text-slate-900">Logged Repairs</h1>
          <Badge variant="outline" className="ml-1">{total}</Badge>
        </div>
        <Button size="sm" variant="outline" onClick={load} disabled={loading}>
          <RefreshCw className={cn("h-3.5 w-3.5 mr-1", loading && "animate-spin")} />
          Refresh
        </Button>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-white p-3 shadow-sm">
        <div>
          <Label htmlFor="rep-fleet">Fleet number</Label>
          <Input
            id="rep-fleet"
            value={fleetNumber}
            onChange={(e) => { setFleetNumber(e.target.value); setPage(1); }}
            placeholder="e.g. PB22"
            className="h-8 w-44"
          />
        </div>
        <div>
          <Label>Status</Label>
          <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
            <SelectTrigger className="h-8 w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All</SelectItem>
              {STATUS_OPTIONS.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="rounded-lg border bg-white shadow-sm overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8" />
              <TableHead>Logged</TableHead>
              <TableHead>Fleet</TableHead>
              <TableHead>Reg</TableHead>
              <TableHead>Issue</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Available</TableHead>
              <TableHead>Job #</TableHead>
              <TableHead>Solflo</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={10}><Skeleton className="h-6 w-full" /></TableCell>
                </TableRow>
              ))
            ) : repairs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center text-slate-500 py-8">
                  No repair requests found.
                </TableCell>
              </TableRow>
            ) : (
              repairs.map((r) => (
                <Fragment key={r.id}>
                  <TableRow key={r.id}>
                    <TableCell>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6"
                        onClick={() => setExpanded((e) => ({ ...e, [r.id]: !e[r.id] }))}
                      >
                        <ChevronDown className={cn("h-4 w-4 transition-transform", expanded[r.id] && "rotate-180")} />
                      </Button>
                    </TableCell>
                    <TableCell className="text-xs whitespace-nowrap">{fmtDT(r.created_at)}</TableCell>
                    <TableCell className="font-medium">{fmt(r.fleet_number)}</TableCell>
                    <TableCell>{fmt(r.registration)}</TableCell>
                    <TableCell className="max-w-[220px] truncate text-xs" title={r.issue_description || ""}>
                      {fmt(r.issue_description)}
                    </TableCell>
                    <TableCell className="text-xs">
                      {r.contact_name ? (
                        <span title={`${r.contact_phone || ""} · ${r.contact_email || ""}`}>
                          {r.contact_name}
                          <span className="text-slate-500"> · {fmt(r.contact_phone)}</span>
                        </span>
                      ) : "—"}
                    </TableCell>
                    <TableCell className="text-xs whitespace-nowrap">
                      {r.available_at ? fmtDT(r.available_at) : "—"}
                    </TableCell>
                    <TableCell className="text-xs font-mono whitespace-nowrap">
                      {r.external_job_number || "—"}
                      {r.external_job_type ? (
                        <span className="text-slate-500"> ({r.external_job_type})</span>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={EXT_STATUS_COLORS[r.external_status || "pending"] || EXT_STATUS_COLORS.pending}>
                        {r.external_status || "pending"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={r.status || "pending"}
                        onValueChange={(v) => updateStatus(r.id, v)}
                        disabled={!!saving[r.id]}
                      >
                        <SelectTrigger className="h-7 w-32 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {STATUS_OPTIONS.map((s) => (
                            <SelectItem key={s} value={s}>{s}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                  {expanded[r.id] && (
                    <TableRow key={`${r.id}-detail`}>
                      <TableCell />
                      <TableCell colSpan={9} className="bg-slate-50 text-xs">
                        <div className="grid gap-1 py-1">
                          <div><span className="font-semibold">Requested by:</span> {fmt(r.created_by)}</div>
                          <div><span className="font-semibold">Email:</span> {fmt(r.contact_email)}</div>
                          <div><span className="font-semibold">Priority:</span> {fmt(r.priority)} <span className="font-semibold ml-3">Account:</span> {fmt(r.account_code)}</div>
                          <div className="whitespace-pre-wrap"><span className="font-semibold">Job description sent to Solflo:</span>{"\n"}{fmt(r.job_description)}</div>
                          {r.notes ? <div><span className="font-semibold">Notes:</span> {r.notes}</div> : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-end gap-2 text-sm text-slate-600">
        <span>Page {page} of {totalPages}</span>
        <Button size="icon" variant="outline" className="h-7 w-7" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button size="icon" variant="outline" className="h-7 w-7" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
