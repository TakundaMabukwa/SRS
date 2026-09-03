"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Plus,
  Pencil,
  Trash2,
  Shield,
  AlertTriangle,
  Camera,
  Cpu,
  X,
  Save,
  Settings,
  Users,
  Clock,
  Copy,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useCostCenters } from "@/context/cost-centers-context";
import { BellRing } from "lucide-react";
import { EscalationSection } from "@/components/settings/escalation-section";

const ALERT_CONFIG_API = "/api/video-server/alert-config";
const DRIVER_CONFIG_API = "/api/video-server/driver-config";

const SEVERITY_OPTIONS = ["CRITICAL", "HIGH", "MEDIUM", "LOW"] as const;
type Severity = typeof SEVERITY_OPTIONS[number];

const SEVERITY_COLORS: Record<Severity, string> = {
  CRITICAL: "bg-red-100 text-red-800 border-red-200",
  HIGH: "bg-orange-100 text-orange-800 border-orange-200",
  MEDIUM: "bg-yellow-100 text-yellow-800 border-yellow-200",
  LOW: "bg-blue-100 text-blue-800 border-blue-200",
};

type AlertDefinition = {
  id: number;
  name: string;
  category: "telematics" | "video";
  description: string;
  signal_code: string;
  severity: Severity;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // Override fields (present when fetched with cost_center_id)
  override_severity?: Severity | null;
  override_description?: string | null;
  override_is_active?: boolean | null;
  override_id?: number | null;
  override_cc_id?: number | null;
};

type AlertGroupConfig = {
  id: number;
  name: string;
  severity: Severity;
  description: string;
  is_active: boolean;
  members: AlertDefinition[];
  created_at: string;
  updated_at: string;
  // Override fields
  override_severity?: Severity | null;
  override_description?: string | null;
  override_is_active?: boolean | null;
  override_id?: number | null;
  override_cc_id?: number | null;
};

