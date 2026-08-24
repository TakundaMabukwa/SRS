"use client";

import React, { useEffect, useState, useCallback } from "react";
import { Building2, Plus, Pencil, Trash2, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

interface CostCenter {
  id: number;
  name: string;
  code: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
}

export default function CostCenterPage() {
  const [costCenters, setCostCenters] = useState<CostCenter[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState({ name: "", code: "", description: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const supabase = createClient();

  const fetchCostCenters = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("cost_centers")
        .select("*")
        .order("name");
      if (error) throw error;
      setCostCenters(data || []);
    } catch (err) {
      console.error("Error fetching cost centers:", err);
      toast.error("Failed to load cost centers");
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchCostCenters();
  }, [fetchCostCenters]);

  const filtered = costCenters.filter(
    (cc) =>
      cc.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cc.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.code.trim()) {
      toast.error("Name and code are required");
      return;
    }
    setIsSubmitting(true);
    try {
      if (editingId) {
        const { error } = await supabase
          .from("cost_centers")
          .update({ name: formData.name, code: formData.code, description: formData.description || null, updated_at: new Date().toISOString() })
          .eq("id", editingId);
        if (error) throw error;
        toast.success("Cost center updated");
      } else {
        const { error } = await supabase
          .from("cost_centers")
          .insert({ name: formData.name, code: formData.code, description: formData.description || null });
        if (error) throw error;
        toast.success("Cost center added");
      }
      setIsDialogOpen(false);
      setFormData({ name: "", code: "", description: "" });
      setEditingId(null);
      fetchCostCenters();
    } catch (err: any) {
      console.error("Save error:", err);
      toast.error(err?.message?.includes("duplicate") ? "Code already exists" : "Failed to save");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this cost center?")) return;
    try {
      const { error } = await supabase.from("cost_centers").delete().eq("id", id);
      if (error) throw error;
      toast.success("Cost center deleted");
      fetchCostCenters();
    } catch (err) {
      console.error("Delete error:", err);
      toast.error("Failed to delete");
    }
  };

  const openAdd = () => {
    setFormData({ name: "", code: "", description: "" });
    setEditingId(null);
    setIsDialogOpen(true);
  };

  const openEdit = (cc: CostCenter) => {
    setFormData({ name: cc.name, code: cc.code, description: cc.description || "" });
    setEditingId(cc.id);
    setIsDialogOpen(true);
  };

  const totalActive = costCenters.filter((c) => c.is_active).length;

  return (
    <div className="p-6 space-y-6 w-full">
      {/* Title */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Cost Centers</h1>
          <p className="text-gray-500">Manage cost centers for vehicles and drivers</p>
        </div>
        <Button onClick={openAdd} className="flex items-center gap-2">
          <Plus className="w-4 h-4" /> Add Cost Center
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center space-x-4">
            <Building2 className="h-8 w-8 text-blue-500" />
            <div>
              <p className="text-sm text-gray-500">Total</p>
              <p className="text-xl font-semibold">{costCenters.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center space-x-4">
            <Building2 className="h-8 w-8 text-green-500" />
            <div>
              <p className="text-sm text-gray-500">Active</p>
              <p className="text-xl font-semibold">{totalActive}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center space-x-4">
            <Building2 className="h-8 w-8 text-purple-500" />
            <div>
              <p className="text-sm text-gray-500">Inactive</p>
              <p className="text-xl font-semibold">{costCenters.length - totalActive}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search + Table */}
      <Card>
        <CardHeader>
          <CardTitle>Cost Centers</CardTitle>
          <Input
            placeholder="Search by name or code..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-sm"
          />
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">Loading...</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              {costCenters.length === 0 ? "No cost centers yet. Click Add to create one." : "No results found."}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="px-4 py-2 text-left font-semibold">Name</th>
                    <th className="px-4 py-2 text-left font-semibold">Code</th>
                    <th className="px-4 py-2 text-left font-semibold">Description</th>
                    <th className="px-4 py-2 text-left font-semibold">Status</th>
                    <th className="px-4 py-2 text-left font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((cc) => (
                    <tr key={cc.id} className="border-b hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium">{cc.name}</td>
                      <td className="px-4 py-3 font-mono text-xs">{cc.code}</td>
                      <td className="px-4 py-3 text-gray-500">{cc.description || "—"}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${cc.is_active ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"}`}>
                          {cc.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          <Button variant="outline" size="sm" onClick={() => openEdit(cc)}>
                            <Pencil className="w-3 h-3" />
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => handleDelete(cc.id)}>
                            <Trash2 className="w-3 h-3 text-red-500" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      {isDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">{editingId ? "Edit Cost Center" : "Add Cost Center"}</h2>
              <button onClick={() => setIsDialogOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label>Name</Label>
                <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="e.g. Fleet Operations" />
              </div>
              <div>
                <Label>Code</Label>
                <Input value={formData.code} onChange={(e) => setFormData({ ...formData, code: e.target.value })} placeholder="e.g. FLEET-01" disabled={!!editingId} />
              </div>
              <div>
                <Label>Description</Label>
                <Input value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} placeholder="Optional description" />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Saving..." : editingId ? "Update" : "Create"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
