'use client'

import { useMemo, useState } from 'react'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Printer, X } from 'lucide-react'

interface ReportAlertDetails {
  id?: string
  type?: string
  severity?: string
  timestamp?: string
  location?: { latitude?: number; longitude?: number; address?: string } | string
  screenshots?: Array<{ url: string; timestamp?: string }>
  videos?: Array<{ key?: string; label?: string; url?: string }>
}
type ScreenshotInput = { url?: string; storage_url?: string; signed_url?: string; image_url?: string; timestamp?: string }
type VideoInput = { key?: string; label?: string; url?: string; src?: string; path?: string }

interface AccidentReportModalProps {
  isOpen: boolean
  onClose: () => void
  onSaved?: () => void | Promise<void>
  driverInfo: {
    name: string
    fleetNumber: string
    department?: string
    timestamp: string
    location?: string
  }
  alertDetails?: ReportAlertDetails
}

export default function AccidentReportModal({ isOpen, onClose, onSaved, driverInfo, alertDetails }: AccidentReportModalProps) {
  const [saving, setSaving] = useState(false)
  const [reportedBy, setReportedBy] = useState('')
  const [titleRole, setTitleRole] = useState('')
  const [affectedDepartment, setAffectedDepartment] = useState('')
  const [incidentType, setIncidentType] = useState('')
  const [dateOfIncident, setDateOfIncident] = useState('')
  const [location, setLocation] = useState('')
  const [city, setCity] = useState('')
  const [specificArea, setSpecificArea] = useState('')
  const [driverDrivingTimes, setDriverDrivingTimes] = useState('')
  const [accidentType, setAccidentType] = useState({
    collision: false,
    propertyDamage: false,
    personalInjury: false,
    cargoLoss: false,
    environmentalSpill: false,
    other: false,
    otherSpecify: ''
  })
  const [incidentDescription, setIncidentDescription] = useState('')
  const [injuredPersons, setInjuredPersons] = useState([
    { name: '', role: '', nature: '', treatment: '' },
    { name: '', role: '', nature: '', treatment: '' }
  ])
  const [thirdParty, setThirdParty] = useState([
    { name: '', role: '', contact: '' },
    { name: '', role: '', contact: '' },
    { name: '', role: '', contact: '' }
  ])
  const [witnesses, setWitnesses] = useState([
    { name: '', contact: '', relationship: '' }
  ])

  const timestamp = alertDetails?.timestamp || driverInfo.timestamp
  const locationText = useMemo(() => {
    if (typeof alertDetails?.location === 'string') return alertDetails.location
    if (alertDetails?.location?.latitude !== undefined && alertDetails?.location?.longitude !== undefined) {
      return `${alertDetails.location.latitude}, ${alertDetails.location.longitude}`
    }
    return driverInfo.location || 'Unknown location'
  }, [alertDetails?.location, driverInfo.location])

  const annexureScreenshots = useMemo(() => {
    const input = Array.isArray(alertDetails?.screenshots) ? (alertDetails.screenshots as ScreenshotInput[]) : []
    const out: Array<{ url: string; timestamp?: string }> = []
    const seen = new Set<string>()
    for (const shot of input) {
      const url = String(shot?.url || shot?.storage_url || shot?.signed_url || shot?.image_url || '').trim()
      if (!url || (!/^https?:\/\//i.test(url) && !url.startsWith('/'))) continue
      if (seen.has(url)) continue
      seen.add(url)
      out.push({ url, timestamp: shot?.timestamp })
    }
    return out
  }, [alertDetails?.screenshots])

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

      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
      })
      const imgData = canvas.toDataURL('image/png')
      const pdf = new jsPDF('p', 'mm', 'a4')
      const width = pdf.internal.pageSize.getWidth()
      const height = (canvas.height * width) / canvas.width
      pdf.addImage(imgData, 'PNG', 0, 0, width, height)

      const fileName = `accident-report-${driverInfo.fleetNumber}-${Date.now()}.pdf`
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('reports')
        
        .upload(fileName, await (await fetch(pdf.output('blob'))).arrayBuffer())
      if (uploadError) throw uploadError

      const { data: publicData } = supabase.storage.from('reports').getPublicUrl(fileName)
      const publicUrl = publicData?.publicUrl || ''

      const { error: dbError } = await supabase.from('reports').insert({
        vehicle_registration: driverInfo.fleetNumber,
        driver_name: driverInfo.name,
        priority: 'High',
        report_type: 'ACCIDENT_REPORT',
        document_url: publicUrl
      })
      if (dbError) throw dbError

      if (onSaved) await onSaved()
      onClose()
    } catch (err) {
      console.error('Error saving accident report:', err)
      alert('Failed to save report')
    } finally {
      setSaving(false)
    }
  }

  const updateInjuredPerson = (index: number, field: string, value: string) => {
    const updated = [...injuredPersons]
    updated[index] = { ...updated[index], [field]: value }
    setInjuredPersons(updated)
  }

  const updateThirdParty = (index: number, field: string, value: string) => {
    const updated = [...thirdParty]
    updated[index] = { ...updated[index], [field]: value }
    setThirdParty(updated)
  }

  const updateWitness = (index: number, field: string, value: string) => {
    const updated = [...witnesses]
    updated[index] = { ...updated[index], [field]: value }
    setWitnesses(updated)
  }

  const toggleAccidentType = (type: string) => {
    setAccidentType(prev => ({
      ...prev,
      [type]: !prev[type as keyof typeof accidentType]
    }))
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 bg-black/60 p-3 md:p-6">
      <div className="mx-auto h-full w-full max-w-[1100px] overflow-hidden rounded-xl border-2 border-blue-900 bg-slate-100 shadow-2xl flex flex-col">
        <div className="border-b border-blue-900 bg-gradient-to-r from-blue-950 via-blue-900 to-sky-700 px-4 py-3 text-white flex items-center justify-between">
          <h2 className="text-base font-semibold">Accident Report Template</h2>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save Report'}</Button>
            <Button size="sm" variant="outline" onClick={handlePrint}><Printer className="w-4 h-4 mr-2" />Print</Button>
            <Button size="sm" variant="ghost" onClick={onClose}><X className="w-4 h-4" /></Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          <div id="accident-report-content" className="mx-auto max-w-[980px] space-y-4 border-2 border-slate-600 bg-white p-4">
            {/* Header */}
            <div className="border border-slate-600">
              <div className="grid grid-cols-12">
                <div className="col-span-3 border-r border-slate-500 p-3 flex items-center justify-center">
                  <Image src="/image001.png" alt="SRS" width={160} height={96} className="h-auto w-full max-w-[160px] object-contain" />
                </div>
                <div className="col-span-6 border-r border-slate-500">
                  <div className="h-full flex flex-col items-center justify-center p-3">
                    <h3 className="text-center text-2xl font-bold text-slate-800">PREMIER LOGISTICS SOLUTIONS</h3>
                    <p className="text-center text-sm font-semibold text-slate-700">Accident report template</p>
                    <p className="text-center text-xs text-slate-600">Meyerton</p>
                  </div>
                </div>
                <div className="col-span-3 border-l border-slate-500 p-2 text-xs">
                  <div className="grid grid-cols-2 gap-1">
                    <span className="font-semibold">Document Number:</span>
                    <input className="border border-slate-400 px-1" />
                    <span className="font-semibold">Accident report</span>
                    <span>template (R)</span>
                    <span className="font-semibold">Revision Number / Date:</span>
                    <input className="border border-slate-400 px-1" />
                    <span className="font-semibold">00 / 10th January 2028</span>
                    <span></span>
                    <span className="font-semibold">Revised by</span>
                    <span>T Hoosen</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Report Header */}
            <div className="text-center space-y-1">
              <h4 className="text-lg font-bold text-blue-900 underline">RISK DEPARTMENT</h4>
              <h5 className="text-lg font-bold text-blue-900 underline">ACCIDENT REPORT</h5>
            </div>

            {/* Report Details */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div><span className="font-semibold">REPORTED BY:</span> <input className="border-b border-slate-400 flex-1 ml-2 w-32" value={reportedBy} onChange={(e) => setReportedBy(e.target.value)} /></div>
                <div className="mt-2"><span className="font-semibold">TITLE / ROLE:</span> <input className="border-b border-slate-400 flex-1 ml-2 w-32" value={titleRole} onChange={(e) => setTitleRole(e.target.value)} /></div>
              </div>
              <div>
                <div><span className="font-semibold">DATE OF REPORT:</span> <input type="date" className="border-b border-slate-400 flex-1 ml-2 w-32" value={new Date(timestamp).toISOString().split('T')[0]} readOnly /></div>
                <div className="mt-2"><span className="font-semibold">INCIDENT NO.:</span> <input className="border-b border-slate-400 flex-1 ml-2 w-32" /></div>
              </div>
            </div>

            <div>
              <span className="font-semibold">AFFECTED DEPARTMENT:</span> <input className="border-b border-slate-400 flex-1 ml-2 w-64" value={affectedDepartment} onChange={(e) => setAffectedDepartment(e.target.value)} />
            </div>

            {/* Incident Information */}
            <div className="border border-slate-500 p-2">
              <h5 className="text-center font-bold text-slate-800 underline mb-3">INCIDENT INFORMATION:</h5>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="font-semibold">INCIDENT TYPE:</label>
                  <input className="border border-slate-400 w-full px-2 py-1 mt-1" value={incidentType} onChange={(e) => setIncidentType(e.target.value)} />
                </div>
                <div>
                  <label className="font-semibold">DATE OF INCIDENT:</label>
                  <input type="date" className="border border-slate-400 w-full px-2 py-1 mt-1" value={dateOfIncident} onChange={(e) => setDateOfIncident(e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 mt-3">
                <div>
                  <label className="font-semibold">LOCATION:</label>
                  <input className="border border-slate-400 w-full px-2 py-1 mt-1" value={location} onChange={(e) => setLocation(e.target.value)} />
                </div>
                <div>
                  <label className="font-semibold">CITY:</label>
                  <input className="border border-slate-400 w-full px-2 py-1 mt-1" value={city} onChange={(e) => setCity(e.target.value)} />
                </div>
              </div>
              <div className="mt-3">
                <label className="font-semibold">SPECIFIC AREA OF LOCATION (if applicable):</label>
                <input className="border border-slate-400 w-full px-2 py-1 mt-1" value={specificArea} onChange={(e) => setSpecificArea(e.target.value)} />
              </div>
              <div className="mt-3">
                <label className="font-semibold">DRIVER DRIVING TIMES:</label>
                <input className="border border-slate-400 w-full px-2 py-1 mt-1" value={driverDrivingTimes} onChange={(e) => setDriverDrivingTimes(e.target.value)} />
              </div>
            </div>

            {/* Type of Accident */}
            <div className="border border-slate-500 p-2">
              <h5 className="font-bold text-slate-800 underline mb-3">TYPE OF ACCIDENT (Tick / Circle):</h5>
              <div className="space-y-2">
                <label className="flex items-center gap-3"><input type="checkbox" checked={accidentType.collision} onChange={() => toggleAccidentType('collision')} /> Vehicle Collision</label>
                <label className="flex items-center gap-3"><input type="checkbox" checked={accidentType.propertyDamage} onChange={() => toggleAccidentType('propertyDamage')} /> Property Damage</label>
                <label className="flex items-center gap-3"><input type="checkbox" checked={accidentType.personalInjury} onChange={() => toggleAccidentType('personalInjury')} /> Personal Injury</label>
                <label className="flex items-center gap-3"><input type="checkbox" checked={accidentType.cargoLoss} onChange={() => toggleAccidentType('cargoLoss')} /> Cargo Loss / Theft</label>
                <label className="flex items-center gap-3"><input type="checkbox" checked={accidentType.environmentalSpill} onChange={() => toggleAccidentType('environmentalSpill')} /> Environmental Spill</label>
                <label className="flex items-center gap-3">
                  <input type="checkbox" checked={accidentType.other} onChange={() => toggleAccidentType('other')} /> Other (specify):
                  <input className="border-b border-slate-400 flex-1" value={accidentType.otherSpecify} onChange={(e) => setAccidentType(prev => ({ ...prev, otherSpecify: e.target.value }))} />
                </label>
              </div>
            </div>

            {/* Incident Description */}
            <div className="border border-slate-500 p-2">
              <h5 className="font-bold text-slate-800 underline mb-3">INCIDENT DESCRIPTION:</h5>
              <p className="text-xs text-slate-600 italic mb-2">(Provide a detailed description of what happened, including sequence of events, damage, and contributing factors.)</p>
              <textarea className="border border-slate-400 w-full px-2 py-2 mt-1 h-24" value={incidentDescription} onChange={(e) => setIncidentDescription(e.target.value)} />
            </div>

            {/* Injury Information */}
            <div className="border border-slate-500 p-2">
              <h5 className="font-bold text-slate-800 underline mb-3">INJURY INFORMATION (if applicable):</h5>
              <table className="w-full border-collapse border border-slate-500 text-sm">
                <thead>
                  <tr>
                    <th className="border border-slate-500 p-2 bg-slate-200">#</th>
                    <th className="border border-slate-500 p-2 bg-slate-200">Name of Injured Person(s)</th>
                    <th className="border border-slate-500 p-2 bg-slate-200">Role / Relationship</th>
                    <th className="border border-slate-500 p-2 bg-slate-200">Nature of Injury</th>
                    <th className="border border-slate-500 p-2 bg-slate-200">Treatment Given / Hospitalised</th>
                  </tr>
                </thead>
                <tbody>
                  {injuredPersons.map((person, idx) => (
                    <tr key={idx}>
                      <td className="border border-slate-500 p-2">{idx + 1}</td>
                      <td className="border border-slate-500 p-1"><input className="w-full border border-slate-400 px-1" value={person.name} onChange={(e) => updateInjuredPerson(idx, 'name', e.target.value)} /></td>
                      <td className="border border-slate-500 p-1"><input className="w-full border border-slate-400 px-1" value={person.role} onChange={(e) => updateInjuredPerson(idx, 'role', e.target.value)} /></td>
                      <td className="border border-slate-500 p-1"><input className="w-full border border-slate-400 px-1" value={person.nature} onChange={(e) => updateInjuredPerson(idx, 'nature', e.target.value)} /></td>
                      <td className="border border-slate-500 p-1"><input className="w-full border border-slate-400 px-1" value={person.treatment} onChange={(e) => updateInjuredPerson(idx, 'treatment', e.target.value)} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Third Party */}
            <div className="border border-slate-500 p-2">
              <h5 className="font-bold text-slate-800 underline mb-3">NAME / ROLE / CONTACT OF THIRD PARTY INVOLVED:</h5>
              <table className="w-full border-collapse border border-slate-500 text-sm">
                <thead>
                  <tr>
                    <th className="border border-slate-500 p-2 bg-slate-200">#</th>
                    <th className="border border-slate-500 p-2 bg-slate-200">Name</th>
                    <th className="border border-slate-500 p-2 bg-slate-200">Role / Company</th>
                    <th className="border border-slate-500 p-2 bg-slate-200">Contact</th>
                  </tr>
                </thead>
                <tbody>
                  {thirdParty.map((party, idx) => (
                    <tr key={idx}>
                      <td className="border border-slate-500 p-2">{idx + 1}</td>
                      <td className="border border-slate-500 p-1"><input className="w-full border border-slate-400 px-1" value={party.name} onChange={(e) => updateThirdParty(idx, 'name', e.target.value)} /></td>
                      <td className="border border-slate-500 p-1"><input className="w-full border border-slate-400 px-1" value={party.role} onChange={(e) => updateThirdParty(idx, 'role', e.target.value)} /></td>
                      <td className="border border-slate-500 p-1"><input className="w-full border border-slate-400 px-1" value={party.contact} onChange={(e) => updateThirdParty(idx, 'contact', e.target.value)} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Witness Information */}
            <div className="border border-slate-500 p-2">
              <h5 className="font-bold text-slate-800 underline mb-3">WITNESS OR VICTIM INFORMATION:</h5>
              <table className="w-full border-collapse border border-slate-500 text-sm">
                <thead>
                  <tr>
                    <th className="border border-slate-500 p-2 bg-slate-200">Name</th>
                    <th className="border border-slate-500 p-2 bg-slate-200">Contact</th>
                    <th className="border border-slate-500 p-2 bg-slate-200">Specific Relationship to Incident</th>
                  </tr>
                </thead>
                <tbody>
                  {witnesses.map((witness, idx) => (
                    <tr key={idx}>
                      <td className="border border-slate-500 p-1"><input className="w-full border border-slate-400 px-1" value={witness.name} onChange={(e) => updateWitness(idx, 'name', e.target.value)} /></td>
                      <td className="border border-slate-500 p-1"><input className="w-full border border-slate-400 px-1" value={witness.contact} onChange={(e) => updateWitness(idx, 'contact', e.target.value)} /></td>
                      <td className="border border-slate-500 p-1"><input className="w-full border border-slate-400 px-1" value={witness.relationship} onChange={(e) => updateWitness(idx, 'relationship', e.target.value)} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Screenshots */}
            {annexureScreenshots.length > 0 && (
              <div className="border border-slate-500 p-2">
                <h5 className="font-bold text-slate-800 underline mb-3">INCIDENT SCREENSHOTS:</h5>
                <div className="grid grid-cols-2 gap-3">
                  {annexureScreenshots.map((shot, idx) => (
                    <div key={`${shot.url}-${idx}`} className="border border-slate-500 p-2">
                      <div className="text-xs font-semibold mb-1">Screenshot {idx + 1}</div>
                      <img src={shot.url} alt={`Screenshot ${idx + 1}`} className="w-full h-36 object-cover border border-slate-500" />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
