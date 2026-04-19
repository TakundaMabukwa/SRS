'use client'

import { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Printer, X } from 'lucide-react'
import EvidenceAnnexure from '@/components/video-alerts/evidence-annexure'
import {
  buildAlertEventSummary,
  deriveReportSiteLabel,
  ReportAlertDetails,
  SavedAlertArtifact,
  normalizeReportScreenshots,
  normalizeReportVideos,
  renderElementToPdfBlob,
  resolveReportLocationText,
  saveAlertArtifactBundle,
} from '@/components/video-alerts/report-support'

interface DispatchReportModalProps {
  isOpen: boolean
  onClose: () => void
  onSaved?: (artifact?: SavedAlertArtifact) => void | Promise<void>
  driverInfo: {
    name: string
    fleetNumber: string
    registration?: string
    department?: string
    timestamp: string
    location?: string
  }
  alertDetails?: ReportAlertDetails
}

function toDateValue(timestamp?: string) {
  if (!timestamp) return ''
  const d = new Date(timestamp)
  if (Number.isNaN(d.getTime())) return ''
  return d.toISOString().slice(0, 10)
}

function toTimeValue(timestamp?: string) {
  if (!timestamp) return ''
  const d = new Date(timestamp)
  if (Number.isNaN(d.getTime())) return ''
  return d.toISOString().slice(11, 16)
}