type DriverConfigCriterion = {
  id: number;
  name: string;
  selected_weighting: number;
  actual_weighting: number;
  risk_tiers: number;
  no_incidents: number;
  statuses: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
  nrc_deduction: boolean;
  incidents_threshold: number;
  deduction_per_alert: number;
  deduction_with_ncr: number;
  ncr_threshold: number;
  cost_center_id: number | null;
  config_group_id: number | null;
};

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState("alert-config");
  const { selectedCostCenterIds } = useCostCenters();

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b px-6 py-4">
        <h1 className="text-2xl font-bold">System Settings</h1>
        <p className="text-sm text-gray-600">Configure alerts, driver monitoring, and system preferences</p>
      </div>

      <div className="px-6 py-4">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4">
            <TabsTrigger value="alert-config" className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              Alert Config
            </TabsTrigger>
            <TabsTrigger value="driver-config" className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              Driver Config
            </TabsTrigger>
            <TabsTrigger value="config-groups" className="flex items-center gap-2">
              <Settings className="w-4 h-4" />
              Config Groups
            </TabsTrigger>
            <TabsTrigger value="rtms-config" className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              RTMS
            </TabsTrigger>
            <TabsTrigger value="escalation" className="flex items-center gap-2">
              <BellRing className="w-4 h-4" />
              Escalation
            </TabsTrigger>
          </TabsList>

          <TabsContent value="alert-config">
            <AlertConfigSection />
          </TabsContent>

          <TabsContent value="driver-config">
            <DriverConfigSection />
          </TabsContent>

          <TabsContent value="config-groups">
            <ConfigGroupsSection />
          </TabsContent>

          <TabsContent value="rtms-config">
            <RTMSConfigSection />
          </TabsContent>

          <TabsContent value="escalation">
            <EscalationSection />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function AlertConfigSection() {
  const { costCenters, selectedCostCenterIds } = useCostCenters();
  const [activeSection, setActiveSection] = useState<"definitions" | "groups">("definitions");
  const [definitions, setDefinitions] = useState<AlertDefinition[]>([]);
  const [groups, setGroups] = useState<AlertGroupConfig[]>([]);
  const [loading, setLoading] = useState(true);

  const [showDefForm, setShowDefForm] = useState(false);
  const [editingDef, setEditingDef] = useState<AlertDefinition | null>(null);
  const [defForm, setDefForm] = useState({ name: "", category: "telematics" as "telematics" | "video", description: "", signal_code: "", severity: "MEDIUM" as Severity });

  const [showGroupForm, setShowGroupForm] = useState(false);
  const [editingGroup, setEditingGroup] = useState<AlertGroupConfig | null>(null);
  const [groupForm, setGroupForm] = useState({ name: "", severity: "MEDIUM" as Severity, description: "", memberIds: [] as number[] });

  const [showOverrideDefConfirm, setShowOverrideDefConfirm] = useState(false);
  const [showOverrideGroupConfirm, setShowOverrideGroupConfirm] = useState(false);
  const [overrideLoading, setOverrideLoading] = useState(false);

  const isMultiCc = selectedCostCenterIds.length > 1;
  const firstCcId = selectedCostCenterIds[0] || null;

  // Multi-CC clarity: for each definition, in how many selected CCs is it in
  // set, and does its effective severity differ across those CCs? The table
  // body always reflects the FIRST selected CC; these markers expose the rest.
  const [setCounts, setSetCounts] = useState<Record<number, number>>({});
  const [mixedSev, setMixedSev] = useState<Record<number, boolean>>({});

  const fetchSetState = useCallback(async () => {
    if (selectedCostCenterIds.length <= 1) { setSetCounts({}); setMixedSev({}); return; }
    try {
      const lists = await Promise.all(selectedCostCenterIds.map(async (ccId) => {
        const res = await fetch(`${ALERT_CONFIG_API}/definitions?cost_center_id=${ccId}`, { cache: "no-store" });
        const data = await res.json();
        return (data?.data || []) as AlertDefinition[];
      }));
      const counts: Record<number, number> = {};
      const sevSets: Record<number, Set<string>> = {};
      for (const list of lists) {
        for (const d of list) {
          if (d.override_id != null) {
            counts[d.id] = (counts[d.id] || 0) + 1;
            const eff = String(d.override_severity || d.severity || "MEDIUM");
            if (!sevSets[d.id]) sevSets[d.id] = new Set();
            sevSets[d.id].add(eff);
          }
        }
      }
      const mixed: Record<number, boolean> = {};
      for (const [id, s] of Object.entries(sevSets)) {
        if (s.size > 1) mixed[Number(id)] = true;
      }
      setSetCounts(counts);
      setMixedSev(mixed);
    } catch { /* non-critical clarity layer */ }
  }, [selectedCostCenterIds]);

  // Fetch definitions — server returns merged base + override rows
  const fetchDefinitions = useCallback(async () => {
    try {
      const url = firstCcId
        ? `${ALERT_CONFIG_API}/definitions?cost_center_id=${firstCcId}`
        : `${ALERT_CONFIG_API}/definitions`;
      const res = await fetch(url, { cache: "no-store" });
      const data = await res.json();
      setDefinitions(((data?.data || []) as AlertDefinition[]).sort((a, b) => a.name.localeCompare(b.name)));
    } catch {
      setDefinitions([]);
    }
  }, [firstCcId]);

  // Fetch groups — server returns merged base + override rows
  const fetchGroups = useCallback(async () => {
    try {
      const url = firstCcId
        ? `${ALERT_CONFIG_API}/groups?cost_center_id=${firstCcId}`
        : `${ALERT_CONFIG_API}/groups`;
      const res = await fetch(url, { cache: "no-store" });
      const data = await res.json();
      setGroups(((data?.data || []) as AlertGroupConfig[]).sort((a, b) => a.name.localeCompare(b.name)));
    } catch {
      setGroups([]);
    }
  }, [firstCcId]);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchDefinitions(), fetchGroups(), fetchSetState()])
      .finally(() => setLoading(false));
  }, [fetchDefinitions, fetchGroups, fetchSetState]);

  // Save definition — global mode edits base; CC mode upserts override
  const handleSaveDef = async () => {
    try {
      if (selectedCostCenterIds.length === 0) {
        // Global mode — edit base definition
        const url = editingDef ? `${ALERT_CONFIG_API}/definitions/${editingDef.id}` : `${ALERT_CONFIG_API}/definitions`;
        const method = editingDef ? "PUT" : "POST";
        const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(defForm) });
        if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.message || "Failed"); }
        toast.success(editingDef ? "Alert type updated" : "Alert type created");
      } else {
        // CC mode — upsert overrides for all selected CCs
        const defId = editingDef?.id;
        if (!defId) {
          toast.error("Click the pencil icon on an Available alert below to add it to this cost center's set");
          return;
        }
        await fetch(`${ALERT_CONFIG_API}/definitions/${defId}/overrides/bulk`, {
          method: "PUT", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cost_center_ids: selectedCostCenterIds, severity: defForm.severity, description: defForm.description }),
        });
        toast.success(`Alert added to ${selectedCostCenterIds.length} cost center set(s)`);
      }
      setShowDefForm(false);
      setEditingDef(null);
      setDefForm({ name: "", category: "telematics", description: "", signal_code: "", severity: "MEDIUM" });
      fetchDefinitions();
      fetchSetState();
    } catch (e: any) {
      toast.error(e?.message || "Failed to save");
    }
  };

  // Delete definition
  const handleDeleteDef = async (def: AlertDefinition) => {
    if (selectedCostCenterIds.length > 0) {
      // Purge from ALL cost center sets — the alert is not necessary anywhere.
      // (Global definition is left intact for CC-less vehicles; use Global mode
      // delete to remove the alert type entirely.)
      if (!confirm(`Remove "${def.name}" from ALL cost center sets? It will stop coming in for every cost center.`)) return;
      try {
        const res = await fetch(`${ALERT_CONFIG_API}/definitions/${def.id}/overrides`, { method: "DELETE" });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.message || "Failed to delete");
        toast.success(data.message || "Removed from all cost centers");
        fetchDefinitions();
        fetchSetState();
      } catch (e: any) { toast.error(e?.message || "Failed to delete"); }
    } else if (selectedCostCenterIds.length === 0) {
      // Global mode — delete base definition
      if (!confirm("Delete this alert type entirely? This cannot be undone.")) return;
      try {
        await fetch(`${ALERT_CONFIG_API}/definitions/${def.id}`, { method: "DELETE" });
        toast.success("Deleted");
        fetchDefinitions();
      } catch { toast.error("Failed to delete"); }
    }
  };

  // Save group — global mode edits base; CC mode upserts override
  const handleSaveGroup = async () => {
    try {
      if (selectedCostCenterIds.length === 0) {
        const url = editingGroup ? `${ALERT_CONFIG_API}/groups/${editingGroup.id}` : `${ALERT_CONFIG_API}/groups`;
        const method = editingGroup ? "PUT" : "POST";
        const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...groupForm, member_ids: groupForm.memberIds }) });
        if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.message || "Failed"); }
        toast.success(editingGroup ? "Alert group updated" : "Alert group created");
      } else {
        const grpId = editingGroup?.id;
        if (!grpId) { toast.error("Select a group to edit"); return; }
        await fetch(`${ALERT_CONFIG_API}/groups/${grpId}/overrides/bulk`, {
          method: "PUT", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cost_center_ids: selectedCostCenterIds, severity: groupForm.severity, description: groupForm.description }),
        });
        toast.success(`Override saved for ${selectedCostCenterIds.length} cost center(s)`);
      }
      setShowGroupForm(false);
      setEditingGroup(null);
      setGroupForm({ name: "", severity: "MEDIUM", description: "", memberIds: [] });
      fetchGroups();
    } catch (e: any) {
      toast.error(e?.message || "Failed to save");
    }
  };

  // Delete group
  const handleDeleteGroup = async (group: AlertGroupConfig) => {
    const hasOverride = group.override_id != null;
    if (selectedCostCenterIds.length > 0 && hasOverride) {
      if (!confirm("Remove this cost center's override? The global default will apply.")) return;
      try {
        for (const ccId of selectedCostCenterIds) {
          await fetch(`${ALERT_CONFIG_API}/groups/${group.id}/overrides/${ccId}`, { method: "DELETE" });
        }
        toast.success("Override removed");
        fetchGroups();
      } catch { toast.error("Failed to delete override"); }
    } else if (selectedCostCenterIds.length === 0) {
      if (!confirm("Delete this alert group entirely? This cannot be undone.")) return;
      try {
        await fetch(`${ALERT_CONFIG_API}/groups/${group.id}`, { method: "DELETE" });
        toast.success("Deleted");
        fetchGroups();
      } catch { toast.error("Failed to delete"); }
    } else {
      toast.error("No override to remove for this cost center");
    }
  };

  // Override from global — create overrides for all defs/groups that don't have one yet
  const handleOverrideDefsFromGlobal = async () => {
    if (selectedCostCenterIds.length === 0) return;
    setOverrideLoading(true);
    try {
      const defsToOverride = definitions.filter(d => d.override_id == null);
      for (const def of defsToOverride) {
        await fetch(`${ALERT_CONFIG_API}/definitions/${def.id}/overrides/bulk`, {
          method: "PUT", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cost_center_ids: selectedCostCenterIds, severity: def.severity, description: def.description }),
        });
      }
      toast.success(`Override created: ${defsToOverride.length} alert type(s) copied to ${selectedCostCenterIds.length} cost center(s)`);
      setShowOverrideDefConfirm(false);
      fetchDefinitions();
      fetchSetState();
    } catch (e: any) { toast.error(e?.message || "Failed to override"); }
    finally { setOverrideLoading(false); }
  };

  const handleOverrideGroupsFromGlobal = async () => {
    if (selectedCostCenterIds.length === 0) return;
    setOverrideLoading(true);
    try {
      const groupsToOverride = groups.filter(g => g.override_id == null);
      for (const group of groupsToOverride) {
        await fetch(`${ALERT_CONFIG_API}/groups/${group.id}/overrides/bulk`, {
          method: "PUT", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cost_center_ids: selectedCostCenterIds, severity: group.severity, description: group.description }),
        });
      }
      toast.success(`Override created: ${groupsToOverride.length} alert group(s) copied to ${selectedCostCenterIds.length} cost center(s)`);
      setShowOverrideGroupConfirm(false);
      fetchGroups();
    } catch (e: any) { toast.error(e?.message || "Failed to override"); }
    finally { setOverrideLoading(false); }
  };

  const ccNames = selectedCostCenterIds.map(id => costCenters.find(cc => cc.id === id)?.name || `CC#${id}`);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Alert Types & Groups</h2>
        <p className="text-sm text-gray-500">
          {selectedCostCenterIds.length === 0
            ? "Global Defaults — applies ONLY to vehicles with no cost center. Vehicles in a cost center use ONLY that cost center's alert set."
            : `Configuring ${selectedCostCenterIds.length} cost center(s): ${ccNames.join(", ")} — only alerts in this set will come in for these vehicles`
          }
        </p>
      </div>
      <AlertConfigPanel
        activeSection={activeSection}
        setActiveSection={setActiveSection}
        definitions={definitions}
        groups={groups}
        loading={loading}
        selectedCcIds={selectedCostCenterIds}
        isMultiCc={isMultiCc}
        costCenterNames={ccNames}
        onEditDef={(def: AlertDefinition) => {
          const effectiveSeverity = def.override_severity || def.severity;
          const effectiveDescription = def.override_description ?? def.description;
          setEditingDef(def);
          setDefForm({ name: def.name, category: def.category, description: effectiveDescription, signal_code: def.signal_code, severity: (effectiveSeverity as Severity) || "MEDIUM" });
          setShowDefForm(true);
        }}
        onDeleteDef={handleDeleteDef}
        onEditGroup={(group: AlertGroupConfig) => {
          const effectiveSeverity = group.override_severity || group.severity;
          const effectiveDescription = group.override_description ?? group.description;
          setEditingGroup(group);
          setGroupForm({ name: group.name, severity: (effectiveSeverity as Severity) || "MEDIUM", description: effectiveDescription, memberIds: (group.members || []).map((m: AlertDefinition) => m.id) });
          setShowGroupForm(true);
        }}
        onDeleteGroup={handleDeleteGroup}
        showDefForm={showDefForm}
        setShowDefForm={setShowDefForm}
        editingDef={editingDef}
        setEditingDef={setEditingDef}
        defForm={defForm}
        setDefForm={setDefForm}
        handleSaveDef={handleSaveDef}
        showGroupForm={showGroupForm}
        setShowGroupForm={setShowGroupForm}
        editingGroup={editingGroup}
        setEditingGroup={setEditingGroup}
        groupForm={groupForm}
        setGroupForm={setGroupForm}
        handleSaveGroup={handleSaveGroup}
        showOverrideDefConfirm={showOverrideDefConfirm}
        setShowOverrideDefConfirm={setShowOverrideDefConfirm}
        showOverrideGroupConfirm={showOverrideGroupConfirm}
        setShowOverrideGroupConfirm={setShowOverrideGroupConfirm}
        overrideLoading={overrideLoading}
        handleOverrideDefsFromGlobal={handleOverrideDefsFromGlobal}
        handleOverrideGroupsFromGlobal={handleOverrideGroupsFromGlobal}
        setCounts={setCounts}
        mixedSev={mixedSev}
      />
    </div>
  );
}

