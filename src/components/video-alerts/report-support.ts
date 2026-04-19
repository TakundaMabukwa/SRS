'use client'

import { normalizeBackendMediaUrl, resolveMediaUrlForCurrentOrigin } from '@/lib/video-alert-playback'

export interface ReportAlertDetails {
  id?: string
  type?: string
  severity?: string
  timestamp?: string
  location?: { latitude?: number; longitude?: number; address?: string } | string
  screenshots?: Array<{ url?: string; timestamp?: string; storage_url?: string; signed_url?: string; image_url?: string; channel?: number }>
  videos?: Array<{ key?: string; label?: string; url?: string; src?: string; path?: string; channel?: number }>
}

export interface ReportDriverInfo {
  name: string
  fleetNumber: string
  registration?: string
  department?: string
  timestamp: string
  location?: string
}

function cleanText(value?: string | null): string {
  return String(value || '').trim()
}

export function isRawVehicleIdentifier(value?: string | null): boolean {
  const clean = cleanText(value)
  return !!clean && /^\d{8,}$/.test(clean)
}

export function getReportVehicleRegistrationText(value?: string | null): string {
  const clean = cleanText(value)
  if (!clean || isRawVehicleIdentifier(clean)) return ''
  return clean
}

export type ScreenshotInput = {
  url?: string
  storage_url?: string
  signed_url?: string
  image_url?: string
  timestamp?: string
  channel?: number
}

export type VideoInput = {
  key?: string
  label?: string
  url?: string
  src?: string
  path?: string
  channel?: number
}

export interface SavedAlertArtifact {
  documentUrl: string
  documentName: string
  documentType: string
  bundleUrl?: string
  closurePayload: Record<string, any>
}

export function resolveReportLocationText(
  location: ReportAlertDetails['location'],
  fallback?: string
): string {
  if (typeof location === 'string' && location.trim()) return location.trim()
  const locationObject =
    location && typeof location === 'object' ? location : undefined
  if (locationObject?.address) return String(locationObject.address)
  if (locationObject?.latitude !== undefined && locationObject?.longitude !== undefined) {
    return `${locationObject.latitude}, ${locationObject.longitude}`
  }
  return fallback || 'Unknown location'
}

