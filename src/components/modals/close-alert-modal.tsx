"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle2, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface CloseAlertModalProps {
  open: boolean;
  onClose: () => void;
  alertId: string;
  alertTitle: string;
  onSubmit?: (data: {
    notes: string;
    action_taken?: string;
    ncr_classification?: string;
    close_reason?: string;
    reported_by?: string;
    resolveScope?: "this_alert" | "all_group";
    incident?: {
      driver_name?: string;
      contact_number?: string;
      id_number?: string;
      division?: string;
    };
  }) => Promise<boolean>;
}

const NCR_CLASSIFICATIONS = [
  { value: "driver_behavior", label: "Driver Behavior" },
  { value: "vehicle_equipment", label: "Vehicle / Equipment" },
  { value: "external_factor", label: "External Factor" },
  { value: "procedural", label: "Procedural" },
  { value: "other", label: "Other" },
];

const CLOSE_REASONS = [
  { value: "resolved", label: "Resolved" },
  { value: "addressed_with_driver", label: "Addressed with Driver" },
  { value: "disciplinary", label: "Disciplinary Action" },
  { value: "training", label: "Training Provided" },
  { value: "maintenance", label: "Maintenance Required" },
  { value: "false_alarm", label: "False Alarm" },
  { value: "other", label: "Other" },
];

