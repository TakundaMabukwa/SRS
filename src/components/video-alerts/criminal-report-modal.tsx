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

interface CriminalReportModalProps {
  isOpen: boolean
  onClose: () => void
  driverInfo: {
    name: string
    fleetNumber: string
    department?: string
    timestamp: string
    location?: string
  }
  alertDetails?: ReportAlertDetails
}

export default function CriminalReportModal({ isOpen, onClose, driverInfo, alertDetails }: CriminalReportModalProps) {
  const [saving, setSaving] = useState(false)
  const [reportedBy, setReportedBy] = useState('')
  const [titleRole, setTitleRole] = useState('')
  const [citySite, setCitySite] = useState('Meyerton')
  const [specificArea, setSpecificArea] = useState('')
  const [description, setDescription] = useState('')
  const [suspect1, setSuspect1] = useState('')
  const [suspect2, setSuspect2] = useState('')
  const [unapprehended, setUnapprehended] = useState('')
  const [witness1, setWitness1] = useState('')
  const [witness2, setWitness2] = useState('')
  const [policeCas, setPoliceCas] = useState('')
  const [station, setStation] = useState('')
  const [officer, setOfficer] = useState('')
  const [policeContact, setPoliceContact] = useState('')
  const [actionTaken, setActionTaken] = useState('')
  const [responsiblePerson, setResponsiblePerson] = useState('')

  const timestamp = alertDetails?.timestamp || driverInfo.timestamp
  const locationText = useMemo(() => {
    if (typeof alertDetails?.location === 'string') return alertDetails.location
    if (alertDetails?.location?.latitude !== undefined && alertDetails?.location?.longitude !== undefined) {
      return `${alertDetails.location.latitude}, ${alertDetails.location.longitude}`
    }
    return driverInfo.location || 'Unknown location'
  }, [alertDetails?.location, driverInfo.location])
  const annexureScreenshots = useMemo(() => {
    const input = Array.isArray(alertDetails?.screenshots) ? alertDetails.screenshots : []
    const out: Array<{ url: string; timestamp?: string }> = []
    const seen = new Set<string>()
    for (const shot of input as any[]) {
      const url = String(shot?.url || shot?.storage_url || shot?.signed_url || shot?.image_url || '').trim()
      if (!url || (!/^https?:\/\//i.test(url) && !url.startsWith('/'))) continue
      if (seen.has(url)) continue
      seen.add(url)
      out.push({ url, timestamp: shot?.timestamp })
    }
    return out
  }, [alertDetails?.screenshots])
  const annexureVideos = useMemo(() => {
    const input = Array.isArray(alertDetails?.videos) ? alertDetails.videos : []
    const out: Array<{ key?: string; label?: string; url?: string }> = []
    const seen = new Set<string>()
    for (const v of input as any[]) {
      const url = String(v?.url || v?.src || v?.path || '').trim()
      if (!url || (!/^https?:\/\//i.test(url) && !url.startsWith('/'))) continue
      if (seen.has(url)) continue
      seen.add(url)
      out.push({ key: v?.key, label: v?.label, url })
    }
    return out
  }, [alertDetails?.videos])

  const handlePrint = () => window.print()

  const handleSave = async () => {
    setSaving(true)
    try {
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()
      const element = document.getElementById('criminal-report-content')
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
      const fileName = `criminal-report-${driverInfo.fleetNumber}-${Date.now()}.pdf`
      pdf.save(fileName)

      const { error: uploadError } = await supabase.storage.from('reports').upload(fileName, blob, { contentType: 'application/pdf' })
      if (uploadError) throw uploadError
      const { data: publicData } = supabase.storage.from('reports').getPublicUrl(fileName)
      const publicUrl = publicData?.publicUrl || ''
      const { error: dbError } = await supabase.from('reports').insert({
        vehicle_registration: driverInfo.fleetNumber,
        driver_name: driverInfo.name,
        priority: 'High',
        report_type: 'CRIMINAL_REPORT',
        document_url: publicUrl
      })
      if (dbError) throw dbError
      onClose()
    } catch (err) {
      console.error('Error saving criminal report:', err)
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
          <h2 className="text-base font-semibold">Criminal report template</h2>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save Report'}</Button>
            <Button size="sm" variant="outline" onClick={handlePrint}><Printer className="w-4 h-4 mr-2" />Print</Button>
            <Button size="sm" variant="ghost" onClick={onClose}><X className="w-4 h-4" /></Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          <div id="criminal-report-content" className="mx-auto max-w-[980px] space-y-4 border-2 border-slate-600 bg-white p-4">
            <div className="border border-slate-600">
              <div className="grid grid-cols-12">
                <div className="col-span-3 border-r border-slate-500 p-3 flex items-center justify-center">
                  <Image src="/image001.png" alt="SRS" width={160} height={96} className="h-auto w-full max-w-[160px] object-contain" />
                </div>
                <div className="col-span-6 border-r border-slate-500">
                  <div className="border-b border-slate-500 bg-slate-200 p-2 text-center text-xl font-medium text-slate-600">PREMIER LOGISTICS SOLUTIONS</div>
                  <div className="border-b border-slate-500 bg-slate-100 p-2 text-center text-2xl font-semibold text-slate-600">Criminal report template</div>
                  <div className="p-2 text-center text-3xl font-medium text-slate-700">Meyerton</div>
                </div>
                <div className="col-span-3 text-xs">
                  <div className="border-b border-slate-500 p-2 text-center text-slate-600">Document Number</div>
                  <div className="border-b border-slate-500 p-2 text-center font-semibold">Criminal report template /00</div>
                  <div className="border-b border-slate-500 p-2 text-center text-slate-600">Revision Number / Date</div>
                  <div className="border-b border-slate-500 p-2 text-center font-semibold">00 / 10th January 2028</div>
                  <div className="border-b border-slate-500 p-2 text-center text-slate-600">Revised by</div>
                  <div className="p-2 text-center font-semibold">T Hoosen</div>
                </div>
              </div>
            </div>

            <h3 className="text-center text-3xl font-semibold text-blue-900 underline">Criminal Incident Report</h3>

            <div className="grid grid-cols-12 border border-slate-500"><div className="col-span-6 border-r border-slate-500 p-2 font-semibold">Company / Department</div><div className="col-span-6 p-2">{driverInfo.department || 'Fleet Operations'}</div></div>
            <div className="grid grid-cols-12 border border-slate-500"><div className="col-span-6 border-r border-slate-500 p-2 font-semibold">Reported By</div><div className="col-span-6 p-1"><input className="h-10 w-full border border-slate-500 px-3" value={reportedBy} onChange={(e) => setReportedBy(e.target.value)} /></div></div>
            <div className="grid grid-cols-12 border border-slate-500"><div className="col-span-6 border-r border-slate-500 p-2 font-semibold">Date of Report</div><div className="col-span-6 p-2">{timestamp ? new Date(timestamp).toLocaleDateString('en-GB') : ''}</div></div>
            <div className="grid grid-cols-12 border border-slate-500"><div className="col-span-6 border-r border-slate-500 p-2 font-semibold">Title / Role</div><div className="col-span-6 p-1"><input className="h-10 w-full border border-slate-500 px-3" value={titleRole} onChange={(e) => setTitleRole(e.target.value)} /></div></div>

            <h4 className="text-center text-2xl font-semibold text-blue-900 underline">Incident Information</h4>
            <div className="grid grid-cols-12 border border-slate-500"><div className="col-span-6 border-r border-slate-500 p-2 font-semibold">Incident Type</div><div className="col-span-6 p-2">{alertDetails?.type || 'Criminal activity'}</div></div>
            <div className="grid grid-cols-12 border border-slate-500"><div className="col-span-6 border-r border-slate-500 p-2 font-semibold">Date & Time of Incident</div><div className="col-span-6 p-2">{timestamp ? new Date(timestamp).toLocaleString('en-GB') : ''}</div></div>
            <div className="grid grid-cols-12 border border-slate-500"><div className="col-span-6 border-r border-slate-500 p-2 font-semibold">Location</div><div className="col-span-6 p-2">{locationText}</div></div>
            <div className="grid grid-cols-12 border border-slate-500"><div className="col-span-6 border-r border-slate-500 p-2 font-semibold">City / Site</div><div className="col-span-6 p-1"><input className="h-10 w-full border border-slate-500 px-3" value={citySite} onChange={(e) => setCitySite(e.target.value)} /></div></div>
            <div className="grid grid-cols-12 border border-slate-500"><div className="col-span-6 border-r border-slate-500 p-2 font-semibold">Specific Area</div><div className="col-span-6 p-1"><input className="h-10 w-full border border-slate-500 px-3" value={specificArea} onChange={(e) => setSpecificArea(e.target.value)} /></div></div>

            <p className="text-center text-2xl font-semibold text-blue-900 underline">Description of Incident</p>
            <textarea className="min-h-[220px] w-full border border-slate-500 p-3" value={description} onChange={(e) => setDescription(e.target.value)} />

            <p className="text-center text-2xl font-semibold text-blue-900 underline">Suspects</p>
            <div className="grid grid-cols-12 border border-slate-500"><div className="col-span-6 border-r border-slate-500 p-2 font-semibold">1. Name / Role / Contact</div><div className="col-span-6 p-1"><input className="h-10 w-full border border-slate-500 px-3" value={suspect1} onChange={(e) => setSuspect1(e.target.value)} /></div></div>
            <div className="grid grid-cols-12 border border-slate-500"><div className="col-span-6 border-r border-slate-500 p-2 font-semibold">2. Name / Role / Contact</div><div className="col-span-6 p-1"><input className="h-10 w-full border border-slate-500 px-3" value={suspect2} onChange={(e) => setSuspect2(e.target.value)} /></div></div>
            <div className="grid grid-cols-12 border border-slate-500"><div className="col-span-6 border-r border-slate-500 p-2 font-semibold">Unapprehended Suspects</div><div className="col-span-6 p-1"><input className="h-10 w-full border border-slate-500 px-3" value={unapprehended} onChange={(e) => setUnapprehended(e.target.value)} /></div></div>

            <p className="text-center text-2xl font-semibold text-blue-900 underline">Witnesses / Victims</p>
            <div className="grid grid-cols-12 border border-slate-500"><div className="col-span-6 border-r border-slate-500 p-2 font-semibold">1. Name / Contact / Relationship</div><div className="col-span-6 p-1"><input className="h-10 w-full border border-slate-500 px-3" value={witness1} onChange={(e) => setWitness1(e.target.value)} /></div></div>
            <div className="grid grid-cols-12 border border-slate-500"><div className="col-span-6 border-r border-slate-500 p-2 font-semibold">2. Name / Contact / Relationship</div><div className="col-span-6 p-1"><input className="h-10 w-full border border-slate-500 px-3" value={witness2} onChange={(e) => setWitness2(e.target.value)} /></div></div>

            <p className="text-center text-2xl font-semibold text-blue-900 underline">Police Information</p>
            <div className="grid grid-cols-12 border border-slate-500"><div className="col-span-4 border-r border-slate-500 p-2 font-semibold">Police CAS Number</div><div className="col-span-8 p-1"><input className="h-10 w-full border border-slate-500 px-3" value={policeCas} onChange={(e) => setPoliceCas(e.target.value)} /></div></div>
            <div className="grid grid-cols-12 border border-slate-500"><div className="col-span-4 border-r border-slate-500 p-2 font-semibold">Station / Precinct</div><div className="col-span-8 p-1"><input className="h-10 w-full border border-slate-500 px-3" value={station} onChange={(e) => setStation(e.target.value)} /></div></div>
            <div className="grid grid-cols-12 border border-slate-500"><div className="col-span-4 border-r border-slate-500 p-2 font-semibold">Reporting Officer</div><div className="col-span-8 p-1"><input className="h-10 w-full border border-slate-500 px-3" value={officer} onChange={(e) => setOfficer(e.target.value)} /></div></div>
            <div className="grid grid-cols-12 border border-slate-500"><div className="col-span-4 border-r border-slate-500 p-2 font-semibold">Contact Number</div><div className="col-span-8 p-1"><input className="h-10 w-full border border-slate-500 px-3" value={policeContact} onChange={(e) => setPoliceContact(e.target.value)} /></div></div>

            <p className="text-center text-2xl font-semibold text-blue-900 underline">Follow-up Action</p>
            <div className="grid grid-cols-12 border border-slate-500"><div className="col-span-5 border-r border-slate-500 p-2 font-semibold">Action Taken / Required</div><div className="col-span-7 p-1"><input className="h-10 w-full border border-slate-500 px-3" value={actionTaken} onChange={(e) => setActionTaken(e.target.value)} /></div></div>
            <div className="grid grid-cols-12 border border-slate-500"><div className="col-span-5 border-r border-slate-500 p-2 font-semibold">Responsible Person</div><div className="col-span-7 p-1"><input className="h-10 w-full border border-slate-500 px-3" value={responsiblePerson} onChange={(e) => setResponsiblePerson(e.target.value)} /></div></div>

            <div className="space-y-2 border border-slate-500 p-3">
              <p className="font-semibold text-slate-800">Annexure A (Picture/Video Evidence)</p>
              <div className="grid grid-cols-2 gap-2 border border-slate-500 p-2 text-xs">
                <div><span className="font-semibold">Alert ID:</span> {alertDetails?.id || 'N/A'}</div>
                <div><span className="font-semibold">Type:</span> {alertDetails?.type || 'N/A'}</div>
                <div><span className="font-semibold">Severity:</span> {alertDetails?.severity || 'N/A'}</div>
                <div><span className="font-semibold">Location:</span> {locationText}</div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {annexureScreenshots.map((shot, idx) => (
                  <div key={`${shot.url}-${idx}`} className="border border-slate-500 p-2">
                    <div className="text-xs font-semibold mb-1">Screenshot {idx + 1}</div>
                    <img src={shot.url} alt={`Screenshot ${idx + 1}`} className="w-full h-36 object-cover border border-slate-500" />
                  </div>
                ))}
                {annexureVideos.map((video, idx) => (
                  <div key={`${video.url}-${idx}`} className="border border-slate-500 p-2">
                    <div className="text-xs font-semibold mb-1">{video.label || `Video ${idx + 1}`}</div>
                    {video.url ? (
                      <video controls className="w-full h-36 bg-black border border-slate-500">
                        <source src={video.url} />
                      </video>
                    ) : (
                      <div className="h-36 border border-slate-500 flex items-center justify-center text-xs text-slate-500">No video URL</div>
                    )}
                  </div>
                ))}
                {annexureScreenshots.length === 0 && annexureVideos.length === 0 ? (
                  <div className="col-span-2 border border-slate-500 p-4 text-center text-xs text-slate-600">
                    No evidence media attached on this alert.
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
