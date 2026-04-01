'use client'

import { useMemo, useState } from 'react'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Printer, X } from 'lucide-react'
import EvidenceAnnexure from '@/components/video-alerts/evidence-annexure'
import {
  ReportAlertDetails,
  SavedAlertArtifact,
  formatReportDate,
  formatReportDateTime,
  formatReportTime,
  getSafeHtml2CanvasOptions,
  normalizeReportScreenshots,
  normalizeReportVideos,
  resolveReportLocationText,
  saveAlertArtifactBundle,
} from '@/components/video-alerts/report-support'

interface IncidentReportModalProps {
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

export default function IncidentReportModal({ isOpen, onClose, onSaved, driverInfo, alertDetails }: IncidentReportModalProps) {
  const [saving, setSaving] = useState(false)
  const [reportedByController, setReportedByController] = useState('')
  const [positionTitle, setPositionTitle] = useState('')
  const [contactNumber, setContactNumber] = useState('')
  const [typeOfIncident, setTypeOfIncident] = useState(alertDetails?.type || 'Vehicle incident')
  const [personsInvolved, setPersonsInvolved] = useState(driverInfo.name || '')
  const [description, setDescription] = useState('')
  const [immediateAction, setImmediateAction] = useState('')
  const [reportedTo, setReportedTo] = useState('')
  const [findingsRootCause, setFindingsRootCause] = useState('')
  const [reportCompiledBy, setReportCompiledBy] = useState('')
  const [designation, setDesignation] = useState('')

  const timestamp = alertDetails?.timestamp || driverInfo.timestamp
  const dateValue = formatReportDate(timestamp)
  const timeValue = formatReportTime(timestamp)
  const locationText = useMemo(
    () => resolveReportLocationText(alertDetails?.location, driverInfo.location),
    [alertDetails?.location, driverInfo.location]
  )
  const annexureScreenshots = useMemo(() => normalizeReportScreenshots(alertDetails?.screenshots), [alertDetails?.screenshots])
  const annexureVideos = useMemo(() => normalizeReportVideos(alertDetails?.videos), [alertDetails?.videos])

  const handlePrint = () => window.print()

  const handleSave = async () => {
    setSaving(true)
    try {
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()
      const element = document.getElementById('incident-report-content')
      if (!element) throw new Error('Form content not found')

      const html2canvas = (await import('html2canvas')).default
      const jsPDF = (await import('jspdf')).default

      const canvas = await html2canvas(element, getSafeHtml2CanvasOptions(element))
      const imgData = canvas.toDataURL('image/png')
      const pdf = new jsPDF('p', 'mm', 'a4')
      const width = pdf.internal.pageSize.getWidth()
      const height = (canvas.height * width) / canvas.width
      pdf.addImage(imgData, 'PNG', 0, 0, width, height)
      const blob = pdf.output('blob')

      const fileName = `incident-report-${driverInfo.fleetNumber}-${Date.now()}.pdf`
      pdf.save(fileName)

      const artifact = await saveAlertArtifactBundle({
        supabase,
        fileName,
        pdfBlob: blob,
        reportType: 'INCIDENT_REPORT',
        driverInfo,
        alertDetails,
      })

      if (onSaved) await onSaved(artifact)
      onClose()
    } catch (err) {
      console.error('Error saving incident report:', err)
      alert('Failed to save report')
    } finally {
      setSaving(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 bg-black/60 p-3 md:p-6">
      <div className="mx-auto h-full w-full max-w-[1100px] overflow-hidden rounded-xl border-2 border-blue-900 bg-slate-100 shadow-2xl flex flex-col">
        <div className="border-b border-blue-900 bg-gradient-to-r from-blue-950 via-blue-900 to-sky-700 px-4 py-3 text-white flex items-center justify-between">
          <h2 className="text-base font-semibold">Incident Report</h2>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save Report'}</Button>
            <Button size="sm" variant="outline" onClick={handlePrint}><Printer className="w-4 h-4 mr-2" />Print</Button>
            <Button size="sm" variant="ghost" onClick={onClose}><X className="w-4 h-4" /></Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          <div id="incident-report-content" className="mx-auto max-w-[980px] space-y-5 border-2 border-slate-600 bg-white p-4">
            <div className="border border-slate-600">
              <div className="grid grid-cols-12">
                <div className="col-span-3 border-r border-slate-500 p-3 flex items-center justify-center">
                  <Image src="/image001.png" alt="SRS" width={160} height={96} className="h-auto w-full max-w-[160px] object-contain" />
                </div>
                <div className="col-span-6 border-r border-slate-500">
                  <div className="border-b border-slate-500 bg-slate-200 p-2 text-center text-xl font-medium text-slate-600">PREMIER LOGISTICS SOLUTIONS</div>
                  <div className="border-b border-slate-500 bg-slate-100 p-2 text-center text-2xl font-semibold text-slate-600">Incident report</div>
                  <div className="p-2 text-center text-3xl font-medium text-slate-700">Meyerton</div>
                </div>
                <div className="col-span-3 text-xs">
                  <div className="border-b border-slate-500 p-2 text-center text-slate-600">Document Number</div>
                  <div className="border-b border-slate-500 p-2 text-center font-semibold">Incident report /00</div>
                  <div className="border-b border-slate-500 p-2 text-center text-slate-600">Revision Number / Date</div>
                  <div className="border-b border-slate-500 p-2 text-center font-semibold">00 / 10th January 2028</div>
                  <div className="border-b border-slate-500 p-2 text-center text-slate-600">Revised by</div>
                  <div className="p-2 text-center font-semibold">T Hoosen</div>
                </div>
              </div>
            </div>

            <h3 className="text-center text-3xl font-semibold uppercase tracking-wide text-blue-900 underline">Incident Report</h3>

            <div className="grid grid-cols-12 border border-slate-500">
              <div className="col-span-5 border-r border-slate-500 p-2 font-semibold text-slate-700 underline">Date:</div>
              <div className="col-span-7 p-2">{dateValue}</div>
            </div>
            <div className="grid grid-cols-12 border border-slate-500">
              <div className="col-span-5 border-r border-slate-500 p-2 font-semibold text-slate-700 underline">Time:</div>
              <div className="col-span-7 p-2">{timeValue}</div>
            </div>
            <div className="grid grid-cols-12 border border-slate-500">
              <div className="col-span-5 border-r border-slate-500 p-2 font-semibold text-slate-700 underline">Location:</div>
              <div className="col-span-7 p-2">{locationText}</div>
            </div>
            <div className="grid grid-cols-12 border border-slate-500">
              <div className="col-span-5 border-r border-slate-500 p-2 font-semibold text-slate-700 underline">Incident Reference Number:</div>
              <div className="col-span-7 p-2">{alertDetails?.id || ''}</div>
            </div>

            <div className="grid grid-cols-12 border border-slate-500">
              <div className="col-span-6 border-r border-slate-500 p-2 font-semibold text-slate-700 underline">Reported By (Controller):</div>
              <div className="col-span-6 p-1"><input className="h-10 w-full border border-slate-500 px-3" value={reportedByController} onChange={(e) => setReportedByController(e.target.value)} /></div>
            </div>
            <div className="grid grid-cols-12 border border-slate-500">
              <div className="col-span-6 border-r border-slate-500 p-2 font-semibold text-slate-700 underline">Position/Title:</div>
              <div className="col-span-6 p-1"><input className="h-10 w-full border border-slate-500 px-3" value={positionTitle} onChange={(e) => setPositionTitle(e.target.value)} /></div>
            </div>
            <div className="grid grid-cols-12 border border-slate-500">
              <div className="col-span-6 border-r border-slate-500 p-2 font-semibold text-slate-700 underline">Contact Number:</div>
              <div className="col-span-6 p-1"><input className="h-10 w-full border border-slate-500 px-3" value={contactNumber} onChange={(e) => setContactNumber(e.target.value)} /></div>
            </div>
            <div className="grid grid-cols-12 border border-slate-500">
              <div className="col-span-6 border-r border-slate-500 p-2 font-semibold text-slate-700 underline">Date and Time of Incident:</div>
              <div className="col-span-6 p-2">{formatReportDateTime(timestamp)}</div>
            </div>
            <div className="grid grid-cols-12 border border-slate-500">
              <div className="col-span-6 border-r border-slate-500 p-2 font-semibold text-slate-700 underline">Fleet/ Vehicle Number:</div>
              <div className="col-span-6 p-2">{driverInfo.registration ? `${driverInfo.fleetNumber} - ${driverInfo.registration}` : driverInfo.fleetNumber}</div>
            </div>
            <div className="grid grid-cols-12 border border-slate-500">
              <div className="col-span-6 border-r border-slate-500 p-2 font-semibold text-slate-700 underline">Vehicle Registration:</div>
              <div className="col-span-6 p-2">{driverInfo.registration || 'N/A'}</div>
            </div>
            <div className="grid grid-cols-12 border border-slate-500">
              <div className="col-span-6 border-r border-slate-500 p-2 font-semibold text-slate-700 underline">Type of Incident:</div>
              <div className="col-span-6 p-1"><input className="h-10 w-full border border-slate-500 px-3" value={typeOfIncident} onChange={(e) => setTypeOfIncident(e.target.value)} /></div>
            </div>
            <div className="grid grid-cols-12 border border-slate-500">
              <div className="col-span-6 border-r border-slate-500 p-2 font-semibold text-slate-700 underline">Location of Incident:</div>
              <div className="col-span-6 p-2">{locationText}</div>
            </div>
            <div className="grid grid-cols-12 border border-slate-500">
              <div className="col-span-7 border-r border-slate-500 p-2 font-semibold text-slate-700 underline">Persons Involved:</div>
              <div className="col-span-5 p-1"><input className="h-10 w-full border border-slate-500 px-3" value={personsInvolved} onChange={(e) => setPersonsInvolved(e.target.value)} /></div>
            </div>

            <div className="space-y-2">
              <p className="font-semibold text-blue-900 underline">Description of Incident:</p>
              <textarea className="min-h-[160px] w-full border border-slate-500 p-3" value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>

            <div className="grid grid-cols-12 border border-slate-500">
              <div className="col-span-6 border-r border-slate-500 p-2 font-semibold text-slate-700 underline">Immediate Action Taken:</div>
              <div className="col-span-6 p-1"><input className="h-10 w-full border border-slate-500 px-3" value={immediateAction} onChange={(e) => setImmediateAction(e.target.value)} /></div>
            </div>
            <div className="grid grid-cols-12 border border-slate-500">
              <div className="col-span-6 border-r border-slate-500 p-2 font-semibold text-slate-700 underline">Reported To (Supervisor/Manager):</div>
              <div className="col-span-6 p-1"><input className="h-10 w-full border border-slate-500 px-3" value={reportedTo} onChange={(e) => setReportedTo(e.target.value)} /></div>
            </div>

            <div className="space-y-2">
              <p className="font-semibold text-slate-700 underline">Findings / Root Cause:</p>
              <textarea className="min-h-[130px] w-full border border-slate-500 p-3" value={findingsRootCause} onChange={(e) => setFindingsRootCause(e.target.value)} />
            </div>

            <div className="grid grid-cols-12 border border-slate-500">
              <div className="col-span-6 border-r border-slate-500 p-2 font-semibold text-slate-700 underline">Report Compiled By:</div>
              <div className="col-span-6 p-1"><input className="h-10 w-full border border-slate-500 px-3" value={reportCompiledBy} onChange={(e) => setReportCompiledBy(e.target.value)} /></div>
            </div>
            <div className="grid grid-cols-12 border border-slate-500">
              <div className="col-span-6 border-r border-slate-500 p-2 font-semibold text-slate-700 underline">Designation:</div>
              <div className="col-span-6 p-1"><input className="h-10 w-full border border-slate-500 px-3" value={designation} onChange={(e) => setDesignation(e.target.value)} /></div>
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
  )
}
