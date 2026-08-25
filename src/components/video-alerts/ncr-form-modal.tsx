'use client'

import { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Loader2, Printer, X } from 'lucide-react'
import { normalizeReportScreenshots, renderElementToPdfBlob, resolveReportLocationText, SavedAlertArtifact, saveAlertArtifactBundle } from '@/components/video-alerts/report-support'

interface AlertDetails {
  id?: string
  type?: string
  severity?: string
  timestamp?: string
  location?: { latitude?: number; longitude?: number; address?: string } | string
  screenshots?: Array<{ url: string; timestamp?: string; channel?: number }>
}

interface NCRFormModalProps {
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

const CLASSIFICATION_OPTIONS = [
  'Injury', 'Negligence of Driver', 'Insubordination', 'Speeding Violation',
  'Reckless Driving', 'Traffic Violation', 'No Seatbelt', 'Poor Fatigue Management',
  'Carrying Unauthorized Passenger', 'Customer Complaints', 'External / Community Complaints',
  'Zone Breach', 'Other',
]

const ROOT_CAUSE_OPTIONS = {
  unsafeActs: [
    'Taking an unsafe position', 'Operating without authority', 'Hazardous arrangement',
    'Distracting, teasing, horseplay', 'Defective tools/equipment',
  ],
  unsafeConditions: [
    'Improper attitude or motivation', 'Lack of knowledge or skill',
    'Ignoring SHE Regulations', 'Ignoring Road Traffic Act',
  ],
  personalFactors: [
    'Physical/Mental incompatibility', 'Operating at unsafe speed', 'Failure to use PPE',
  ],
}

export default function NCRFormModal({ isOpen, onClose, onSaved, driverInfo, alertDetails }: NCRFormModalProps) {
  const locationText = resolveReportLocationText(alertDetails?.location, driverInfo.location)

  const [formData, setFormData] = useState({
    name: '',
    department: 'Fleet Operations',
    responsibleManager: 'Fleet Operations Manager',
    section: 'Fleet Operations',
    vehicleFleetNumber: '',
    vehicleRegistration: '',
    area: '',
    date: '',
    time: '',
    duration: '',
    alertId: '',
    lastOccurrence: '',
    description: '',
    correctiveAction: '',
    correctiveResponsibility: '',
    correctiveTargetDate: '',
    preventiveAction: '',
    preventiveResponsibility: '',
    preventiveTargetDate: '',
    investigator: '',
    manager: '',
    actionTaken: '',
    actionEffective: '',
  })

  const [selectedClassifications, setSelectedClassifications] = useState<string[]>([])
  const [selectedRootCauses, setSelectedRootCauses] = useState<string[]>([])
  const [otherClassification, setOtherClassification] = useState('')
  const [riskRating, setRiskRating] = useState<'high' | 'medium' | 'low'>('high')
  const [saving, setSaving] = useState(false)
  const normalizedScreenshots = useMemo(() => normalizeReportScreenshots(alertDetails?.screenshots), [alertDetails?.screenshots])

  useEffect(() => {
    if (!isOpen) return
    const ts = driverInfo.timestamp ? new Date(driverInfo.timestamp) : new Date()
    const dateStr = ts.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
    const timeStr = ts.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })

    const fetchCurrentUser = async () => {
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      return session?.user?.email || session?.user?.user_metadata?.email || session?.user?.user_metadata?.name || 'Fleet Manager'
    }

    fetchCurrentUser().then((currentUser) => {
      const costCenter = driverInfo.department || 'Fleet Operations'
      setFormData((prev) => ({
        ...prev,
        name: driverInfo.name || prev.name,
        vehicleFleetNumber: driverInfo.fleetNumber || prev.vehicleFleetNumber,
        vehicleRegistration: driverInfo.registration || prev.vehicleRegistration || driverInfo.fleetNumber,
        department: costCenter,
        section: costCenter,
        responsibleManager: currentUser,
        date: dateStr,
        time: timeStr,
        duration: `Observed at ${timeStr}`,
        alertId: alertDetails?.id || prev.alertId,
        lastOccurrence: ts.toLocaleString('en-GB'),
        area: locationText || prev.area,
        description: `Alert ${alertDetails?.id || ''} generated for driver ${driverInfo.name || 'Unknown'} on fleet ${driverInfo.fleetNumber} at ${ts.toLocaleString('en-GB')} (${locationText}). The event should be investigated against the recorded video evidence, screenshots, and alert timeline.`,
      }))
    })
  }, [isOpen, alertDetails?.id, alertDetails?.type, driverInfo.name, driverInfo.fleetNumber, driverInfo.registration, driverInfo.department, driverInfo.timestamp, locationText])

    const alertType = (alertDetails?.type || '').toLowerCase()
    const autoClassify: string[] = []
    if (/speed/i.test(alertType)) autoClassify.push('Speeding Violation')
    if (/zone|fence|breach/i.test(alertType)) autoClassify.push('Zone Breach')
    if (/harsh|braking|cornering/i.test(alertType)) autoClassify.push('Reckless Driving')
    if (/seatbelt/i.test(alertType)) autoClassify.push('No Seatbelt')
    if (/fatigue/i.test(alertType)) autoClassify.push('Poor Fatigue Management')
    if (/phone|call/i.test(alertType)) autoClassify.push('Negligence of Driver')
    if (autoClassify.length > 0) setSelectedClassifications(autoClassify)

    const autoRootCause: string[] = []
    if (/speed/i.test(alertType)) autoRootCause.push('Operating at unsafe speed')
    if (/zone|fence|breach/i.test(alertType)) autoRootCause.push('Improper attitude or motivation')
    if (autoRootCause.length > 0) setSelectedRootCauses(autoRootCause)

    if (/speed/i.test(alertType)) setRiskRating('high')
    else if (/zone|fence|breach/i.test(alertType)) setRiskRating('medium')
  }, [isOpen, alertDetails?.id, alertDetails?.type, driverInfo.name, driverInfo.fleetNumber, driverInfo.registration, driverInfo.department, driverInfo.timestamp, locationText])

  const toggleClassification = (value: string) => {
    setSelectedClassifications((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
    )
  }

  const toggleRootCause = (value: string) => {
    setSelectedRootCauses((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
    )
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()
      const element = document.getElementById('ncr-form-content')
      if (!element) throw new Error('Form content not found')
      const pdfBlob = await renderElementToPdfBlob(element)
      const fileName = `NCR-${formData.vehicleFleetNumber || 'unknown'}-${Date.now()}.pdf`
      const artifact = await saveAlertArtifactBundle({
        supabase, fileName, pdfBlob, reportType: 'NCR', driverInfo,
        alertDetails: alertDetails ? { ...alertDetails, videos: [] } : undefined,
        extraPayload: {
          ncrForm: 'vehicle-general', ...formData,
          classifications: selectedClassifications,
          rootCauses: selectedRootCauses,
          otherClassification, riskRating,
        }
      })
      if (onSaved) await onSaved(artifact)
      alert('NCR Report saved successfully!')
      onClose()
    } catch (err) {
      console.error('Error saving report:', err)
      alert('Failed to save report: ' + (err?.message || JSON.stringify(err)))
    } finally {
      setSaving(false)
    }
  }

  const updateField = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const CellInput = ({ value, field, className = '' }: { value: string; field: string; className?: string }) => (
    <input
      type="text"
      value={value}
      onChange={(e) => updateField(field, e.target.value)}
      className={`w-full bg-slate-50/50 border border-dashed border-slate-300 rounded outline-none p-1 text-xs font-mono focus:border-blue-400 focus:bg-white transition-colors ${className}`}
    />
  )

  const CellTextarea = ({ value, field, rows = 3 }: { value: string; field: string; rows?: number }) => (
    <textarea
      value={value}
      onChange={(e) => updateField(field, e.target.value)}
      rows={rows}
      className="w-full bg-slate-50/50 border border-dashed border-slate-300 rounded outline-none p-1 text-xs resize-none focus:border-blue-400 focus:bg-white transition-colors"
    />
  )

  const ClickableCell = ({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) => (
    <div
      onClick={onClick}
      className="cursor-pointer border-r border-b border-black p-1.5 flex items-center justify-between text-[10px] select-none hover:bg-slate-50 transition-colors min-h-[28px]"
      style={{ backgroundColor: selected ? '#fef3c7' : undefined }}
    >
      <span>{label}</span>
      {selected && <span className="font-bold text-green-700">✓</span>}
    </div>
  )

  return isOpen ? (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-2xl w-[90vw] h-[85vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b flex-shrink-0">
          <h2 className="text-xl font-bold">Generic NCR</h2>
          <div className="flex gap-2">
            <Button size="sm" variant="default" onClick={handleSave} disabled={saving}>
              {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin inline" />Saving...</> : 'Save Report'}
            </Button>
            <Button size="sm" variant="outline" onClick={() => window.print()}>
              <Printer className="w-4 h-4 mr-2" />
              Print
            </Button>
            <Button size="sm" variant="ghost" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-8">
          <div id="ncr-form-content" style={{ border: '2px solid #000', color: '#000' }}>
            <style>{`
              @media print {
                #ncr-form-content input, #ncr-form-content textarea {
                  border: none !important;
                  outline: none !important;
                  padding: 2px 4px !important;
                  background: transparent !important;
                  box-shadow: none !important;
                }
                #ncr-form-content .no-print { display: none !important; }
              }
            `}</style>

            {/* HEADER */}
            <div className="flex border-b-2 border-black">
              <div className="w-1/4 border-r border-black p-2 flex items-center justify-center">
                <Image src="/image001.png" alt="SRS" width={150} height={96} className="h-auto w-full max-w-[150px] object-contain" />
              </div>
              <div className="w-1/2 border-r border-black">
                <div className="border-b border-black p-1 text-center font-bold text-lg" style={{ backgroundColor: '#e2e8f0' }}>SRS LOGISTICS SOLUTIONS</div>
                <div className="border-b border-black p-2 text-center font-bold" style={{ backgroundColor: '#f1f5f9' }}>Risk Non – Conformance Report</div>
                <div className="p-2 text-center text-sm">Meyerton</div>
              </div>
              <div className="w-1/4 text-[10px]">
                <div className="flex border-b border-black">
                  <div className="w-1/2 p-1 border-r border-black font-bold" style={{ backgroundColor: '#e2e8f0' }}>Document Number</div>
                  <div className="w-1/2 p-1 text-center font-mono">Non-Conformance-00</div>
                </div>
                <div className="flex border-b border-black">
                  <div className="w-1/2 p-1 border-r border-black font-bold" style={{ backgroundColor: '#e2e8f0' }}>Revision / Date</div>
                  <div className="w-1/2 p-1 text-center">{new Date().toLocaleDateString('en-GB')}</div>
                </div>
                <div className="flex border-b border-black">
                  <div className="w-1/2 p-1 border-r border-black font-bold" style={{ backgroundColor: '#e2e8f0' }}>Page Number</div>
                  <div className="w-1/2 p-1 text-center">Page 1 of 1</div>
                </div>
              </div>
            </div>

            {/* Implicated Entity - ALL EDITABLE */}
            <div className="border-b-2 border-black">
              <div className="font-bold px-2 py-1 text-xs border-b border-black" style={{ backgroundColor: '#cbd5e1' }}>Implicated Entity Information</div>
              <table className="w-full text-xs">
                <tbody>
                  <tr className="border-b border-black">
                    <td className="w-[15%] p-1 border-r border-black font-semibold" style={{ backgroundColor: '#f1f5f9' }}>Name</td>
                    <td className="w-[35%] p-0 border-r border-black" style={{ backgroundColor: '#f9fafb' }}><CellInput value={formData.name} field="name" /></td>
                    <td className="w-[15%] p-1 border-r border-black font-semibold" style={{ backgroundColor: '#f1f5f9' }}>Department</td>
                    <td className="w-[35%] p-0" style={{ backgroundColor: '#f9fafb' }}><CellInput value={formData.department} field="department" /></td>
                  </tr>
                  <tr className="border-b border-black">
                    <td className="p-1 border-r border-black font-semibold" style={{ backgroundColor: '#f1f5f9' }}>Responsible Manager</td>
                    <td className="p-0 border-r border-black" style={{ backgroundColor: '#f9fafb' }}><CellInput value={formData.responsibleManager} field="responsibleManager" /></td>
                    <td className="p-1 border-r border-black font-semibold" style={{ backgroundColor: '#f1f5f9' }}>Section</td>
                    <td className="p-0" style={{ backgroundColor: '#f9fafb' }}><CellInput value={formData.section} field="section" /></td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Non-Conformance Information - ALL EDITABLE */}
            <div className="border-b-2 border-black">
              <div className="font-bold px-2 py-1 text-xs border-b border-black" style={{ backgroundColor: '#cbd5e1' }}>Non-Conformance Information</div>
              <table className="w-full text-xs">
                <tbody>
                  <tr className="border-b border-black">
                    <td className="w-[15%] p-1 border-r border-black font-semibold" style={{ backgroundColor: '#f1f5f9' }}>Date</td>
                    <td className="w-[20%] p-0 border-r border-black" style={{ backgroundColor: '#f9fafb' }}><CellInput value={formData.date} field="date" /></td>
                    <td className="w-[10%] p-1 border-r border-black font-semibold" style={{ backgroundColor: '#f1f5f9' }}>Time</td>
                    <td className="w-[15%] p-0 border-r border-black" style={{ backgroundColor: '#f9fafb' }}><CellInput value={formData.time} field="time" /></td>
                    <td className="w-[10%] p-1 border-r border-black font-semibold" style={{ backgroundColor: '#f1f5f9' }}>Duration</td>
                    <td className="w-[30%] p-0" style={{ backgroundColor: '#f9fafb' }}><CellInput value={formData.duration} field="duration" /></td>
                  </tr>
                  <tr className="border-b border-black">
                    <td className="p-1 border-r border-black font-semibold" style={{ backgroundColor: '#f1f5f9' }}>Vehicle Fleet Number</td>
                    <td className="p-0 border-r border-black font-bold" style={{ backgroundColor: '#f9fafb' }}><CellInput value={formData.vehicleFleetNumber} field="vehicleFleetNumber" /></td>
                    <td className="p-1 border-r border-black font-semibold" style={{ backgroundColor: '#f1f5f9' }}>Area</td>
                    <td className="p-0 border-r border-black" style={{ backgroundColor: '#f9fafb' }}><CellInput value={formData.area} field="area" /></td>
                    <td className="p-1 border-r border-black font-semibold" style={{ backgroundColor: '#f1f5f9' }}>Alert ID</td>
                    <td className="p-0" style={{ backgroundColor: '#f9fafb' }}><CellInput value={formData.alertId} field="alertId" /></td>
                  </tr>
                  <tr className="border-b border-black">
                    <td className="p-1 border-r border-black font-semibold" style={{ backgroundColor: '#f1f5f9' }}>Vehicle Registration</td>
                    <td className="p-0 border-r border-black font-bold" style={{ backgroundColor: '#f9fafb' }}><CellInput value={formData.vehicleRegistration} field="vehicleRegistration" /></td>
                    <td className="p-1 border-r border-black font-semibold" style={{ backgroundColor: '#f1f5f9' }}>Last Occurrence</td>
                    <td className="p-0" colSpan={3}><CellInput value={formData.lastOccurrence} field="lastOccurrence" /></td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Description - EDITABLE */}
            <div className="border-b-2 border-black">
              <div className="font-bold px-2 py-1 text-xs border-b border-black" style={{ backgroundColor: '#cbd5e1' }}>Description of non-conformance</div>
              <CellTextarea value={formData.description} field="description" rows={5} />
              <div className="px-2 py-1 text-[10px] text-slate-600 border-t border-black">
                Alert: {formData.alertId} | Type: {alertDetails?.type || 'N/A'} | Severity: {alertDetails?.severity || 'N/A'} | Location: {formData.area}
              </div>
            </div>

            {/* Classification - CLICKABLE */}
            <div className="border-b-2 border-black">
              <div className="font-bold px-2 py-1 text-xs border-b border-black uppercase" style={{ backgroundColor: "#cbd5e1" }}>Classification Of Non-Conformance</div>
              <div className="grid grid-cols-4 gap-0">
                {CLASSIFICATION_OPTIONS.map((option) => (
                  <ClickableCell
                    key={option}
                    label={option}
                    selected={selectedClassifications.includes(option)}
                    onClick={() => toggleClassification(option)}
                  />
                ))}
              </div>
              {selectedClassifications.includes('Other') && (
                <div className="px-2 py-1 border-t border-black text-xs">
                  <span className="font-semibold">Other: </span>
                  <input
                    type="text"
                    value={otherClassification}
                    onChange={(e) => setOtherClassification(e.target.value)}
                    className="bg-slate-50/50 border border-dashed border-slate-300 rounded outline-none font-mono text-xs w-1/2 p-0.5 focus:border-blue-400 focus:bg-white transition-colors"
                    placeholder="Specify..."
                  />
                </div>
              )}
            </div>

            {/* Root Cause Analysis - CLICKABLE */}
            <div className="border-b-2 border-black">
              <div className="font-bold px-2 py-1 text-xs border-b border-black" style={{ backgroundColor: "#cbd5e1" }}>Root Cause Analysis (Unsafe Acts / Conditions / Personal Factors)</div>
              <div className="grid grid-cols-3 text-[10px]">
                <div className="border-r border-b border-black font-bold p-1 text-center" style={{ backgroundColor: "#f8fafc" }}>Unsafe Acts</div>
                <div className="border-r border-b border-black font-bold p-1 text-center" style={{ backgroundColor: "#f8fafc" }}>Unsafe Conditions</div>
                <div className="border-b border-black font-bold p-1 text-center" style={{ backgroundColor: "#f8fafc" }}>Personal Factors</div>
                {ROOT_CAUSE_OPTIONS.unsafeActs.map((opt) => (
                  <ClickableCell key={opt} label={opt} selected={selectedRootCauses.includes(opt)} onClick={() => toggleRootCause(opt)} />
                ))}
                {ROOT_CAUSE_OPTIONS.unsafeConditions.map((opt) => (
                  <ClickableCell key={opt} label={opt} selected={selectedRootCauses.includes(opt)} onClick={() => toggleRootCause(opt)} />
                ))}
                {ROOT_CAUSE_OPTIONS.personalFactors.map((opt) => (
                  <ClickableCell key={opt} label={opt} selected={selectedRootCauses.includes(opt)} onClick={() => toggleRootCause(opt)} />
                ))}
              </div>
              {/* RISK RATING */}
              <div className="flex border-t border-black text-xs">
                <div className="p-1 font-bold w-1/4 border-r border-black">RISK RATING</div>
                <div className="flex-1 flex">
                  {(['high', 'medium', 'low'] as const).map((level) => (
                    <div
                      key={level}
                      onClick={() => setRiskRating(level)}
                      className="flex-1 border-r border-black p-1 flex justify-between cursor-pointer select-none hover:bg-slate-50"
                      style={{ backgroundColor: riskRating === level ? '#fef3c7' : undefined }}
                    >
                      {level === 'high' ? 'High Risk' : level === 'medium' ? 'Medium Risk' : 'Low Risk'}
                      {riskRating === level && <span className="font-bold">X</span>}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Actions - EDITABLE */}
            <div className="border-b-2 border-black">
              <div className="font-bold px-2 py-1 text-xs border-b border-black" style={{ backgroundColor: "#cbd5e1" }}>C: ACTION PLAN</div>
              <div className="grid grid-cols-12 border-b border-black text-xs">
                <div className="col-span-6 p-2 border-r border-black">
                  <label className="font-bold block mb-1">Corrective Action:</label>
                  <textarea
                    value={formData.correctiveAction}
                    onChange={(e) => setFormData({...formData, correctiveAction: e.target.value})}
                    rows={3}
                    className="w-full text-xs p-1 resize-none bg-slate-50/50 border border-dashed border-slate-300 rounded focus:border-blue-400 focus:bg-white transition-colors"
                  />
                </div>
                <div className="col-span-3 p-2 border-r border-black">
                  <span className="font-bold block mb-1">Responsibility</span>
                  <input
                    type="text"
                    value={formData.correctiveResponsibility}
                    onChange={(e) => setFormData({...formData, correctiveResponsibility: e.target.value})}
                    className="w-full text-xs p-1 bg-slate-50/50 border border-dashed border-slate-300 rounded focus:border-blue-400 focus:bg-white transition-colors"
                  />
                </div>
                <div className="col-span-3 p-2">
                  <span className="font-bold block mb-1">Target Date</span>
                  <input
                    type="text"
                    value={formData.correctiveTargetDate}
                    onChange={(e) => setFormData({...formData, correctiveTargetDate: e.target.value})}
                    className="w-full text-xs p-1 bg-slate-50/50 border border-dashed border-slate-300 rounded focus:border-blue-400 focus:bg-white transition-colors"
                  />
                </div>
              </div>
              <div className="grid grid-cols-12 text-xs">
                <div className="col-span-6 p-2 border-r border-black">
                  <label className="font-bold block mb-1">Preventive Action:</label>
                  <textarea
                    value={formData.preventiveAction}
                    onChange={(e) => setFormData({...formData, preventiveAction: e.target.value})}
                    rows={3}
                    className="w-full text-xs p-1 resize-none bg-slate-50/50 border border-dashed border-slate-300 rounded focus:border-blue-400 focus:bg-white transition-colors"
                  />
                </div>
                <div className="col-span-3 p-2 border-r border-black">
                  <span className="font-bold block mb-1">Responsibility</span>
                  <input
                    type="text"
                    value={formData.preventiveResponsibility}
                    onChange={(e) => setFormData({...formData, preventiveResponsibility: e.target.value})}
                    className="w-full text-xs p-1 bg-slate-50/50 border border-dashed border-slate-300 rounded focus:border-blue-400 focus:bg-white transition-colors"
                  />
                </div>
                <div className="col-span-3 p-2">
                  <span className="font-bold block mb-1">Target Date</span>
                  <input
                    type="text"
                    value={formData.preventiveTargetDate}
                    onChange={(e) => setFormData({...formData, preventiveTargetDate: e.target.value})}
                    className="w-full text-xs p-1 bg-slate-50/50 border border-dashed border-slate-300 rounded focus:border-blue-400 focus:bg-white transition-colors"
                  />
                </div>
              </div>
            </div>

            {/* Sign Off - EDITABLE */}
            <div className="text-xs">
              <div className="font-bold px-2 py-1 border-b border-black" style={{ backgroundColor: "#cbd5e1" }}>D: FEEDBACK</div>
              <div className="grid grid-cols-12 border-b border-black">
                <div className="col-span-2 p-2 font-bold border-r border-black" style={{ backgroundColor: "#f1f5f9" }}>ACTION TAKEN</div>
                <div className="col-span-4 p-2 border-r border-black flex gap-4">
                  <label className="flex items-center gap-1 cursor-pointer">
                    <input type="radio" name="actionTaken" value="yes" checked={formData.actionTaken === 'yes'} onChange={(e) => setFormData({...formData, actionTaken: e.target.value})} />
                    <span>Yes</span>
                  </label>
                  <label className="flex items-center gap-1 cursor-pointer">
                    <input type="radio" name="actionTaken" value="no" checked={formData.actionTaken === 'no'} onChange={(e) => setFormData({...formData, actionTaken: e.target.value})} />
                    <span>No</span>
                  </label>
                </div>
                <div className="col-span-2 p-2 font-bold border-r border-black" style={{ backgroundColor: "#f1f5f9" }}>ACTION EFFECTIVE</div>
                <div className="col-span-4 p-2 flex gap-4">
                  <label className="flex items-center gap-1 cursor-pointer">
                    <input type="radio" name="actionEffective" value="yes" checked={formData.actionEffective === 'yes'} onChange={(e) => setFormData({...formData, actionEffective: e.target.value})} />
                    <span>Yes</span>
                  </label>
                  <label className="flex items-center gap-1 cursor-pointer">
                    <input type="radio" name="actionEffective" value="no" checked={formData.actionEffective === 'no'} onChange={(e) => setFormData({...formData, actionEffective: e.target.value})} />
                    <span>No</span>
                  </label>
                </div>
              </div>
              <div className="grid grid-cols-12">
                <div className="col-span-2 p-2 border-r border-black">Investigator</div>
                <div className="col-span-3 p-2 border-r border-black">
                  <input type="text" value={formData.investigator} onChange={(e) => setFormData({...formData, investigator: e.target.value})} className="w-full p-1 bg-slate-50/50 border border-dashed border-slate-300 rounded focus:border-blue-400 focus:bg-white transition-colors" />
                </div>
                <div className="col-span-1 p-2 border-r border-black font-bold" style={{ backgroundColor: "#f8fafc" }}>Date</div>
                <div className="col-span-2 p-2 border-r border-black font-mono">{new Date().toLocaleDateString('en-GB')}</div>
                <div className="col-span-2 p-2 border-r border-black">Manager</div>
                <div className="col-span-2 p-2">
                  <input type="text" value={formData.manager} onChange={(e) => setFormData({...formData, manager: e.target.value})} className="w-full p-1 bg-slate-50/50 border border-dashed border-slate-300 rounded focus:border-blue-400 focus:bg-white transition-colors" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  ) : null
}
