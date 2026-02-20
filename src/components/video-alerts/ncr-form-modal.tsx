'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Printer, X } from 'lucide-react'

interface AlertDetails {
  id?: string
  type?: string
  severity?: string
  timestamp?: string
  location?: { latitude?: number; longitude?: number; address?: string } | string
  screenshots?: Array<{ url: string; timestamp?: string }>
}

interface NCRFormModalProps {
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

export default function NCRFormModal({ isOpen, onClose, driverInfo, alertDetails }: NCRFormModalProps) {
  const locationText =
    typeof alertDetails?.location === 'string'
      ? alertDetails.location
      : alertDetails?.location?.latitude && alertDetails?.location?.longitude
      ? `${alertDetails.location.latitude}, ${alertDetails.location.longitude}`
      : driverInfo.location || 'Unknown location'

  const [formData, setFormData] = useState({
    description: `Alert ${alertDetails?.id || ''} generated for driver ${driverInfo.name} on fleet ${driverInfo.fleetNumber} at ${new Date(driverInfo.timestamp).toLocaleString()} (${locationText}). Further investigation required.`,
    correctiveAction: 'Immediate disciplinary hearing scheduled. Counseling on speed limits.',
    correctiveResponsibility: 'Divan/Manie',
    correctiveTargetDate: '04/01/2025',
    preventiveAction: 'Driver retraining module on Heavy Vehicle Speed regulations.',
    preventiveResponsibility: 'Training Dept',
    preventiveTargetDate: '10/01/2025',
    investigator: 'Werner',
    manager: 'Divan',
    actionTaken: '',
    actionEffective: ''
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!isOpen) return
    setFormData((prev) => ({
      ...prev,
      description: `Alert ${alertDetails?.id || ''} generated for driver ${driverInfo.name} on fleet ${driverInfo.fleetNumber} at ${new Date(driverInfo.timestamp).toLocaleString()} (${locationText}). Further investigation required.`
    }))
  }, [isOpen, alertDetails?.id, driverInfo.name, driverInfo.fleetNumber, driverInfo.timestamp, locationText])

  const handleSave = async () => {
    setSaving(true)
    try {
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()
      
      const element = document.getElementById('ncr-form-content')
      if (!element) throw new Error('Form content not found')
      
      const html2canvas = (await import('html2canvas')).default
      const jsPDF = (await import('jspdf')).default
      
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        windowWidth: element.scrollWidth,
        windowHeight: element.scrollHeight,
        onclone: (clonedDoc) => {
          const clonedElement = clonedDoc.getElementById('ncr-form-content')
          if (clonedElement) {
            const allElements = clonedElement.querySelectorAll('*')
            allElements.forEach((el: Element) => {
              const computed = window.getComputedStyle(el)
              if (computed.borderColor && computed.borderColor.includes('oklch')) {
                el.style.borderColor = '#000'
              }
              if (computed.color && computed.color.includes('oklch')) {
                el.style.color = '#000'
              }
              if (computed.backgroundColor && computed.backgroundColor.includes('oklch')) {
                el.style.backgroundColor = '#fff'
              }
            })
          }
        }
      })
      