function AlertConfigPanel({
  activeSection, setActiveSection, definitions, groups, loading, selectedCcIds, isMultiCc, costCenterNames,
  onEditDef, onDeleteDef, onEditGroup, onDeleteGroup,
  showDefForm, setShowDefForm, editingDef, setEditingDef, defForm, setDefForm, handleSaveDef,
  showGroupForm, setShowGroupForm, editingGroup, setEditingGroup, groupForm, setGroupForm, handleSaveGroup,
  showOverrideDefConfirm, setShowOverrideDefConfirm, showOverrideGroupConfirm, setShowOverrideGroupConfirm,
  overrideLoading, handleOverrideDefsFromGlobal, handleOverrideGroupsFromGlobal,
  setCounts, mixedSev,
}: any) {
  if (loading) return <div className="text-sm text-gray-500 py-4">Loading...</div>;

  const hasCcSelected = selectedCcIds.length > 0;
  const customizedDefs = hasCcSelected ? definitions.filter((d: AlertDefinition) => d.override_id != null) : [];
  const inheritedDefs = hasCcSelected ? definitions.filter((d: AlertDefinition) => d.override_id == null) : [];
  const customizedGroups = hasCcSelected ? groups.filter((g: AlertGroupConfig) => g.override_id != null) : [];
  const inheritedGroups = hasCcSelected ? groups.filter((g: AlertGroupConfig) => g.override_id == null) : [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <Button
            variant={activeSection === "definitions" ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveSection("definitions")}
            className="flex items-center gap-2"
          >
            <Cpu className="w-4 h-4" />
            Alert Types
          </Button>
          <Button
            variant={activeSection === "groups" ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveSection("groups")}
            className="flex items-center gap-2"
          >
            <Shield className="w-4 h-4" />
            Alert Groups
          </Button>
        </div>
        {hasCcSelected && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => activeSection === "definitions" ? setShowOverrideDefConfirm(true) : setShowOverrideGroupConfirm(true)}
          >
            <Copy className="w-4 h-4 mr-1" /> Override from Global
          </Button>
        )}
      </div>

      {/* Multi-CC info banner */}
      {isMultiCc && (
        <div className="bg-blue-50 border border-blue-200 rounded-md px-3 py-2 text-sm text-blue-700">
          Applying changes to {selectedCcIds.length} cost centers: {costCenterNames.join(", ")}
        </div>
      )}
      {/* Multi-CC clarity: values shown are for the first selected cost center */}
      {isMultiCc && activeSection === "definitions" && (
        <div className="bg-amber-50 border border-amber-200 rounded-md px-3 py-2 text-sm text-amber-800">
          Showing values for <strong>{costCenterNames[0] || "first selected"}</strong> — bulk edits apply to all {selectedCcIds.length} selected cost centers.
          Rows marked <strong>Mixed</strong> have different severities across cost centers.
        </div>
      )}

      {activeSection === "definitions" && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              {hasCcSelected ? <Badge>Alert Types</Badge> : <Badge variant="outline">Global</Badge>}
              <span className="text-gray-400 font-normal">
                ({definitions.length} definitions{hasCcSelected ? ` — ${customizedDefs.length} in set, ${inheritedDefs.length} available` : ""})
              </span>
            </CardTitle>
            <Button size="sm" onClick={() => { setShowDefForm(true); setEditingDef(null); setDefForm({ name: "", category: "telematics", description: "", signal_code: "", severity: "MEDIUM" }); }}>
              <Plus className="w-4 h-4 mr-1" /> Add Alert Type
            </Button>
          </CardHeader>
          <CardContent>
            <Dialog open={showDefForm} onOpenChange={(open) => { if (!open) { setShowDefForm(false); setEditingDef(null); } }}>
              <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                  <DialogTitle>{editingDef ? "Edit Alert Type" : "Add Alert Type"}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-2">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-sm font-medium">Name</label>
                      <Input value={defForm.name} onChange={(e) => setDefForm({ ...defForm, name: e.target.value })} placeholder="e.g. Harsh Braking" />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Category</label>
                      <Select value={defForm.category} onValueChange={(v: "telematics" | "video") => setDefForm({ ...defForm, category: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="telematics">Telematics</SelectItem>
                          <SelectItem value="video">Video</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-sm font-medium">Severity</label>
                      <Select value={defForm.severity} onValueChange={(v: Severity) => setDefForm({ ...defForm, severity: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {SEVERITY_OPTIONS.map((s) => (
                            <SelectItem key={s} value={s}>{s}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Description</label>
                    <Input value={defForm.description || ""} onChange={(e) => setDefForm({ ...defForm, description: e.target.value })} placeholder="Optional description" />
                  </div>
                  {isMultiCc && (
                    <p className="text-xs text-blue-600 bg-blue-50 p-2 rounded">
                      This will be saved to all {selectedCcIds.length} selected cost centers.
                    </p>
                  )}
                  <div className="flex gap-2 justify-end">
                    <Button size="sm" variant="outline" onClick={() => { setShowDefForm(false); setEditingDef(null); }}>Cancel</Button>
                    <Button size="sm" onClick={handleSaveDef}><Save className="w-4 h-4 mr-1" /> {editingDef ? "Update" : "Create"}</Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-gray-500">
                  <th className="py-2">Name</th>
                  <th>Category</th>
                  <th>Severity</th>
                  <th>Description</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {definitions.map((def: AlertDefinition) => (
                  <tr key={def.id} className="border-b">
                    <td className="py-2 font-medium">
                      <div className="flex items-center gap-2">
                        {def.name}
                        {hasCcSelected && def.override_id != null && (
                          <Badge variant="default" className="text-[10px]">
                            In set{isMultiCc && setCounts?.[def.id] != null ? ` (${setCounts[def.id]}/${selectedCcIds.length})` : ""}
                          </Badge>
                        )}
                        {hasCcSelected && def.override_id == null && <Badge variant="outline" className="text-[10px] text-gray-400 border-gray-200">Available</Badge>}
                      </div>
                    </td>
                    <td><Badge variant={def.category === "telematics" ? "default" : "secondary"}>{def.category}</Badge></td>
                    <td>
                      {isMultiCc && mixedSev?.[def.id] ? (
                        <Badge variant="outline" className="text-[10px] border-amber-400 text-amber-700" title="Severity differs across the selected cost centers">Mixed</Badge>
                      ) : (
                        <Badge className={SEVERITY_COLORS[(def.override_severity || def.severity) as Severity]}>{(def.override_severity || def.severity) || "MEDIUM"}</Badge>
                      )}
                    </td>
                    <td className="text-gray-500">{(def.override_description ?? def.description) || "—"}</td>
                    <td><Badge variant={def.is_active ? "default" : "outline"}>{def.is_active ? "Active" : "Inactive"}</Badge></td>
                    <td>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => onEditDef(def)}>
                          <Pencil className="w-3 h-3" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => onDeleteDef(def)}>
                          <Trash2 className="w-3 h-3 text-red-500" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {activeSection === "groups" && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              {hasCcSelected ? <Badge>Alert Groups</Badge> : <Badge variant="outline">Global</Badge>}
              <span className="text-gray-400 font-normal">
                ({groups.length} groups{hasCcSelected ? ` — ${inheritedGroups.length} inherited, ${customizedGroups.length} customized` : ""})
              </span>
            </CardTitle>
            <Button size="sm" onClick={() => { setShowGroupForm(true); setEditingGroup(null); setGroupForm({ name: "", severity: "MEDIUM", description: "", memberIds: [] }); }}>
              <Plus className="w-4 h-4 mr-1" /> Add Alert Group
            </Button>
          </CardHeader>
          <CardContent>
            {showGroupForm && (
              <div className="mb-4 p-4 border rounded-lg bg-gray-50 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium">Name</label>
                    <Input value={groupForm.name} onChange={(e) => setGroupForm({ ...groupForm, name: e.target.value })} placeholder="e.g. Safety Alerts" />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Severity</label>
                    <Select value={groupForm.severity} onValueChange={(v: Severity) => setGroupForm({ ...groupForm, severity: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {SEVERITY_OPTIONS.map((s) => (
                          <SelectItem key={s} value={s}>{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium">Description</label>
                  <Input value={groupForm.description} onChange={(e) => setGroupForm({ ...groupForm, description: e.target.value })} placeholder="Optional description" />
                </div>
                <div>
                  <label className="text-sm font-medium">Member Alert Types</label>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {definitions.map((def: AlertDefinition) => (
                      <Badge
                        key={def.id}
                        variant={groupForm.memberIds.includes(def.id) ? "default" : "outline"}
                        className="cursor-pointer"
                        onClick={() => {
                          setGroupForm({
                            ...groupForm,
                            memberIds: groupForm.memberIds.includes(def.id)
                              ? groupForm.memberIds.filter((id: number) => id !== def.id)
                              : [...groupForm.memberIds, def.id],
                          });
                        }}
                      >
                        {def.name}
                      </Badge>
                    ))}
                  </div>
                </div>
                {isMultiCc && (
                  <p className="text-xs text-blue-600 bg-blue-50 p-2 rounded">
                    This will be saved to all {selectedCcIds.length} selected cost centers.
                  </p>
                )}
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleSaveGroup}><Save className="w-4 h-4 mr-1" /> {editingGroup ? "Update" : "Create"}</Button>
                  <Button size="sm" variant="outline" onClick={() => { setShowGroupForm(false); setEditingGroup(null); }}>Cancel</Button>
                </div>
              </div>
            )}

            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-gray-500">
                  <th className="py-2">Name</th>
                  <th>Severity</th>
                  <th>Description</th>
                  <th>Members</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {groups.map((group: AlertGroupConfig) => (
                  <tr key={group.id} className="border-b">
                    <td className="py-2 font-medium">
                      <div className="flex items-center gap-2">
                        {group.name}
                        {hasCcSelected && group.override_id != null && <Badge variant="default" className="text-[10px]">Custom</Badge>}
                        {hasCcSelected && group.override_id == null && <Badge variant="outline" className="text-[10px] text-gray-400 border-gray-200">Global</Badge>}
                      </div>
                    </td>
                    <td><Badge className={SEVERITY_COLORS[(group.override_severity || group.severity) as Severity]}>{(group.override_severity || group.severity) || "MEDIUM"}</Badge></td>
                    <td className="text-gray-500">{(group.override_description ?? group.description) || "—"}</td>
                    <td>
                      <div className="flex flex-wrap gap-1">
                        {(group.members || []).slice(0, 3).map((m: AlertDefinition) => (
                          <Badge key={m.id} variant="outline" className="text-xs">{m.name}</Badge>
                        ))}
                        {(group.members || []).length > 3 && (
                          <Badge variant="outline" className="text-xs">+{(group.members || []).length - 3}</Badge>
                        )}
                      </div>
                    </td>
                    <td><Badge variant={group.is_active ? "default" : "outline"}>{group.is_active ? "Active" : "Inactive"}</Badge></td>
                    <td>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => onEditGroup(group)}>
                          <Pencil className="w-3 h-3" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => onDeleteGroup(group)}>
                          <Trash2 className="w-3 h-3 text-red-500" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* Override from Global Confirmation Dialogs */}
      <Dialog open={showOverrideDefConfirm} onOpenChange={setShowOverrideDefConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Override Alert Types from Global</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-gray-600">
              This will add all global alert types to {isMultiCc ? `all ${selectedCcIds.length} selected cost centers` : "this cost center"}'s alert set. Only alerts in the set will come in for its vehicles.
            </p>
            <p className="text-sm text-gray-500">
              Existing custom alert types will not be affected.
            </p>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setShowOverrideDefConfirm(false)}>Cancel</Button>
              <Button size="sm" disabled={overrideLoading} onClick={handleOverrideDefsFromGlobal}>
                {overrideLoading ? "Copying..." : "Confirm Override"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showOverrideGroupConfirm} onOpenChange={setShowOverrideGroupConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Override Alert Groups from Global</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-gray-600">
              This will copy all global alert groups as custom overrides for {isMultiCc ? `all ${selectedCcIds.length} selected cost centers` : "this cost center"}.
            </p>
            <p className="text-sm text-gray-500">
              Existing custom alert groups will not be affected.
            </p>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setShowOverrideGroupConfirm(false)}>Cancel</Button>
              <Button size="sm" disabled={overrideLoading} onClick={handleOverrideGroupsFromGlobal}>
                {overrideLoading ? "Copying..." : "Confirm Override"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AlertSearchDropdown({ selected, onAdd, onRemove, alertDefinitions }: { selected: string[]; onAdd: (name: string) => void; onRemove: (name: string) => void; alertDefinitions: AlertDefinition[] }) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filtered = alertDefinitions
    .filter(ad => !selected.includes(ad.name))
    .filter(ad => {
      if (!search) return true;
      const q = search.toLowerCase();
      return ad.name.toLowerCase().includes(q) || ad.category.toLowerCase().includes(q);
    })
    .sort((a, b) => {
      const q = search.toLowerCase();
      const aStarts = a.name.toLowerCase().startsWith(q) ? 0 : 1;
      const bStarts = b.name.toLowerCase().startsWith(q) ? 0 : 1;
      return aStarts - bStarts || a.name.localeCompare(b.name);
    });

  return (
    <div ref={ref} className="relative">
      <div className="border rounded px-2 py-1 min-h-[38px] flex flex-wrap gap-1 cursor-text" onClick={() => setOpen(true)}>
        {selected.map(s => (
          <Badge key={s} variant="secondary" className="text-xs gap-1">
            {s}
            <button type="button" className="ml-0.5 text-red-500 hover:text-red-700 font-bold" onClick={(e) => { e.stopPropagation(); onRemove(s); }}>×</button>
          </Badge>
        ))}
        <input
          className="flex-1 min-w-[80px] outline-none text-sm border-none bg-transparent"
          placeholder={selected.length ? "" : "Search alerts..."}
          value={search}
          onChange={(e) => { setSearch(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
        />
      </div>
      {open && filtered.length > 0 && (
        <div className="absolute z-50 mt-1 w-full max-h-[200px] overflow-y-auto bg-white border rounded shadow-lg">
          {filtered.map(ad => (
            <div
              key={ad.id}
              className="px-3 py-2 hover:bg-blue-50 cursor-pointer text-sm flex justify-between"
              onClick={() => { onAdd(ad.name); setSearch(""); setOpen(false); }}
            >
              <span>{ad.name}</span>
              <span className="text-xs text-gray-400">{ad.category}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function DriverConfigSection() {
  const { costCenters, selectedCostCenterIds } = useCostCenters();
  const [alertDefinitions, setAlertDefinitions] = useState<AlertDefinition[]>([]);
  const [configGroups, setConfigGroups] = useState<any[]>([]);

  useEffect(() => {
    fetch(`${ALERT_CONFIG_API}/definitions`, { cache: "no-store" })
      .then(r => r.json())
      .then(d => setAlertDefinitions(d?.data || []))
      .catch(() => {});
    fetch(`${DRIVER_CONFIG_API}/config-groups`, { cache: "no-store" })
      .then(r => r.json())
      .then(d => setConfigGroups(d?.data || []))
      .catch(() => {});
  }, []);

  const getGroupForCC = (ccId: number) => {
    return configGroups.find(g => (g.members || []).includes(ccId));
  };

  if (selectedCostCenterIds.length === 0) {
    return (
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Driver Monitoring Config</h2>
          <p className="text-sm text-gray-500">Global Defaults — baseline criteria inherited by all cost centers</p>
        </div>
        <CostCenterTable costCenterId={null} costCenterName="Global Defaults" alertDefinitions={alertDefinitions} configGroups={configGroups} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Driver Monitoring Config</h2>
        <p className="text-sm text-gray-500">
          {selectedCostCenterIds.length === 1
            ? `Configuring: ${costCenters.find(cc => cc.id === selectedCostCenterIds[0])?.name}`
            : `${selectedCostCenterIds.length} Cost Centers Selected`
          }
        </p>
      </div>
      {selectedCostCenterIds.map(ccId => {
        const cc = costCenters.find(c => c.id === ccId);
        const group = getGroupForCC(ccId);
        return (
          <CostCenterTable
            key={ccId}
            costCenterId={ccId}
            costCenterName={cc?.name || `Cost Center #${ccId}`}
            alertDefinitions={alertDefinitions}
            configGroups={configGroups}
            groupName={group?.name}
          />
        );
      })}
    </div>
  );
}

function CostCenterTable({ costCenterId, costCenterName, alertDefinitions, configGroups = [], groupName }: { costCenterId: number | null; costCenterName: string; alertDefinitions: AlertDefinition[]; configGroups?: any[]; groupName?: string }) {
  const [criteria, setCriteria] = useState<DriverConfigCriterion[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<Partial<DriverConfigCriterion>>({});
  const [showAddForm, setShowAddForm] = useState(false);
  const [showOverrideConfirm, setShowOverrideConfirm] = useState(false);
  const [overrideLoading, setOverrideLoading] = useState(false);
  const [addForm, setAddForm] = useState({
    name: "",
    deduction_per_alert: 10,
    deduction_with_ncr: 0,
    ncr_threshold: 3,
    statuses: [] as string[],
  });

  const fetchCriteria = useCallback(async () => {
    try {
      if (costCenterId === null) {
        const res = await fetch(`${DRIVER_CONFIG_API}/criteria/global`, { cache: "no-store" });
        const data = await res.json();
        setCriteria(data?.data || []);
      } else {
        const res = await fetch(`${DRIVER_CONFIG_API}/criteria/for-cc/${costCenterId}`, { cache: "no-store" });
        const data = await res.json();
        setCriteria(data?.data || []);
      }
    } catch {
      setCriteria([]);
    }
  }, [costCenterId]);

  useEffect(() => {
    setLoading(true);
    fetchCriteria().finally(() => setLoading(false));
  }, [fetchCriteria]);

  const handleSaveEdit = async () => {
    if (!editingId) return;
    const editingCriterion = criteria.find(c => c.id === editingId);
    const isGlobalBeingEditedInCCContext = costCenterId !== null && editingCriterion?.cost_center_id === null && editingCriterion?.config_group_id == null;
    try {
      if (isGlobalBeingEditedInCCContext) {
        // Check if a CC override already exists for this name
        const existingOverride = criteria.find(c => c.name === editingCriterion?.name && c.cost_center_id === costCenterId && c.config_group_id == null);
        const payload = {
          name: editForm.name || editingCriterion?.name,
          deduction_per_alert: editForm.deduction_per_alert ?? editingCriterion?.deduction_per_alert ?? editingCriterion?.selected_weighting ?? 10,
          deduction_with_ncr: editForm.deduction_with_ncr ?? editingCriterion?.deduction_with_ncr ?? 0,
          ncr_threshold: editForm.ncr_threshold ?? editingCriterion?.ncr_threshold ?? 3,
          statuses: editForm.statuses || editingCriterion?.statuses || [],
          cost_center_id: costCenterId,
        };
        if (existingOverride) {
          // Update existing override
          await fetch(`${DRIVER_CONFIG_API}/criteria/${existingOverride.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          toast.success("Override updated");
        } else {
          // Create new override
          const res = await fetch(`${DRIVER_CONFIG_API}/criteria`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          const body = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(body?.message || "Failed to create override");
          toast.success("Override created for this cost center");
        }
      } else {
        await fetch(`${DRIVER_CONFIG_API}/criteria/${editingId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(editForm),
        });
        toast.success("Criterion updated");
      }
      setEditingId(null);
      setEditForm({});
      fetchCriteria();
    } catch (e: any) {
      toast.error(e?.message || "Failed to update");
    }
  };

  const handleAdd = async () => {
    try {
      await fetch(`${DRIVER_CONFIG_API}/criteria`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: addForm.name,
          deduction_per_alert: addForm.deduction_per_alert,
          deduction_with_ncr: addForm.deduction_with_ncr,
          ncr_threshold: addForm.ncr_threshold,
          statuses: addForm.statuses,
          cost_center_id: costCenterId,
        }),
      });
      toast.success("Criterion added");
      setShowAddForm(false);
      setAddForm({ name: "", deduction_per_alert: 10, deduction_with_ncr: 0, ncr_threshold: 3, statuses: [] });
      fetchCriteria();
    } catch {
      toast.error("Failed to add");
    }
  };

  const handleDelete = async (criterion: DriverConfigCriterion) => {
    if (costCenterId !== null && criterion.config_group_id != null) {
      toast.error("Can't delete a group criterion from here. Edit the Config Group instead.");
      return;
    }
    if (costCenterId !== null && criterion.cost_center_id === null && criterion.config_group_id == null) {
      toast.error("Can't delete a global default from here. Go to Global Defaults to remove it.");
      return;
    }
    if (!confirm("Delete this criterion?")) return;
    try {
      await fetch(`${DRIVER_CONFIG_API}/criteria/${criterion.id}`, { method: "DELETE" });
      toast.success("Deleted");
      fetchCriteria();
    } catch {
      toast.error("Failed to delete");
    }
  };

  const handleOverrideFromGlobal = async () => {
    if (!costCenterId) return;
    setOverrideLoading(true);
    try {
      const res = await fetch(`${DRIVER_CONFIG_API}/criteria/reset-to-global/${costCenterId}`, {
        method: "POST",
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.message || "Failed to reset");
      toast.success(`Override created: ${body.data?.created || 0} criteria copied from global defaults`);
      setShowOverrideConfirm(false);
      fetchCriteria();
    } catch (e: any) {
      toast.error(e?.message || "Failed to reset");
    } finally {
      setOverrideLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between py-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          {costCenterId === null ? (
            <Badge variant="outline">Global</Badge>
          ) : (
            <Badge>{costCenterName}</Badge>
          )}
          {groupName && (
            <Badge variant="secondary" className="text-xs">
              <Settings className="w-3 h-3 mr-1" />
              {groupName}
            </Badge>
          )}
          <span className="text-gray-400 font-normal">
            ({criteria.length} criteria{costCenterId !== null ? ` — ${criteria.filter(c => c.config_group_id != null).length} from group, ${criteria.filter(c => c.cost_center_id === costCenterId).length} customized, ${criteria.filter(c => c.cost_center_id === null && c.config_group_id == null).length} inherited` : ""})
          </span>
        </CardTitle>
        <div className="flex items-center gap-2">
          {costCenterId !== null && (
            <Button size="sm" variant="outline" onClick={() => setShowOverrideConfirm(true)}>
              <Copy className="w-4 h-4 mr-1" /> Override from Global
            </Button>
          )}
          <Button size="sm" onClick={() => setShowAddForm(true)}>
            <Plus className="w-4 h-4 mr-1" /> Add
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {showAddForm && (
          <div className="p-4 border-b bg-gray-50 space-y-3">
            <div className="grid grid-cols-4 gap-3">
              <div>
                <label className="text-sm font-medium">Name</label>
                <Input value={addForm.name} onChange={(e) => setAddForm({ ...addForm, name: e.target.value })} placeholder="e.g. Speeding" />
              </div>
              <div>
                <label className="text-sm font-medium">Per-Alert</label>
                <Input type="number" value={addForm.deduction_per_alert} onChange={(e) => setAddForm({ ...addForm, deduction_per_alert: Number(e.target.value) })} />
              </div>
              <div>
                <label className="text-sm font-medium">NCR Deduction</label>
                <Input type="number" value={addForm.deduction_with_ncr} onChange={(e) => setAddForm({ ...addForm, deduction_with_ncr: Number(e.target.value) })} />
              </div>
              <div>
                <label className="text-sm font-medium">NCR Threshold</label>
                <Input type="number" value={addForm.ncr_threshold} min={1} onChange={(e) => setAddForm({ ...addForm, ncr_threshold: Number(e.target.value) })} />
              </div>
            </div>
            <div className="flex gap-3 items-end">
              <div className="flex-1">
                <label className="text-sm font-medium">Statuses</label>
                <AlertSearchDropdown
                  selected={addForm.statuses}
                  alertDefinitions={alertDefinitions}
                  onAdd={(name) => setAddForm({ ...addForm, statuses: [...addForm.statuses, name] })}
                  onRemove={(name) => setAddForm({ ...addForm, statuses: addForm.statuses.filter(x => x !== name) })}
                />
              </div>
              <Button size="sm" onClick={handleAdd} disabled={!addForm.name}><Save className="w-4 h-4 mr-1" /> Add</Button>
              <Button size="sm" variant="outline" onClick={() => setShowAddForm(false)}>Cancel</Button>
            </div>
          </div>
        )}
        {loading ? (
          <div className="p-6 text-center text-sm text-gray-500">Loading...</div>
        ) : criteria.length === 0 ? (
          <div className="p-6 text-center text-sm text-gray-400">No criteria configured. Click "Add" to create one.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50 text-left text-gray-500">
                <th className="py-3 px-4">Criterion</th>
                <th>Per-Alert</th>
                <th>NCR Deduction</th>
                <th>NCR Threshold</th>
                <th>Statuses</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {criteria.map((c) => (
                <tr key={c.id} className="border-b">
                  <td className="py-3 px-4 font-medium">
                    {editingId === c.id ? (
                      <Input value={editForm.name || ""} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} className="h-8" />
                    ) : (
                      <div className="flex items-center gap-2">
                        {c.name}
                        {costCenterId !== null && c.config_group_id != null && (
                          <Badge variant="secondary" className="text-[10px]">
                            <Settings className="w-2.5 h-2.5 mr-0.5" />
                            Group
                          </Badge>
                        )}
                        {costCenterId !== null && c.cost_center_id === costCenterId && c.config_group_id == null && (
                          <Badge variant="default" className="text-[10px]">Custom</Badge>
                        )}
                        {costCenterId !== null && c.cost_center_id === null && c.config_group_id == null && (
                          <Badge variant="outline" className="text-[10px] text-gray-400 border-gray-200">Global</Badge>
                        )}
                      </div>
                    )}
                  </td>
                  <td>
                    {editingId === c.id ? (
                      <Input type="number" value={editForm.deduction_per_alert ?? c.deduction_per_alert ?? c.selected_weighting} onChange={(e) => setEditForm({ ...editForm, deduction_per_alert: Number(e.target.value) })} className="h-8 w-20" />
                    ) : (c.deduction_per_alert ?? c.selected_weighting)}
                  </td>
                  <td>
                    {editingId === c.id ? (
                      <Input type="number" value={editForm.deduction_with_ncr ?? c.deduction_with_ncr ?? 0} onChange={(e) => setEditForm({ ...editForm, deduction_with_ncr: Number(e.target.value) })} className="h-8 w-20" />
                    ) : (c.deduction_with_ncr ?? 0)}
                  </td>
                  <td>
                    {editingId === c.id ? (
                      <Input type="number" value={editForm.ncr_threshold ?? c.ncr_threshold ?? 3} min={1} onChange={(e) => setEditForm({ ...editForm, ncr_threshold: Number(e.target.value) })} className="h-8 w-20" />
                    ) : (c.ncr_threshold ?? 3)}
                  </td>
                  <td>
                    {editingId === c.id ? (
                      <AlertSearchDropdown
                        selected={editForm.statuses || c.statuses}
                        alertDefinitions={alertDefinitions}
                        onAdd={(name) => setEditForm({ ...editForm, statuses: [...(editForm.statuses || c.statuses), name] })}
                        onRemove={(name) => setEditForm({ ...editForm, statuses: (editForm.statuses || c.statuses).filter((x: string) => x !== name) })}
                      />
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {(c.statuses || []).slice(0, 2).map((s, i) => (
                          <Badge key={i} variant="outline" className="text-xs">{s}</Badge>
                        ))}
                        {(c.statuses || []).length > 2 && (
                          <Badge variant="outline" className="text-xs">+{(c.statuses || []).length - 2}</Badge>
                        )}
                      </div>
                    )}
                  </td>
                  <td>
                    <div className="flex gap-1">
                      {editingId === c.id ? (
                        <>
                          <Button variant="ghost" size="sm" onClick={handleSaveEdit}><Save className="w-3 h-3" /></Button>
                          <Button variant="ghost" size="sm" onClick={() => { setEditingId(null); setEditForm({}); }}><X className="w-3 h-3" /></Button>
                        </>
                      ) : (
                        <>
                          <Button variant="ghost" size="sm" onClick={() => { setEditingId(c.id); setEditForm({ name: c.name, deduction_per_alert: c.deduction_per_alert ?? c.selected_weighting, deduction_with_ncr: c.deduction_with_ncr, ncr_threshold: c.ncr_threshold, statuses: c.statuses }); }}>
                            <Pencil className="w-3 h-3" />
                          </Button>
                          <Button variant="ghost" size="sm" disabled={costCenterId !== null && (c.cost_center_id === null || c.config_group_id != null)} onClick={() => handleDelete(c)}>
                            <Trash2 className={`w-3 h-3 ${costCenterId !== null && (c.cost_center_id === null || c.config_group_id != null) ? 'text-gray-300' : 'text-red-500'}`} />
                          </Button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </CardContent>

      <Dialog open={showOverrideConfirm} onOpenChange={setShowOverrideConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Override from Global Defaults</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-gray-600">
              This will <strong>delete all existing custom criteria</strong> for <strong>{costCenterName}</strong> and replace them with copies from the global defaults table.
            </p>
            <p className="text-sm text-gray-500">
              This action breaks the inheritance relationship — future changes to global defaults will NOT automatically apply to this cost center.
            </p>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setShowOverrideConfirm(false)}>Cancel</Button>
              <Button size="sm" disabled={overrideLoading} onClick={handleOverrideFromGlobal}>
                {overrideLoading ? "Resetting..." : "Confirm Override"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function ConfigGroupsSection() {
  const { costCenters } = useCostCenters();
  const [groups, setGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createForm, setCreateForm] = useState({ name: "", cost_center_ids: [] as number[] });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ name: "", cost_center_ids: [] as number[] });

  const fetchGroups = useCallback(async () => {
    try {
      const res = await fetch(`${DRIVER_CONFIG_API}/config-groups`, { cache: "no-store" });
      const data = await res.json();
      setGroups(data?.data || []);
    } catch {
      setGroups([]);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchGroups().finally(() => setLoading(false));
  }, [fetchGroups]);

  const handleCreate = async () => {
    if (!createForm.name.trim()) return toast.error("Name is required");
    try {
      const res = await fetch(`${DRIVER_CONFIG_API}/config-groups`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(createForm),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.message || "Failed to create");
      toast.success("Group created");
      setShowCreateForm(false);
      setCreateForm({ name: "", cost_center_ids: [] });
      fetchGroups();
    } catch (e: any) {
      toast.error(e?.message || "Failed to create");
    }
  };

  const handleUpdate = async (id: number) => {
    try {
      const res = await fetch(`${DRIVER_CONFIG_API}/config-groups/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.message || "Failed to update");
      toast.success("Group updated");
      setEditingId(null);
      fetchGroups();
    } catch (e: any) {
      toast.error(e?.message || "Failed to update");
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this group? Criteria assigned to it will become global.")) return;
    try {
      await fetch(`${DRIVER_CONFIG_API}/config-groups/${id}`, { method: "DELETE" });
      toast.success("Deleted");
      fetchGroups();
    } catch {
      toast.error("Failed to delete");
    }
  };

  const toggleCc = (ccId: number, target: "create" | "edit") => {
    if (target === "create") {
      setCreateForm(prev => ({
        ...prev,
        cost_center_ids: prev.cost_center_ids.includes(ccId)
          ? prev.cost_center_ids.filter(id => id !== ccId)
          : [...prev.cost_center_ids, ccId],
      }));
    } else {
      setEditForm(prev => ({
        ...prev,
        cost_center_ids: prev.cost_center_ids.includes(ccId)
          ? prev.cost_center_ids.filter(id => id !== ccId)
          : [...prev.cost_center_ids, ccId],
      }));
    }
  };

  if (loading) return <div className="text-sm text-gray-500 py-4">Loading...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Config Groups</h3>
          <p className="text-sm text-gray-500">Groups of cost centers that share the same driver config criteria</p>
        </div>
        <Button size="sm" onClick={() => setShowCreateForm(true)}>
          <Plus className="w-4 h-4 mr-1" /> New Group
        </Button>
      </div>

      {showCreateForm && (
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm font-semibold">Create Config Group</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              placeholder="Group name (e.g. Fleet A)"
              value={createForm.name}
              onChange={e => setCreateForm({ ...createForm, name: e.target.value })}
            />
            <div>
              <p className="text-xs text-gray-500 mb-2">Cost Centers in this group:</p>
              <div className="flex flex-wrap gap-2">
                {costCenters.map(cc => (
                  <Badge
                    key={cc.id}
                    variant={createForm.cost_center_ids.includes(cc.id) ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => toggleCc(cc.id, "create")}
                  >
                    {cc.name}
                  </Badge>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleCreate}>Create</Button>
              <Button size="sm" variant="outline" onClick={() => setShowCreateForm(false)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {groups.length === 0 ? (
        <p className="text-sm text-gray-500">No config groups yet. Create one to share config across cost centers.</p>
      ) : (
        groups.map(group => (
          <Card key={group.id}>
            <CardHeader className="flex flex-row items-center justify-between py-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Badge variant="outline">Group</Badge>
                {editingId === group.id ? (
                  <Input
                    value={editForm.name}
                    onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                    className="h-7 w-48"
                  />
                ) : (
                  group.name
                )}
                <span className="text-gray-400 font-normal">
                  ({group.member_count} cost center{group.member_count !== 1 ? "s" : ""})
                </span>
              </CardTitle>
              <div className="flex items-center gap-1">
                {editingId === group.id ? (
                  <>
                    <Button variant="ghost" size="sm" onClick={() => handleUpdate(group.id)}>
                      <Save className="w-3 h-3 text-green-500" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setEditingId(null)}>
                      <X className="w-3 h-3 text-gray-400" />
                    </Button>
                  </>
                ) : (
                  <>
                    <Button variant="ghost" size="sm" onClick={() => {
                      setEditingId(group.id);
                      setEditForm({ name: group.name, cost_center_ids: group.members || [] });
                    }}>
                      <Pencil className="w-3 h-3 text-blue-500" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(group.id)}>
                      <Trash2 className="w-3 h-3 text-red-500" />
                    </Button>
                  </>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {editingId === group.id ? (
                <div className="space-y-2">
                  <p className="text-xs text-gray-500">Cost Centers in this group:</p>
                  <div className="flex flex-wrap gap-2">
                    {costCenters.map(cc => (
                      <Badge
                        key={cc.id}
                        variant={editForm.cost_center_ids.includes(cc.id) ? "default" : "outline"}
                        className="cursor-pointer"
                        onClick={() => toggleCc(cc.id, "edit")}
                      >
                        {cc.name}
                      </Badge>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap gap-1">
                  {(group.members || []).map((ccId: number) => {
                    const cc = costCenters.find(c => c.id === ccId);
                    return <Badge key={ccId} variant="secondary">{cc?.name || `#${ccId}`}</Badge>;
                  })}
                  {(!group.members || group.members.length === 0) && (
                    <span className="text-xs text-gray-400">No cost centers assigned</span>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}

const DEFAULT_RTMS_RULES = [
  { module: 'Driver Hours', rule_name: 'Driver Hours', system_constraint: 'Flag after 4 hrs driving; enforce >= 15-min break; max 12-14 hr shift.', audit_focus: 'Fatigue reduction', max_value: 240, min_value: 15, unit: 'minutes' },
  { module: 'Mass Control', rule_name: 'Mass Control', system_constraint: 'Block dispatch if GVM exceeds legal limits or lacks weighbridge logs.', audit_focus: 'Prevention of overloading', max_value: 0, min_value: 0, unit: 'kg' },
  { module: 'Speed & Risk', rule_name: 'Speed & Risk', system_constraint: 'Flag speed > 80 km/h; audit trips running between 22:00 and 04:00.', audit_focus: 'Safe driving habits', max_value: 80, min_value: 0, unit: 'km/h' },
  { module: 'Fleet Fitness', rule_name: 'Fleet Fitness', system_constraint: 'Require a daily pre-trip checklist before unlocking a vehicle assignment.', audit_focus: 'Roadworthiness', max_value: 1, min_value: 0, unit: 'checklist' },
  { module: 'Certifications', rule_name: 'Certifications', system_constraint: 'Flag upcoming expirations for PrDPs and Annual Medical Certificates.', audit_focus: 'Driver wellness & legal compliance', max_value: 30, min_value: 0, unit: 'days' },
];

function RTMSConfigSection() {
  const [rules, setRules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [selectedConfigCostCenterId, setSelectedConfigCostCenterId] = useState<number | null>(null);
  const { costCenters } = useCostCenters();

  const fetchRules = useCallback(async () => {
    try {
      const ccParam = selectedConfigCostCenterId != null ? `?cost_center_id=${selectedConfigCostCenterId}` : "";
      const res = await fetch(`/api/video-server/rtms/rules${ccParam}`, { cache: 'no-store' });
      const data = await res.json();
      setRules(data?.rules || []);
    } catch { setRules([]); }
  }, [selectedConfigCostCenterId]);

  useEffect(() => {
    setLoading(true);
    fetchRules().finally(() => setLoading(false));
  }, [fetchRules]);

  const handleSeedDefaults = async () => {
    try {
      // Filter out rules that already exist for this cost center context
      const existingNames = new Set(rules.map(r => r.rule_name));
      const newRules = DEFAULT_RTMS_RULES.filter(r => !existingNames.has(r.rule_name));
      if (newRules.length === 0) {
        toast.info('All default rules already exist');
        return;
      }
      await fetch('/api/video-server/rtms/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rules: newRules, cost_center_id: selectedConfigCostCenterId }),
      });
      toast.success(`${newRules.length} rule(s) added`);
      fetchRules();
    } catch { toast.error('Failed to seed rules'); }
  };

  const handleSaveEdit = async () => {
    if (!editingId) return;
    try {
      await fetch(`/api/video-server/rtms/rules/${editingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });
      toast.success('Rule updated');
      setEditingId(null);
      setEditForm({});
      fetchRules();
    } catch { toast.error('Failed to update'); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this rule?')) return;
    try {
      await fetch(`/api/video-server/rtms/rules/${id}`, { method: 'DELETE' });
      toast.success('Deleted');
      fetchRules();
    } catch { toast.error('Failed to delete'); }
  };

  const modules = [...new Set(rules.map(r => r.module))];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">RTMS Configuration</h2>
          <p className="text-sm text-gray-500">Road Transport Management System rules for driving time monitoring</p>
        </div>
        <div className="flex gap-2 items-center">
          <div className="w-56">
            <Select value={selectedConfigCostCenterId?.toString() ?? "global"} onValueChange={(v) => setSelectedConfigCostCenterId(v === "global" ? null : Number(v))}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Global Default" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="global">Global Default</SelectItem>
                {costCenters.map((cc) => (
                  <SelectItem key={cc.id} value={cc.id.toString()}>{cc.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {rules.length === 0 && (
            <Button size="sm" variant="outline" onClick={handleSeedDefaults}>
              <Plus className="w-4 h-4 mr-1" /> Load Defaults
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={fetchRules}>
            Refresh
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50 text-left text-gray-500">
                <th className="py-3 px-4">Module</th>
                <th>Rule</th>
                <th>System Constraint</th>
                <th>Audit Focus</th>
                <th>Max</th>
                <th>Unit</th>
                <th>Cost Center</th>
                <th>Enabled</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rules.map(r => (
                <tr key={r.id} className="border-b hover:bg-gray-50">
                  <td className="py-2 px-4 font-medium">
                    {editingId === r.id ? (
                      <Input value={editForm.module || r.module} onChange={e => setEditForm({ ...editForm, module: e.target.value })} className="h-7 text-xs" />
                    ) : (
                      <Badge variant="outline" className="text-xs">{r.module}</Badge>
                    )}
                  </td>
                  <td>
                    {editingId === r.id ? (
                      <Input value={editForm.rule_name || r.rule_name} onChange={e => setEditForm({ ...editForm, rule_name: e.target.value })} className="h-7 text-xs" />
                    ) : (
                      r.rule_name
                    )}
                  </td>
                  <td className="max-w-[200px]">
                    {editingId === r.id ? (
                      <Input value={editForm.system_constraint || r.system_constraint} onChange={e => setEditForm({ ...editForm, system_constraint: e.target.value })} className="h-7 text-xs" />
                    ) : (
                      <span className="text-xs text-gray-600 line-clamp-2">{r.system_constraint}</span>
                    )}
                  </td>
                  <td>
                    {editingId === r.id ? (
                      <Input value={editForm.audit_focus || r.audit_focus} onChange={e => setEditForm({ ...editForm, audit_focus: e.target.value })} className="h-7 text-xs" />
                    ) : (
                      <span className="text-xs">{r.audit_focus}</span>
                    )}
                  </td>
                  <td>
                    {editingId === r.id ? (
                      <Input type="number" value={editForm.max_value ?? r.max_value} onChange={e => setEditForm({ ...editForm, max_value: Number(e.target.value) })} className="h-7 w-16 text-xs" />
                    ) : (
                      r.max_value
                    )}
                  </td>
                  <td>
                    {editingId === r.id ? (
                      <Input value={editForm.unit || r.unit} onChange={e => setEditForm({ ...editForm, unit: e.target.value })} className="h-7 w-16 text-xs" />
                    ) : (
                      r.unit
                    )}
                  </td>
                  <td>
                    {r.cost_center_id != null
                      ? (costCenters.find(cc => cc.id === r.cost_center_id)?.name || `ID: ${r.cost_center_id}`)
                      : <Badge variant="outline" className="text-xs">Global</Badge>}
                  </td>
                  <td>
                    {editingId === r.id ? (
                      <select className="border rounded px-1 py-0.5 h-7 text-xs" value={editForm.enabled ? 'true' : 'false'} onChange={e => setEditForm({ ...editForm, enabled: e.target.value === 'true' })}>
                        <option value="true">Yes</option>
                        <option value="false">No</option>
                      </select>
                    ) : (
                      <span className={cn("text-xs font-medium", r.enabled ? "text-green-600" : "text-gray-400")}>
                        {r.enabled ? "Yes" : "No"}
                      </span>
                    )}
                  </td>
                  <td>
                    <div className="flex gap-1">
                      {editingId === r.id ? (
                        <>
                          <Button variant="ghost" size="sm" onClick={handleSaveEdit}><Save className="w-3 h-3" /></Button>
                          <Button variant="ghost" size="sm" onClick={() => { setEditingId(null); setEditForm({}); }}><X className="w-3 h-3" /></Button>
                        </>
                      ) : (
                        <>
                          <Button variant="ghost" size="sm" onClick={() => { setEditingId(r.id); setEditForm({ module: r.module, rule_name: r.rule_name, system_constraint: r.system_constraint, audit_focus: r.audit_focus, max_value: r.max_value, unit: r.unit, enabled: r.enabled }); }}>
                            <Pencil className="w-3 h-3" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleDelete(r.id)}>
                            <Trash2 className="w-3 h-3 text-red-500" />
                          </Button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {rules.length === 0 && !loading && (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-gray-500">
                    No rules configured. Click "Load Defaults" to get started.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card className="border-dashed">
        <CardContent className="p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">How RTMS Works</h3>
          <ul className="text-xs text-gray-500 space-y-1">
            <li><strong>Driver Hours:</strong> Monitors engine on/off via telematics. If engine stays on beyond Max minutes, a websocket alert is sent.</li>
            <li><strong>Speed & Risk:</strong> Flags vehicles exceeding Max speed (km/h).</li>
            <li><strong>Certifications:</strong> Flags drivers with licenses/certifications expiring within Max days.</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
