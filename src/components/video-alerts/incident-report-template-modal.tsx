"use client";

import { useEffect, useMemo, useState } from "react";
import { X, FileText, CheckCircle2 } from "lucide-react";

type AnyRecord = Record<string, unknown>;

interface IncidentReportTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  alert: AnyRecord;
  trip?: AnyRecord | null;
  onResolved?: () => void;
}

interface IncidentFormState {
  date: string;
  time: string;
  location: string;
  incidentReferenceNumber: string;
  reportedByController: string;
  positionTitle: string;
  contactNumber: string;
  dateTimeOfIncident: string;
  fleetVehicleNumber: string;
  typeOfIncident: string;
  locationOfIncident: string;
  personsInvolved: string;
  descriptionOfIncident: string;
  immediateActionTaken: string;
  reportedToSupervisorManager: string;
  findingsRootCause: string;
  reportCompiledBy: string;
  designation: string;
}

function toDateInput(timestamp?: string) {
  if (!timestamp) return "";
  const d = new Date(timestamp);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

function toTimeInput(timestamp?: string) {
  if (!timestamp) return "";
  const d = new Date(timestamp);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(11, 16);
}

function toDateTimeText(timestamp?: string) {
  if (!timestamp) return "";
  const d = new Date(timestamp);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function IncidentReportTemplateModal({
  isOpen,
  onClose,
  alert,
  trip,
  onResolved,
}: IncidentReportTemplateModalProps) {
  const defaultState = useMemo<IncidentFormState>(() => {
    const timestamp = alert?.timestamp;
    const locationText =
      alert?.location?.address ||
      (alert?.location?.latitude && alert?.location?.longitude
        ? `${alert.location.latitude}, ${alert.location.longitude}`
        : "");

    return {
      date: toDateInput(timestamp),
      time: toTimeInput(timestamp),
      location: locationText || trip?.origin || "",
      incidentReferenceNumber: alert?.id ? `ALERT-${alert.id}` : "",
      reportedByController: "",
      positionTitle: "",
      contactNumber: "",
      dateTimeOfIncident: toDateTimeText(timestamp),
      fleetVehicleNumber:
        alert?.vehicle_registration ||
        alert?.fleet_number ||
        trip?.vehicleassignments?.[0]?.vehicle?.fleet_number ||
        trip?.vehicleassignments?.[0]?.vehicle?.name ||
        "",
      typeOfIncident: alert?.alert_type
        ? String(alert.alert_type).replace(/_/g, " ")
        : "Vehicle alert",
      locationOfIncident: locationText || "",
      personsInvolved: alert?.driver_name || trip?.drivername || "",
      descriptionOfIncident: "",
      immediateActionTaken: "",
      reportedToSupervisorManager: "",
      findingsRootCause: "",
      reportCompiledBy: "",
      designation: "",
    };
  }, [alert, trip]);

  const [form, setForm] = useState<IncidentFormState>(defaultState);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setForm(defaultState);
      setError(null);
    }
  }, [isOpen, defaultState]);

  if (!isOpen) return null;

  const setValue = (key: keyof IncidentFormState, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const textInputClass =
    "h-10 w-full rounded-none border border-slate-500 bg-white px-3 text-sm outline-none focus:border-blue-700";
  const cellLabelClass =
    "border border-slate-500 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700";
  const cellValueClass = "border border-slate-500 bg-white px-0 py-0";

  const compileNotes = () => {
    return [
      "Incident Report Template",
      `Reference: ${form.incidentReferenceNumber || "-"}`,
      `Date: ${form.date || "-"} ${form.time || ""}`.trim(),
      `Fleet/Vehicle: ${form.fleetVehicleNumber || "-"}`,
      `Type: ${form.typeOfIncident || "-"}`,
      `Location: ${form.locationOfIncident || form.location || "-"}`,
      `Persons involved: ${form.personsInvolved || "-"}`,
      `Description: ${form.descriptionOfIncident || "-"}`,
      `Immediate action: ${form.immediateActionTaken || "-"}`,
      `Findings/Root cause: ${form.findingsRootCause || "-"}`,
      `Reported by: ${form.reportCompiledBy || form.reportedByController || "-"}`,
      `Designation: ${form.designation || form.positionTitle || "-"}`,
    ].join("\n");
  };

  const handleResolve = async () => {
    if (!alert?.id) {
      setError("Invalid alert ID.");
      return;
    }

    if (!form.descriptionOfIncident.trim()) {
      setError("Description of incident is required.");
      return;
    }

    if (!form.immediateActionTaken.trim()) {
      setError("Immediate action taken is required.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/video-server/alerts/${alert.id}/resolve-with-notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notes: compileNotes(),
          resolvedBy: form.reportCompiledBy || form.reportedByController || "Controller",
          actionTaken: form.immediateActionTaken,
          incidentReport: form,
        }),
      });

      if (!response.ok) {
        const txt = await response.text();
        throw new Error(txt || "Failed to resolve alert");
      }

      onResolved?.();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to resolve alert");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] bg-black/60 p-3 md:p-6">
      <div className="mx-auto flex h-full w-full max-w-[1100px] flex-col overflow-hidden rounded-xl border-2 border-blue-900 bg-slate-100 shadow-2xl">
        <div className="relative border-b border-blue-900 bg-gradient-to-r from-blue-950 via-blue-900 to-sky-700 px-4 py-3 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              <h2 className="text-base font-semibold">Incident Report Template</h2>
            </div>
            <button
              type="button"
              className="rounded-md border border-white/30 p-1.5 hover:bg-white/10"
              onClick={onClose}
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          <div className="mx-auto max-w-[980px] space-y-5">
            <div className="border-2 border-slate-600 bg-white">
              <div className="grid grid-cols-12">
                <div className="col-span-3 border-r border-slate-500 p-3 text-center text-sm font-semibold text-blue-900">
                  PREMIER LOGISTICS SOLUTIONS
                  <div className="mt-2 text-xs font-medium text-slate-600">SRS</div>
                </div>
                <div className="col-span-6 border-r border-slate-500">
                  <div className="border-b border-slate-500 bg-slate-200 p-3 text-center text-2xl font-medium text-slate-600">
                    PREMIER LOGISTICS SOLUTIONS
                  </div>
                  <div className="border-b border-slate-500 bg-slate-100 p-3 text-center text-xl font-semibold text-slate-600">
                    Incident report template
                  </div>
                  <div className="p-2 text-center text-3xl font-medium text-slate-700">Meyerton</div>
                </div>
                <div className="col-span-3 text-xs">
                  <div className="border-b border-slate-500 p-2 text-center text-slate-600">Document Number</div>
                  <div className="border-b border-slate-500 p-2 text-center font-semibold">Incident report template /00</div>
                  <div className="border-b border-slate-500 p-2 text-center text-slate-600">Revision Number / Date</div>
                  <div className="border-b border-slate-500 p-2 text-center font-semibold">00 / 10th January 2028</div>
                  <div className="border-b border-slate-500 p-2 text-center text-slate-600">Revised by</div>
                  <div className="p-2 text-center font-semibold">T Hoosen</div>
                </div>
              </div>
            </div>

            <h3 className="text-center text-3xl font-semibold uppercase tracking-wide text-blue-900 underline">
              Incident Report Template
            </h3>

            <div className="space-y-2">
              <div className="grid grid-cols-12">
                <div className={`${cellLabelClass} col-span-5`}>Date:</div>
                <div className={`${cellValueClass} col-span-7`}>
                  <input className={textInputClass} type="date" value={form.date} onChange={(e) => setValue("date", e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-12">
                <div className={`${cellLabelClass} col-span-5`}>Time:</div>
                <div className={`${cellValueClass} col-span-7`}>
                  <input className={textInputClass} type="time" value={form.time} onChange={(e) => setValue("time", e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-12">
                <div className={`${cellLabelClass} col-span-5`}>Location:</div>
                <div className={`${cellValueClass} col-span-7`}>
                  <input className={textInputClass} value={form.location} onChange={(e) => setValue("location", e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-12">
                <div className={`${cellLabelClass} col-span-5`}>Incident Reference Number:</div>
                <div className={`${cellValueClass} col-span-7`}>
                  <input className={textInputClass} value={form.incidentReferenceNumber} onChange={(e) => setValue("incidentReferenceNumber", e.target.value)} />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="grid grid-cols-12">
                <div className={`${cellLabelClass} col-span-6`}>Reported By (Controller):</div>
                <div className={`${cellValueClass} col-span-6`}>
                  <input className={textInputClass} value={form.reportedByController} onChange={(e) => setValue("reportedByController", e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-12">
                <div className={`${cellLabelClass} col-span-6`}>Position / Title:</div>
                <div className={`${cellValueClass} col-span-6`}>
                  <input className={textInputClass} value={form.positionTitle} onChange={(e) => setValue("positionTitle", e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-12">
                <div className={`${cellLabelClass} col-span-6`}>Contact Number:</div>
                <div className={`${cellValueClass} col-span-6`}>
                  <input className={textInputClass} value={form.contactNumber} onChange={(e) => setValue("contactNumber", e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-12">
                <div className={`${cellLabelClass} col-span-6`}>Date and Time of Incident:</div>
                <div className={`${cellValueClass} col-span-6`}>
                  <input className={textInputClass} value={form.dateTimeOfIncident} onChange={(e) => setValue("dateTimeOfIncident", e.target.value)} />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="grid grid-cols-12">
                <div className={`${cellLabelClass} col-span-6`}>Fleet / Vehicle Number:</div>
                <div className={`${cellValueClass} col-span-6`}>
                  <input className={textInputClass} value={form.fleetVehicleNumber} onChange={(e) => setValue("fleetVehicleNumber", e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-12">
                <div className={`${cellLabelClass} col-span-6`}>Type of Incident:</div>
                <div className={`${cellValueClass} col-span-6`}>
                  <input className={textInputClass} value={form.typeOfIncident} onChange={(e) => setValue("typeOfIncident", e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-12">
                <div className={`${cellLabelClass} col-span-6`}>Location of Incident:</div>
                <div className={`${cellValueClass} col-span-6`}>
                  <input className={textInputClass} value={form.locationOfIncident} onChange={(e) => setValue("locationOfIncident", e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-12">
                <div className={`${cellLabelClass} col-span-7`}>Persons Involved:</div>
                <div className={`${cellValueClass} col-span-5`}>
                  <input className={textInputClass} value={form.personsInvolved} onChange={(e) => setValue("personsInvolved", e.target.value)} />
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <label className="block text-sm font-semibold text-blue-900 underline">Description of Incident:</label>
              <textarea
                className="min-h-[180px] w-full border border-slate-500 bg-white p-3 text-sm outline-none focus:border-blue-700"
                value={form.descriptionOfIncident}
                onChange={(e) => setValue("descriptionOfIncident", e.target.value)}
              />
              <div className="grid grid-cols-12">
                <div className={`${cellLabelClass} col-span-6`}>Immediate Action Taken:</div>
                <div className={`${cellValueClass} col-span-6`}>
                  <input className={textInputClass} value={form.immediateActionTaken} onChange={(e) => setValue("immediateActionTaken", e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-12">
                <div className={`${cellLabelClass} col-span-6`}>Reported To (Supervisor/Manager):</div>
                <div className={`${cellValueClass} col-span-6`}>
                  <input className={textInputClass} value={form.reportedToSupervisorManager} onChange={(e) => setValue("reportedToSupervisorManager", e.target.value)} />
                </div>
              </div>
              <label className="block text-sm font-semibold text-slate-700 underline">Findings / Root Cause:</label>
              <textarea
                className="min-h-[140px] w-full border border-slate-500 bg-white p-3 text-sm outline-none focus:border-blue-700"
                value={form.findingsRootCause}
                onChange={(e) => setValue("findingsRootCause", e.target.value)}
              />
              <div className="grid grid-cols-12">
                <div className={`${cellLabelClass} col-span-6`}>Report Compiled By:</div>
                <div className={`${cellValueClass} col-span-6`}>
                  <input className={textInputClass} value={form.reportCompiledBy} onChange={(e) => setValue("reportCompiledBy", e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-12">
                <div className={`${cellLabelClass} col-span-5`}>Designation:</div>
                <div className={`${cellValueClass} col-span-7`}>
                  <input className={textInputClass} value={form.designation} onChange={(e) => setValue("designation", e.target.value)} />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-slate-300 bg-white px-4 py-3">
          {error && <p className="mb-2 text-sm font-medium text-red-600">{error}</p>}
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="button"
              className="inline-flex items-center rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
              onClick={handleResolve}
              disabled={saving}
            >
              <CheckCircle2 className="mr-1.5 h-4 w-4" />
              {saving ? "Resolving..." : "Resolve Alert"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
