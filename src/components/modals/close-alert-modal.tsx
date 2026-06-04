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
