'use client'

import { normalizeBackendMediaUrl, resolveMediaUrlForCurrentOrigin } from '@/lib/video-alert-playback'

export interface ReportAlertDetails {
  id?: string
  type?: string
  severity?: string
  timestamp?: string
  lastOccurrenceTimestamp?: string
  fleetNumber?: string
  vehicleRegistration?: string
  driverName?: string
  department?: string
  vehicleId?: string
  deviceId?: string
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
  cellNumber?: string
}

export function resolveAlertEventTimestamp(
  alertDetails?: ReportAlertDetails,
  fallbackTimestamp?: string
): string {
  return (
    String(alertDetails?.lastOccurrenceTimestamp || '').trim() ||
    String(alertDetails?.timestamp || '').trim() ||
    String(fallbackTimestamp || '').trim()
  )
}

function cleanText(value?: string | null): string {
  return String(value || '').trim()
}

function looksLikeCoordinatePair(value?: string | null): boolean {
  const clean = cleanText(value)
  return /^-?\d+(?:\.\d+)?\s*,\s*-?\d+(?:\.\d+)?$/.test(clean)
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
  storagePath?: string
  closurePayload: Record<string, any>
}

export function resolveReportLocationText(
  location: ReportAlertDetails['location'],
  fallback?: string
): string {
  if (typeof location === 'string' && location.trim() && !looksLikeCoordinatePair(location)) return location.trim()
  const locationObject =
    location && typeof location === 'object' ? location : undefined
  if (locationObject?.address) return String(locationObject.address)
  const cleanFallback = cleanText(fallback)
  if (cleanFallback && !looksLikeCoordinatePair(cleanFallback)) return cleanFallback
  if (locationObject?.latitude !== undefined && locationObject?.longitude !== undefined) {
    return `${locationObject.latitude}, ${locationObject.longitude}`
  }
  return cleanFallback || 'Unknown location'
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
  // Pass raw Skycam URLs through directly — don't wrap in proxy
  if (/^https?:\/\/.*skycamx\.co\.za/i.test(clean)) return clean
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
  if (!clean || looksLikeCoordinatePair(clean)) return ''
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
  const timestamp = formatReportDateTime(resolveAlertEventTimestamp(alertDetails, driverInfo.timestamp))
  const resolvedLocation = cleanText(locationText || resolveReportLocationText(alertDetails?.location, driverInfo.location))
  const location = looksLikeCoordinatePair(resolvedLocation) ? '' : resolvedLocation
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
  const resolvedFleetNumber =
    cleanText(driverInfo.fleetNumber) ||
    cleanText(alertDetails?.fleetNumber)
  const resolvedVehicleRegistration =
    getReportVehicleRegistrationText(driverInfo.registration) ||
    getReportVehicleRegistrationText(alertDetails?.vehicleRegistration)
  const resolvedDriverName =
    cleanText(driverInfo.name) ||
    cleanText(alertDetails?.driverName)
  const resolvedDepartment =
    cleanText(driverInfo.department) ||
    cleanText(alertDetails?.department)
  const resolvedDriverInfo: ReportDriverInfo = {
    ...driverInfo,
    name: resolvedDriverName || driverInfo.name,
    fleetNumber: resolvedFleetNumber || driverInfo.fleetNumber,
    registration: resolvedVehicleRegistration || driverInfo.registration,
    department: resolvedDepartment || driverInfo.department,
  }

  return {
    alertId: alertDetails?.id || null,
    alertType: alertDetails?.type || null,
    severity: alertDetails?.severity || null,
    timestamp: resolveAlertEventTimestamp(alertDetails, driverInfo.timestamp) || null,
    lastOccurrenceTimestamp: resolveAlertEventTimestamp(alertDetails, driverInfo.timestamp) || null,
    vehicle: getReportVehicleDisplayText(resolvedDriverInfo),
    fleetNumber: resolvedFleetNumber || null,
    vehicleRegistration: resolvedVehicleRegistration || null,
    driver: resolvedDriverName || null,
    department: resolvedDepartment || null,
    vehicleId: cleanText(alertDetails?.vehicleId) || null,
    deviceId: cleanText(alertDetails?.deviceId) || null,
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
  contentType = 'application/msword',
  fileExtension = '.doc',
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
  contentType?: string
  fileExtension?: string
}): Promise<SavedAlertArtifact> {
  const originalFileName = sanitizePathSegment(fileName.replace(/\\/g, '/').split('/').pop() || fileName)
  const baseName = originalFileName.replace(/\.(pdf|doc|docx)$/i, '')
  const safeBaseName = sanitizePathSegment(baseName)
  const alertFolder = sanitizePathSegment(alertDetails?.id || driverInfo.fleetNumber || 'unlinked-alert')
  const typeFolder = sanitizePathSegment(String(reportType || 'report').toLowerCase())
  const timestampFolder = new Date().toISOString().replace(/[:.]/g, '-')
  const storagePrefix = `video-alerts/${alertFolder}/${typeFolder}/${timestampFolder}`
  const storageFileName = `${storagePrefix}/${safeBaseName}${fileExtension}`

  const uploadFile = async (): Promise<string> => {
    const { error } = await supabase.storage
      .from(storageBucket)
      .upload(storageFileName, pdfBlob, { contentType, upsert: true })
    if (error) throw error
    return (supabase.storage.from(storageBucket).getPublicUrl(storageFileName)?.data?.publicUrl) || ''
  }

  const documentUrl = await Promise.race([
    uploadFile(),
    new Promise<string>((resolve) => setTimeout(() => resolve(''), 10000)),
  ]).catch(() => '')

  const closurePayload: Record<string, any> = buildAlertEvidencePayload(driverInfo, alertDetails, {
    reportType,
    priority,
    documentUrl,
    documentName: fileName,
    documentType: reportType,
    ...extraPayload,
  })

  // Index in reports table (fire-and-forget, no blocking)
  supabase.from('reports').insert({
    vehicle_registration: driverInfo.registration || driverInfo.fleetNumber,
    driver_name: driverInfo.name,
    priority,
    report_type: reportType,
    document_url: documentUrl,
  }).then().catch(() => {})

  return {
    documentUrl,
    documentName: originalFileName,
    documentType: reportType,
    storagePath: storageFileName,
    closurePayload,
  }
}

