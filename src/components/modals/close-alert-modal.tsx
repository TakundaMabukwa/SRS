"use client";

import React, { useState } from "react";
import { useVideoAlerts } from "@/context/video-alerts-context/context";
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
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle2, AlertTriangle } from "lucide-react";

interface CloseAlertModalProps {
  open: boolean;
  onClose: () => void;
  alertId: string;
  alertTitle: string;
}

export default function CloseAlertModal({
  open,
  onClose,
  alertId,
  alertTitle,
}: CloseAlertModalProps) {
  const { closeAlert } = useVideoAlerts();
  const [closingNotes, setClosingNotes] = useState("");
  const [actionTaken, setActionTaken] = useState("");
  const [isFalsePositive, setIsFalsePositive] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [currentUser] = useState({
    id: "user-1",
    name: "Current User",
  });

  const handleSubmit = async () => {
    // Validation
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
      const result = await closeAlert(alertId, {
        notes: closingNotes.trim(),
        action_taken: actionTaken.trim() || undefined,
        is_false_positive: isFalsePositive,
        userId: currentUser.id,
      });

      if (result) {
        // Reset form
        setClosingNotes("");
        setActionTaken("");
        setIsFalsePositive(false);
        onClose();
      }
    } catch (err) {
      setError("Failed to close alert. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    setClosingNotes("");
    setActionTaken("");
    setIsFalsePositive(false);
    setError("");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-green-600" />
            Save Alert Report
          </DialogTitle>
          <DialogDescription>
            Document the incident: <span className="font-medium text-slate-900">{alertTitle}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Warning Alert */}
          <Alert variant="default" className="bg-blue-50 border-blue-200">
            <AlertTriangle className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-blue-800">
              Please provide detailed information about this incident for record keeping and reporting purposes.
            </AlertDescription>
          </Alert>

          {/* Report Notes - Required */}
          <div className="space-y-2">
            <Label htmlFor="closing-notes" className="text-base font-semibold">
              Incident Report <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="closing-notes"
              placeholder="Describe the incident, driver behavior, actions taken, and any relevant details..."
              value={closingNotes}
              onChange={(e) => {
                setClosingNotes(e.target.value);
                if (error) setError("");
              }}
              rows={5}
              className={error ? "border-red-500" : ""}
              disabled={isSubmitting}
            />
            <p className="text-sm text-slate-500">
              Minimum 10 characters • {closingNotes.length} characters
            </p>
            {error && <p className="text-sm text-red-600">{error}</p>}
          </div>

          {/* Action Taken - Required */}
          <div className="space-y-2">
            <Label htmlFor="action-taken" className="text-base font-semibold">
              Action Taken <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="action-taken"
              placeholder="What action was taken? (e.g., 'Driver counseled', 'Written warning issued', 'Scheduled retraining', etc.)"
              value={actionTaken}
              onChange={(e) => setActionTaken(e.target.value)}
              rows={3}
              disabled={isSubmitting}
            />
          </div>

          {/* False Positive Checkbox - Removed */}
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
            {isSubmitting ? "Saving..." : "Save Report"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
