'use client'

import { useMemo, useState } from 'react'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Printer, X } from 'lucide-react'

interface AlertDetails {
  id?: string
  type?: string
  severity?: string
  timestamp?: string
  location?: { latitude?: number; longitude?: number; address?: string } | string
  screenshots?: Array<{ url: string; timestamp?: string }>
  videos?: Array<{ key?: string; label?: string; url?: string }>
}

interface SpeedingModalProps {
  isOpen: boolean
  onClose: () => void
  driverInfo: {
    name: string
    fleetNumber: string
    department?: string
    timestamp: string
    location?: string
  }
  alertDetails?: AlertDetails
}

export default function NCRSpeedingModal({ isOpen, onClose, driverInfo, alertDetails }: SpeedingModalProps) {
  const [saving, setSaving] = useState(false)
  const [ncrNo, setNcrNo] = useState('/26')
  const [responsibleManager, setResponsibleManager] = useState('Fleet Manager')
  const [section, setSection] = useState('Road Safety')
  const [description, setDescription] = useState(
    `The driver of fleet ${driverInfo.fleetNumber} was observed exceeding designated speed limits. This creates significant risk for road users and company operations.`
  )
  const [correctiveAction, setCorrectiveAction] = useState('.')
  const [preventiveAction, setPreventiveAction] = useState('')
  const [investigator, setInvestigator] = useState('')
  const [manager, setManager] = useState('')

  const locationText = useMemo(() => {
    if (typeof alertDetails?.location === 'string') return alertDetails.location
    if (alertDetails?.location?.latitude && alertDetails?.location?.longitude) {
      return `${alertDetails.location.latitude}, ${alertDetails.location.longitude}`
    }
    return driverInfo.location || 'Unknown location'
  }, [alertDetails?.location, driverInfo.location])

  const handlePrint = () => window.print()

  const handleSave = async () => {
    setSaving(true)
    try {
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()
      const element = document.getElementById('ncr-speeding-content')
      if (!element) throw new Error('Form content not found')

      const html2canvas = (await import('html2canvas')).default
      const jsPDF = (await import('jspdf')).default
      const canvas = await html2canvas(element, { scale: 2, useCORS: true, logging: false, backgroundColor: '#ffffff' })
      const imgData = canvas.toDataURL('image/png')
      const pdf = new jsPDF('p', 'mm', 'a4')
      const width = pdf.internal.pageSize.getWidth()
      const height = (canvas.height * width) / canvas.width
      pdf.addImage(imgData, 'PNG', 0, 0, width, height)
      const blob = pdf.output('blob')
      const fileName = `ncr-speeding-${driverInfo.fleetNumber}-${Date.now()}.pdf`
      pdf.save(fileName)

      const { error: uploadError } = await supabase.storage.from('reports').upload(fileName, blob, { contentType: 'application/pdf' })
      if (uploadError) throw uploadError
      const { data: publicData } = supabase.storage.from('reports').getPublicUrl(fileName)
      const publicUrl = publicData?.publicUrl || ''

      const { error: dbError } = await supabase.from('reports').insert({
        vehicle_registration: driverInfo.fleetNumber,
        driver_name: driverInfo.name,
        priority: 'High',
        report_type: 'NCR_SPEEDING',
        document_url: publicUrl
      })
      if (dbError) throw dbError
      onClose()
    } catch (err) {
      console.error('Error saving NCR speeding report:', err)
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
          <h2 className="text-xl font-bold">ncr-speeding</h2>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save Report'}</Button>
            <Button size="sm" variant="outline" onClick={handlePrint}><Printer className="w-4 h-4 mr-2" />Print</Button>
            <Button size="sm" variant="ghost" onClick={onClose}><X className="w-4 h-4" /></Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 bg-slate-100">
          <div id="ncr-speeding-content" className="mx-auto max-w-[1080px] bg-white border-2 border-black text-black">
            <div className="border-b-2 border-black grid grid-cols-12 text-sm">
              <div className="col-span-3 border-r border-black p-3 flex items-center justify-center">
                <Image src="/image001.png" alt="SRS" width={160} height={96} className="h-auto w-full max-w-[160px] object-contain" />
              </div>
              <div className="col-span-6 border-r border-black">
                <div className="border-b border-black p-2 text-center font-bold text-2xl">SOTERIA RISK SOLUTIONS</div>
                <div className="border-b border-black p-2 text-center font-bold text-3xl">Risk - Non-Conformance Report</div>
                <div className="p-2 text-center text-3xl">Meyerton</div>
              </div>
              <div className="col-span-3 text-xs">
                <div className="grid grid-cols-2 border-b border-black"><div className="p-2 border-r border-black bg-slate-100">Document Number</div><div className="p-2 font-bold">Non - Conformance Report / 002</div></div>
                <div className="grid grid-cols-2 border-b border-black"><div className="p-2 border-r border-black bg-slate-100">Revision Number / Date</div><div className="p-2 font-bold">5 Feb 2026 / 1 Jan 2027</div></div>
                <div className="grid grid-cols-2"><div className="p-2 border-r border-black bg-slate-100">Page Number</div><div className="p-2 font-bold">Page 1 of 2</div></div>
              </div>
            </div>

            <div className="grid grid-cols-12 border-b border-black text-sm">
              <div className="col-span-8 p-2 border-r border-black">Safety [X] Health/Envir [X] Quality [X]</div>
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
                <div className="grid grid-cols-8 border-b border-black text-sm">
                  <div className="col-span-1 border-r border-black p-2 bg-slate-100">Date</div>
                  <div className="col-span-2 border-r border-black p-2">{new Date(driverInfo.timestamp).toLocaleDateString('en-GB')}</div>
                  <div className="col-span-1 border-r border-black p-2 bg-slate-100">Time</div>
                  <div className="col-span-1 border-r border-black p-2">Multiple</div>
                  <div className="col-span-1 border-r border-black p-2 bg-slate-100">Duration</div>
                  <div className="col-span-2 p-2">N/A</div>
                </div>
                <div className="grid grid-cols-8 border-b border-black text-sm">
                  <div className="col-span-2 border-r border-black p-2 bg-slate-100">Vehicle Fleet Number</div>
                  <div className="col-span-2 border-r border-black p-2">{driverInfo.fleetNumber}</div>
                  <div className="col-span-1 border-r border-black p-2 bg-slate-100">Area</div>
                  <div className="col-span-3 p-2">Road Network</div>
                </div>
                <div className="border-b border-black p-2 font-bold bg-slate-100">Classification Of Non-Conformance</div>
                <div className="grid grid-cols-6 border-b border-black text-sm">
                  <div className="border-r border-black p-2">Injury</div>
                  <div className="border-r border-black p-2 bg-yellow-200">Negligence of Driver</div>
                  <div className="border-r border-black p-2 bg-yellow-200">Insubordination</div>
                  <div className="border-r border-black p-2 bg-yellow-200">Speeding Violation</div>
                  <div className="border-r border-black p-2 bg-yellow-200">Traffic Violation</div>
                  <div className="p-2">No Seatbelt</div>
                </div>
                <div className="grid grid-cols-6 border-b border-black text-sm">
                  <div className="border-r border-black p-2 bg-yellow-200">Reckless Driving</div>
                  <div className="border-r border-black p-2">Poor Fatigue Management</div>
                  <div className="border-r border-black p-2">Carrying Unauthorized Personal</div>
                  <div className="border-r border-black p-2">No Container Locks</div>
                  <div className="border-r border-black p-2">Inadequate Loading Equipment</div>
                  <div className="p-2 bg-yellow-200">Legal non-compliance</div>
                </div>
                <div className="grid grid-cols-6 border-b border-black text-sm">
                  <div className="border-r border-black p-2">Customer Complaints</div>
                  <div className="border-r border-black p-2">External / Community Complaints</div>
                  <div className="col-span-4 p-2">Other: The driver exceeded the safe operating speed.</div>
                </div>
                <div className="p-2 text-sm">
                  <div className="font-bold underline mb-1">Description of non-conformance</div>
                  <textarea className="w-full min-h-[130px] border border-black p-2" value={description} onChange={(e) => setDescription(e.target.value)} />
                  <div className="mt-2 text-xs">Alert: {alertDetails?.id || 'N/A'} | Type: {alertDetails?.type || 'N/A'} | Severity: {alertDetails?.severity || 'N/A'} | Location: {locationText}</div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-12 border-b border-black">
              <div className="col-span-1 border-r border-black p-2 [writing-mode:vertical-rl] rotate-180 text-center font-bold">B: INVESTIGATION</div>
              <div className="col-span-11">
                <div className="border-b border-black p-2 font-bold bg-slate-100">Root Cause Analysis</div>
                <div className="grid grid-cols-5 border-b border-black text-sm">
                  <div className="border-r border-black p-2">Operating without authority</div>
                  <div className="border-r border-black p-2">Taking an unsafe position</div>
                  <div className="border-r border-black p-2 bg-yellow-200">Improper attitude or motivation</div>
                  <div className="border-r border-black p-2 bg-yellow-200">Operating at unsafe speed</div>
                  <div className="p-2">Physical/Mental incompatibility</div>
                </div>
                <div className="grid grid-cols-5 border-b border-black text-sm">
                  <div className="border-r border-black p-2">Distracting/horseplay</div>
                  <div className="border-r border-black p-2">Defective tools/equipment</div>
                  <div className="border-r border-black p-2 bg-yellow-200">Lack of knowledge or skill</div>
                  <div className="border-r border-black p-2">Using equipment unsafely</div>
                  <div className="p-2">Failure to use PPE</div>
                </div>
                <div className="grid grid-cols-5 border-b border-black text-sm">
                  <div className="border-r border-black p-2 bg-yellow-200">Hazardous arrangement</div>
                  <div className="border-r border-black p-2">Using unsafe equipment</div>
                  <div className="border-r border-black p-2 bg-yellow-200">Ignoring SHE Regulations</div>
                  <div className="border-r border-black p-2 bg-yellow-200">Ignoring Road Traffic Act</div>
                  <div className="p-2">Poor road/environment conditions</div>
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
                    <textarea className="w-full min-h-[90px] border border-black p-2 mt-1" value={correctiveAction} onChange={(e) => setCorrectiveAction(e.target.value)} />
                    <div className="font-bold underline mt-2">Preventive Action</div>
                    <textarea className="w-full min-h-[90px] border border-black p-2 mt-1" value={preventiveAction} onChange={(e) => setPreventiveAction(e.target.value)} />
                  </div>
                  <div className="col-span-4 p-2">
                    <div className="font-semibold">Responsibility</div>
                    <input className="w-full border border-black p-1 mt-1" value={responsibleManager} onChange={(e) => setResponsibleManager(e.target.value)} />
                    <div className="font-semibold mt-2">Target Date</div>
                    <input className="w-full border border-black p-1 mt-1" />
                  </div>
                </div>
              </div>
            </div>

            <div className="p-3 text-sm border-b border-black">
              <div className="font-bold text-lg mb-2">Risk Analysis and Priority Rating Table</div>
              <div className="grid grid-cols-2 gap-3">
                <div className="border border-black">
                  <div className="border-b border-black p-1 font-bold">Probability / Likelihood</div>
                  <div className="p-1">A Very High</div>
                  <div className="p-1">B High</div>
                  <div className="p-1">C Moderate</div>
                  <div className="p-1">D Low</div>
                  <div className="p-1">E Very Low</div>
                </div>
                <div className="border border-black">
                  <div className="border-b border-black p-1 font-bold">Actions</div>
                  <div className="p-1">High risk: Immediate action.</div>
                  <div className="p-1">Medium risk: Urgent controls.</div>
                  <div className="p-1">Low risk: monitor.</div>
                </div>
              </div>
            </div>

            <div className="p-3 text-sm border-b border-black">
              <div className="font-bold text-lg mb-2">Annexture A (Picture/Video Evidence)</div>
              <div className="grid grid-cols-2 gap-2">
                {(alertDetails?.screenshots || []).slice(0, 4).map((shot, idx) => (
                  <div key={`${shot.url}-${idx}`} className="border border-black p-2">
                    <div className="text-xs font-semibold mb-1">Screenshot {idx + 1}</div>
                    <img src={shot.url} alt={`Evidence ${idx + 1}`} className="w-full h-40 object-cover border border-black" />
                    <div className="text-[11px] mt-1">{shot.timestamp ? new Date(shot.timestamp).toLocaleString('en-GB') : ''}</div>
                  </div>
                ))}
                {(alertDetails?.videos || []).slice(0, 4).map((video, idx) => (
                  <div key={`${video.url}-${idx}`} className="border border-black p-2">
                    <div className="text-xs font-semibold mb-1">{video.label || `Video ${idx + 1}`}</div>
                    {video.url ? (
                      <>
                        <video controls className="w-full h-40 bg-black border border-black">
                          <source src={video.url} />
                        </video>
                        <div className="text-[11px] mt-1 break-all">{video.url}</div>
                      </>
                    ) : (
                      <div className="h-40 border border-black flex items-center justify-center text-xs text-slate-500">No video URL</div>
                    )}
                  </div>
                ))}
              </div>
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