export default function DispatchReportModal({
  isOpen,
  onClose,
  onSaved,
  driverInfo,
  alertDetails,
}: DispatchReportModalProps) {
  const [saving, setSaving] = useState(false)
  const [dispatchedBy, setDispatchedBy] = useState('')
  const [titleRole, setTitleRole] = useState('')
  const [affectedDepartment, setAffectedDepartment] = useState(driverInfo.department || 'Fleet Operations')
  const [reason, setReason] = useState(alertDetails?.type || '')
  const [specificArea, setSpecificArea] = useState('')
  const [incidentDescription, setIncidentDescription] = useState('')
  const [ems, setEms] = useState('')
  const [saps, setSaps] = useState('')

  const timestamp = alertDetails?.timestamp || driverInfo.timestamp
  const dateOfReport = toDateValue(timestamp)
  const timeOfDispatch = toTimeValue(timestamp)
  const dateOfDispatch = toDateValue(timestamp)
  const timeStoodDown = ''

  const locationText = useMemo(
    () => resolveReportLocationText(alertDetails?.location, driverInfo.location),
    [alertDetails?.location, driverInfo.location]
  )
  const annexureScreenshots = useMemo(() => normalizeReportScreenshots(alertDetails?.screenshots), [alertDetails?.screenshots])
  const annexureVideos = useMemo(() => normalizeReportVideos(alertDetails?.videos), [alertDetails?.videos])

  const cityText = useMemo(() => deriveReportSiteLabel(locationText), [locationText])
  const eventSummary = useMemo(
    () => buildAlertEventSummary(alertDetails, driverInfo, locationText, 'dispatch'),
    [alertDetails, driverInfo, locationText]
  )
  useEffect(() => {
    if (!isOpen) return
    setReason(alertDetails?.type || '')
    setSpecificArea(locationText)
    setIncidentDescription(eventSummary)
  }, [alertDetails?.type, eventSummary, isOpen, locationText])

  const handlePrint = () => window.print()

  const handleSave = async () => {
    setSaving(true)
    try {
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()
      const element = document.getElementById('dispatch-report-content')
      if (!element) throw new Error('Form content not found')

      const blob = await renderElementToPdfBlob(element)

      const fileName = `dispatch-report-${driverInfo.fleetNumber}-${Date.now()}.pdf`

      const artifact = await saveAlertArtifactBundle({
        supabase,
        fileName,
        pdfBlob: blob,
        reportType: 'DISPATCH_REPORT',
        driverInfo,
        alertDetails,
      })

      if (onSaved) await onSaved(artifact)
      onClose()
    } catch (err) {
      console.error('Error saving dispatch report:', err)
      alert('Failed to save dispatch report')
    } finally {
      setSaving(false)
    }
  }

  if (!isOpen) return null

  const lineClass = 'border-0 border-b border-slate-500 bg-transparent px-2 py-1 text-sm outline-none'

  return (
    <div className="fixed inset-0 z-50 bg-black/60 p-3 md:p-6">
      <div className="mx-auto flex h-full w-full max-w-[1100px] flex-col overflow-hidden rounded-xl border-2 border-slate-800 bg-slate-100 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-700 px-4 py-3 text-white">
          <h2 className="text-base font-semibold">Dispatch Report</h2>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save Report'}</Button>
            <Button size="sm" variant="outline" onClick={handlePrint}><Printer className="mr-2 h-4 w-4" />Print</Button>
            <Button size="sm" variant="ghost" onClick={onClose}><X className="h-4 w-4" /></Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto bg-slate-200 p-4 md:p-6">
          <div id="dispatch-report-content" className="mx-auto max-w-[960px] bg-white px-10 py-8 text-slate-800">
            <div className="mb-8 flex flex-col items-center gap-3">
              <Image src="/image001.png" alt="SRS" width={320} height={120} className="h-auto w-[260px] object-contain" />
              <h3 className="text-2xl font-bold tracking-wide text-slate-800">RISK DEPARTMENT</h3>
              <h4 className="text-2xl font-bold tracking-wide text-slate-800">DISPATCH REPORT</h4>
            </div>

            <div className="grid grid-cols-2 gap-x-10 gap-y-6 text-sm">
              <label className="flex items-end gap-3 font-semibold">
                <span className="min-w-[135px] uppercase">Dispatched By:</span>
                <input className={`flex-1 ${lineClass}`} value={dispatchedBy} onChange={(e) => setDispatchedBy(e.target.value)} />
              </label>
              <label className="flex items-end gap-3 font-semibold">
                <span className="min-w-[135px] uppercase">Date of Report:</span>
                <input className={`flex-1 ${lineClass}`} value={dateOfReport} readOnly />
              </label>

              <label className="flex items-end gap-3 font-semibold">
                <span className="min-w-[135px] uppercase">Title / Role:</span>
                <input className={`flex-1 ${lineClass}`} value={titleRole} onChange={(e) => setTitleRole(e.target.value)} />
              </label>
              <label className="flex items-end gap-3 font-semibold">
                <span className="min-w-[135px] uppercase">Time of Dispatch:</span>
                <input className={`flex-1 ${lineClass}`} value={timeOfDispatch} readOnly />
              </label>

              <label className="flex items-end gap-3 font-semibold">
                <span className="min-w-[135px] uppercase">Affected Department:</span>
                <input className={`flex-1 ${lineClass}`} value={affectedDepartment} onChange={(e) => setAffectedDepartment(e.target.value)} />
              </label>
              <label className="flex items-end gap-3 font-semibold">
                <span className="min-w-[135px] uppercase">Time Stood Down:</span>
                <input className={`flex-1 ${lineClass}`} value={timeStoodDown} readOnly />
              </label>
            </div>

            <div className="mt-8 bg-[#4a395d] px-4 py-2 text-center text-sm font-bold uppercase tracking-wide text-white">
              Security Incident Information
            </div>

            <div className="mt-5 space-y-4 text-sm">
              <div className="grid grid-cols-[140px_1fr_160px_1fr] items-end gap-3">
                <label className="font-semibold uppercase">Reason:</label>
                <input className={lineClass} value={reason} onChange={(e) => setReason(e.target.value)} />
                <label className="font-semibold uppercase">Date of Dispatch:</label>
                <input className={lineClass} value={dateOfDispatch} readOnly />
              </div>

              <div className="grid grid-cols-[140px_1fr] items-end gap-3">
                <label className="font-semibold uppercase">Location:</label>
                <input className={lineClass} value={locationText} readOnly />
              </div>

              <div className="grid grid-cols-[140px_1fr] items-end gap-3">
                <label className="font-semibold uppercase">Fleet / Reg:</label>
                <input className={lineClass} value={driverInfo.registration ? `${driverInfo.fleetNumber} - ${driverInfo.registration}` : driverInfo.fleetNumber} readOnly />
              </div>

              <div className="grid grid-cols-[140px_320px] items-end gap-3">
                <label className="font-semibold uppercase">City:</label>
                <input className={lineClass} value={cityText} readOnly />
              </div>

              <div className="grid grid-cols-[360px_1fr] items-end gap-3">
                <label className="font-semibold uppercase">Specific Area of Location (if applicable):</label>
                <input className={lineClass} value={specificArea} onChange={(e) => setSpecificArea(e.target.value)} />
              </div>

              <div className="pt-2">
                <div className="mb-2 font-semibold uppercase">Incident Description:</div>
                <textarea
                  className="min-h-[180px] w-full bg-[#dfd8eb] p-4 text-sm outline-none"
                  value={incidentDescription}
                  onChange={(e) => setIncidentDescription(e.target.value)}
                />
              </div>

              <div className="pt-6">
                <div className="mb-4 font-semibold uppercase">Other Services Dispatched:</div>
                <div className="space-y-4">
                  <div className="grid grid-cols-[80px_1fr] items-end gap-3">
                    <label className="font-semibold uppercase">EMS:</label>
                    <input className={lineClass} value={ems} onChange={(e) => setEms(e.target.value)} />
                  </div>
                  <div className="grid grid-cols-[80px_1fr] items-end gap-3">
                    <label className="font-semibold uppercase">SAPS:</label>
                    <input className={lineClass} value={saps} onChange={(e) => setSaps(e.target.value)} />
                  </div>
                </div>
              </div>

              <EvidenceAnnexure
                alertDetails={alertDetails}
                driverInfo={driverInfo}
                locationText={locationText}
                screenshots={annexureScreenshots}
                videos={annexureVideos}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
