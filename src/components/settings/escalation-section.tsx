"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Users, Loader2, Mail, BellRing } from "lucide-react";
import { toast } from "sonner";
import { useCostCenters } from "@/context/cost-centers-context";

const ESCALATION_API = "/api/video-server/escalation";

type EscalationMember = {
  id: number;
  email: string;
  member_name?: string;
  is_active?: boolean;
};

type EscalationAlertGroup = {
  id: number;
  name: string;
};

type EscalationGroup = {
  id: number;
  name: string;
  cost_center_id: number | null;
  description?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  members: EscalationMember[];
  alert_groups: EscalationAlertGroup[];
};

export function EscalationSection() {
  const [groups, setGroups] = useState<EscalationGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [alertGroups, setAlertGroups] = useState<EscalationAlertGroup[]>([]);
  const [selectedCcId, setSelectedCcId] = useState<number | null>(null);
  const { costCenters } = useCostCenters();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState("");
  const [editingDescription, setEditingDescription] = useState("");
  const [editingCostCenterId, setEditingCostCenterId] = useState<number | null>(null);
  const [emailsText, setEmailsText] = useState("");
  const [selectedAlertGroupIds, setSelectedAlertGroupIds] = useState<number[]>([]);

  const fetchGroups = useCallback(async () => {
    try {
      const ccParam = selectedCcId != null ? `?cost_center_id=${selectedCcId}` : "";
      const res = await fetch(`${ESCALATION_API}/groups${ccParam}`, { cache: "no-store" });
      const data = await res.json();
      setGroups(data?.data || []);
    } catch (err) {
      console.error("Error fetching escalation groups:", err);
      setGroups([]);
      toast.error("Failed to load escalation groups");
    }
  }, [selectedCcId]);

  const fetchAlertGroups = useCallback(async () => {
    try {
      const res = await fetch(`${ESCALATION_API}/alert-groups`, { cache: "no-store" });
      const data = await res.json();
      setAlertGroups(data?.data || []);
    } catch {
      setAlertGroups([]);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchGroups().finally(() => setLoading(false));
  }, [fetchGroups]);

  useEffect(() => {
    fetchAlertGroups();
  }, [fetchAlertGroups]);

  const openCreate = () => {
    setEditingId(null);
    setEditingName("");
    setEditingDescription("");
    setEditingCostCenterId(selectedCcId);
    setEmailsText("");
    setSelectedAlertGroupIds([]);
    setDialogOpen(true);
  };

  const openEdit = (g: EscalationGroup) => {
    setEditingId(g.id);
    setEditingName(g.name);
    setEditingDescription(g.description || "");
    setEditingCostCenterId(g.cost_center_id);
    setEmailsText((g.members || []).map((m) => m.email).join(", "));
    setSelectedAlertGroupIds((g.alert_groups || []).map((a) => a.id));
    setDialogOpen(true);
  };

  const parseEmails = (text: string): string[] =>
    text
      .split(/[\n,;]+/)
      .map((e) => e.trim())
      .filter((e) => e.length > 0);

  const handleSave = async () => {
    const emails = parseEmails(emailsText);
    if (!editingName.trim()) {
      toast.error("Group name is required");
      return;
    }
    if (emails.length === 0) {
      toast.error("Add at least one contact email");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: editingName.trim(),
        cost_center_id: editingCostCenterId,
        description: editingDescription,
        emails,
        alert_group_ids: selectedAlertGroupIds,
      };

      if (editingId != null) {
        const res = await fetch(`${ESCALATION_API}/groups/${editingId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.message || "Failed to update");
        toast.success("Escalation group updated");
      } else {
        const res = await fetch(`${ESCALATION_API}/groups`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.message || "Failed to create");
        toast.success("Escalation group created");
      }
      setDialogOpen(false);
      fetchGroups();
    } catch (err: any) {
      console.error("Error saving escalation group:", err);
      toast.error(err?.message || "Failed to save escalation group");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (g: EscalationGroup) => {
    if (!confirm(`Delete escalation group "${g.name}"?`)) return;
    try {
      const res = await fetch(`${ESCALATION_API}/groups/${g.id}`, { method: "DELETE" });
      if (!res.ok && res.status !== 204) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.message || "Failed to delete");
      }
      toast.success("Escalation group deleted");
      fetchGroups();
    } catch (err: any) {
      console.error("Error deleting escalation group:", err);
      toast.error(err?.message || "Failed to delete");
    }
  };

  const toggleAlertGroup = (id: number) => {
    setSelectedAlertGroupIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const ccName = (id: number | null) =>
    id == null ? "Global" : costCenters.find((c) => c.id === id)?.name || `#${id}`;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Escalation Groups</h2>
          <p className="text-sm text-gray-500">
            Setup contact people (emails) who should be notified per alert, grouped by cost center
          </p>
        </div>
        <div className="flex gap-2 items-center">
          <div className="w-56">
            <Select
              value={selectedCcId?.toString() ?? "all"}
              onValueChange={(v) => setSelectedCcId(v === "all" ? null : Number(v))}
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder="All Cost Centers" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Cost Centers</SelectItem>
                {costCenters.map((cc) => (
                  <SelectItem key={cc.id} value={cc.id.toString()}>
                    {cc.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button size="sm" variant="outline" onClick={fetchGroups}>
            Refresh
          </Button>
          <Button size="sm" onClick={openCreate}>
            <Plus className="w-4 h-4 mr-1" /> New Group
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-gray-500">
              <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading...
            </div>
          ) : groups.length === 0 ? (
            <div className="py-12 text-center text-gray-500">
              <Users className="w-8 h-8 mx-auto mb-2 text-gray-300" />
              <p>No escalation groups found for this filter.</p>
              <p className="text-sm text-gray-400">Use "New Group" to create one.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50 text-left text-gray-500">
                  <th className="py-3 px-4">Name</th>
                  <th>Cost Center</th>
                  <th>Contacts</th>
                  <th>Alert Groups</th>
                  <th>Status</th>
                  <th className="text-right pr-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {groups.map((g) => (
                  <tr key={g.id} className="border-b hover:bg-gray-50">
                    <td className="py-2 px-4">
                      <div className="font-medium">{g.name}</div>
                      {g.description && (
                        <div className="text-xs text-gray-500">{g.description}</div>
                      )}
                    </td>
                    <td className="py-2">
                      <Badge variant="secondary" className="text-xs">
                        {ccName(g.cost_center_id)}
                      </Badge>
                    </td>
                    <td className="py-2">
                      {(g.members || []).length > 0 ? (
                        <div className="flex flex-wrap gap-1 max-w-[280px]">
                          {g.members.map((m) => (
                            <span
                              key={m.id}
                              className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full border border-blue-200 flex items-center gap-1"
                            >
                              <Mail className="w-3 h-3" />
                              {m.email}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">No contacts</span>
                      )}
                    </td>
                    <td className="py-2">
                      {(g.alert_groups || []).length > 0 ? (
                        <div className="flex flex-wrap gap-1 max-w-[200px]">
                          {g.alert_groups.map((a) => (
                            <span
                              key={a.id}
                              className="text-xs bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full border border-purple-200"
                            >
                              {a.name}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">All alerts</span>
                      )}
                    </td>
                    <td className="py-2">
                      <Badge className={g.is_active !== false ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}>
                        {g.is_active !== false ? "Active" : "Inactive"}
                      </Badge>
                    </td>
                    <td className="py-2 text-right pr-4">
                      <div className="flex justify-end gap-1">
                        <Button variant="outline" size="sm" onClick={() => openEdit(g)}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => handleDelete(g)}>
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId != null ? "Edit Escalation Group" : "New Escalation Group"}</DialogTitle>
            <DialogDescription>
              Who should receive emails for certain alerts, and for which cost center
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Group Name</Label>
              <Input value={editingName} onChange={(e) => setEditingName(e.target.value)} placeholder="e.g. SRS Fleet Managers" />
            </div>

            <div className="space-y-2">
              <Label>Cost Center</Label>
              <Select
                value={editingCostCenterId?.toString() ?? "global"}
                onValueChange={(v) => setEditingCostCenterId(v === "global" ? null : Number(v))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Global Default" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="global">Global Default</SelectItem>
                  {costCenters.map((cc) => (
                    <SelectItem key={cc.id} value={cc.id.toString()}>
                      {cc.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Input
                value={editingDescription}
                onChange={(e) => setEditingDescription(e.target.value)}
                placeholder="Optional description"
              />
            </div>

            <div className="space-y-2">
              <Label>Contact Emails</Label>
              <Textarea
                value={emailsText}
                onChange={(e) => setEmailsText(e.target.value)}
                placeholder={"person1@company.com, person2@company.com\nNew email per line"}
                rows={4}
              />
              <p className="text-xs text-gray-500">
                Separate emails with commas or new lines
              </p>
            </div>

            <div className="space-y-2">
              <Label>Triggered For Alert Groups</Label>
              <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
                <BellRing className="w-3 h-3" />
                Leave empty to apply to all alerts
              </div>
              {alertGroups.length === 0 ? (
                <p className="text-sm text-gray-400">No alert groups available.</p>
              ) : (
                <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto border rounded-md p-3">
                  {alertGroups.map((ag) => (
                    <label key={ag.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-50 p-1 rounded">
                      <input
                        type="checkbox"
                        checked={selectedAlertGroupIds.includes(ag.id)}
                        onChange={() => toggleAlertGroup(ag.id)}
                        className="rounded border-gray-300"
                      />
                      {ag.name}
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving} className="min-w-[120px]">
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" /> Saving...
                </>
              ) : (
                "Save Group"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
