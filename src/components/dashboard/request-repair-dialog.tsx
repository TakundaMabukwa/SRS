"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DateTimePicker } from "@/components/ui/datetime-picker";
import { toast } from "sonner";

interface RequestRepairDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  alert: any;
  fleetNumber: string;
  registration: string;
  alarmType: string;
  onSuccess?: (jobNumber: string | null) => void;
}

export function RequestRepairDialog({
  open,
  onOpenChange,
  alert,
  fleetNumber,
  registration,
  alarmType,
  onSuccess,
}: RequestRepairDialogProps) {
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [availableAt, setAvailableAt] = useState("");
  const [issue, setIssue] = useState(alarmType ? `${alarmType} fault` : "");
  const [priority, setPriority] = useState("medium");
  const [submitting, setSubmitting] = useState(false);

  React.useEffect(() => {
    if (open && alarmType) setIssue((prev) => prev || `${alarmType} fault`);
  }, [open, alarmType]);

  const reset = () => {
    setContactName("");
    setContactPhone("");
    setContactEmail("");
    setAvailableAt("");
    setIssue(alarmType ? `${alarmType} fault` : "");
    setPriority("medium");
  };

  const handleSubmit = async () => {
    if (!contactName.trim()) return toast.error("Contact name is required.");
    if (!contactPhone.trim()) return toast.error("Contact phone is required.");
    if (!contactEmail.trim() || !/^\S+@\S+\.\S+$/.test(contactEmail.trim()))
      return toast.error("Valid contact email is required.");
    if (!availableAt) return toast.error("Please pick when the vehicle will be available.");
    if (!issue.trim()) return toast.error("Issue description is required.");
    if (!fleetNumber) return toast.error("Fleet number missing from alert.");

    setSubmitting(true);
    try {
      const res = await fetch("/api/video-server/repair-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          alert_id: alert?.id,
          fleet_number: fleetNumber,
          registration,
          device_id: alert?.device_id || alert?.deviceId || "",
          cost_center_id: null,
          alarm_type: alarmType,
          notes: "Repair requested from alert detail",
          contact_name: contactName.trim(),
          contact_phone: contactPhone.trim(),
          contact_email: contactEmail.trim(),
          available_at: availableAt,
          issue_description: issue.trim(),
          priority,
        }),
      });
      const data = await res.json();
      if (data.success) {
        const jobNo = data.job?.job_number || data.repair?.external_job_number || null;
        toast.success(jobNo ? `Repair logged – ${jobNo}` : "Repair request logged.");
        onOpenChange(false);
        reset();
        onSuccess?.(jobNo);
      } else {
        toast.error(data.message || "Failed to log job. Contact monique@soltrack.co.za");
      }
    } catch {
      toast.error("Failed to log job. Contact monique@soltrack.co.za");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Request Repair – {fleetNumber}</DialogTitle>
          <DialogDescription>
            Contact info and availability are sent to Solflo as the job description.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          <div>
            <Label htmlFor="rr-name">Contact name *</Label>
            <Input id="rr-name" value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="e.g. Thandi M" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="rr-phone">Contact phone *</Label>
              <Input id="rr-phone" type="tel" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} placeholder="0821234567" />
            </div>
            <div>
              <Label htmlFor="rr-email">Contact email *</Label>
              <Input id="rr-email" type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} placeholder="name@company.co.za" />
            </div>
          </div>
          <div>
            <Label>Vehicle available *</Label>
            <DateTimePicker value={availableAt} onChange={setAvailableAt} placeholder="Pick date and time" />
          </div>
          <div>
            <Label htmlFor="rr-issue">Issue / fault description *</Label>
            <Textarea id="rr-issue" value={issue} onChange={(e) => setIssue(e.target.value)} rows={3} placeholder="Describe the fault" />
          </div>
          <div>
            <Label>Priority</Label>
            <Select value={priority} onValueChange={setPriority}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting} className="bg-amber-600 hover:bg-amber-700 text-white">
            {submitting ? "Submitting…" : "Submit Repair"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
