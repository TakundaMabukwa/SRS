"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
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
import { useCostCenters } from "@/context/cost-centers-context";
import { FileText, ExternalLink, RefreshCw, ChevronLeft, ChevronRight } from "lucide-react";

const API = "/api/video-server/incidents";

interface Incident {
  id: string;
  incident_no: string | null;
  week: number | null;
  shift: string | null;
  incident_date: string | null;
  incident_time: string | null;
  controller: string | null;
  driver_name: string | null;
  contact_number: string | null;
  id_number: string | null;
  division: string | null;
  fleet_number: string | null;
  infringement: string | null;
  infringement_detail: string | null;
  action_taken: string | null;
  outcome: string | null;
  document_link: string | null;
  document_type: string | null;
  status: string;
  filled_by: string | null;
  filled_at: string | null;
}

const STATUS_COLORS: Record<string, string> = {
  OPEN: "bg-amber-100 text-amber-800 border-amber-300",
  RESOLVED: "bg-green-100 text-green-800 border-green-300",
  FALSE_ALERT: "bg-slate-100 text-slate-700 border-slate-300",
};

function fmt(value: string | null | undefined): string {
  return value ? String(value) : "—";
}

const CURRENT_MONTH_START = (() => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
})();
const CURRENT_MONTH_END = (() => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
})();