      const imgData = canvas.toDataURL('image/png')
      const pdf = new jsPDF('p', 'mm', 'a4')
      const pdfWidth = pdf.internal.pageSize.getWidth()
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width
      
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight)
      const pdfBlob = pdf.output('blob')
      
      const fileName = `NCR-${driverInfo.fleetNumber}-${Date.now()}.pdf`
      
      // Download the PDF
      pdf.save(fileName)
      
      const { error: uploadError } = await supabase.storage
        .from('reports')
        .upload(fileName, pdfBlob, { contentType: 'application/pdf' })
      
      if (uploadError) throw uploadError
      
      const { data: { publicUrl } } = supabase.storage.from('reports').getPublicUrl(fileName)
      
      const { error: dbError } = await supabase.from('reports').insert({
        vehicle_registration: driverInfo.fleetNumber,
        driver_name: driverInfo.name,
        priority: 'High',
        document_url: publicUrl,
        report_type: 'NCR'
      })
      
      if (dbError) throw dbError
      
      alert('NCR Report saved successfully!')
      onClose()
    } catch (err) {
      console.error('Error saving report:', err)
      alert('Failed to save report: ' + (err?.message || JSON.stringify(err)))
    } finally {
      setSaving(false)
    }
  }

  const handlePrint = () => {
    window.print()
  }

  return isOpen ? (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-2xl w-[90vw] h-[85vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b flex-shrink-0">
          <h2 className="text-xl font-bold">NCR Form - {driverInfo.name}</h2>
          <div className="flex gap-2">
            <Button size="sm" variant="default" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save Report'}
            </Button>
            <Button size="sm" variant="outline" onClick={handlePrint}>
              <Printer className="w-4 h-4 mr-2" />
              Print
            </Button>
            <Button size="sm" variant="ghost" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-8">
          <div id="ncr-form-content" style={{border: '2px solid #000', color: '#000'}}>
            <style>{`
              #ncr-form-content .border-black { border-color: #000 !important; }
              #ncr-form-content .border-b-2 { border-bottom-width: 2px !important; }
              #ncr-form-content .border-b { border-bottom-width: 1px !important; }
              #ncr-form-content .border-r { border-right-width: 1px !important; }
              #ncr-form-content .border-t { border-top-width: 1px !important; }
            `}</style>
            {/* HEADER */}
            <div className="flex border-b-2 border-black">
              <div className="w-1/4 border-r border-black p-2 flex items-center justify-center">
                <h1 className="text-3xl font-black" style={{color: '#dc2626'}}>SRS</h1>
              </div>
              <div className="w-1/2 border-r border-black">
                <div className="border-b border-black p-1 text-center font-bold text-lg" style={{backgroundColor: '#e2e8f0'}}>SRS LOGISTICS SOLUTIONS</div>
                <div className="border-b border-black p-2 text-center font-bold" style={{backgroundColor: '#f1f5f9'}}>Risk Non – Conformance Report</div>
                <div className="p-2 text-center text-sm">Meyerton</div>
              </div>
              <div className="w-1/4 text-[10px]">
                <div className="flex border-b border-black">
                  <div className="w-1/2 p-1 border-r border-black font-bold" style={{backgroundColor: '#e2e8f0'}}>Document Number</div>
                  <div className="w-1/2 p-1 text-center font-mono">Non-Conformance-00</div>
                </div>
                <div className="flex border-b border-black">
                  <div className="w-1/2 p-1 border-r border-black font-bold" style={{backgroundColor: '#e2e8f0'}}>Revision / Date</div>
                  <div className="w-1/2 p-1 text-center">{new Date().toLocaleDateString('en-GB')}</div>
                </div>
                <div className="flex border-b border-black">
                  <div className="w-1/2 p-1 border-r border-black font-bold" style={{backgroundColor: '#e2e8f0'}}>Page Number</div>
                  <div className="w-1/2 p-1 text-center">Page 1 of 1</div>
                </div>
              </div>
            </div>

            {/* Implicated Entity - READ ONLY */}
            <div className="border-b-2 border-black">
              <div className="font-bold px-2 py-1 text-xs border-b border-black" style={{backgroundColor: '#cbd5e1'}}>Implicated Entity Information</div>
              <table className="w-full text-xs">
                <tbody>
                  <tr className="border-b border-black">
                    <td className="w-[15%] p-1 border-r border-black font-semibold" style={{backgroundColor: '#f1f5f9'}}>Name</td>
                    <td className="w-[35%] p-1 border-r border-black" style={{backgroundColor: '#f9fafb'}}>{driverInfo.name}</td>
                    <td className="w-[15%] p-1 border-r border-black font-semibold" style={{backgroundColor: '#f1f5f9'}}>Department</td>
                    <td className="w-[35%] p-1" style={{backgroundColor: '#f9fafb'}}>{driverInfo.department || 'Fleet Operations'}</td>
                  </tr>
                  <tr>
                    <td className="p-1 border-r border-black font-semibold" style={{backgroundColor: '#f1f5f9'}}>Vehicle Fleet No</td>
                    <td className="p-1 border-r border-black font-bold" style={{backgroundColor: '#f9fafb'}}>{driverInfo.fleetNumber}</td>
                    <td className="p-1 border-r border-black font-semibold" style={{backgroundColor: '#f1f5f9'}}>Date/Time</td>
                    <td className="p-1" style={{backgroundColor: '#f9fafb'}}>{new Date(driverInfo.timestamp).toLocaleString('en-GB')}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Alert Evidence - READ ONLY */}
            {alertDetails && (
              <div className="border-b-2 border-black">
                <div className="font-bold px-2 py-1 text-xs border-b border-black" style={{backgroundColor: '#cbd5e1'}}>Alert Evidence Attached</div>
                <table className="w-full text-xs">
                  <tbody>
                    <tr className="border-b border-black">
                      <td className="w-[15%] p-1 border-r border-black font-semibold" style={{backgroundColor: '#f1f5f9'}}>Alert ID</td>
                      <td className="w-[35%] p-1 border-r border-black">{alertDetails.id || 'N/A'}</td>
                      <td className="w-[15%] p-1 border-r border-black font-semibold" style={{backgroundColor: '#f1f5f9'}}>Type</td>
                      <td className="w-[35%] p-1">{alertDetails.type || 'N/A'}</td>
                    </tr>
                    <tr className="border-b border-black">
                      <td className="p-1 border-r border-black font-semibold" style={{backgroundColor: '#f1f5f9'}}>Severity</td>
                      <td className="p-1 border-r border-black">{alertDetails.severity || 'N/A'}</td>
                      <td className="p-1 border-r border-black font-semibold" style={{backgroundColor: '#f1f5f9'}}>Timestamp</td>
                      <td className="p-1">{alertDetails.timestamp ? new Date(alertDetails.timestamp).toLocaleString('en-GB') : 'N/A'}</td>
                    </tr>
                    <tr>
                      <td className="p-1 border-r border-black font-semibold" style={{backgroundColor: '#f1f5f9'}}>Location</td>
                      <td className="p-1 border-r border-black" colSpan={3}>{locationText}</td>
                    </tr>
                  </tbody>
                </table>
                {Array.isArray(alertDetails.screenshots) && alertDetails.screenshots.length > 0 && (
                  <div className="grid grid-cols-3 gap-2 p-2 border-t border-black">
                    {alertDetails.screenshots.slice(0, 3).map((shot, idx) => (
                      <div key={`${shot.url}-${idx}`} className="border border-black p-1">
                        <img src={shot.url} alt={`Evidence ${idx + 1}`} style={{width: '100%', height: '80px', objectFit: 'cover'}} />
                        <div className="text-[10px] mt-1">
                          {shot.timestamp ? new Date(shot.timestamp).toLocaleTimeString('en-GB') : `Image ${idx + 1}`}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Description - EDITABLE */}
            <div className="border-b-2 border-black">
              <div className="font-bold px-2 py-1 text-xs border-b border-black" style={{backgroundColor: '#cbd5e1'}}>Description of Non-Conformance</div>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                style={{width: '100%', padding: '0.5rem', fontSize: '0.75rem', minHeight: '120px', border: 'none', outline: 'none', resize: 'none'}}
              />
            </div>

            {/* Classification */}
            <div className="border-b-2 border-black">
              <div className="font-bold px-2 py-1 text-xs border-b border-black uppercase" style={{backgroundColor: "#cbd5e1"}}>Classification of Non-Conformance</div>
              <div className="grid grid-cols-4 gap-0 text-[10px]">
                <div className="border-r border-b border-black p-1">Injury</div>
                <div className="border-r border-b border-black p-1 flex items-center justify-between">Negligence of Driver</div>
                <div className="border-r border-b border-black p-1 flex items-center justify-between">Insubordination</div>
                <div className="border-b border-black p-1 flex items-center justify-between" style={{backgroundColor: "#fef3c7"}}>Speeding Violation ✓</div>
                <div className="border-r border-b border-black p-1 flex items-center justify-between" style={{backgroundColor: "#fef3c7"}}>Reckless Driving</div>
                <div className="border-r border-b border-black p-1">Poor Fatigue Management</div>
                <div className="border-r border-b border-black p-1">Carrying Unauthorized Passenger</div>
                <div className="border-b border-black p-1 flex items-center justify-between" style={{backgroundColor: "#fef3c7"}}>Traffic Violation ✓</div>
                <div className="border-r border-black p-1">Customer Complaints</div>
                <div className="border-r border-black p-1">External / Community Complaints</div>
                <div className="border-r border-black p-1">Other:</div>
                <div className="border-black p-1">Inadequate Loading Equipment</div>
              </div>
            </div>

            {/* Root Cause Analysis */}
            <div className="border-b-2 border-black">
              <div className="font-bold px-2 py-1 text-xs border-b border-black" style={{backgroundColor: "#cbd5e1"}}>ROOT CAUSE ANALYSIS</div>
              <div className="grid grid-cols-3 text-[10px]">
                <div className="border-r border-b border-black font-bold p-1 text-center" style={{backgroundColor: "#f8fafc"}}>Unsafe Acts</div>
                <div className="border-r border-b border-black font-bold p-1 text-center" style={{backgroundColor: "#f8fafc"}}>Unsafe Conditions</div>
                <div className="border-b border-black font-bold p-1 text-center" style={{backgroundColor: "#f8fafc"}}>Personal Factors</div>
                <div className="border-r border-b border-black p-1">Operating without authority</div>
                <div className="border-r border-b border-black p-1 font-bold" style={{backgroundColor: "#fef3c7"}}>Improper attitude or motivation</div>
                <div className="border-b border-black p-1">Physical/Mental incompatibility</div>
                <div className="border-r border-b border-black p-1 font-bold" style={{backgroundColor: "#fef3c7"}}>Taking an unsafe position</div>
                <div className="border-r border-b border-black p-1">Lack of knowledge or skill</div>
                <div className="border-b border-black p-1 font-bold" style={{backgroundColor: "#fef3c7"}}>Operating at unsafe speed</div>
                <div className="border-r border-b border-black p-1">Hazardous arrangement</div>
                <div className="border-r border-b border-black p-1">Ignoring SHE Regulations</div>
                <div className="border-b border-black p-1">Ignoring Road Traffic Act</div>
              </div>
              <div className="flex border-t border-black text-xs">
                <div className="p-1 font-bold w-1/4 border-r border-black">RISK RATING</div>
                <div className="flex-1 flex">
                  <div className="flex-1 border-r border-black p-1 flex justify-between" style={{backgroundColor: "#fef3c7"}}>High Risk <span className="font-bold">X</span></div>
                  <div className="flex-1 border-r border-black p-1 flex justify-between">Medium Risk</div>
                  <div className="flex-1 p-1 flex justify-between">Low Risk</div>
                </div>
              </div>
            </div>

            {/* Actions - EDITABLE */}
            <div className="border-b-2 border-black">
              <div className="font-bold px-2 py-1 text-xs border-b border-black" style={{backgroundColor: "#cbd5e1"}}>C: ACTION PLAN</div>
              <div className="grid grid-cols-12 border-b border-black text-xs">
                <div className="col-span-6 p-2 border-r border-black">
                  <label className="font-bold block mb-1">Corrective Action:</label>
                  <textarea
                    value={formData.correctiveAction}
                    onChange={(e) => setFormData({...formData, correctiveAction: e.target.value})}
                    style={{width: '100%', padding: '0.5rem', fontSize: '0.75rem', minHeight: '60px', border: '1px solid #d1d5db', borderRadius: '0.25rem'}}
                  />
                </div>
                <div className="col-span-3 p-2 border-r border-black">
                  <span className="font-bold block mb-1">Responsibility</span>
                  <input
                    type="text"
                    value={formData.correctiveResponsibility}
                    onChange={(e) => setFormData({...formData, correctiveResponsibility: e.target.value})}
                    style={{width: '100%', padding: '0.25rem', fontSize: '0.75rem', border: '1px solid #d1d5db', borderRadius: '0.25rem'}}
                  />
                </div>
                <div className="col-span-3 p-2">
                  <span className="font-bold block mb-1">Target Date</span>
                  <input
                    type="text"
                    value={formData.correctiveTargetDate}
                    onChange={(e) => setFormData({...formData, correctiveTargetDate: e.target.value})}
                    style={{width: '100%', padding: '0.25rem', fontSize: '0.75rem', border: '1px solid #d1d5db', borderRadius: '0.25rem'}}
                  />
                </div>
              </div>
              <div className="grid grid-cols-12 text-xs">
                <div className="col-span-6 p-2 border-r border-black">
                  <label className="font-bold block mb-1">Preventive Action:</label>
                  <textarea
                    value={formData.preventiveAction}
                    onChange={(e) => setFormData({...formData, preventiveAction: e.target.value})}
                    style={{width: '100%', padding: '0.5rem', fontSize: '0.75rem', minHeight: '60px', border: '1px solid #d1d5db', borderRadius: '0.25rem'}}
                  />
                </div>
                <div className="col-span-3 p-2 border-r border-black">
                  <span className="font-bold block mb-1">Responsibility</span>
                  <input
                    type="text"
                    value={formData.preventiveResponsibility}
                    onChange={(e) => setFormData({...formData, preventiveResponsibility: e.target.value})}
                    style={{width: '100%', padding: '0.25rem', fontSize: '0.75rem', border: '1px solid #d1d5db', borderRadius: '0.25rem'}}
                  />
                </div>
                <div className="col-span-3 p-2">
                  <span className="font-bold block mb-1">Target Date</span>
                  <input
                    type="text"
                    value={formData.preventiveTargetDate}
                    onChange={(e) => setFormData({...formData, preventiveTargetDate: e.target.value})}
                    style={{width: '100%', padding: '0.25rem', fontSize: '0.75rem', border: '1px solid #d1d5db', borderRadius: '0.25rem'}}
                  />
                </div>
              </div>
            </div>

            {/* Sign Off - EDITABLE */}
            <div className="text-xs">
              <div className="font-bold px-2 py-1 border-b border-black" style={{backgroundColor: "#cbd5e1"}}>D: FEEDBACK</div>
              <div className="grid grid-cols-12 border-b border-black">
                <div className="col-span-2 p-2 font-bold border-r border-black" style={{backgroundColor: "#f1f5f9"}}>ACTION TAKEN</div>
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
                <div className="col-span-2 p-2 font-bold border-r border-black" style={{backgroundColor: "#f1f5f9"}}>ACTION EFFECTIVE</div>
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
                  <input
                    type="text"
                    value={formData.investigator}
                    onChange={(e) => setFormData({...formData, investigator: e.target.value})}
                    style={{width: '100%', padding: '0.25rem', border: '1px solid #d1d5db', borderRadius: '0.25rem'}}
                  />
                </div>
                <div className="col-span-1 p-2 border-r border-black" style={{backgroundColor: "#f8fafc"}}>Date</div>
                <div className="col-span-2 p-2 border-r border-black font-mono">{new Date().toLocaleDateString('en-GB')}</div>
                <div className="col-span-2 p-2 border-r border-black">Manager</div>
                <div className="col-span-2 p-2">
                  <input
                    type="text"
                    value={formData.manager}
                    onChange={(e) => setFormData({...formData, manager: e.target.value})}
                    style={{width: '100%', padding: '0.25rem', border: '1px solid #d1d5db', borderRadius: '0.25rem'}}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  ) : null
}
