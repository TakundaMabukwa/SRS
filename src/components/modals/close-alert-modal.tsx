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
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { XCircle, AlertTriangle } from "lucide-react";

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
      setError("Closing notes are required");
      return;
    }

    if (closingNotes.trim().length < 10) {
      setError("Closing notes must be at least 10 characters");
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
            <XCircle className="w-5 h-5 text-red-600" />
            Close Alert
          </DialogTitle>
          <DialogDescription>
            You are closing: <span className="font-medium text-slate-900">{alertTitle}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Warning Alert */}
          <Alert variant="default" className="bg-yellow-50 border-yellow-200">
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
            <AlertDescription className="text-yellow-800">
              Closing notes are <strong>required</strong>. Please provide detailed information
              about the resolution before closing this alert.
            </AlertDescription>
          </Alert>

          {/* Closing Notes - Required */}
          <div className="space-y-2">
            <Label htmlFor="closing-notes" className="text-base font-semibold">
              Closing Notes <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="closing-notes"
              placeholder="Describe how the alert was resolved, what actions were taken, and any relevant details..."
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

          {/* Action Taken - Optional */}
          <div className="space-y-2">
            <Label htmlFor="action-taken" className="text-base font-semibold">
              Action Taken <span className="text-slate-400">(Optional)</span>
            </Label>
            <Textarea
              id="action-taken"
              placeholder="Brief summary of the action taken (e.g., 'Driver counseled', 'Maintenance scheduled', etc.)"
              value={actionTaken}
              onChange={(e) => setActionTaken(e.target.value)}
              rows={2}
              disabled={isSubmitting}
            />
          </div>

          {/* False Positive Checkbox */}
          <div className="flex items-center space-x-2 p-3 bg-slate-50 rounded-lg">
            <Checkbox
              id="false-positive"
              checked={isFalsePositive}
              onCheckedChange={(checked) => setIsFalsePositive(checked as boolean)}
              disabled={isSubmitting}
            />
            <Label
              htmlFor="false-positive"
              className="text-sm font-medium cursor-pointer flex-1"
            >
              Mark as False Positive
              <span className="block text-xs text-slate-600 font-normal mt-0.5">
                Check this if the alert was triggered incorrectly
              </span>
            </Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || !closingNotes.trim() || closingNotes.trim().length < 10}
          >
            {isSubmitting ? "Closing..." : "Close Alert"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