export default function ReportsPage() {
  const { selectedCostCenterIds } = useCostCenters();

  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);

  // Filters (default to the current calendar month)
  const [fleetNumber, setFleetNumber] = useState("");
  const [status, setStatus] = useState("ALL");
  const [from, setFrom] = useState(CURRENT_MONTH_START);
  const [to, setTo] = useState(CURRENT_MONTH_END);

  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [drafts, setDrafts] = useState<Record<string, { action_taken: string; outcome: string }>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedCostCenterIds.length > 0) params.set("cost_center_ids", selectedCostCenterIds.join(","));
      if (fleetNumber.trim()) params.set("fleet_number", fleetNumber.trim());
      if (status !== "ALL") params.set("status", status);
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      params.set("pageIndex", String(page));
      params.set("pageSize", String(pageSize));

      const res = await fetch(`${API}?${params.toString()}`, { cache: "no-store" });
      const data = await res.json();
      if (data.success) {
        setIncidents(data.incidents || []);
        setTotal(data.total || 0);
      }
    } catch {
      toast.error("Failed to load incident register");
    } finally {
      setLoading(false);
    }
  }, [selectedCostCenterIds, fleetNumber, status, from, to, page, pageSize]);

  useEffect(() => {
    load();
  }, [load]);

  const handleBlurSave = async (incidentId: string) => {
    const draft = drafts[incidentId];
    if (!draft) return;
    setSaving((s) => ({ ...s, [incidentId]: true }));
    try {
      const res = await fetch(`${API}/${incidentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action_taken: draft.action_taken || null,
          outcome: draft.outcome || null,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setDrafts((d) => {
          const next = { ...d };
          delete next[incidentId];
          return next;
        });
        setIncidents((list) => list.map((i) => (i.id === incidentId ? { ...i, ...data.incident } : i)));
        toast.success("Incident updated");
      }
    } catch {
      toast.error("Failed to update incident");
    } finally {
      setSaving((s) => ({ ...s, [incidentId]: false }));
    }
  };

  const totalPages = Math.max(Math.ceil(total / pageSize), 1);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <FileText className="h-6 w-6 text-red-600" />
            Reports <span className="text-slate-500 font-normal">/ Incident Register</span>
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            NCR &amp; incident records captured from alerts. {total} record{total === 1 ? "" : "s"}.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="space-y-1">
          <Label className="text-xs text-slate-500">Fleet #</Label>
          <Input
            placeholder="e.g. 123-456"
            value={fleetNumber}
            onChange={(e) => { setFleetNumber(e.target.value); setPage(1); }}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-slate-500">Status</Label>
          <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All</SelectItem>
              <SelectItem value="OPEN">Open</SelectItem>
              <SelectItem value="RESOLVED">Resolved</SelectItem>
              <SelectItem value="FALSE_ALERT">False Alert</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-slate-500">From</Label>
          <Input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-slate-500">To</Label>
          <Input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} />
        </div>
        <div className="flex items-end">
          <Button variant="secondary" size="sm" onClick={() => { setFleetNumber(""); setStatus("ALL"); setFrom(CURRENT_MONTH_START); setTo(CURRENT_MONTH_END); setPage(1); }}>
            Clear
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border shadow-sm overflow-auto max-h-[65vh]">
        <Table className="min-w-[1500px] text-xs [&_th]:px-2.5 [&_th]:py-2 [&_td]:px-2.5 [&_td]:py-2 [&_td]:align-top">
          <TableHeader>
            <TableRow>
              <TableHead>Incident ID</TableHead>
              <TableHead>Week</TableHead>
              <TableHead>Shift</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Time</TableHead>
              <TableHead>Controller</TableHead>
              <TableHead>Name &amp; Surname</TableHead>
              <TableHead>Contact #</TableHead>
              <TableHead>ID Number</TableHead>
              <TableHead>Division / Dept</TableHead>
              <TableHead>Fleet #</TableHead>
              <TableHead>Infringement</TableHead>
              <TableHead>Infringement Detail</TableHead>
              <TableHead>Action Taken</TableHead>
              <TableHead>Outcome</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Doc</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 17 }).map((__, j) => (
                    <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : incidents.length === 0 ? (
              <TableRow>
                <TableCell colSpan={17} className="text-center py-10 text-slate-500">
                  No incidents match the current filters
                </TableCell>
              </TableRow>
            ) : (
              incidents.map((inc) => {
                const draft = drafts[inc.id] || { action_taken: inc.action_taken || "", outcome: inc.outcome || "" };
                return (
                  <TableRow key={inc.id} className="align-top">
                    <TableCell className="font-medium text-slate-900">{fmt(inc.incident_no)}</TableCell>
                    <TableCell>{inc.week ?? "—"}</TableCell>
                    <TableCell>{fmt(inc.shift)}</TableCell>
                    <TableCell>{inc.incident_date ? String(inc.incident_date).slice(0, 10) : "—"}</TableCell>
                    <TableCell>{inc.incident_time ? String(inc.incident_time).slice(0, 5) : "—"}</TableCell>
                    <TableCell>{fmt(inc.controller)}</TableCell>
                    <TableCell>{fmt(inc.driver_name)}</TableCell>
                    <TableCell>{fmt(inc.contact_number)}</TableCell>
                    <TableCell>{fmt(inc.id_number)}</TableCell>
                    <TableCell>{fmt(inc.division)}</TableCell>
                    <TableCell className="font-medium">{fmt(inc.fleet_number)}</TableCell>
                    <TableCell>{fmt(inc.infringement)}</TableCell>
                    <TableCell className="max-w-[220px]">{fmt(inc.infringement_detail)}</TableCell>
                    <TableCell className="max-w-[200px] min-w-[180px]">
                      <Textarea
                        defaultValue={draft.action_taken}
                        onBlur={(e) => {
                          setDrafts((d) => ({ ...d, [inc.id]: { ...d[inc.id], action_taken: e.target.value } }));
                          handleBlurSave(inc.id);
                        }}
                        className="text-xs min-h-16 max-h-40"
                        rows={2}
                        disabled={saving[inc.id]}
                      />
                    </TableCell>
                    <TableCell className="max-w-[200px] min-w-[180px]">
                      <Textarea
                        defaultValue={draft.outcome}
                        onBlur={(e) => {
                          setDrafts((d) => ({ ...d, [inc.id]: { ...d[inc.id], outcome: e.target.value } }));
                          handleBlurSave(inc.id);
                        }}
                        className="text-xs min-h-16 max-h-40"
                        rows={2}
                        disabled={saving[inc.id]}
                      />
                    </TableCell>
                    <TableCell>
                      <Badge className={STATUS_COLORS[inc.status] || "bg-slate-100 text-slate-700"}>
                        {inc.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {inc.document_link ? (
                        <a href={inc.document_link} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline inline-flex items-center gap-1 text-xs">
                          <ExternalLink className="h-3 w-3" /> Open
                        </a>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-slate-500">Page {page} of {totalPages}</span>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(p - 1, 1))} disabled={page <= 1 || loading}>
            <ChevronLeft className="h-4 w-4" /> Prev
          </Button>
          <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(p + 1, totalPages))} disabled={page >= totalPages || loading}>
            Next <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}