export default function CloseAlertModal({
  open,
  onClose,
  alertId,
  alertTitle,
  onSubmit,
}: CloseAlertModalProps) {
  const [ncrClassification, setNcrClassification] = useState("");
  const [closeReason, setCloseReason] = useState("");
  const [closingNotes, setClosingNotes] = useState("");
  const [actionTaken, setActionTaken] = useState("");
  const [reportedBy, setReportedBy] = useState("");
  const [resolveScope, setResolveScope] = useState<"this_alert" | "all_group">("this_alert");
  const [driverName, setDriverName] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [idNumber, setIdNumber] = useState("");
  const [division, setDivision] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [currentUser] = useState({
    id: "user-1",
    name: "Current User",
  });

  const handleSubmit = async () => {
    if (!closingNotes.trim()) {
      setError("Incident report is required");
      return;
    }

    if (closingNotes.trim().length < 10) {
      setError("Incident report must be at least 10 characters");
      return;
    }

    if (!actionTaken.trim()) {
      setError("Action taken is required");
      return;
    }

    setError("");
    setIsSubmitting(true);

    try {
      const data = {
        notes: closingNotes.trim(),
        action_taken: actionTaken.trim() || undefined,
        ncr_classification: ncrClassification || undefined,
        close_reason: closeReason || undefined,
        reported_by: reportedBy.trim() || currentUser.name,
        resolveScope,
        incident: {
          driver_name: driverName.trim() || undefined,
          contact_number: contactNumber.trim() || undefined,
          id_number: idNumber.trim() || undefined,
          division: division.trim() || undefined,
        },
      };

      let success = false;
      if (onSubmit) {
        success = await onSubmit(data);
      } else {
        const res = await fetch(`/api/video-server/eps/alerts/${encodeURIComponent(alertId)}/close`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        success = res.ok;
      }

      if (success) {
        setNcrClassification("");
        setCloseReason("");
        setClosingNotes("");
        setActionTaken("");
        setReportedBy("");
        setResolveScope("this_alert");
        setDriverName("");
        setContactNumber("");
        setIdNumber("");
        setDivision("");
        onClose();
      }
    } catch (err) {
      setError("Failed to close alert. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    setNcrClassification("");
    setCloseReason("");
    setClosingNotes("");
    setActionTaken("");
    setReportedBy("");
    setResolveScope("this_alert");
    setDriverName("");
    setContactNumber("");
    setIdNumber("");
    setDivision("");
    setError("");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[700px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-green-600" />
            NCR & Alert Report
          </DialogTitle>
          <DialogDescription>
            Document the incident: <span className="font-medium text-slate-900">{alertTitle}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-4">
          <Alert variant="default" className="bg-blue-50 border-blue-200">
            <AlertTriangle className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-blue-800">
              Complete this Non-Conformance Report (NCR) to document the incident for record keeping and reporting.
            </AlertDescription>
          </Alert>

          {/* Resolve Scope */}
          <div className="space-y-2">
            <Label className="text-base font-semibold">Resolution Scope</Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setResolveScope("this_alert")}
                className={cn(
                  "rounded-md border px-3 py-2 text-sm text-left transition-colors",
                  resolveScope === "this_alert"
                    ? "border-blue-500 bg-blue-50 text-blue-800 font-medium"
                    : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                )}
              >
                Resolve Active Alert
                <span className="block text-xs font-normal text-slate-500">Close just this alert</span>
              </button>
              <button
                type="button"
                onClick={() => setResolveScope("all_group")}
                className={cn(
                  "rounded-md border px-3 py-2 text-sm text-left transition-colors",
                  resolveScope === "all_group"
                    ? "border-blue-500 bg-blue-50 text-blue-800 font-medium"
                    : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                )}
              >
                Resolve All With Note
                <span className="block text-xs font-normal text-slate-500">Close the whole alert group + children</span>
              </button>
            </div>
          </div>

          {/* Driver / Incident Details (register fields) */}
          <div className="space-y-2">
            <Label className="text-base font-semibold">Driver / Incident Details</Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="driver-name" className="text-xs text-slate-500">Name &amp; Surname</Label>
                <Input
                  id="driver-name"
                  placeholder="Driver name & surname"
                  value={driverName}
                  onChange={(e) => setDriverName(e.target.value)}
                  disabled={isSubmitting}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="contact-number" className="text-xs text-slate-500">Contact Number</Label>
                <Input
                  id="contact-number"
                  placeholder="Contact number"
                  value={contactNumber}
                  onChange={(e) => setContactNumber(e.target.value)}
                  disabled={isSubmitting}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="id-number" className="text-xs text-slate-500">ID Number</Label>
                <Input
                  id="id-number"
                  placeholder="ID number"
                  value={idNumber}
                  onChange={(e) => setIdNumber(e.target.value)}
                  disabled={isSubmitting}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="division" className="text-xs text-slate-500">Division</Label>
                <Input
                  id="division"
                  placeholder="Division"
                  value={division}
                  onChange={(e) => setDivision(e.target.value)}
                  disabled={isSubmitting}
                />
              </div>
            </div>
          </div>

          {/* NCR Classification */}
          <div className="space-y-2">
            <Label className="text-base font-semibold">NCR Classification</Label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {NCR_CLASSIFICATIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setNcrClassification(opt.value === ncrClassification ? "" : opt.value)}
                  className={cn(
                    "rounded-md border px-3 py-2 text-sm text-left transition-colors",
                    ncrClassification === opt.value
                      ? "border-blue-500 bg-blue-50 text-blue-800 font-medium"
                      : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Reason for Closing */}
          <div className="space-y-2">
            <Label className="text-base font-semibold">Reason for Closing</Label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {CLOSE_REASONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setCloseReason(opt.value === closeReason ? "" : opt.value)}
                  className={cn(
                    "rounded-md border px-3 py-2 text-sm text-left transition-colors",
                    closeReason === opt.value
                      ? "border-green-500 bg-green-50 text-green-800 font-medium"
                      : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Incident Report */}
          <div className="space-y-2">
            <Label htmlFor="closing-notes" className="text-base font-semibold">
              NCR Description <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="closing-notes"
              placeholder="Describe the incident, what led to it, and any contributing factors..."
              value={closingNotes}
              onChange={(e) => {
                setClosingNotes(e.target.value);
                if (error) setError("");
              }}
              rows={4}
              className={error ? "border-red-500" : ""}
              disabled={isSubmitting}
            />
            <p className="text-sm text-slate-500">
              Minimum 10 characters • {closingNotes.length} characters
            </p>
            {error && <p className="text-sm text-red-600">{error}</p>}
          </div>

          {/* Action Taken */}
          <div className="space-y-2">
            <Label htmlFor="action-taken" className="text-base font-semibold">
              Corrective Action Taken <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="action-taken"
              placeholder="e.g., 'Driver counseled on safe following distance', 'Vehicle sent for brake inspection', 'Written warning issued'"
              value={actionTaken}
              onChange={(e) => setActionTaken(e.target.value)}
              rows={3}
              disabled={isSubmitting}
            />
          </div>

          {/* Reported By */}
          <div className="space-y-2">
            <Label htmlFor="reported-by" className="text-base font-semibold">
              Reported By
            </Label>
            <Input
              id="reported-by"
              placeholder={currentUser.name}
              value={reportedBy}
              onChange={(e) => setReportedBy(e.target.value)}
              disabled={isSubmitting}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || !closingNotes.trim() || closingNotes.trim().length < 10 || !actionTaken.trim()}
            className="bg-green-600 hover:bg-green-700"
          >
            {isSubmitting ? "Saving..." : "Save Report & Close"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
