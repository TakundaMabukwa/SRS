'use client'

export interface ReportAlertDetails {
  id?: string
  type?: string
  severity?: string
  timestamp?: string
  location?: { latitude?: number; longitude?: number; address?: string } | string
  screenshots?: Array<{ url?: string; timestamp?: string; storage_url?: string; signed_url?: string; image_url?: string }>
  videos?: Array<{ key?: string; label?: string; url?: string; src?: string; path?: string }>
}

export interface ReportDriverInfo {
  name: string
  fleetNumber: string
  department?: string
  timestamp: string
  location?: string
}

export type ScreenshotInput = {
  url?: string
  storage_url?: string
  signed_url?: string
  image_url?: string
  timestamp?: string
}

export type VideoInput = {
  key?: string
  label?: string
  url?: string
  src?: string
  path?: string
}

export function resolveReportLocationText(
  location: ReportAlertDetails['location'],
  fallback?: string
): string {
  if (typeof location === 'string' && location.trim()) return location.trim()
  if (location?.address) return String(location.address)
  if (location?.latitude !== undefined && location?.longitude !== undefined) {
    return `${location.latitude}, ${location.longitude}`
  }
  return fallback || 'Unknown location'
}

export function normalizeReportScreenshots(
  input?: ReportAlertDetails['screenshots']
): Array<{ url: string; timestamp?: string }> {
  const screenshots = Array.isArray(input) ? (input as ScreenshotInput[]) : []
  const out: Array<{ url: string; timestamp?: string }> = []
  const seen = new Set<string>()
  for (const shot of screenshots) {
    const url = String(shot?.url || shot?.storage_url || shot?.signed_url || shot?.image_url || '').trim()
    if (!url || (!/^https?:\/\//i.test(url) && !url.startsWith('/'))) continue
    if (seen.has(url)) continue
    seen.add(url)
    out.push({ url, timestamp: shot?.timestamp })
  }
  return out
}

export function normalizeReportVideos(
  input?: ReportAlertDetails['videos']
): Array<{ key?: string; label?: string; url?: string }> {
  const videos = Array.isArray(input) ? (input as VideoInput[]) : []
  const out: Array<{ key?: string; label?: string; url?: string }> = []
  const seen = new Set<string>()
  for (const video of videos) {
    const url = String(video?.url || video?.src || video?.path || '').trim()
    if (!url || (!/^https?:\/\//i.test(url) && !url.startsWith('/'))) continue
    if (seen.has(url)) continue
    seen.add(url)
    out.push({ key: video?.key, label: video?.label, url })
  }
  return out
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
