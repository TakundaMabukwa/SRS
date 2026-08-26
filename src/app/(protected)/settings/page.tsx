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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

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
};

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState("alert-config");

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
          </TabsList>

          <TabsContent value="alert-config">
            <AlertConfigSection />
          </TabsContent>

          <TabsContent value="driver-config">
            <DriverConfigSection />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function AlertConfigSection() {
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
  const [showMemberPicker, setShowMemberPicker] = useState(false);

  const fetchDefinitions = useCallback(async () => {
    try {
      const res = await fetch(`${ALERT_CONFIG_API}/definitions`, { cache: "no-store" });
      const data = await res.json();
      setDefinitions(data?.data || []);
    } catch {
      setDefinitions([]);
    }
  }, []);

  const fetchGroups = useCallback(async () => {
    try {
      const res = await fetch(`${ALERT_CONFIG_API}/groups`, { cache: "no-store" });
      const data = await res.json();
      setGroups(data?.data || []);
    } catch {
      setGroups([]);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchDefinitions(), fetchGroups()])
      .finally(() => setLoading(false));
  }, [fetchDefinitions, fetchGroups]);

  const handleSaveDef = async () => {
    const url = editingDef ? `${ALERT_CONFIG_API}/definitions/${editingDef.id}` : `${ALERT_CONFIG_API}/definitions`;
    const method = editingDef ? "PUT" : "POST";
    try {
      await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(defForm),
      });
      toast.success(editingDef ? "Alert type updated" : "Alert type created");
      setShowDefForm(false);
      setEditingDef(null);
      setDefForm({ name: "", category: "telematics", description: "", signal_code: "", severity: "MEDIUM" });
      fetchDefinitions();
      fetchGroups();
    } catch {
      toast.error("Failed to save");
    }
  };

  const handleDeleteDef = async (id: number) => {
    if (!confirm("Delete this alert type?")) return;
    try {
      await fetch(`${ALERT_CONFIG_API}/definitions/${id}`, { method: "DELETE" });
      toast.success("Deleted");
      fetchDefinitions();
      fetchGroups();
    } catch {
      toast.error("Failed to delete");
    }
  };

  const handleSaveGroup = async () => {
    const url = editingGroup ? `${ALERT_CONFIG_API}/groups/${editingGroup.id}` : `${ALERT_CONFIG_API}/groups`;
    const method = editingGroup ? "PUT" : "POST";
    try {
      await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...groupForm, member_ids: groupForm.memberIds }),
      });
      toast.success(editingGroup ? "Alert group updated" : "Alert group created");
      setShowGroupForm(false);
      setEditingGroup(null);
      setGroupForm({ name: "", severity: "MEDIUM", description: "", memberIds: [] });
      fetchGroups();
    } catch {
      toast.error("Failed to save");
    }
  };

  const handleDeleteGroup = async (id: number) => {
    if (!confirm("Delete this alert group?")) return;
    try {
      await fetch(`${ALERT_CONFIG_API}/groups/${id}`, { method: "DELETE" });
      toast.success("Deleted");
      fetchGroups();
    } catch {
      toast.error("Failed to delete");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Alert Types & Groups</h2>
          <p className="text-sm text-gray-500">Configure alert definitions and grouping rules</p>
        </div>
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
      </div>

      {activeSection === "definitions" && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Alert Types</CardTitle>
            <Button size="sm" onClick={() => { setShowDefForm(true); setEditingDef(null); setDefForm({ name: "", category: "telematics", description: "", signal_code: "", severity: "MEDIUM" }); }}>
              <Plus className="w-4 h-4 mr-1" /> Add Alert Type
            </Button>
          </CardHeader>
          <CardContent>
            {showDefForm && (
              <div className="mb-4 p-4 border rounded-lg bg-gray-50 space-y-3">
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
                    <label className="text-sm font-medium">Signal Code</label>
                    <Input value={defForm.signal_code} onChange={(e) => setDefForm({ ...defForm, signal_code: e.target.value })} placeholder="e.g. HARSH_BRAKE" />
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
                  <Input value={defForm.description} onChange={(e) => setDefForm({ ...defForm, description: e.target.value })} placeholder="Optional description" />
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleSaveDef}><Save className="w-4 h-4 mr-1" /> {editingDef ? "Update" : "Create"}</Button>
                  <Button size="sm" variant="outline" onClick={() => { setShowDefForm(false); setEditingDef(null); }}>Cancel</Button>
                </div>
              </div>
            )}

            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-gray-500">
                  <th className="py-2">Name</th>
                  <th>Category</th>
                  <th>Signal Code</th>
                  <th>Severity</th>
                  <th>Description</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {definitions.map((def) => (
                  <tr key={def.id} className="border-b">
                    <td className="py-2 font-medium">{def.name}</td>
                    <td><Badge variant={def.category === "telematics" ? "default" : "secondary"}>{def.category}</Badge></td>
                    <td>{def.signal_code}</td>
                    <td><Badge className={SEVERITY_COLORS[def.severity || "MEDIUM"]}>{def.severity || "MEDIUM"}</Badge></td>
                    <td className="text-gray-500">{def.description || "—"}</td>
                    <td><Badge variant={def.is_active ? "default" : "outline"}>{def.is_active ? "Active" : "Inactive"}</Badge></td>
                    <td>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => { setEditingDef(def); setDefForm({ name: def.name, category: def.category, description: def.description, signal_code: def.signal_code, severity: def.severity || "MEDIUM" }); setShowDefForm(true); }}>
                          <Pencil className="w-3 h-3" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDeleteDef(def.id)}>
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
            <CardTitle>Alert Groups</CardTitle>
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
                    {definitions.map((def) => (
                      <Badge
                        key={def.id}
                        variant={groupForm.memberIds.includes(def.id) ? "default" : "outline"}
                        className="cursor-pointer"
                        onClick={() => {
                          setGroupForm({
                            ...groupForm,
                            memberIds: groupForm.memberIds.includes(def.id)
                              ? groupForm.memberIds.filter((id) => id !== def.id)
                              : [...groupForm.memberIds, def.id],
                          });
                        }}
                      >
                        {def.name}
                      </Badge>
                    ))}
                  </div>
                </div>
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
                {groups.map((group) => (
                  <tr key={group.id} className="border-b">
                    <td className="py-2 font-medium">{group.name}</td>
                    <td><Badge className={SEVERITY_COLORS[group.severity || "MEDIUM"]}>{group.severity || "MEDIUM"}</Badge></td>
                    <td className="text-gray-500">{group.description || "—"}</td>
                    <td>
                      <div className="flex flex-wrap gap-1">
                        {(group.members || []).slice(0, 3).map((m) => (
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
                        <Button variant="ghost" size="sm" onClick={() => {
                          setEditingGroup(group);
                          setGroupForm({ name: group.name, severity: group.severity || "MEDIUM", description: group.description, memberIds: (group.members || []).map((m) => m.id) });
                          setShowGroupForm(true);
                        }}>
                          <Pencil className="w-3 h-3" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDeleteGroup(group.id)}>
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
  const [criteria, setCriteria] = useState<DriverConfigCriterion[]>([]);
  const [alertDefinitions, setAlertDefinitions] = useState<AlertDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<Partial<DriverConfigCriterion>>({});
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState({ 
    name: "", 
    selected_weighting: 10, 
    risk_tiers: 4, 
    statuses: [] as string[],
    nrc_deduction: false,
    incidents_threshold: 1,
  });

  const fetchCriteria = useCallback(async () => {
    try {
      const res = await fetch(`${DRIVER_CONFIG_API}/criteria`, { cache: "no-store" });
      const data = await res.json();
      setCriteria(data?.data || []);
    } catch {
      setCriteria([]);
    }
  }, []);

  const fetchAlertDefinitions = useCallback(async () => {
    try {
      const res = await fetch(`${ALERT_CONFIG_API}/definitions`, { cache: "no-store" });
      const data = await res.json();
      setAlertDefinitions(data?.data || []);
    } catch {
      setAlertDefinitions([]);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchCriteria(), fetchAlertDefinitions()]).finally(() => setLoading(false));
  }, [fetchCriteria, fetchAlertDefinitions]);

  const handleSaveEdit = async () => {
    if (!editingId) return;
    try {
      await fetch(`${DRIVER_CONFIG_API}/criteria/${editingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      toast.success("Criterion updated");
      setEditingId(null);
      setEditForm({});
      fetchCriteria();
    } catch {
      toast.error("Failed to update");
    }
  };

  const handleAdd = async () => {
    try {
      await fetch(`${DRIVER_CONFIG_API}/criteria`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: addForm.name,
          selected_weighting: addForm.selected_weighting,
          risk_tiers: addForm.risk_tiers,
          statuses: addForm.statuses,
          nrc_deduction: addForm.nrc_deduction,
          incidents_threshold: addForm.incidents_threshold,
        }),
      });
      toast.success("Criterion added");
      setShowAddForm(false);
      setAddForm({ name: "", selected_weighting: 10, risk_tiers: 4, statuses: [], nrc_deduction: false, incidents_threshold: 1 });
      fetchCriteria();
    } catch {
      toast.error("Failed to add");
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this criterion?")) return;
    try {
      await fetch(`${DRIVER_CONFIG_API}/criteria/${id}`, { method: "DELETE" });
      toast.success("Deleted");
      fetchCriteria();
    } catch {
      toast.error("Failed to delete");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Driver Monitoring Config</h2>
          <p className="text-sm text-gray-500">Configure driver behavior criteria, risk tiers, and thresholds</p>
        </div>
        <Button size="sm" onClick={() => setShowAddForm(true)}>
          <Plus className="w-4 h-4 mr-1" /> Add Criterion
        </Button>
      </div>

      {showAddForm && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="grid grid-cols-5 gap-3">
              <div>
                <label className="text-sm font-medium">Name</label>
                <Input value={addForm.name} onChange={(e) => setAddForm({ ...addForm, name: e.target.value })} placeholder="e.g. Speeding" />
              </div>
              <div>
                <label className="text-sm font-medium">Weighting</label>
                <Input type="number" value={addForm.selected_weighting} onChange={(e) => setAddForm({ ...addForm, selected_weighting: Number(e.target.value) })} />
              </div>
              <div>
                <label className="text-sm font-medium">Incidents</label>
                <Input type="number" value={addForm.incidents_threshold} min={1} onChange={(e) => setAddForm({ ...addForm, incidents_threshold: Number(e.target.value) })} />
              </div>
              <div className="flex flex-col">
                <label className="text-sm font-medium mb-1">NCR</label>
                <select 
                  className="border rounded px-2 py-1.5 h-[38px]"
                  value={addForm.nrc_deduction ? "yes" : "no"}
                  onChange={(e) => setAddForm({ ...addForm, nrc_deduction: e.target.value === "yes" })}
                >
                  <option value="no">No</option>
                  <option value="yes">Yes</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className="text-sm font-medium">Statuses</label>
                <AlertSearchDropdown
                  selected={addForm.statuses}
                  alertDefinitions={alertDefinitions}
                  onAdd={(name) => setAddForm({ ...addForm, statuses: [...addForm.statuses, name] })}
                  onRemove={(name) => setAddForm({ ...addForm, statuses: addForm.statuses.filter(x => x !== name) })}
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleAdd} disabled={!addForm.name}><Save className="w-4 h-4 mr-1" /> Add</Button>
              <Button size="sm" variant="outline" onClick={() => setShowAddForm(false)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50 text-left text-gray-500">
                <th className="py-3 px-4">Criterion</th>
                <th>Weighting</th>
                <th>NCR</th>
                <th>Incidents</th>
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
                      c.name
                    )}
                  </td>
                  <td>
                    {editingId === c.id ? (
                      <Input type="number" value={editForm.selected_weighting ?? c.selected_weighting} onChange={(e) => setEditForm({ ...editForm, selected_weighting: Number(e.target.value) })} className="h-8 w-20" />
                    ) : (
                      c.selected_weighting
                    )}
                  </td>
                  <td>
                    {editingId === c.id ? (
                      <select 
                        className="border rounded px-1 py-0.5 h-8"
                        value={editForm.nrc_deduction ? "yes" : "no"}
                        onChange={(e) => setEditForm({ ...editForm, nrc_deduction: e.target.value === "yes" })}
                      >
                        <option value="no">No</option>
                        <option value="yes">Yes</option>
                      </select>
                    ) : (
                      <span className={cn("px-2 py-1 rounded text-xs font-medium", c.nrc_deduction ? "bg-purple-100 text-purple-700" : "bg-gray-100 text-gray-700")}>
                        {c.nrc_deduction ? "Yes" : "No"}
                      </span>
                    )}
                  </td>
                  <td>
                    {editingId === c.id ? (
                      <Input type="number" value={editForm.incidents_threshold ?? c.incidents_threshold ?? 1} min={1} onChange={(e) => setEditForm({ ...editForm, incidents_threshold: Number(e.target.value) })} className="h-8 w-20" />
                    ) : (
                      c.incidents_threshold ?? 1
                    )}
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
                          <Button variant="ghost" size="sm" onClick={() => { setEditingId(c.id); setEditForm({ name: c.name, selected_weighting: c.selected_weighting, statuses: c.statuses, nrc_deduction: c.nrc_deduction, incidents_threshold: c.incidents_threshold }); }}>
                            <Pencil className="w-3 h-3" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleDelete(c.id)}>
                            <Trash2 className="w-3 h-3 text-red-500" />
                          </Button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
