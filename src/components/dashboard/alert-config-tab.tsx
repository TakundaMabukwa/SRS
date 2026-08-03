"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";

const API_BASE = "/api/video-server/alert-config";

type AlertDefinition = {
  id: number;
  name: string;
  category: "telematics" | "video";
  description: string;
  signal_code: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type AlertGroupConfig = {
  id: number;
  name: string;
  severity: number;
  description: string;
  is_active: boolean;
  members: AlertDefinition[];
  created_at: string;
  updated_at: string;
};

const SEVERITY_COLORS: Record<number, string> = {
  1: "bg-green-100 text-green-800 border-green-200",
  2: "bg-green-100 text-green-800 border-green-200",
  3: "bg-yellow-100 text-yellow-800 border-yellow-200",
  4: "bg-yellow-100 text-yellow-800 border-yellow-200",
  5: "bg-orange-100 text-orange-800 border-orange-200",
  6: "bg-orange-100 text-orange-800 border-orange-200",
  7: "bg-red-100 text-red-800 border-red-200",
  8: "bg-red-100 text-red-800 border-red-200",
  9: "bg-red-100 text-red-800 border-red-200",
  10: "bg-red-100 text-red-800 border-red-200",
};

export default function AlertConfigTab() {
  const [activeSection, setActiveSection] = useState<"definitions" | "groups">("definitions");
  const [definitions, setDefinitions] = useState<AlertDefinition[]>([]);
  const [groups, setGroups] = useState<AlertGroupConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Definition form
  const [showDefForm, setShowDefForm] = useState(false);
  const [editingDef, setEditingDef] = useState<AlertDefinition | null>(null);
  const [defForm, setDefForm] = useState({ name: "", category: "telematics" as "telematics" | "video", description: "", signal_code: "" });

  // Group form
  const [showGroupForm, setShowGroupForm] = useState(false);
  const [editingGroup, setEditingGroup] = useState<AlertGroupConfig | null>(null);
  const [groupForm, setGroupForm] = useState({ name: "", severity: 5, description: "", memberIds: [] as number[] });
  const [showMemberPicker, setShowMemberPicker] = useState(false);

  const fetchDefinitions = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/definitions`, { cache: "no-store" });
      const data = await res.json();
      setDefinitions(data?.data || []);
    } catch {
      setDefinitions([]);
    }
  }, []);

  const fetchGroups = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/groups`, { cache: "no-store" });
      const data = await res.json();
      setGroups(data?.data || []);
    } catch {
      setGroups([]);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchDefinitions(), fetchGroups()])
      .catch(() => setError("Failed to load"))
      .finally(() => setLoading(false));
  }, [fetchDefinitions, fetchGroups]);

  // ── Definitions CRUD ──
  const saveDefinition = async () => {
    if (!defForm.name.trim()) return;
    try {
      const method = editingDef ? "PUT" : "POST";
      const url = editingDef ? `${API_BASE}/definitions/${editingDef.id}` : `${API_BASE}/definitions`;
      await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(defForm),
      });
      setShowDefForm(false);
      setEditingDef(null);
      setDefForm({ name: "", category: "telematics", description: "", signal_code: "" });
      await fetchDefinitions();
    } catch {
      setError("Failed to save definition");
    }
  };

  const deleteDefinition = async (id: number) => {
    if (!confirm("Delete this alert definition?")) return;
    try {
      await fetch(`${API_BASE}/definitions/${id}`, { method: "DELETE" });
      await fetchDefinitions();
    } catch {
      setError("Failed to delete definition");
    }
  };

  // ── Groups CRUD ──
  const saveGroup = async () => {
    if (!groupForm.name.trim()) return;
    try {
      const method = editingGroup ? "PUT" : "POST";
      const url = editingGroup ? `${API_BASE}/groups/${editingGroup.id}` : `${API_BASE}/groups`;
      await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: groupForm.name,
          severity: groupForm.severity,
          description: groupForm.description,
          member_ids: groupForm.memberIds,
        }),
      });
      setShowGroupForm(false);
      setEditingGroup(null);
      setGroupForm({ name: "", severity: 5, description: "", memberIds: [] });
      await fetchGroups();
    } catch {
      setError("Failed to save group");
    }
  };

  const deleteGroup = async (id: number) => {
    if (!confirm("Delete this alert group?")) return;
    try {
      await fetch(`${API_BASE}/groups/${id}`, { method: "DELETE" });
      await fetchGroups();
    } catch {
      setError("Failed to delete group");
    }
  };

  const toggleMember = (defId: number) => {
    setGroupForm((prev) => ({
      ...prev,
      memberIds: prev.memberIds.includes(defId)
        ? prev.memberIds.filter((id) => id !== defId)
        : [...prev.memberIds, defId],
    }));
  };

  if (loading) {
    return (
      <div className="p-10 text-center text-slate-500 text-sm">Loading alert configuration...</div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded bg-red-900/50 border border-red-800 px-3 py-2 text-xs text-red-300">
          {error}
          <button className="ml-2 underline" onClick={() => setError("")}>dismiss</button>
        </div>
      )}

      {/* Header */}
      <Card className="overflow-hidden border-slate-800 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-800 text-slate-100 shadow-xl">
        <div className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-violet-400/30 bg-violet-500/10 px-3 py-1 text-xs font-medium text-violet-300">
                <Shield className="h-3.5 w-3.5" />
                Configuration
              </div>
              <h2 className="text-xl font-bold tracking-tight">Alert Types & Groups</h2>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant={activeSection === "definitions" ? "default" : "outline"}
                className={cn(
                  "h-7 text-xs",
                  activeSection === "definitions"
                    ? "bg-violet-600 hover:bg-violet-700"
                    : "border-slate-600 bg-slate-800 text-slate-400 hover:bg-slate-700"
                )}
                onClick={() => setActiveSection("definitions")}
              >
                <Cpu className="mr-1 h-3 w-3" />
                Alert Types
              </Button>
              <Button
                size="sm"
                variant={activeSection === "groups" ? "default" : "outline"}
                className={cn(
                  "h-7 text-xs",
                  activeSection === "groups"
                    ? "bg-violet-600 hover:bg-violet-700"
                    : "border-slate-600 bg-slate-800 text-slate-400 hover:bg-slate-700"
                )}
                onClick={() => setActiveSection("groups")}
              >
                <AlertTriangle className="mr-1 h-3 w-3" />
                Alert Groups
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {/* ── Alert Definitions Section ── */}
      {activeSection === "definitions" && (
        <Card className="border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Alert Types</h3>
              <p className="text-xs text-slate-500">Define custom alerts from Telematics or Video sources</p>
            </div>
            <Button
              size="sm"
              className="h-7 bg-violet-600 hover:bg-violet-700"
              onClick={() => {
                setEditingDef(null);
                setDefForm({ name: "", category: "telematics", description: "", signal_code: "" });
                setShowDefForm(true);
              }}
            >
              <Plus className="mr-1 h-3 w-3" />
              Add Alert Type
            </Button>
          </div>

          {/* Definition Form */}
          {showDefForm && (
            <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
              <div className="grid grid-cols-4 gap-3">
                <div>
                  <label className="mb-1 block text-[10px] font-medium uppercase text-slate-500">Name</label>
                  <input
                    className="h-8 w-full rounded border border-slate-300 px-2 text-xs text-slate-900 outline-none focus:border-violet-400"
                    placeholder="e.g. Harsh Braking"
                    value={defForm.name}
                    onChange={(e) => setDefForm((p) => ({ ...p, name: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-medium uppercase text-slate-500">Category</label>
                  <select
                    className="h-8 w-full rounded border border-slate-300 px-2 text-xs text-slate-900 outline-none focus:border-violet-400"
                    value={defForm.category}
                    onChange={(e) => setDefForm((p) => ({ ...p, category: e.target.value as "telematics" | "video" }))}
                  >
                    <option value="telematics">Telematics</option>
                    <option value="video">Video</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-medium uppercase text-slate-500">Signal Code</label>
                  <input
                    className="h-8 w-full rounded border border-slate-300 px-2 text-xs text-slate-900 outline-none focus:border-violet-400"
                    placeholder="e.g. HARSH_BRAKE"
                    value={defForm.signal_code}
                    onChange={(e) => setDefForm((p) => ({ ...p, signal_code: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-medium uppercase text-slate-500">Description</label>
                  <input
                    className="h-8 w-full rounded border border-slate-300 px-2 text-xs text-slate-900 outline-none focus:border-violet-400"
                    placeholder="Optional description"
                    value={defForm.description}
                    onChange={(e) => setDefForm((p) => ({ ...p, description: e.target.value }))}
                  />
                </div>
              </div>
              <div className="mt-2 flex gap-2">
                <Button size="sm" className="h-7 bg-violet-600 hover:bg-violet-700" onClick={saveDefinition}>
                  <Save className="mr-1 h-3 w-3" />
                  {editingDef ? "Update" : "Create"}
                </Button>
                <Button size="sm" variant="outline" className="h-7" onClick={() => { setShowDefForm(false); setEditingDef(null); }}>
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {/* Definitions Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="px-4 py-2 font-medium text-slate-500">Name</th>
                  <th className="px-4 py-2 font-medium text-slate-500">Category</th>
                  <th className="px-4 py-2 font-medium text-slate-500">Signal Code</th>
                  <th className="px-4 py-2 font-medium text-slate-500">Description</th>
                  <th className="px-4 py-2 font-medium text-slate-500">Status</th>
                  <th className="px-4 py-2 font-medium text-slate-500 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {definitions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                      No alert types defined yet. Click "Add Alert Type" to create one.
                    </td>
                  </tr>
                ) : (
                  definitions.map((def) => (
                    <tr key={def.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="px-4 py-2 font-medium text-slate-900">{def.name}</td>
                      <td className="px-4 py-2">
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[10px] font-semibold",
                            def.category === "telematics"
                              ? "border-blue-200 bg-blue-50 text-blue-700"
                              : "border-purple-200 bg-purple-50 text-purple-700"
                          )}
                        >
                          {def.category === "telematics" ? (
                            <Cpu className="mr-1 h-2.5 w-2.5" />
                          ) : (
                            <Camera className="mr-1 h-2.5 w-2.5" />
                          )}
                          {def.category}
                        </Badge>
                      </td>
                      <td className="px-4 py-2 font-mono text-slate-600">{def.signal_code || "—"}</td>
                      <td className="px-4 py-2 text-slate-500 max-w-[200px] truncate">{def.description || "—"}</td>
                      <td className="px-4 py-2">
                        <Badge variant="outline" className={cn("text-[10px]", def.is_active ? "border-green-200 bg-green-50 text-green-700" : "border-slate-200 bg-slate-100 text-slate-500")}>
                          {def.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </td>
                      <td className="px-4 py-2 text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 px-1.5 text-slate-500 hover:text-violet-600"
                            onClick={() => {
                              setEditingDef(def);
                              setDefForm({ name: def.name, category: def.category, description: def.description, signal_code: def.signal_code });
                              setShowDefForm(true);
                            }}
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 px-1.5 text-slate-500 hover:text-red-600"
                            onClick={() => deleteDefinition(def.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* ── Alert Groups Section ── */}
      {activeSection === "groups" && (
        <Card className="border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Alert Groups</h3>
              <p className="text-xs text-slate-500">Combine multiple alert types and assign severity (1-10)</p>
            </div>
            <Button
              size="sm"
              className="h-7 bg-violet-600 hover:bg-violet-700"
              onClick={() => {
                setEditingGroup(null);
                setGroupForm({ name: "", severity: 5, description: "", memberIds: [] });
                setShowGroupForm(true);
              }}
            >
              <Plus className="mr-1 h-3 w-3" />
              Add Group
            </Button>
          </div>

          {/* Group Form */}
          {showGroupForm && (
            <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="mb-1 block text-[10px] font-medium uppercase text-slate-500">Group Name</label>
                  <input
                    className="h-8 w-full rounded border border-slate-300 px-2 text-xs text-slate-900 outline-none focus:border-violet-400"
                    placeholder="e.g. Safety Incident"
                    value={groupForm.name}
                    onChange={(e) => setGroupForm((p) => ({ ...p, name: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-medium uppercase text-slate-500">
                    Severity: <span className="font-bold text-slate-900">{groupForm.severity}</span>
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="10"
                    value={groupForm.severity}
                    onChange={(e) => setGroupForm((p) => ({ ...p, severity: parseInt(e.target.value) }))}
                    className="w-full accent-violet-600"
                  />
                  <div className="flex justify-between text-[9px] text-slate-400">
                    <span>Low (1)</span>
                    <span>High (10)</span>
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-medium uppercase text-slate-500">Description</label>
                  <input
                    className="h-8 w-full rounded border border-slate-300 px-2 text-xs text-slate-900 outline-none focus:border-violet-400"
                    placeholder="Optional description"
                    value={groupForm.description}
                    onChange={(e) => setGroupForm((p) => ({ ...p, description: e.target.value }))}
                  />
                </div>
              </div>

              {/* Member Selection */}
              <div className="mt-3">
                <label className="mb-1 block text-[10px] font-medium uppercase text-slate-500">
                  Alert Types in this Group ({groupForm.memberIds.length} selected)
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {definitions.map((def) => {
                    const selected = groupForm.memberIds.includes(def.id);
                    return (
                      <button
                        key={def.id}
                        type="button"
                        onClick={() => toggleMember(def.id)}
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium transition-colors",
                          selected
                            ? "border-violet-300 bg-violet-100 text-violet-800"
                            : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                        )}
                      >
                        {def.category === "telematics" ? <Cpu className="h-2.5 w-2.5" /> : <Camera className="h-2.5 w-2.5" />}
                        {def.name}
                      </button>
                    );
                  })}
                  {definitions.length === 0 && (
                    <span className="text-xs text-slate-400">No alert types defined. Add some in the Alert Types tab first.</span>
                  )}
                </div>
              </div>

              <div className="mt-3 flex gap-2">
                <Button size="sm" className="h-7 bg-violet-600 hover:bg-violet-700" onClick={saveGroup}>
                  <Save className="mr-1 h-3 w-3" />
                  {editingGroup ? "Update" : "Create"}
                </Button>
                <Button size="sm" variant="outline" className="h-7" onClick={() => { setShowGroupForm(false); setEditingGroup(null); }}>
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {/* Groups List */}
          <div className="divide-y divide-slate-100">
            {groups.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-slate-400">
                No alert groups defined yet. Click "Add Group" to create one.
              </div>
            ) : (
              groups.map((group) => (
                <div key={group.id} className="flex items-start justify-between px-4 py-3 hover:bg-slate-50">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-semibold text-slate-900">{group.name}</h4>
                      <Badge
                        variant="outline"
                        className={cn("text-[10px] font-bold", SEVERITY_COLORS[group.severity] || SEVERITY_COLORS[5])}
                      >
                        Severity {group.severity}
                      </Badge>
                      {!group.is_active && (
                        <Badge variant="outline" className="text-[10px] text-slate-400">Inactive</Badge>
                      )}
                    </div>
                    {group.description && (
                      <p className="mt-0.5 text-xs text-slate-500">{group.description}</p>
                    )}
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {group.members.map((m) => (
                        <Badge
                          key={m.id}
                          variant="outline"
                          className={cn(
                            "text-[9px] font-medium",
                            m.category === "telematics"
                              ? "border-blue-200 bg-blue-50 text-blue-700"
                              : "border-purple-200 bg-purple-50 text-purple-700"
                          )}
                        >
                          {m.category === "telematics" ? <Cpu className="mr-0.5 h-2 w-2" /> : <Camera className="mr-0.5 h-2 w-2" />}
                          {m.name}
                        </Badge>
                      ))}
                      {group.members.length === 0 && (
                        <span className="text-[10px] text-slate-400">No alert types assigned</span>
                      )}
                    </div>
                  </div>
                  <div className="ml-3 flex gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 px-1.5 text-slate-500 hover:text-violet-600"
                      onClick={() => {
                        setEditingGroup(group);
                        setGroupForm({
                          name: group.name,
                          severity: group.severity,
                          description: group.description,
                          memberIds: group.members.map((m) => m.id),
                        });
                        setShowGroupForm(true);
                      }}
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 px-1.5 text-slate-500 hover:text-red-600"
                      onClick={() => deleteGroup(group.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
