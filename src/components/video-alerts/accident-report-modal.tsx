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
  getSafeHtml2CanvasOptions,
  normalizeReportScreenshots,
  normalizeReportVideos,
  resolveReportLocationText,
  saveAlertArtifactBundle,
} from '@/components/video-alerts/report-support'

interface AccidentReportModalProps {
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

function getIncidentDateText(timestamp?: string) {
  if (!timestamp) return ''
  const date = new Date(timestamp)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function inferCity(locationText: string) {
  return locationText
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)[0] || ''
}

function inferAccidentKind(type?: string) {
  const value = String(type || '').toLowerCase()
  if (value.includes('collision')) return 'Vehicle Collision'
  if (value.includes('injury')) return 'Personal Injury'
  if (value.includes('spill')) return 'Environmental Spill'
  if (value.includes('cargo') || value.includes('theft')) return 'Cargo Loss / Theft'
  if (value.includes('damage')) return 'Property Damage'
  return 'Other'
}

export default function AccidentReportModal({
  isOpen,
  onClose,
  onSaved,
  driverInfo,
  alertDetails,
}: AccidentReportModalProps) {
  const [saving, setSaving] = useState(false)
  const [reportedBy, setReportedBy] = useState('')
  const [titleRole, setTitleRole] = useState('')
  const [incidentNo, setIncidentNo] = useState(alertDetails?.id || '')
  const [affectedDepartment, setAffectedDepartment] = useState(driverInfo.department || 'Fleet Operations')
  const [incidentType, setIncidentType] = useState(alertDetails?.type || 'Vehicle incident')
  const [specificArea, setSpecificArea] = useState('')
  const [driverDrivingTimes, setDriverDrivingTimes] = useState('')
  const [sceneSketchNotes, setSceneSketchNotes] = useState('')
  const [incidentDescription, setIncidentDescription] = useState('')
  const [selectedAccidentTypes, setSelectedAccidentTypes] = useState<string[]>([inferAccidentKind(alertDetails?.type)])
  const [otherAccidentType, setOtherAccidentType] = useState('')
  const [injuryRows, setInjuryRows] = useState([
    { name: '', role: '', nature: '', treatment: '' },
    { name: '', role: '', nature: '', treatment: '' },
  ])
  const [thirdPartyRows, setThirdPartyRows] = useState([
    { name: '', role: '', contact: '' },
    { name: '', role: '', contact: '' },
    { name: '', role: '', contact: '' },
  ])
  const [witnessRows, setWitnessRows] = useState([{ name: '', contact: '', relationship: '' }])
  const [policeCaseNumber, setPoliceCaseNumber] = useState('')
  const [precinct, setPrecinct] = useState('')
  const [reportingOfficer, setReportingOfficer] = useState('')
  const [policePhone, setPolicePhone] = useState('')

  const timestamp = alertDetails?.timestamp || driverInfo.timestamp
  const reportDate = formatReportDate(timestamp)
  const incidentDate = getIncidentDateText(timestamp)
  const locationText = useMemo(
    () => resolveReportLocationText(alertDetails?.location, driverInfo.location),
    [alertDetails?.location, driverInfo.location]
  )
  const cityText = useMemo(() => inferCity(locationText), [locationText])
  const annexureScreenshots = useMemo(() => normalizeReportScreenshots(alertDetails?.screenshots), [alertDetails?.screenshots])
  const annexureVideos = useMemo(() => normalizeReportVideos(alertDetails?.videos), [alertDetails?.videos])

  const toggleAccidentType = (value: string) => {
    setSelectedAccidentTypes((prev) =>
      prev.includes(value) ? prev.filter((item) => item !== value) : [...prev, value]
    )
  }

  const handlePrint = () => window.print()

  const handleSave = async () => {
    setSaving(true)
    try {
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()
      const element = document.getElementById('accident-report-content')
      if (!element) throw new Error('Form content not found')

      const html2canvas = (await import('html2canvas')).default
      const jsPDF = (await import('jspdf')).default

      const canvas = await html2canvas(element, getSafeHtml2CanvasOptions(element))
      const imgData = canvas.toDataURL('image/png')
      const pdf = new jsPDF('p', 'mm', 'a4')
      const width = pdf.internal.pageSize.getWidth()
      const height = (canvas.height * width) / canvas.width
      let offset = 0
      let remaining = height

      pdf.addImage(imgData, 'PNG', 0, offset, width, height)
      remaining -= pdf.internal.pageSize.getHeight()

      while (remaining > 0) {
        offset -= pdf.internal.pageSize.getHeight()
        pdf.addPage()
        pdf.addImage(imgData, 'PNG', 0, offset, width, height)
        remaining -= pdf.internal.pageSize.getHeight()
      }

      const blob = pdf.output('blob')
      const fileName = `accident-report-${driverInfo.fleetNumber}-${Date.now()}.pdf`
      pdf.save(fileName)

      const artifact = await saveAlertArtifactBundle({
        supabase,
        fileName,
        pdfBlob: blob,
        reportType: 'ACCIDENT_REPORT',
        driverInfo,
        alertDetails,
      })

      if (onSaved) await onSaved(artifact)
      onClose()
    } catch (error) {
      console.error('Error saving accident report:', error)
      alert('Failed to save report')
    } finally {
      setSaving(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 md:p-6">
      <div className="flex h-full w-full max-w-[1180px] flex-col overflow-hidden rounded-xl border-2 border-blue-900 bg-slate-100 shadow-2xl">
        <div className="flex items-center justify-between border-b border-blue-900 bg-gradient-to-r from-blue-950 via-blue-900 to-sky-700 px-4 py-3 text-white">
          <h2 className="text-base font-semibold">Accident Report</h2>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save Report'}</Button>
            <Button size="sm" variant="outline" onClick={handlePrint}><Printer className="mr-2 h-4 w-4" />Print</Button>
            <Button size="sm" variant="ghost" onClick={onClose}><X className="h-4 w-4" /></Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto bg-slate-100 p-4 md:p-6">
          <div id="accident-report-content" className="mx-auto max-w-[980px] space-y-5 border-[3px] border-blue-900 bg-white p-4 text-black">
            <div className="border border-black">
              <div className="grid grid-cols-12">
                <div className="col-span-3 flex flex-col items-center justify-center gap-4 border-r border-black p-3">
                  <Image src="/prem-logo.png" alt="Premier Logistics" width={150} height={60} className="h-auto w-full max-w-[150px] object-contain" />
                  <Image src="/image001.png" alt="Soteria Risk Solutions" width={140} height={70} className="h-auto w-full max-w-[140px] object-contain" />
                </div>
                <div className="col-span-6 border-r border-black">
                  <div className="border-b border-black bg-slate-200 p-3 text-center text-[18px] font-medium text-slate-700">PREMIER LOGISTICS SOLUTIONS</div>
                  <div className="border-b border-black bg-slate-200 p-8 text-center text-[18px] font-semibold text-slate-700">Accident report template</div>
                  <div className="p-2 text-center text-[18px] text-slate-700">Meyerton</div>
                </div>
                <div className="col-span-3 text-xs">
                  <div className="border-b border-black p-1 text-center text-slate-600">Document Number</div>
                  <div className="border-b border-black p-2 text-center font-semibold">Accident report template /00</div>
                  <div className="border-b border-black p-1 text-center text-slate-600">Revision Number / Date</div>
                  <div className="border-b border-black p-2 text-center font-semibold">00 / 10th January 2028</div>
                  <div className="border-b border-black p-1 text-center text-slate-600">Revised by</div>
                  <div className="p-2 text-center font-semibold">T Hoosen</div>
                </div>
              </div>
            </div>

            <div className="space-y-1 pt-4 text-center">
              <p className="text-[18px] font-bold uppercase underline">Risk Department</p>
              <p className="text-[18px] font-bold uppercase underline">Accident Report</p>
            </div>

            <div className="grid grid-cols-12 gap-6 text-sm">
              <div className="col-span-6 space-y-4">
                <label className="flex items-center gap-3">
                  <span className="w-32 font-semibold uppercase">Reported By:</span>
                  <input className="h-8 flex-1 border-b border-black px-2" value={reportedBy} onChange={(e) => setReportedBy(e.target.value)} />
                </label>
                <label className="flex items-center gap-3">
                  <span className="w-32 font-semibold uppercase">Title / Role:</span>
                  <input className="h-8 flex-1 border-b border-black px-2" value={titleRole} onChange={(e) => setTitleRole(e.target.value)} />
                </label>
              </div>
              <div className="col-span-6 space-y-4">
                <label className="flex items-center gap-3">
                  <span className="w-36 font-semibold uppercase">Date of Report:</span>
                  <input className="h-8 flex-1 border-b border-black px-2" value={reportDate} onChange={(e) => void e} readOnly />
                </label>
                <label className="flex items-center gap-3">
                  <span className="w-36 font-semibold uppercase">Incident No.:</span>
                  <input className="h-8 flex-1 border-b border-black px-2" value={incidentNo} onChange={(e) => setIncidentNo(e.target.value)} />
                </label>
              </div>
            </div>

            <label className="flex items-center gap-3 text-sm">
              <span className="w-48 font-semibold uppercase">Affected Department:</span>
              <input className="h-8 flex-1 border-b border-black px-2" value={affectedDepartment} onChange={(e) => setAffectedDepartment(e.target.value)} />
            </label>

            <div className="border border-black text-center text-sm font-semibold uppercase">Incident Information</div>

            <div className="grid grid-cols-12 gap-4 text-sm">
              <div className="col-span-7">
                <label className="block border border-black p-2 font-semibold uppercase">Incident Type:</label>
                <input className="h-9 w-full border-x border-b border-black px-2" value={incidentType} onChange={(e) => setIncidentType(e.target.value)} />
              </div>
              <div className="col-span-5">
                <label className="block border border-black p-2 font-semibold uppercase">Date of Incident:</label>
                <input className="h-9 w-full border-x border-b border-black px-2" value={incidentDate} onChange={(e) => void e} readOnly />
              </div>
              <div className="col-span-7">
                <label className="block border border-black p-2 font-semibold uppercase">Location:</label>
                <input className="h-9 w-full border-x border-b border-black px-2" value={locationText} onChange={(e) => void e} readOnly />
              </div>
              <div className="col-span-5">
                <label className="block border border-black p-2 font-semibold uppercase">City:</label>
                <input className="h-9 w-full border-x border-b border-black px-2" value={cityText} onChange={(e) => void e} readOnly />
              </div>
              <div className="col-span-7">
                <label className="block border border-black p-2 font-semibold">SPECIFIC AREA OF LOCATION (if applicable):</label>
                <input className="h-9 w-full border-x border-b border-black px-2" value={specificArea} onChange={(e) => setSpecificArea(e.target.value)} />
              </div>
              <div className="col-span-5">
                <div className="h-full min-h-[86px] border border-black p-2 text-xs">
                  <p><span className="font-semibold">Alert ID:</span> {alertDetails?.id || 'N/A'}</p>
                  <p><span className="font-semibold">Vehicle:</span> {driverInfo.registration ? `${driverInfo.fleetNumber} - ${driverInfo.registration}` : driverInfo.fleetNumber || 'N/A'}</p>
                  <p><span className="font-semibold">Registration:</span> {driverInfo.registration || 'N/A'}</p>
                  <p><span className="font-semibold">Driver:</span> {driverInfo.name || 'N/A'}</p>
                  <p><span className="font-semibold">Severity:</span> {alertDetails?.severity || 'N/A'}</p>
                </div>
              </div>
            </div>

            <label className="block text-sm">
              <span className="block border border-black p-2 font-semibold uppercase">Driver Driving Times:</span>
              <input className="h-9 w-full border-x border-b border-black px-2" value={driverDrivingTimes} onChange={(e) => setDriverDrivingTimes(e.target.value)} />
            </label>

            <div className="space-y-3 text-sm">
              <p className="font-semibold uppercase">Type of Accident (Tick / Circle):</p>
              <div className="grid grid-cols-2 gap-2">
                {['Vehicle Collision', 'Property Damage', 'Personal Injury', 'Cargo Loss / Theft', 'Environmental Spill', 'Other'].map((item) => (
                  <label key={item} className="flex items-center gap-2">
                    <input type="checkbox" checked={selectedAccidentTypes.includes(item)} onChange={() => toggleAccidentType(item)} />
                    <span>{item}</span>
                  </label>
                ))}
              </div>
              <label className="flex items-center gap-2">
                <span className="font-semibold">Other (specify):</span>
                <input
                  className="h-8 flex-1 border-b border-black px-2"
                  value={otherAccidentType}
                  onChange={(e) => setOtherAccidentType(e.target.value)}
                />
              </label>
            </div>

            <div className="grid grid-cols-12 gap-4 text-sm">
              <div className="col-span-7 space-y-2">
                <p className="font-semibold uppercase">Incident Description:</p>
                <p className="italic">(Provide a detailed description of what happened, including sequence of events, damage, and contributing factors.)</p>
                <textarea className="min-h-[190px] w-full border border-black p-3" value={incidentDescription} onChange={(e) => setIncidentDescription(e.target.value)} />
              </div>
              <div className="col-span-5 space-y-2">
                <p className="font-semibold uppercase">Scene Sketch / Additional Notes:</p>
                <textarea
                  className="min-h-[190px] w-full border border-black p-3"
                  value={sceneSketchNotes}
                  onChange={(e) => setSceneSketchNotes(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-3 text-sm">
              <p className="text-[18px] font-semibold underline">Injury Information (if applicable):</p>
              <div className="overflow-hidden border border-black">
                <div className="grid grid-cols-12 bg-slate-50 text-center font-semibold">
                  <div className="col-span-3 border-r border-black p-2">Name of Injured Person(s)</div>
                  <div className="col-span-3 border-r border-black p-2">Role / Relationship</div>
                  <div className="col-span-3 border-r border-black p-2">Nature of Injury</div>
                  <div className="col-span-3 p-2">Treatment Given / Hospitalised</div>
                </div>
                {injuryRows.map((row, index) => (
                  <div key={`injury-${index}`} className="grid grid-cols-12 border-t border-black">
                    <input className="col-span-3 border-r border-black p-2" value={row.name} onChange={(e) => setInjuryRows((prev) => prev.map((item, idx) => idx === index ? { ...item, name: e.target.value } : item))} />
                    <input className="col-span-3 border-r border-black p-2" value={row.role} onChange={(e) => setInjuryRows((prev) => prev.map((item, idx) => idx === index ? { ...item, role: e.target.value } : item))} />
                    <input className="col-span-3 border-r border-black p-2" value={row.nature} onChange={(e) => setInjuryRows((prev) => prev.map((item, idx) => idx === index ? { ...item, nature: e.target.value } : item))} />
                    <input className="col-span-3 p-2" value={row.treatment} onChange={(e) => setInjuryRows((prev) => prev.map((item, idx) => idx === index ? { ...item, treatment: e.target.value } : item))} />
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-3 text-sm">
              <p className="text-[18px] font-semibold underline">Name / Role / Contact of Third Party Involved:</p>
              <div className="overflow-hidden border border-black">
                <div className="grid grid-cols-12 bg-slate-50 text-center font-semibold">
                  <div className="col-span-1 border-r border-black p-2">#</div>
                  <div className="col-span-4 border-r border-black p-2">Name</div>
                  <div className="col-span-4 border-r border-black p-2">Role / Company</div>
                  <div className="col-span-3 p-2">Contact</div>
                </div>
                {thirdPartyRows.map((row, index) => (
                  <div key={`third-party-${index}`} className="grid grid-cols-12 border-t border-black">
                    <div className="col-span-1 border-r border-black p-2 text-center">{index + 1}</div>
                    <input className="col-span-4 border-r border-black p-2" value={row.name} onChange={(e) => setThirdPartyRows((prev) => prev.map((item, idx) => idx === index ? { ...item, name: e.target.value } : item))} />
                    <input className="col-span-4 border-r border-black p-2" value={row.role} onChange={(e) => setThirdPartyRows((prev) => prev.map((item, idx) => idx === index ? { ...item, role: e.target.value } : item))} />
                    <input className="col-span-3 p-2" value={row.contact} onChange={(e) => setThirdPartyRows((prev) => prev.map((item, idx) => idx === index ? { ...item, contact: e.target.value } : item))} />
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-3 text-sm">
              <p className="text-[18px] font-semibold underline">Witness or Victim Information:</p>
              <div className="overflow-hidden border border-black">
                <div className="grid grid-cols-12 bg-slate-50 text-center font-semibold">
                  <div className="col-span-3 border-r border-black p-2">Name</div>
                  <div className="col-span-2 border-r border-black p-2">Contact</div>
                  <div className="col-span-7 p-2">Specific Relationship to Incident</div>
                </div>
                {witnessRows.map((row, index) => (
                  <div key={`witness-${index}`} className="grid grid-cols-12 border-t border-black">
                    <input className="col-span-3 border-r border-black p-2" value={row.name} onChange={(e) => setWitnessRows((prev) => prev.map((item, idx) => idx === index ? { ...item, name: e.target.value } : item))} />
                    <input className="col-span-2 border-r border-black p-2" value={row.contact} onChange={(e) => setWitnessRows((prev) => prev.map((item, idx) => idx === index ? { ...item, contact: e.target.value } : item))} />
                    <input className="col-span-7 p-2" value={row.relationship} onChange={(e) => setWitnessRows((prev) => prev.map((item, idx) => idx === index ? { ...item, relationship: e.target.value } : item))} />
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-4 pt-6 text-sm">
              <p className="text-center text-[18px] font-semibold uppercase underline">Police / Law Enforcement Details</p>
              <div className="grid grid-cols-12 gap-6">
                <label className="col-span-6 flex items-center gap-3">
                  <span className="w-44 font-semibold uppercase">Police A/R Number:</span>
                  <input className="h-8 flex-1 border-b border-black px-2" value={policeCaseNumber} onChange={(e) => setPoliceCaseNumber(e.target.value)} />
                </label>
                <label className="col-span-6 flex items-center gap-3">
                  <span className="w-24 font-semibold uppercase">Precinct:</span>
                  <input className="h-8 flex-1 border-b border-black px-2" value={precinct} onChange={(e) => setPrecinct(e.target.value)} />
                </label>
                <label className="col-span-6 flex items-center gap-3">
                  <span className="w-44 font-semibold uppercase">Reporting Officer:</span>
                  <input className="h-8 flex-1 border-b border-black px-2" value={reportingOfficer} onChange={(e) => setReportingOfficer(e.target.value)} />
                </label>
                <label className="col-span-6 flex items-center gap-3">
                  <span className="w-24 font-semibold uppercase">Phone:</span>
                  <input className="h-8 flex-1 border-b border-black px-2" value={policePhone} onChange={(e) => setPolicePhone(e.target.value)} />
                </label>
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
  )
}