function toSastDate(timestamp?: string): Date | null {
  if (!timestamp) return null
  const d = new Date(timestamp)
  if (Number.isNaN(d.getTime())) return null
  return d
}

export function formatReportDate(timestamp?: string): string {
  const date = toSastDate(timestamp)
  if (!date) return ''
  return date.toISOString().slice(0, 10)
}

export function formatReportTime(timestamp?: string): string {
  const date = toSastDate(timestamp)
  if (!date) return ''
  return date.toISOString().slice(11, 16)
}

export function formatReportDateTime(timestamp?: string): string {
  const date = toSastDate(timestamp)
  if (!date) return ''
  return date.toLocaleString('en-GB')
}

function yieldToMain(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(reader.error || new Error('read failed'))
    reader.readAsDataURL(blob)
  })
}

const TRANSPARENT_GIF = 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs='

// Same-origin proxy to fetch cross-origin images as data URLs.
function toSameOriginProxy(url: string): string {
  if (!/^https?:\/\//i.test(url)) return url
  const base = typeof window !== 'undefined' ? window.location.origin : ''
  return `${base}/api/video-server/playback/image-proxy?url=${encodeURIComponent(url)}`
}

// Replace every <img> in the element with a data URL fetched through the
// same-origin proxy. Cross-origin images (e.g. Skycam) need proxying for
// any canvas-based or fetch-based rendering. Returns the list
// of (img, originalSrc) pairs so the DOM can be restored afterwards.
async function hydrateImagesToDataUrls(
  element: HTMLElement
): Promise<Array<{ img: HTMLImageElement; original: string }>> {
  const images = Array.from(element.querySelectorAll<HTMLImageElement>('img'))
  const tracked: Array<{ img: HTMLImageElement; original: string }> = []
  let cursor = 0
  const worker = async () => {
    while (cursor < images.length) {
      const img = images[cursor++]
      const original = img.src || ''
      tracked.push({ img, original })
      if (!original || /^data:/i.test(original)) continue
      try {
        const res = await fetch(toSameOriginProxy(original), { signal: AbortSignal.timeout(8000) })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        img.src = await blobToDataUrl(await res.blob())
      } catch {
        // Keep generation moving: blank the failed image instead of stalling.
        img.src = TRANSPARENT_GIF
        img.style.width = '1px'
        img.style.height = '1px'
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(6, images.length) }, () => worker()))
  return tracked
}

const TAILWIND_SPACING: Record<string, string> = {
  'p-1': '4px', 'p-2': '8px', 'p-3': '12px', 'p-4': '16px', 'p-5': '20px', 'p-6': '24px',
  'px-1': '4px', 'px-2': '8px', 'px-3': '12px', 'px-4': '16px',
  'py-1': '4px', 'py-2': '8px', 'py-3': '12px', 'py-4': '16px',
  'm-1': '4px', 'm-2': '8px', 'm-3': '12px', 'm-4': '16px',
  'mt-1': '4px', 'mt-2': '8px', 'mt-3': '12px', 'mt-4': '16px',
  'mb-1': '4px', 'mb-2': '8px', 'mb-3': '12px', 'mb-4': '16px',
  'ml-1': '4px', 'ml-2': '8px', 'ml-3': '12px',
  'mr-1': '4px', 'mr-2': '8px', 'mr-3': '12px',
  'gap-1': '4px', 'gap-2': '8px', 'gap-3': '12px', 'gap-4': '16px',
}

function prepareForWord(root: HTMLElement): HTMLElement {
  const clone = root.cloneNode(true) as HTMLElement

  // Convert grid → table (bottom-up so nested grids are handled first)
  const gridEls = clone.querySelectorAll('[class*="grid-cols"]')
  gridEls.forEach((el) => {
    const classes = el.getAttribute('class') || ''
    const colsMatch = classes.match(/grid-cols-(\d+)/)
    if (!colsMatch) return
    const totalCols = parseInt(colsMatch[1])

    const table = document.createElement('table')
    table.setAttribute('cellpadding', '0')
    table.setAttribute('cellspacing', '0')
    table.style.cssText = 'width:100%;border-collapse:collapse;border:1px solid black;'

    const tr = document.createElement('tr')
    const children = Array.from(el.children) as HTMLElement[]

    children.forEach((child) => {
      const childClasses = child.getAttribute('class') || ''
      const spanMatch = childClasses.match(/col-span-(\d+)/)
      const colspan = spanMatch ? parseInt(spanMatch[1]) : 1

      const td = document.createElement('td')
      td.setAttribute('colspan', String(colspan))
      td.style.cssText = 'vertical-align:top;padding:0;'
      td.innerHTML = child.innerHTML

      // Copy relevant inline styles from child
      const s = child.style
      if (s.textAlign) td.style.textAlign = s.textAlign
      if (s.fontWeight) td.style.fontWeight = s.fontWeight
      if (s.fontSize) td.style.fontSize = s.fontSize
      if (s.backgroundColor) td.style.backgroundColor = s.backgroundColor

      // Inline border classes
      if (childClasses.includes('border-r')) td.style.borderRight = '1px solid black'
      if (childClasses.includes('border-b')) td.style.borderBottom = '1px solid black'
      if (childClasses.includes('border-l')) td.style.borderLeft = '1px solid black'
      if (childClasses.includes('border-t')) td.style.borderTop = '1px solid black'

      // Inline padding
      for (const [tw, css] of Object.entries(TAILWIND_SPACING)) {
        if (childClasses.includes(tw)) {
          const prop = tw.startsWith('p') ? 'padding' : tw.startsWith('m') ? 'margin' : 'gap'
          if (tw.startsWith('px')) td.style.paddingLeft = td.style.paddingRight = css
          else if (tw.startsWith('py')) td.style.paddingTop = td.style.paddingBottom = css
          else if (tw.startsWith('pt')) td.style.paddingTop = css
          else if (tw.startsWith('pb')) td.style.paddingBottom = css
          else if (tw.startsWith('pl')) td.style.paddingLeft = css
          else if (tw.startsWith('pr')) td.style.paddingRight = css
          else td.style.padding = css
        }
      }

      tr.appendChild(td)
    })

    table.appendChild(tr)
    el.parentNode?.replaceChild(table, el)
  })

  // Convert flex → block
  clone.querySelectorAll('[class*="flex"]').forEach((el) => {
    const htmlEl = el as HTMLElement
    const classes = htmlEl.getAttribute('class') || ''
    htmlEl.style.display = 'block'
    if (classes.includes('items-center')) htmlEl.style.textAlign = 'center'
  })

  // Inline text classes
  clone.querySelectorAll('[class*="text-"]').forEach((el) => {
    const classes = (el as HTMLElement).getAttribute('class') || ''
    const htmlEl = el as HTMLElement
    if (classes.includes('text-center')) htmlEl.style.textAlign = 'center'
    if (classes.includes('text-right')) htmlEl.style.textAlign = 'right'
    if (classes.includes('text-sm')) htmlEl.style.fontSize = '12px'
    if (classes.includes('text-xs')) htmlEl.style.fontSize = '10px'
    if (classes.includes('text-lg')) htmlEl.style.fontSize = '18px'
    if (classes.includes('text-xl')) htmlEl.style.fontSize = '20px'
    if (classes.includes('text-2xl')) htmlEl.style.fontSize = '24px'
    if (classes.includes('text-3xl')) htmlEl.style.fontSize = '30px'
    if (classes.includes('font-bold')) htmlEl.style.fontWeight = 'bold'
  })

  // Inline border classes on remaining elements
  clone.querySelectorAll('[class*="border"]').forEach((el) => {
    const classes = (el as HTMLElement).getAttribute('class') || ''
    const htmlEl = el as HTMLElement
    if (classes.includes('border-b-2')) htmlEl.style.borderBottom = '2px solid black'
    else if (classes.includes('border-b')) htmlEl.style.borderBottom = htmlEl.style.borderBottom || '1px solid black'
    if (classes.includes('border-r')) htmlEl.style.borderRight = htmlEl.style.borderRight || '1px solid black'
    if (classes.includes('border-l')) htmlEl.style.borderLeft = htmlEl.style.borderLeft || '1px solid black'
    if (classes.includes('border-t')) htmlEl.style.borderTop = htmlEl.style.borderTop || '1px solid black'
    if (classes.includes('border-black')) {
      if (!htmlEl.style.borderBottom) htmlEl.style.borderBottom = '1px solid black'
      if (!htmlEl.style.borderRight) htmlEl.style.borderRight = '1px solid black'
    }
  })

  // Remove hidden inputs/selects that may have been missed
  clone.querySelectorAll('input, select, button').forEach((el) => el.remove())

  return clone
}

export async function renderElementToDocBlob(element: HTMLElement): Promise<Blob> {
  const t = (msg: string) => console.log(`[DOC] ${msg}`, performance.now().toFixed(0) + 'ms')
  t('START')

  await yieldToMain()

  const replacements: Array<{ el: HTMLElement; parent: Node; next: Node | null }> = []
  const inputs = element.querySelectorAll('input, textarea, select')
  inputs.forEach((input) => {
    const parent = input.parentNode
    if (!parent) return
    const next = input.nextSibling
    const value = (input as HTMLInputElement).value || (input as HTMLTextAreaElement).value || ''
    const placeholder = (input as HTMLInputElement).placeholder || ''
    const displayText = value || placeholder || ''
    const textDiv = document.createElement('div')
    textDiv.textContent = displayText
    textDiv.style.cssText = 'border: 1px solid #999; padding: 6px 8px; background: white; min-height: 24px; font-size: 12px; line-height: 1.5; color: #000; word-wrap: break-word;'
    parent.insertBefore(textDiv, next)
    replacements.push({ el: input as HTMLElement, parent, next })
    parent.removeChild(input)
  })
  t('replaced form elements with text')

  let trackedImgs: Array<{ img: HTMLImageElement; original: string }> = []
  try {
    const originalWidth = element.style.width
    element.style.width = '850px'
    element.style.maxWidth = '850px'
    element.style.margin = '0 auto'
    element.style.padding = '20px'
    element.style.boxSizing = 'border-box'

    trackedImgs = await hydrateImagesToDataUrls(element)
    t(`hydrated ${trackedImgs.length} images`)

    const wordReady = prepareForWord(element)
    t('prepared for Word (grid→table, flex→block, inlined styles)')

    const stylesheets = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
      .map((link) => `<link rel="stylesheet" href="${(link as HTMLLinkElement).href}">`)
      .join('\n')

    const inlineStyles = Array.from(document.querySelectorAll('style'))
      .map((s) => `<style>${s.textContent || ''}</style>`)
      .join('\n')

    const htmlContent = `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:w="urn:schemas-microsoft-com:office:word"
      xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="utf-8">
<title>NCR Report</title>
${stylesheets}
${inlineStyles}
<style>
  @page { size: A4 portrait; margin: 15mm; }
  body { font-family: Arial, sans-serif; font-size: 10pt; }
  table { border-collapse: collapse; width: 100%; }
  td, th { border: 1px solid black; padding: 4px 6px; font-size: 10pt; }
</style>
</head>
<body>
${wordReady.innerHTML}
</body>
</html>`

    element.style.width = originalWidth
    element.style.maxWidth = ''
    element.style.margin = ''

    t(`html length: ${htmlContent.length}`)
    const blob = new Blob([htmlContent], { type: 'application/msword' })
    t(`done, blob size: ${blob.size}`)
    return blob
  } finally {
    trackedImgs.forEach(({ img, original }) => {
      img.src = original
      img.style.width = ''
      img.style.height = ''
      img.style.visibility = ''
    })
    replacements.forEach(({ el, parent, next }) => {
      if (next && parent.contains(next)) {
        parent.insertBefore(el, next)
      } else if (parent) {
        parent.appendChild(el)
      }
    })
  }
}

export async function renderElementToPdfBlob(element: HTMLElement): Promise<Blob> {
  return renderElementToDocBlob(element)
}

export async function renderElementToWordBlob(element: HTMLElement): Promise<Blob> {
  // Just render to PDF - simple and reliable
  return renderElementToPdfBlob(element);
}
