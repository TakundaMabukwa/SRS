'use client'

import { formatReportDateTime, getReportVehicleDisplayText, getReportVehicleRegistrationText, ReportAlertDetails, ReportDriverInfo } from './report-support'

interface EvidenceAnnexureProps {
  title?: string
  alertDetails?: ReportAlertDetails
  driverInfo: ReportDriverInfo
  locationText: string
  screenshots: Array<{ url: string; timestamp?: string; channel?: number }>
  videos: Array<{ key?: string; label?: string; url?: string; channel?: number }>
}

export default function EvidenceAnnexure({
  title = 'Annexure A (Picture/Video Evidence)',
  alertDetails,
  driverInfo,
  locationText,
  screenshots,
  videos,
}: EvidenceAnnexureProps) {
  const formatCameraLabel = (channel?: number, fallback?: string) => {
    if (channel && Number.isFinite(channel) && channel > 0) return `Camera CH${channel}`
    return fallback || 'Camera'
  }

  return (
    <div className="space-y-2 border border-slate-500 p-3">
      <p className="font-semibold text-slate-800">{title}</p>
      <div className="grid grid-cols-2 gap-2 border border-slate-500 p-2 text-xs">
        <div><span className="font-semibold">Alert ID:</span> {alertDetails?.id || 'N/A'}</div>
        <div><span className="font-semibold">Vehicle:</span> {getReportVehicleDisplayText(driverInfo)}</div>
        <div><span className="font-semibold">Driver:</span> {driverInfo.name || 'N/A'}</div>
        <div><span className="font-semibold">Type:</span> {alertDetails?.type || 'N/A'}</div>
        <div><span className="font-semibold">Fleet Number:</span> {driverInfo.fleetNumber || 'N/A'}</div>
        <div><span className="font-semibold">Registration:</span> {getReportVehicleRegistrationText(driverInfo.registration) || 'N/A'}</div>
        <div><span className="font-semibold">Severity:</span> {alertDetails?.severity || 'N/A'}</div>
        <div><span className="font-semibold">Timestamp:</span> {formatReportDateTime(alertDetails?.timestamp || driverInfo.timestamp) || 'N/A'}</div>
        <div className="col-span-2"><span className="font-semibold">Location:</span> {locationText}</div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {screenshots.map((shot, idx) => (
          <div key={`${shot.url}-${idx}`} className="border border-slate-500 p-2">
            <div className="mb-1 text-xs font-semibold">{formatCameraLabel(shot.channel, `Screenshot ${idx + 1}`)}</div>
            <img src={shot.url} alt={`Screenshot ${idx + 1}`} className="h-36 w-full border border-slate-500 object-cover" />
            {shot.timestamp ? <div className="mt-1 text-[10px] text-slate-500">{formatReportDateTime(shot.timestamp) || shot.timestamp}</div> : null}
          </div>
        ))}
        {videos.map((video, idx) => (
          <div key={`${video.url}-${idx}`} className="border border-slate-500 p-2">
            <div className="mb-1 text-xs font-semibold">
              {video.label || `${formatCameraLabel(video.channel, 'Video')} Link`}
            </div>
            {video.url ? (
              <div className="space-y-2 border border-slate-500 p-3 text-xs">
                <p className="font-medium text-slate-700">{formatCameraLabel(video.channel, 'Video')} link</p>
                <a
                  href={video.url}
                  target="_blank"
                  rel="noreferrer"
                  className="break-all text-blue-700 underline"
                >
                  {video.url}
                </a>
              </div>
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
