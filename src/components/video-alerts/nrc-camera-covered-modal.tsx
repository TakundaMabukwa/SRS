'use client'

import { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Printer, X } from 'lucide-react'
import EvidenceAnnexure from '@/components/video-alerts/evidence-annexure'
import {
  buildAlertEventSummary,
  deriveReportSiteLabel,
  formatReportDate,
  formatReportTime,
  getSafeHtml2CanvasOptions,
  ReportAlertDetails as AlertDetails,
  normalizeReportScreenshots,
  normalizeReportVideos,
  resolveReportLocationText,
  SavedAlertArtifact,
  saveAlertArtifactBundle,
} from '@/components/video-alerts/report-support'

interface CameraCoveredModalProps {
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
  alertDetails?: AlertDetails
}

export default function NRCCameraCoveredModal({ isOpen, onClose, onSaved, driverInfo, alertDetails }: CameraCoveredModalProps) {
  const [saving, setSaving] = useState(false)
  const [ncrNo, setNcrNo] = useState(`NCR-CAMERA-${Date.now()}`)
  const [section, setSection] = useState('Fleet Operations')
  const [responsibleManager, setResponsibleManager] = useState('Fleet Manager')
  const [duration, setDuration] = useState('While vehicle was in motion')
  const [area, setArea] = useState('In-cab camera system')
  const [otherClass, setOtherClass] = useState('The driver obstructed the camera.')
  const [description, setDescription] = useState(
    'The driver was found to have intentionally obstructed the in-cab camera while the vehicle was in motion. This is a direct breach of company SOP and safety policy.'
  )
  const [correctiveAction, setCorrectiveAction] = useState('Immediate removal of obstruction, driver counselling and disciplinary process.')
  const [correctiveResponsibility, setCorrectiveResponsibility] = useState('Fleet Supervisor')
  const [correctiveTargetDate, setCorrectiveTargetDate] = useState('')
  const [preventiveAction, setPreventiveAction] = useState('Daily camera visibility checks and random compliance audits.')
  const [preventiveResponsibility, setPreventiveResponsibility] = useState('Operations Control')
  const [preventiveTargetDate, setPreventiveTargetDate] = useState('')
  const [investigator, setInvestigator] = useState('')
  const [manager, setManager] = useState('')
  const [selectedRootCauses, setSelectedRootCauses] = useState<string[]>([])
  const rootCauseStorageKey = useMemo(
    () => `ncr-camera-root-causes:${alertDetails?.id || driverInfo.fleetNumber || 'unknown'}`,
    [alertDetails?.id, driverInfo.fleetNumber]
  )
  const rootCauseDefaults = useMemo(
    () => [
      'improper_attitude_or_motivation',
      'lack_of_knowledge_or_skill',
      'ignoring_she_regulations',
      'ignoring_road_traffic_act',
    ],
    []
  )

  const locationText = useMemo(
    () => resolveReportLocationText(alertDetails?.location, driverInfo.location),
    [alertDetails?.location, driverInfo.location]
  )
  const siteLabel = useMemo(() => deriveReportSiteLabel(locationText) || 'Event Site', [locationText])
  const eventDate = useMemo(() => formatReportDate(alertDetails?.timestamp || driverInfo.timestamp), [alertDetails?.timestamp, driverInfo.timestamp])
  const eventTime = useMemo(() => formatReportTime(alertDetails?.timestamp || driverInfo.timestamp), [alertDetails?.timestamp, driverInfo.timestamp])
  const eventSummary = useMemo(
    () => buildAlertEventSummary(alertDetails, driverInfo, locationText, 'camera'),
    [alertDetails, driverInfo, locationText]
  )
  useEffect(() => {
    if (!isOpen) return
    setDescription(eventSummary)
    setArea(siteLabel)
    setDuration(eventTime ? `Observed at ${eventTime}` : 'Observed at alert time')
    setOtherClass(alertDetails?.type || 'Camera obstruction / visibility breach')
  }, [alertDetails?.type, eventSummary, eventTime, isOpen, siteLabel])
  useEffect(() => {
    if (!isOpen) return
    try {
      const raw = localStorage.getItem(rootCauseStorageKey)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed)) {
          setSelectedRootCauses(parsed.filter((v) => typeof v === 'string'))
          return
        }
      }
    } catch {}
    setSelectedRootCauses(rootCauseDefaults)
  }, [isOpen, rootCauseDefaults, rootCauseStorageKey])
  useEffect(() => {
    if (!isOpen) return
    try {
      localStorage.setItem(rootCauseStorageKey, JSON.stringify(selectedRootCauses))
    } catch {}
  }, [isOpen, rootCauseStorageKey, selectedRootCauses])
  const toggleRootCause = (key: string) => {
    setSelectedRootCauses((prev) =>
      prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key]
    )
  }
  const getRootCauseCellClass = (key: string, last: boolean = false) =>
    [
      `${last ? '' : 'border-r border-black'} p-2 transition-colors cursor-pointer select-none`,
      selectedRootCauses.includes(key)
        ? 'bg-green-200 text-green-900 font-semibold'
        : 'hover:bg-slate-100',
    ].join(' ')
  const annexureScreenshots = useMemo(() => normalizeReportScreenshots(alertDetails?.screenshots), [alertDetails?.screenshots])
  const annexureVideos = useMemo(() => normalizeReportVideos(alertDetails?.videos), [alertDetails?.videos])

  const handlePrint = () => window.print()

  const handleSave = async () => {
    setSaving(true)
    try {
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()
      const element = document.getElementById('nrc-camera-covered-content')
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
      const fileName = `nrc-camera-covered-${driverInfo.fleetNumber}-${Date.now()}.pdf`
      pdf.save(fileName)

      const artifact = await saveAlertArtifactBundle({
        supabase,
        fileName,
        pdfBlob: blob,
        reportType: 'NRC_CAMERA_COVERED',
        driverInfo,
        alertDetails,
      })

      if (onSaved) await onSaved(artifact)
      onClose()
    } catch (err) {
      console.error('Error saving NRC camera covered report:', err)
      alert('Failed to save form')
    } finally {
      setSaving(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 bg-black/50 p-4 flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-2xl w-[95vw] h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-xl font-bold">NRC Camera Covered</h2>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save Report'}</Button>
            <Button size="sm" variant="outline" onClick={handlePrint}><Printer className="w-4 h-4 mr-2" />Print</Button>
            <Button size="sm" variant="ghost" onClick={onClose}><X className="w-4 h-4" /></Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 bg-slate-100">
          <div id="nrc-camera-covered-content" className="mx-auto max-w-[980px] bg-white border-2 border-black text-black">
            <div className="border-b-2 border-black grid grid-cols-12 text-sm">
              <div className="col-span-2 border-r border-black p-3 flex items-center justify-center">
                <Image src="/image001.png" alt="SRS" width={140} height={90} className="h-auto w-full max-w-[140px] object-contain" />
              </div>
              <div className="col-span-7 border-r border-black">
                <div className="border-b border-black p-2 text-center font-bold text-2xl">SOTERIA RISK SOLUTIONS</div>
                <div className="border-b border-black p-2 text-center font-bold text-3xl">Risk - Non-Conformance Report</div>
                <div className="p-2 text-center text-2xl">{siteLabel}</div>
              </div>
              <div className="col-span-3 text-xs">
                <div className="grid grid-cols-2 border-b border-black"><div className="p-2 border-r border-black bg-slate-100">Document Number</div><div className="p-2 font-bold">Non - Conformance Report / 002</div></div>
                <div className="grid grid-cols-2 border-b border-black"><div className="p-2 border-r border-black bg-slate-100">Revision Number / Date</div><div className="p-2 font-bold">5 Feb 2026 / 1 Jan 2027</div></div>
                <div className="grid grid-cols-2"><div className="p-2 border-r border-black bg-slate-100">Page Number</div><div className="p-2 font-bold">Page 1 of 2</div></div>
              </div>
            </div>

            <div className="grid grid-cols-12 border-b border-black text-sm">
              <div className="col-span-8 p-2 border-r border-black">Safety [X] Health/Envir [ ] Quality [X]</div>
              <div className="col-span-4 p-2">NCR No: <input className="ml-2 border border-black px-1" value={ncrNo} onChange={(e) => setNcrNo(e.target.value)} /></div>
            </div>

            <div className="grid grid-cols-12 border-b border-black">
              <div className="col-span-1 border-r border-black p-2 [writing-mode:vertical-rl] rotate-180 text-center font-bold">A: INCIDENT / NON-CONFORMANCE REPORT</div>
              <div className="col-span-11">
                <div className="border-b border-black p-2 font-bold bg-slate-100">Implicated Entity Information</div>
                <div className="grid grid-cols-8 border-b border-black text-sm">
                  <div className="col-span-1 border-r border-black p-2 bg-slate-100">Name</div>
                  <div className="col-span-3 border-r border-black p-2">{driverInfo.name}</div>
                  <div className="col-span-1 border-r border-black p-2 bg-slate-100">Department</div>
                  <div className="col-span-3 p-2">{driverInfo.department || 'Fleet Operations'}</div>
                </div>
                <div className="grid grid-cols-8 border-b border-black text-sm">
                  <div className="col-span-2 border-r border-black p-2 bg-slate-100">Responsible Manager</div>
                  <div className="col-span-2 border-r border-black p-2"><input className="w-full border border-black px-1" value={responsibleManager} onChange={(e) => setResponsibleManager(e.target.value)} /></div>
                  <div className="col-span-1 border-r border-black p-2 bg-slate-100">Section</div>
                  <div className="col-span-3 p-2"><input className="w-full border border-black px-1" value={section} onChange={(e) => setSection(e.target.value)} /></div>
                </div>
                <div className="border-b border-black p-2 font-bold bg-slate-100">Non-Conformance Information</div>
                <div className="grid grid-cols-8 border-b border-black text-sm">
                  <div className="col-span-1 border-r border-black p-2 bg-slate-100">Date</div>
                  <div className="col-span-2 border-r border-black p-2">{eventDate || new Date(driverInfo.timestamp).toLocaleDateString('en-GB')}</div>
                  <div className="col-span-1 border-r border-black p-2 bg-slate-100">Time</div>
                  <div className="col-span-1 border-r border-black p-2">{eventTime || new Date(driverInfo.timestamp).toLocaleTimeString('en-GB')}</div>
                  <div className="col-span-1 border-r border-black p-2 bg-slate-100">Duration</div>
                  <div className="col-span-2 p-2"><input className="w-full border border-black px-1" value={duration} onChange={(e) => setDuration(e.target.value)} /></div>
                </div>
                <div className="grid grid-cols-8 border-b border-black text-sm">
                  <div className="col-span-2 border-r border-black p-2 bg-slate-100">Vehicle Fleet Number</div>
                  <div className="col-span-2 border-r border-black p-2">{driverInfo.fleetNumber}</div>
                  <div className="col-span-1 border-r border-black p-2 bg-slate-100">Area</div>
                  <div className="col-span-3 p-2"><input className="w-full border border-black px-1" value={area} onChange={(e) => setArea(e.target.value)} /></div>
                </div>
                <div className="grid grid-cols-8 border-b border-black text-sm">
                  <div className="col-span-2 border-r border-black p-2 bg-slate-100">Vehicle Registration</div>
                  <div className="col-span-2 border-r border-black p-2">{driverInfo.registration || 'N/A'}</div>
                  <div className="col-span-1 border-r border-black p-2 bg-slate-100">Alert ID</div>
                  <div className="col-span-3 p-2">{alertDetails?.id || 'N/A'}</div>
                </div>
                <div className="border-b border-black p-2 font-bold bg-slate-100">Classification Of Non-Conformance</div>
                <div className="grid grid-cols-6 border-b border-black text-sm">
                  <div className="border-r border-black p-2">Injury</div>
                  <div className="border-r border-black p-2 bg-yellow-200">Negligence of Driver</div>
                  <div className="border-r border-black p-2 bg-yellow-200">Insubordination</div>
                  <div className="border-r border-black p-2">Speeding Violation</div>
                  <div className="border-r border-black p-2">Traffic Violation</div>
                  <div className="p-2">No Seatbelt</div>
                </div>
                <div className="grid grid-cols-6 border-b border-black text-sm">
                  <div className="border-r border-black p-2">Customer Complaints</div>
                  <div className="border-r border-black p-2">External / Community Complaints</div>
                  <div className="col-span-4 p-2">Other: <input className="w-[80%] border border-black px-1" value={otherClass} onChange={(e) => setOtherClass(e.target.value)} /></div>
                </div>
                <div className="p-2 text-sm">
                  <div className="font-bold underline mb-1">Description of non-conformance</div>
                  <textarea className="w-full min-h-[120px] border border-black p-2" value={description} onChange={(e) => setDescription(e.target.value)} />
                  <div className="mt-2 text-xs">Alert: {alertDetails?.id || 'N/A'} | Type: {alertDetails?.type || 'N/A'} | Severity: {alertDetails?.severity || 'N/A'} | Location: {locationText}</div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-12 border-b border-black">
              <div className="col-span-1 border-r border-black p-2 [writing-mode:vertical-rl] rotate-180 text-center font-bold">B: INVESTIGATION</div>
              <div className="col-span-11">
                <div className="border-b border-black p-2 font-bold bg-slate-100">Root Cause Analysis (Unsafe Acts / Conditions / Personal Factors)</div>
                <div className="grid grid-cols-5 border-b border-black text-sm">
                  <div className={getRootCauseCellClass('unsafe_acts')} onClick={() => toggleRootCause('unsafe_acts')}>Unsafe Acts</div>
                  <div className={getRootCauseCellClass('taking_an_unsafe_position')} onClick={() => toggleRootCause('taking_an_unsafe_position')}>Taking an unsafe position</div>
                  <div className={getRootCauseCellClass('improper_attitude_or_motivation')} onClick={() => toggleRootCause('improper_attitude_or_motivation')}>Improper attitude or motivation</div>
                  <div className={getRootCauseCellClass('operating_at_unsafe_speed')} onClick={() => toggleRootCause('operating_at_unsafe_speed')}>Operating at unsafe speed</div>
                  <div className={getRootCauseCellClass('physical_mental_incompatibility', true)} onClick={() => toggleRootCause('physical_mental_incompatibility')}>Physical/Mental incompatibility</div>
                </div>
                <div className="grid grid-cols-5 border-b border-black text-sm">
                  <div className={getRootCauseCellClass('distracting_teasing_horseplay')} onClick={() => toggleRootCause('distracting_teasing_horseplay')}>Distracting, teasing, horseplay</div>
                  <div className={getRootCauseCellClass('defective_tools_equipment')} onClick={() => toggleRootCause('defective_tools_equipment')}>Defective tools/equipment</div>
                  <div className={getRootCauseCellClass('lack_of_knowledge_or_skill')} onClick={() => toggleRootCause('lack_of_knowledge_or_skill')}>Lack of knowledge or skill</div>
                  <div className={getRootCauseCellClass('using_equipment_unsafely')} onClick={() => toggleRootCause('using_equipment_unsafely')}>Using equipment unsafely</div>
                  <div className={getRootCauseCellClass('failure_to_use_ppe', true)} onClick={() => toggleRootCause('failure_to_use_ppe')}>Failure to use PPE</div>
                </div>
                <div className="grid grid-cols-5 border-b border-black text-sm">
                  <div className={getRootCauseCellClass('hazardous_arrangement')} onClick={() => toggleRootCause('hazardous_arrangement')}>Hazardous arrangement</div>
                  <div className={getRootCauseCellClass('using_unsafe_equipment')} onClick={() => toggleRootCause('using_unsafe_equipment')}>Using unsafe equipment</div>
                  <div className={getRootCauseCellClass('ignoring_she_regulations')} onClick={() => toggleRootCause('ignoring_she_regulations')}>Ignoring SHE regulations</div>
                  <div className={getRootCauseCellClass('ignoring_road_traffic_act')} onClick={() => toggleRootCause('ignoring_road_traffic_act')}>Ignoring Road Traffic Act</div>
                  <div className={getRootCauseCellClass('poor_road_environment_conditions', true)} onClick={() => toggleRootCause('poor_road_environment_conditions')}>Poor Road/Environment Conditions</div>
                </div>
                <div className="grid grid-cols-12 border-b border-black text-sm">
                  <div className="col-span-6 border-r border-black p-2 font-bold">Risk Rating</div>
                  <div className="col-span-2 border-r border-black p-2">High Risk</div>
                  <div className="col-span-2 border-r border-black p-2">Medium Risk</div>
                  <div className="col-span-2 p-2">Low Risk</div>
                </div>
                <div className="grid grid-cols-12 text-sm">
                  <div className="col-span-8 border-r border-black p-2">
                    <div className="font-bold underline">Corrective Action</div>
                    <textarea className="w-full min-h-[100px] border border-black p-2 mt-1" value={correctiveAction} onChange={(e) => setCorrectiveAction(e.target.value)} />
                    <div className="font-bold underline mt-2">Preventive Action</div>
                    <textarea className="w-full min-h-[100px] border border-black p-2 mt-1" value={preventiveAction} onChange={(e) => setPreventiveAction(e.target.value)} />
                  </div>
                  <div className="col-span-4">
                    <div className="border-b border-black p-2">
                      <div className="font-semibold">Responsibility</div>
                      <input className="w-full border border-black p-1 mt-1" value={correctiveResponsibility} onChange={(e) => setCorrectiveResponsibility(e.target.value)} />
                      <div className="font-semibold mt-2">Target Date</div>
                      <input className="w-full border border-black p-1 mt-1" value={correctiveTargetDate} onChange={(e) => setCorrectiveTargetDate(e.target.value)} />
                    </div>
                    <div className="p-2">
                      <div className="font-semibold">Responsibility</div>
                      <input className="w-full border border-black p-1 mt-1" value={preventiveResponsibility} onChange={(e) => setPreventiveResponsibility(e.target.value)} />
                      <div className="font-semibold mt-2">Target Date</div>
                      <input className="w-full border border-black p-1 mt-1" value={preventiveTargetDate} onChange={(e) => setPreventiveTargetDate(e.target.value)} />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-3 text-sm border-b border-black">
              <div className="font-bold text-lg text-center mb-2">Risk Analysis And Priority Rating Table</div>
              <div className="grid grid-cols-3 gap-3">
                <div className="border border-black">
                  <div className="border-b border-black p-1 font-bold bg-slate-100">Probability / Likelihood</div>
                  <div className="p-1">A - Very High</div>
                  <div className="p-1">B - High</div>
                  <div className="p-1">C - Moderate</div>
                  <div className="p-1">D - Low</div>
                  <div className="p-1">E - Very Low</div>
                </div>
                <div className="border border-black">
                  <div className="border-b border-black p-1 font-bold bg-slate-100">Rating Matrix</div>
                  <div className="p-1">High Risk = 1-6</div>
                  <div className="p-1">Medium Risk = 7-15</div>
                  <div className="p-1">Low Risk = 16-25</div>
                </div>
                <div className="border border-black">
                  <div className="border-b border-black p-1 font-bold bg-slate-100">Actions</div>
                  <div className="p-1">High: Immediate action to reduce/control risk.</div>
                  <div className="p-1">Medium: Urgent attention and controls.</div>
                  <div className="p-1">Low: Monitor at lower frequency.</div>
                </div>
              </div>
            </div>

            <div className="p-3 text-sm border-b border-black">
              <EvidenceAnnexure
                title="Annexure A (Picture/Video Evidence)"
                alertDetails={alertDetails}
                driverInfo={driverInfo}
                locationText={locationText}
                screenshots={annexureScreenshots}
                videos={annexureVideos}
              />
            </div>

            <div className="grid grid-cols-4 text-sm">
              <div className="p-2 border-r border-black">
                <div className="font-semibold">Investigator</div>
                <input className="w-full border border-black p-1 mt-1" value={investigator} onChange={(e) => setInvestigator(e.target.value)} />
              </div>
              <div className="p-2 border-r border-black">
                <div className="font-semibold">Date</div>
                <input className="w-full border border-black p-1 mt-1" value={new Date().toLocaleDateString('en-GB')} readOnly />
              </div>
              <div className="p-2 border-r border-black">
                <div className="font-semibold">Manager</div>
                <input className="w-full border border-black p-1 mt-1" value={manager} onChange={(e) => setManager(e.target.value)} />
              </div>
              <div className="p-2">
                <div className="font-semibold">Date</div>
                <input className="w-full border border-black p-1 mt-1" value={new Date().toLocaleDateString('en-GB')} readOnly />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
