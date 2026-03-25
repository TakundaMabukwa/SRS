'use client'

import { ReportAlertDetails, ReportDriverInfo } from './report-support'

interface EvidenceAnnexureProps {
  title?: string
  alertDetails?: ReportAlertDetails
  driverInfo: ReportDriverInfo
  locationText: string
  screenshots: Array<{ url: string; timestamp?: string }>
  videos: Array<{ key?: string; label?: string; url?: string }>
}

export default function EvidenceAnnexure({
  title = 'Annexure A (Picture/Video Evidence)',
  alertDetails,
  driverInfo,
  locationText,
  screenshots,
  videos,
}: EvidenceAnnexureProps) {
  return (
    <div className="space-y-2 border border-slate-500 p-3">
      <p className="font-semibold text-slate-800">{title}</p>
      <div className="grid grid-cols-2 gap-2 border border-slate-500 p-2 text-xs">
        <div><span className="font-semibold">Alert ID:</span> {alertDetails?.id || 'N/A'}</div>
        <div><span className="font-semibold">Vehicle:</span> {driverInfo.fleetNumber || 'N/A'}</div>
        <div><span className="font-semibold">Driver:</span> {driverInfo.name || 'N/A'}</div>
        <div><span className="font-semibold">Type:</span> {alertDetails?.type || 'N/A'}</div>
        <div><span className="font-semibold">Severity:</span> {alertDetails?.severity || 'N/A'}</div>
        <div><span className="font-semibold">Timestamp:</span> {alertDetails?.timestamp || driverInfo.timestamp || 'N/A'}</div>
        <div className="col-span-2"><span className="font-semibold">Location:</span> {locationText}</div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {screenshots.map((shot, idx) => (
          <div key={`${shot.url}-${idx}`} className="border border-slate-500 p-2">
            <div className="mb-1 text-xs font-semibold">Screenshot {idx + 1}</div>
            <img src={shot.url} alt={`Screenshot ${idx + 1}`} className="h-36 w-full border border-slate-500 object-cover" />
            {shot.timestamp ? <div className="mt-1 text-[10px] text-slate-500">{shot.timestamp}</div> : null}
          </div>
        ))}
        {videos.map((video, idx) => (
          <div key={`${video.url}-${idx}`} className="border border-slate-500 p-2">
            <div className="mb-1 text-xs font-semibold">{video.label || `Video ${idx + 1}`}</div>
            {video.url ? (
              <video controls className="h-36 w-full border border-slate-500 bg-black">
                <source src={video.url} />
              </video>
            ) : (
              <div className="flex h-36 items-center justify-center border border-slate-500 text-xs text-slate-500">
                No video URL
              </div>
            )}
          </div>
        ))}
        {screenshots.length === 0 && videos.length === 0 ? (
          <div className="col-span-2 border border-slate-500 p-4 text-center text-xs text-slate-600">
            No evidence media attached on this alert.
          </div>
        ) : null}
      </div>
    </div>
  )
}