export function normalizeReportScreenshots(
  input?: ReportAlertDetails['screenshots']
): Array<{ url: string; timestamp?: string; channel?: number }> {
  const screenshots = Array.isArray(input) ? (input as ScreenshotInput[]) : []
  const out: Array<{ url: string; timestamp?: string; channel?: number }> = []
  const seen = new Set<string>()
  for (const shot of screenshots) {
    const rawUrl = String(shot?.url || shot?.storage_url || shot?.signed_url || shot?.image_url || '').trim()
    const url = toResolvedMediaUrl(rawUrl)
    if (!url || (!/^https?:\/\//i.test(url) && !url.startsWith('/'))) continue
    if (seen.has(url)) continue
    seen.add(url)
    const channel = Number(shot?.channel || 0)
    out.push({ url, timestamp: shot?.timestamp, channel: Number.isFinite(channel) && channel > 0 ? channel : undefined })
  }
  return out.sort((a, b) => {
    const channelDelta = Number(a.channel || Number.MAX_SAFE_INTEGER) - Number(b.channel || Number.MAX_SAFE_INTEGER)
    if (channelDelta !== 0) return channelDelta
    return String(a.timestamp || '').localeCompare(String(b.timestamp || ''))
  })
}

export function normalizeReportVideos(
  input?: ReportAlertDetails['videos']
): Array<{ key?: string; label?: string; url?: string; channel?: number }> {
  const videos = Array.isArray(input) ? (input as VideoInput[]) : []
  const out: Array<{ key?: string; label?: string; url?: string; channel?: number }> = []
  const seen = new Set<string>()
  for (const video of videos) {
    const rawUrl = String(video?.url || video?.src || video?.path || '').trim()
    const url = toResolvedMediaUrl(rawUrl)
    if (!url || (!/^https?:\/\//i.test(url) && !url.startsWith('/'))) continue
    if (seen.has(url)) continue
    seen.add(url)
    const inferredChannel = inferMediaChannel(video)
    out.push({ key: video?.key, label: video?.label, url, channel: inferredChannel || undefined })
  }
  return out.sort((a, b) => {
    const channelDelta = Number(a.channel || Number.MAX_SAFE_INTEGER) - Number(b.channel || Number.MAX_SAFE_INTEGER)
    if (channelDelta !== 0) return channelDelta
    return String(a.label || '').localeCompare(String(b.label || ''))
  })
}

function inferMediaChannel(value: { channel?: number; label?: string; key?: string; url?: string; src?: string; path?: string }) {
  const candidates = [
    Number(value?.channel || 0),
    Number(String(value?.label || '').match(/\bch(?:annel)?\s*([1-9]\d*)\b/i)?.[1] || 0),
    Number(String(value?.key || '').match(/\bch(?:annel)?[_-]?([1-9]\d*)\b/i)?.[1] || 0),
    Number(String(value?.url || value?.src || value?.path || '').match(/channel[_-](\d+)/i)?.[1] || 0),
  ]
  for (const candidate of candidates) {
    if (Number.isFinite(candidate) && candidate > 0) return candidate
  }
  return null
}

function sanitizePathSegment(value: string): string {
  return String(value || '')
    .trim()
    .replace(/[^a-z0-9._-]+/gi, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'artifact'
}

function toResolvedMediaUrl(url?: string): string {
  const clean = String(url || '').trim()
  if (!clean) return ''
  try {
    if (/^https?:\/\//i.test(clean)) {
      const parsed = new URL(clean)
      if (parsed.pathname.startsWith('/api/video-server/')) {
        return resolveMediaUrlForCurrentOrigin(`${parsed.pathname}${parsed.search || ''}`)
      }
      if (parsed.pathname.startsWith('/api/')) {
        return resolveMediaUrlForCurrentOrigin(`/api/video-server${parsed.pathname.slice(4)}${parsed.search || ''}`)
      }
    }
  } catch {
    // Fall through to standard normalization.
  }
  return resolveMediaUrlForCurrentOrigin(normalizeBackendMediaUrl(clean))
}

export function getReportVehicleDisplayText(driverInfo: ReportDriverInfo): string {
  const fleet = cleanText(driverInfo.fleetNumber)
  const registration = getReportVehicleRegistrationText(driverInfo.registration)
  if (fleet && registration && fleet !== registration) {
    return `${fleet} - ${registration}`
  }
  return fleet || registration || 'N/A'
}

export function deriveReportSiteLabel(locationText?: string): string {
  const clean = cleanText(locationText)
  if (!clean) return ''
  const segments = clean
    .split(',')
    .map((segment) => segment.trim())
    .filter(Boolean)
  return segments[0] || clean
}

export function buildAlertEventSummary(
  alertDetails: ReportAlertDetails | undefined,
  driverInfo: ReportDriverInfo,
  locationText?: string,
  focus: 'generic' | 'camera' | 'speeding' | 'criminal' | 'dispatch' | 'accident' = 'generic'
): string {
  const vehicle = getReportVehicleDisplayText(driverInfo)
  const type = cleanText(alertDetails?.type) || 'video alert'
  const severity = cleanText(alertDetails?.severity)
  const timestamp = formatReportDateTime(alertDetails?.timestamp || driverInfo.timestamp)
  const location = cleanText(locationText || resolveReportLocationText(alertDetails?.location, driverInfo.location))
  const subject = driverInfo.name && driverInfo.name !== 'Unknown Driver'
    ? `${driverInfo.name} operating ${vehicle}`
    : `${vehicle}`

  const base = `${subject} triggered a ${type}${severity ? ` (${severity})` : ''}${timestamp ? ` on ${timestamp}` : ''}${location ? ` near ${location}` : ''}.`

  if (focus === 'camera') {
    return `${base} The event indicates the driver-facing camera view may have been obstructed or covered, which prevents proper monitoring and breaches fleet camera compliance requirements.`
  }
  if (focus === 'speeding') {
    return `${base} The alert points to excessive speed or unsafe road-speed behaviour that requires investigation against the applicable route and fleet speed policy.`
  }
  if (focus === 'criminal') {
    return `${base} This event requires criminal incident assessment, evidence preservation, and follow-up with any witnesses or law enforcement involved.`
  }
  if (focus === 'dispatch') {
    return `${base} This dispatch event should record the response trigger, exact location, responding teams, and any operational escalation taken.`
  }
  if (focus === 'accident') {
    return `${base} This incident should be reviewed for accident circumstances, impact, injuries, property damage, and immediate response actions.`
  }

  return `${base} The event should be investigated against the recorded video evidence, screenshots, and alert timeline.`
}

export function buildAlertEvidencePayload(
  driverInfo: ReportDriverInfo,
  alertDetails?: ReportAlertDetails,
  extras?: Record<string, any>
): Record<string, any> {
  const screenshots = normalizeReportScreenshots(alertDetails?.screenshots).map((shot, index) => ({
    index: index + 1,
    url: toResolvedMediaUrl(shot.url),
    timestamp: shot.timestamp || null,
    channel: shot.channel || null,
  }))
  const videos = normalizeReportVideos(alertDetails?.videos).map((video, index) => ({
    index: index + 1,
    key: video.key || null,
    label: video.label || `Video ${index + 1}`,
    url: toResolvedMediaUrl(video.url),
    channel: video.channel || null,
  }))

  return {
    alertId: alertDetails?.id || null,
    alertType: alertDetails?.type || null,
    severity: alertDetails?.severity || null,
    timestamp: alertDetails?.timestamp || driverInfo.timestamp || null,
    vehicle: getReportVehicleDisplayText(driverInfo),
    fleetNumber: driverInfo.fleetNumber || null,
    vehicleRegistration: driverInfo.registration || null,
    driver: driverInfo.name || null,
    department: driverInfo.department || null,
    locationText: resolveReportLocationText(alertDetails?.location, driverInfo.location),
    screenshots,
    screenshotCount: screenshots.length,
    videos,
    videoCount: videos.length,
    ...extras,
  }
}

export async function saveAlertArtifactBundle({
  supabase,
  storageBucket = 'reports',
  fileName,
  pdfBlob,
  reportType,
  driverInfo,
  alertDetails,
  priority = 'High',
  extraPayload,
}: {
  supabase: any
  storageBucket?: string
  fileName: string
  pdfBlob: Blob
  reportType: string
  driverInfo: ReportDriverInfo
  alertDetails?: ReportAlertDetails
  priority?: string
  extraPayload?: Record<string, any>
}): Promise<SavedAlertArtifact> {
  const baseName = fileName.replace(/\.pdf$/i, '')
  const safeBaseName = sanitizePathSegment(baseName)

  const { error: uploadError } = await supabase.storage
    .from(storageBucket)
    .upload(fileName, pdfBlob, { contentType: 'application/pdf' })
  if (uploadError) throw uploadError

  const { data: publicData } = supabase.storage.from(storageBucket).getPublicUrl(fileName)
  const documentUrl = publicData?.publicUrl || ''

  const closurePayload: Record<string, any> = buildAlertEvidencePayload(driverInfo, alertDetails, {
    reportType,
    priority,
    documentUrl,
    documentName: fileName,
    documentType: reportType,
    ...extraPayload,
  })

  let bundleUrl = ''
  try {
    const bundleName = `${safeBaseName}.json`
    const bundleBlob = new Blob([JSON.stringify(closurePayload, null, 2)], {
      type: 'application/json',
    })
    const { error: bundleError } = await supabase.storage
      .from(storageBucket)
      .upload(bundleName, bundleBlob, {
        contentType: 'application/json',
        upsert: true,
      })
    if (!bundleError) {
      const { data: bundlePublicData } = supabase.storage.from(storageBucket).getPublicUrl(bundleName)
      bundleUrl = bundlePublicData?.publicUrl || ''
      closurePayload.bundleUrl = bundleUrl
    }
  } catch (error) {
    console.warn('Failed to save alert artifact bundle:', error)
  }

  const richInsert = {
    vehicle_registration: driverInfo.registration || driverInfo.fleetNumber,
    driver_name: driverInfo.name,
    priority,
    report_type: reportType,
    document_url: documentUrl,
  }

  try {
    const { error: richInsertError } = await supabase.from('reports').insert(richInsert)
    if (richInsertError) {
      const { error: fallbackInsertError } = await supabase.from('reports').insert({
        url: documentUrl,
      })
      if (fallbackInsertError) {
        console.warn('Failed to index saved report in reports table:', {
          richInsertError,
          fallbackInsertError,
          documentUrl,
          reportType,
        })
      }
    }
  } catch (error) {
    console.warn('Unexpected reports table insert failure:', {
      error,
      documentUrl,
      reportType,
    })
  }

  return {
    documentUrl,
    documentName: fileName,
    documentType: reportType,
    bundleUrl,
    closurePayload,
  }
}

export function formatReportDate(timestamp?: string): string {
  if (!timestamp) return ''
  const date = new Date(timestamp)
  if (Number.isNaN(date.getTime())) return ''
  return date.toISOString().slice(0, 10)
}

export function formatReportTime(timestamp?: string): string {
  if (!timestamp) return ''
  const date = new Date(timestamp)
  if (Number.isNaN(date.getTime())) return ''
  return date.toISOString().slice(11, 16)
}

export function formatReportDateTime(timestamp?: string): string {
  if (!timestamp) return ''
  const date = new Date(timestamp)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString('en-GB')
}

function sanitizeOklchStyles(doc: Document) {
  const fallbackMap: Record<string, string> = {
    color: '#000000',
    backgroundColor: '#ffffff',
    borderColor: '#000000',
    outlineColor: '#000000',
    textDecorationColor: '#000000',
    columnRuleColor: '#000000',
  }

  doc.querySelectorAll('style').forEach((styleEl) => {
    const cssText = styleEl.textContent || ''
    if (cssText.includes('oklch(')) {
      styleEl.textContent = cssText.replace(/oklch\([^)]+\)/g, '#000000')
    }
  })

  doc.querySelectorAll<HTMLElement>('*').forEach((el) => {
    const computed = window.getComputedStyle(el)
    for (const [prop, fallback] of Object.entries(fallbackMap)) {
      const value = computed[prop as keyof CSSStyleDeclaration]
      if (typeof value === 'string' && value.includes('oklch(')) {
        ;(el.style as any)[prop] = fallback
      }
    }
    if (typeof computed.boxShadow === 'string' && computed.boxShadow.includes('oklch(')) {
      el.style.boxShadow = 'none'
    }
    if (typeof computed.textShadow === 'string' && computed.textShadow.includes('oklch(')) {
      el.style.textShadow = 'none'
    }
  })
}

export function getSafeHtml2CanvasOptions(element: HTMLElement) {
  return {
    scale: 2,
    useCORS: true,
    logging: false,
    backgroundColor: '#ffffff',
    windowWidth: element.scrollWidth,
    windowHeight: element.scrollHeight,
    onclone: (clonedDoc: Document) => {
      sanitizeOklchStyles(clonedDoc)
    },
  }
}
