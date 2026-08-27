'use client'

import { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Loader2, Printer, X } from 'lucide-react'
import { DriverDropdown } from '@/components/ui/driver-dropdown'
import { createClient } from '@/lib/supabase/client'
import EvidenceAnnexure from '@/components/video-alerts/evidence-annexure'
import {
  buildAlertEventSummary,
  deriveReportSiteLabel,
  formatReportDate,
  formatReportTime,
  ReportAlertDetails as AlertDetails,
  normalizeReportScreenshots,
  normalizeReportVideos,
  renderElementToWordBlob,
  resolveAlertEventTimestamp,
  resolveReportLocationText,
  SavedAlertArtifact,
  saveAlertArtifactBundle,
} from '@/components/video-alerts/report-support'

type DriverOption = {
  id: string
  first_name: string
  surname: string
  fleet_number: string | null
  cell_number: string | null
  assigned_vehicle: { registration_number: string | null } | null
}

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
  const [ncrNo, setNcrNo] = useState(`NCR-${Date.now()}`)
  const [driverName, setDriverName] = useState(driverInfo.name || 'Unknown Driver')
  const [department, setDepartment] = useState(driverInfo.department || 'Fleet Operations')
  const [responsibleManager, setResponsibleManager] = useState(driverInfo.department ? `${driverInfo.department} Manager` : 'Fleet Manager')
  const [section, setSection] = useState(driverInfo.department || 'Fleet Operations')
  const [vehicleFleetNumber, setVehicleFleetNumber] = useState(driverInfo.fleetNumber || '')
  const [vehicleRegistration, setVehicleRegistration] = useState(driverInfo.registration || '')
  const [duration, setDuration] = useState('Observed during vehicle operation')
  const [area, setArea] = useState('Fleet operation / monitored journey')
  const [otherClass, setOtherClass] = useState('Operational non-conformance requiring investigation.')
  const [selectedClassifications, setSelectedClassifications] = useState<string[]>([])
  const [selectedRiskRating, setSelectedRiskRating] = useState<'high' | 'medium' | 'low'>('high')
  const [description, setDescription] = useState(
    'A fleet non-conformance was identified during vehicle operations and requires formal investigation, corrective action, and management follow-up.'
  )
  const [correctiveAction, setCorrectiveAction] = useState('Investigate the event, brief the responsible crew, and implement immediate corrective controls.')
  const [correctiveResponsibility, setCorrectiveResponsibility] = useState('Fleet Supervisor')
  const [correctiveTargetDate, setCorrectiveTargetDate] = useState('')
  const [preventiveAction, setPreventiveAction] = useState('Review procedures, reinforce compliance expectations, and schedule follow-up monitoring.')
  const [preventiveResponsibility, setPreventiveResponsibility] = useState('Operations Control')
  const [preventiveTargetDate, setPreventiveTargetDate] = useState('')
  const [drivers, setDrivers] = useState<DriverOption[]>([])
  const [selectedDriverId, setSelectedDriverId] = useState('')
  const [deductionInfo, setDeductionInfo] = useState<{ show: boolean; alertType: string; weighting: number; criteriaId: number } | null>(null)
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
  const reportEventTimestamp = useMemo(
    () => resolveAlertEventTimestamp(alertDetails, driverInfo.timestamp),
    [alertDetails, driverInfo.timestamp]
  )
  const eventDate = useMemo(() => formatReportDate(reportEventTimestamp), [reportEventTimestamp])
  const eventTime = useMemo(() => formatReportTime(reportEventTimestamp), [reportEventTimestamp])
  const lastOccurrenceText = useMemo(
    () => reportEventTimestamp ? new Date(reportEventTimestamp).toLocaleString('en-GB') : '',
    [reportEventTimestamp]
  )
  const eventSummary = useMemo(
    () => buildAlertEventSummary(alertDetails, driverInfo, locationText, 'generic'),
    [alertDetails, driverInfo, locationText]
  )
  useEffect(() => {
    if (!isOpen) return
    const fetchCurrentUser = async () => {
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      return session?.user?.email || session?.user?.user_metadata?.email || session?.user?.user_metadata?.name || 'Fleet Manager'
    }
    const costCenter = driverInfo.department || 'Fleet Operations'
    fetchCurrentUser().then((currentUser) => {
      setResponsibleManager(currentUser)
    })
    setDescription(eventSummary)
    setArea(siteLabel)
    setDuration(eventTime ? `Observed at ${eventTime}` : 'Observed at alert time')
    setOtherClass(alertDetails?.type || 'General fleet non-conformance')
    setDriverName(driverInfo.name || 'Unknown Driver')
    setDepartment(costCenter)
    setVehicleFleetNumber(driverInfo.fleetNumber || '')
    setVehicleRegistration(driverInfo.registration || '')
    setSection(costCenter)

    const alertType = (alertDetails?.type || '').toLowerCase()
    const autoClassify: string[] = []
    if (/speed/i.test(alertType)) autoClassify.push('Speeding Violation')
    if (/zone|fence|breach/i.test(alertType)) autoClassify.push('Zone Breach')
    if (/harsh|braking|cornering/i.test(alertType)) autoClassify.push('Reckless Driving')
    if (/seatbelt/i.test(alertType)) autoClassify.push('No Seatbelt')
    if (/fatigue/i.test(alertType)) autoClassify.push('Poor Fatigue Management')
    if (/phone|call/i.test(alertType)) autoClassify.push('Negligence of Driver')
    if (/exception/i.test(alertType)) autoClassify.push('Negligence of Driver')
    if (autoClassify.length > 0) setSelectedClassifications(autoClassify)

    if (/speed/i.test(alertType)) setSelectedRiskRating('high')
    else if (/zone|fence|breach/i.test(alertType)) setSelectedRiskRating('medium')
    else setSelectedRiskRating('high')
  }, [alertDetails?.type, eventSummary, eventTime, isOpen, siteLabel, driverInfo.name, driverInfo.department, driverInfo.fleetNumber, driverInfo.registration])
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

  useEffect(() => {
    if (!isOpen) return
    fetch('/api/drivers?all=true')
      .then(res => res.json())
      .then(data => {
        if (!data.success || !data.drivers) { console.error('Error fetching drivers:', data.error || data.message); return }
        const mapped: DriverOption[] = (data.drivers || []).map((d: any) => ({
          id: String(d.id),
          first_name: d.first_name || '',
          surname: d.surname || '',
          fleet_number: d.fleet_number || null,
          cell_number: d.cell_number || null,
          assigned_vehicle: d.assigned_vehicle || null,
        }))
        setDrivers(mapped)
      })
      .catch(err => { console.error('Error fetching drivers:', err); })
  }, [isOpen])

  const handleDriverChange = (driverId: string) => {
    setSelectedDriverId(driverId)
    const driver = drivers.find(d => d.id === driverId)
    if (driver) {
      setDriverName(`${driver.first_name} ${driver.surname}`.trim())
      if (driver.fleet_number) setVehicleFleetNumber(driver.fleet_number)
      if (driver.assigned_vehicle?.registration_number) setVehicleRegistration(driver.assigned_vehicle.registration_number)
    }
  }

  useEffect(() => {
    if (!selectedDriverId && drivers.length > 0) {
      const fleetNum = vehicleFleetNumber?.toUpperCase().trim()
      if (fleetNum) {
        const matched = drivers.find(d => d.fleet_number?.toUpperCase() === fleetNum)
        if (matched) {
          setSelectedDriverId(matched.id)
          setDriverName(`${matched.first_name} ${matched.surname}`.trim())
          return
        }
      }
      if (driverInfo.name) {
        const fullName = driverInfo.name.toLowerCase().trim()
        const parts = fullName.split(' ')
        const matched = drivers.find(d => {
          const dFull = `${d.first_name} ${d.surname}`.toLowerCase()
          return dFull === fullName || (parts.length >= 2 && d.first_name.toLowerCase() === parts[0] && d.surname.toLowerCase() === parts[parts.length - 1])
        })
        if (matched) setSelectedDriverId(matched.id)
      }
    }
  }, [drivers, selectedDriverId, driverInfo.name, vehicleFleetNumber])

  const toggleRootCause = (key: string) => {
    setSelectedRootCauses((prev) =>
      prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key]
    )
  }
  const toggleClassification = (value: string) => {
    setSelectedClassifications((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
    )
  }
  const getClassificationCellClass = (value: string) => {
    const isSelected = selectedClassifications.includes(value)
    return [
      'border-r border-black p-2 transition-colors cursor-pointer select-none',
      isSelected ? 'bg-yellow-200 font-semibold' : 'hover:bg-slate-100',
    ].join(' ')
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

  const checkDeduction = async () => {
    const fleetNum = vehicleFleetNumber || driverInfo.fleetNumber
    const alertType = alertDetails?.type || alertDetails?.alert_type
    if (!fleetNum || !alertType) return false
    try {
      const res = await fetch(`/api/video-server/driver-scoring/lookup?fleet_number=${encodeURIComponent(fleetNum)}&alert_type=${encodeURIComponent(alertType)}`)
      const data = await res.json()
      if (data.success && data.eligible) {
        setDeductionInfo({ show: true, alertType, weighting: data.weighting, criteriaId: data.criteria_id })
        return true
      }
    } catch (e) { console.error('[NCR] Deduction check error:', e) }
    return false
  }

  const doSave = async () => {
    setSaving(true)
    setDeductionInfo(null)
    try {
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()
      const element = document.getElementById('nrc-camera-covered-content')
      if (!element) throw new Error('Form content not found')

      const blob = await renderElementToWordBlob(element)
      const fileName = `ncr-generic-${vehicleFleetNumber || driverInfo.fleetNumber}-${Date.now()}.pdf`

      const artifact = await saveAlertArtifactBundle({
        supabase,
        fileName,
        pdfBlob: blob,
        reportType: 'NRC_CAMERA_COVERED',
        driverInfo,
        alertDetails,
      })

      if (selectedDriverId && vehicleFleetNumber) {
        const driver = drivers.find(d => d.id === selectedDriverId)
        if (driver && driver.fleet_number !== vehicleFleetNumber) {
          await supabase
            .from('drivers')
            .update({ fleet_number: vehicleFleetNumber })
            .eq('id', selectedDriverId)
        }
      }

      if (deductionInfo) {
        try {
          await fetch('/api/video-server/driver-scoring/deduct', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fleet_number: vehicleFleetNumber || driverInfo.fleetNumber, criteria_id: deductionInfo.criteriaId })
          })
        } catch {}
      }

      if (onSaved) await onSaved(artifact)
      onClose()
    } catch (err) {
      console.error('Error saving NRC camera covered report:', err)
      alert('Failed to save form')
    } finally {
      setSaving(false)
    }
  }

  const handleSave = async () => {
    const hasDeduction = await checkDeduction()
    if (!hasDeduction) {
      await doSave()
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 bg-black/50 p-4 flex items-center justify-center">
      {deductionInfo?.show && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60">
          <div className="bg-white rounded-lg shadow-2xl p-6 max-w-md w-full">
            <h3 className="text-lg font-bold text-slate-900 mb-2">Deduction Confirmation</h3>
            <p className="text-sm text-slate-600 mb-2">
              This alert qualifies for an NCR deduction. Saving this NCR will deduct:
            </p>
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-red-700">Points to deduct:</span>
                <span className="text-2xl font-bold text-red-600">{deductionInfo.weighting}</span>
              </div>
              <div className="text-xs text-red-500 mt-1">Alert: {deductionInfo.alertType}</div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button size="sm" variant="outline" onClick={() => { setDeductionInfo(null); doSave() }}>Save Without Deducting</Button>
              <Button size="sm" variant="default" className="bg-red-600 hover:bg-red-700" onClick={doSave}>Save & Deduct</Button>
            </div>
          </div>
        </div>
      )}
      <div className="bg-white rounded-lg shadow-2xl w-[95vw] h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-xl font-bold">Generic NCR</h2>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleSave} disabled={saving}>{saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin inline" />Saving...</> : 'Save Report'}</Button>
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
                  <div className="col-span-3 border-r border-black p-0"><DriverDropdown value={selectedDriverId} onChange={handleDriverChange} drivers={drivers} placeholder="Select driver" /></div>
                  <div className="col-span-1 border-r border-black p-2 bg-slate-100">Department</div>
                  <div className="col-span-3 p-0"><input className="w-full h-full border border-black px-1 py-2" value={department} onChange={(e) => setDepartment(e.target.value)} /></div>
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
                  <div className="col-span-2 border-r border-black p-0"><input className="w-full h-full border border-black px-1 py-2 font-bold" value={vehicleFleetNumber} onChange={(e) => setVehicleFleetNumber(e.target.value)} /></div>
                  <div className="col-span-1 border-r border-black p-2 bg-slate-100">Area</div>
                  <div className="col-span-3 p-0"><input className="w-full h-full border border-black px-1 py-2" value={area} onChange={(e) => setArea(e.target.value)} /></div>
                </div>
                <div className="grid grid-cols-8 border-b border-black text-sm">
                  <div className="col-span-2 border-r border-black p-2 bg-slate-100">Vehicle Registration</div>
                  <div className="col-span-2 border-r border-black p-0"><input className="w-full h-full border border-black px-1 py-2 font-bold" value={vehicleRegistration} onChange={(e) => setVehicleRegistration(e.target.value)} /></div>
                  <div className="col-span-1 border-r border-black p-2 bg-slate-100">Alert ID</div>
                  <div className="col-span-3 p-2">{alertDetails?.id || 'N/A'}</div>
                </div>
                <div className="grid grid-cols-8 border-b border-black text-sm">
                  <div className="col-span-2 border-r border-black p-2 bg-slate-100">Last Occurrence</div>
                  <div className="col-span-6 p-2">{lastOccurrenceText || 'N/A'}</div>
                </div>
                <div className="border-b border-black p-2 font-bold bg-slate-100">Classification Of Non-Conformance</div>
                <div className="grid grid-cols-6 border-b border-black text-sm">
                  <div className={getClassificationCellClass('Injury')} onClick={() => toggleClassification('Injury')}>Injury {selectedClassifications.includes('Injury') && '✓'}</div>
                  <div className={getClassificationCellClass('Negligence of Driver')} onClick={() => toggleClassification('Negligence of Driver')}>Negligence of Driver {selectedClassifications.includes('Negligence of Driver') && '✓'}</div>
                  <div className={getClassificationCellClass('Insubordination')} onClick={() => toggleClassification('Insubordination')}>Insubordination {selectedClassifications.includes('Insubordination') && '✓'}</div>
                  <div className={getClassificationCellClass('Speeding Violation')} onClick={() => toggleClassification('Speeding Violation')}>Speeding Violation {selectedClassifications.includes('Speeding Violation') && '✓'}</div>
                  <div className={getClassificationCellClass('Traffic Violation')} onClick={() => toggleClassification('Traffic Violation')}>Traffic Violation {selectedClassifications.includes('Traffic Violation') && '✓'}</div>
                  <div className={getClassificationCellClass('No Seatbelt')} onClick={() => toggleClassification('No Seatbelt')}>No Seatbelt {selectedClassifications.includes('No Seatbelt') && '✓'}</div>
                </div>
                <div className="grid grid-cols-6 border-b border-black text-sm">
                  <div className={getClassificationCellClass('Customer Complaints')} onClick={() => toggleClassification('Customer Complaints')}>Customer Complaints {selectedClassifications.includes('Customer Complaints') && '✓'}</div>
                  <div className={getClassificationCellClass('External / Community Complaints')} onClick={() => toggleClassification('External / Community Complaints')}>External / Community Complaints {selectedClassifications.includes('External / Community Complaints') && '✓'}</div>
                  <div className="col-span-4 p-2">Other: <input className="w-[80%] border border-black px-1" value={otherClass} onChange={(e) => setOtherClass(e.target.value)} /></div>
                </div>
                <div className="p-2 text-sm">
                  <div className="font-bold underline mb-1">Description of non-conformance</div>
                  <textarea className="w-full min-h-[150px] border border-black p-2" value={description} onChange={(e) => setDescription(e.target.value)} />
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
                  <div className={`col-span-2 border-r border-black p-2 cursor-pointer select-none transition-colors ${selectedRiskRating === 'high' ? 'bg-yellow-200 font-semibold' : 'hover:bg-slate-100'}`} onClick={() => setSelectedRiskRating('high')}>High Risk {selectedRiskRating === 'high' && 'X'}</div>
                  <div className={`col-span-2 border-r border-black p-2 cursor-pointer select-none transition-colors ${selectedRiskRating === 'medium' ? 'bg-yellow-200 font-semibold' : 'hover:bg-slate-100'}`} onClick={() => setSelectedRiskRating('medium')}>Medium Risk {selectedRiskRating === 'medium' && 'X'}</div>
                  <div className={`col-span-2 p-2 cursor-pointer select-none transition-colors ${selectedRiskRating === 'low' ? 'bg-yellow-200 font-semibold' : 'hover:bg-slate-100'}`} onClick={() => setSelectedRiskRating('low')}>Low Risk {selectedRiskRating === 'low' && 'X'}</div>
                </div>
                <div className="grid grid-cols-12 text-sm">
                  <div className="col-span-8 border-r border-black p-2">
                    <div className="font-bold underline">Corrective Action</div>
                    <textarea className="w-full min-h-[120px] border border-black p-2 mt-1" value={correctiveAction} onChange={(e) => setCorrectiveAction(e.target.value)} />
                    <div className="font-bold underline mt-2">Preventive Action</div>
                    <textarea className="w-full min-h-[120px] border border-black p-2 mt-1" value={preventiveAction} onChange={(e) => setPreventiveAction(e.target.value)} />
                  </div>
                  <div className="col-span-4">
                    <div className="border-b border-black p-2">
                      <div className="font-semibold">Responsibility</div>
                      <input className="w-full border border-black p-2 mt-1" value={correctiveResponsibility} onChange={(e) => setCorrectiveResponsibility(e.target.value)} />
                      <div className="font-semibold mt-2">Target Date</div>
                      <input className="w-full border border-black p-2 mt-1" value={correctiveTargetDate} onChange={(e) => setCorrectiveTargetDate(e.target.value)} />
                    </div>
                    <div className="p-2">
                      <div className="font-semibold">Responsibility</div>
                      <input className="w-full border border-black p-2 mt-1" value={preventiveResponsibility} onChange={(e) => setPreventiveResponsibility(e.target.value)} />
                      <div className="font-semibold mt-2">Target Date</div>
                      <input className="w-full border border-black p-2 mt-1" value={preventiveTargetDate} onChange={(e) => setPreventiveTargetDate(e.target.value)} />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-3 text-sm border-b border-black" style={{ pageBreakBefore: 'always', breakBefore: 'page' }}>
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
