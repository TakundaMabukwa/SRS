import { NextRequest } from 'next/server'
import {
  getLivePreviewBaseUrl,
  getLiveVideoRuntimeBaseUrl,
  resolveVideoServerProxyBase,
} from '@/lib/backend-hubs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

type AnyRecord = Record<string, any>
type GenericRecord = Record<string, unknown>

function normalizeProxiedMediaUrls(value: unknown, baseUrl: string): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => normalizeProxiedMediaUrls(entry, baseUrl));
  }
  if (!value || typeof value !== 'object') {
    if (typeof value === 'string') {
      const raw = value.trim();
      if (raw.startsWith('captures/')) {
        return `/api/video-server/${raw}`;
      }
      if (raw.startsWith('/media/') || raw.startsWith('/captures/')) {
        return `/api/video-server${raw}`;
      }
      if (raw.startsWith('/api/')) {
        return `/api/video-server${raw.slice(4)}`;
      }
      if (/^\/api\/(videos(?:\/jobs)?\/.+\/file|videos\/[^/]+\/file|stream\/.+|playback\/.+)/i.test(raw)) {
        return `/api/video-server${raw.slice(4)}`;
      }
      if (/^https?:\/\//i.test(raw)) {
        try {
          const parsed = new URL(raw);
          const targetBase = new URL(baseUrl);
          if (
            parsed.origin === targetBase.origin &&
            (parsed.pathname.startsWith('/media/') || parsed.pathname.startsWith('/captures/'))
          ) {
            return `/api/video-server${parsed.pathname}${parsed.search || ''}`;
          }
          if (parsed.origin === targetBase.origin && parsed.pathname.startsWith('/api/')) {
            return `/api/video-server${parsed.pathname.slice(4)}${parsed.search || ''}`;
          }
        } catch {
          return raw;
        }
      }
    }
    return value;
  }

  const output: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    output[key] = normalizeProxiedMediaUrls(entry, baseUrl);
  }
  return output;
}

function readRecord(value: unknown): GenericRecord {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as GenericRecord)
    : {}
}

function normalizeVehicleAlias(value: string): string {
  const trimmed = String(value || '').trim()
  if (!/^\d+$/.test(trimmed)) return trimmed
  if (trimmed.startsWith('862') && trimmed.length > 12) {
    return trimmed.slice(3)
  }
  return trimmed
}

function buildCandidateVehicleIds(vehicleId: string, fallbackIdsRaw: string | null): string[] {
  const ordered = [vehicleId, ...(fallbackIdsRaw ? fallbackIdsRaw.split(',') : [])]
    .map((value) => String(value || '').trim())
    .filter(Boolean)

  const out: string[] = []
  const seen = new Set<string>()

  for (const value of ordered) {
    const alias = normalizeVehicleAlias(value)
    if (!seen.has(value)) {
      out.push(value)
      seen.add(value)
    }
    if (alias && alias !== value && !seen.has(alias)) {
      out.push(alias)
      seen.add(alias)
    }
  }

  return out
}

function copyProxyHeaders(response: Response): Headers {
  const headers = new Headers()
  for (const key of [
    'content-type',
    'content-length',
    'cache-control',
    'connection',
    'pragma',
    'expires',
    'accept-ranges',
    'content-range',
    'etag',
    'last-modified',
    'x-live-channel',
    'x-live-sim',
    'x-live-source',
    'x-live-updated-at',
    'x-preview-updated-at',
    'x-preview-sequence',
  ]) {
    const value = response.headers.get(key)
    if (value) headers.set(key, value)
  }
  if (!headers.has('cache-control')) {
    headers.set('cache-control', 'no-store, no-cache, must-revalidate, private')
  }
  return headers
}

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, {
      cache: 'no-store',
      signal: controller.signal,
    })
  } finally {
    clearTimeout(timer)
  }
}

function collectChannelNumbers(record: GenericRecord): number[] {
  const channels = new Set<number>()
  const readNumber = (value: unknown) => {
    const n = Number(value)
    if (Number.isFinite(n) && n > 0) channels.add(Math.round(n))
  }

  const activeStreams = Array.isArray(record.activeStreams) ? record.activeStreams : []
  for (const entry of activeStreams) {
    readNumber(entry)
  }

  const channelRows = Array.isArray(record.channels) ? record.channels : []
  for (const entry of channelRows) {
    if (typeof entry === 'number' || typeof entry === 'string') {
      readNumber(entry)
      continue
    }
    const channelRecord = readRecord(entry)
    readNumber(channelRecord.logicalChannel ?? channelRecord.channel ?? channelRecord.channelId)
  }

  const streamRows = Array.isArray(record.streams) ? record.streams : []
  for (const entry of streamRows) {
    const streamRecord = readRecord(entry)
    readNumber(streamRecord.channel ?? streamRecord.logicalChannel)
  }

  return Array.from(channels).sort((a, b) => a - b)
}

function matchesCandidateVehicle(record: GenericRecord, candidates: string[]): boolean {
  const keys = [
    String(record.id ?? '').trim(),
    String(record.vehicleId ?? '').trim(),
    String(record.deviceId ?? '').trim(),
    String(record.phone ?? '').trim(),
  ].filter(Boolean)
  if (keys.length === 0) return false
  const candidateSet = new Set(candidates.flatMap((value) => [value, normalizeVehicleAlias(value)]))
  return keys.some((key) => candidateSet.has(key) || candidateSet.has(normalizeVehicleAlias(key)))
}

function parseVehicleRows(payload: unknown): GenericRecord[] {
  const root = readRecord(payload)
  const rootData = readRecord(root.data)

  const rows = Array.isArray(payload)
    ? payload
    : Array.isArray(root.vehicles)
      ? root.vehicles
      : Array.isArray(root.data)
        ? root.data
        : Array.isArray(rootData.vehicles)
          ? rootData.vehicles
          : []

  return rows.map((entry) => readRecord(entry))
}

function isChannelReadyInPayload(payload: unknown, candidates: string[], channel: number): boolean {
  for (const row of parseVehicleRows(payload)) {
    if (!matchesCandidateVehicle(row, candidates)) continue
    const channels = collectChannelNumbers(row)
    if (channels.includes(channel)) return true
  }
  return false
}

function isChannelReadyFromLatestScreenshots(payload: unknown, candidates: string[], channel: number): boolean {
  const root = readRecord(payload)
  const rows = Array.isArray(root.results) ? root.results : []
  const candidateSet = new Set(candidates.flatMap((value) => [value, normalizeVehicleAlias(value)]))

  return rows.some((entry) => {
    const row = readRecord(entry)
    const vehicle = String(row.vehicleId ?? '').trim()
    const normalized = normalizeVehicleAlias(vehicle)
    const ch = Number(row.channel ?? 0)
    const ok = Boolean(row.ok)
    const hasFile = String(row.fileUrl ?? '').trim().length > 0
    return ok && hasFile && ch === channel && (candidateSet.has(vehicle) || candidateSet.has(normalized))
  })
}

async function resolveGoHubScreenshotLatest(
  livePreviewBase: string,
  candidates: string[],
  channel: number | null,
): Promise<Response | null> {
  const latestResponse = await fetchWithTimeout(`${livePreviewBase}/api/live/screenshots/latest`, 4500)
  if (!latestResponse.ok) return null

  const latestPayload = await latestResponse.json().catch(() => ({}))
  const results = Array.isArray((latestPayload as { results?: unknown[] }).results)
    ? ((latestPayload as { results?: unknown[] }).results as GenericRecord[])
    : []
  const candidateSet = new Set(candidates.flatMap((value) => [value, normalizeVehicleAlias(value)]))

  const match = results.find((entry) => {
    const row = readRecord(entry)
    const vehicle = String(row.vehicleId ?? '').trim()
    const normalized = normalizeVehicleAlias(vehicle)
    const ch = Number(row.channel ?? 0)
    if (!row.ok) return false
    if (!row.fileUrl) return false
    if (channel && ch !== channel) return false
    return candidateSet.has(vehicle) || candidateSet.has(normalized)
  })

  if (!match) return null

  const fileUrl = String(match.fileUrl || '').trim()
  if (!fileUrl) return null
  const absolute = /^https?:\/\//i.test(fileUrl)
    ? fileUrl
    : `${livePreviewBase}${fileUrl.startsWith('/') ? '' : '/'}${fileUrl}`

  const screenshotResponse = await fetchWithTimeout(absolute, 4500)
  return screenshotResponse.ok ? screenshotResponse : null
}

async function handleVehicleLiveMjpegProxy(request: NextRequest, pathArray: string[], primaryBase: string): Promise<Response> {
  const vehicleId = String(pathArray[1] || '').trim()
  if (!vehicleId) {
    return Response.json({ success: false, message: 'vehicle id is required' }, { status: 400 })
  }

  const livePreviewBase = getLivePreviewBaseUrl()
  const fallbackIds = request.nextUrl.searchParams.get('fallbackIds')
  const candidates = buildCandidateVehicleIds(vehicleId, fallbackIds)
  const forwardedQuery = new URLSearchParams(request.nextUrl.searchParams)
  forwardedQuery.delete('fallbackIds')
  if (!forwardedQuery.get('waitMs')) forwardedQuery.set('waitMs', '2500')
  if (!forwardedQuery.get('maxAgeMs')) forwardedQuery.set('maxAgeMs', '15000')
  if (!forwardedQuery.get('autoStart')) forwardedQuery.set('autoStart', 'true')
  if (!forwardedQuery.get('videoOnly')) forwardedQuery.set('videoOnly', 'true')
  if (!forwardedQuery.get('input')) forwardedQuery.set('input', 'auto')
  if (!forwardedQuery.get('fps')) forwardedQuery.set('fps', '6')
  const waitMs = Number(forwardedQuery.get('waitMs') || 0)
  const timeoutMs = Number.isFinite(waitMs) && waitMs > 0
    ? Math.max(6000, Math.min(16000, Math.round(waitMs) + 7000))
    : 9000

  const attempts: string[] = []
  const seen = new Set<string>()
  const pushAttempt = (url: string) => {
    if (!url || seen.has(url)) return
    seen.add(url)
    attempts.push(url)
  }

  for (const candidateId of candidates) {
    const liveQuery = new URLSearchParams(forwardedQuery)
    liveQuery.set('sim', candidateId)
    // Fast-path go-hub MJPEG first (best chance for quickest first frame).
    pushAttempt(`${livePreviewBase}/api/live/mjpeg?${liveQuery.toString()}`)
    pushAttempt(`${primaryBase}/api/live/mjpeg?${liveQuery.toString()}`)

    // Legacy listener paths as fallback.
    const legacyQuery = new URLSearchParams(forwardedQuery)
    pushAttempt(`${livePreviewBase}/api/vehicles/${encodeURIComponent(candidateId)}/live.mjpeg${legacyQuery.toString() ? `?${legacyQuery.toString()}` : ''}`)
    pushAttempt(`${primaryBase}/api/vehicles/${encodeURIComponent(candidateId)}/live.mjpeg${legacyQuery.toString() ? `?${legacyQuery.toString()}` : ''}`)
  }

  let lastError: Response | null = null
  for (const url of attempts) {
    try {
      const response = await fetchWithTimeout(url, timeoutMs)
      if (response.ok) {
        return new Response(response.body, {
          status: response.status,
          headers: copyProxyHeaders(response),
        })
      }
      lastError = response
    } catch (error) {
      console.error('[video-server/live.mjpeg] Proxy failed:', url, error)
    }
  }

  if (lastError) {
    const text = await lastError.text().catch(() => '')
    return new Response(text || 'Live MJPEG unavailable', {
      status: lastError.status,
      headers: {
        'content-type': lastError.headers.get('content-type') || 'text/plain; charset=utf-8',
        'cache-control': 'no-store',
      },
    })
  }

  return Response.json(
    { success: false, message: 'No live MJPEG stream available for requested vehicle/channel' },
    { status: 404 },
  )
}

async function handleVehicleScreenshotProxy(request: NextRequest, pathArray: string[], primaryBase: string): Promise<Response> {
  const vehicleId = String(pathArray[1] || '').trim()
  if (!vehicleId) {
    return Response.json({ success: false, message: 'vehicle id is required' }, { status: 400 })
  }

  const livePreviewBase = getLivePreviewBaseUrl()
  const fallbackIds = request.nextUrl.searchParams.get('fallbackIds')
  const candidates = buildCandidateVehicleIds(vehicleId, fallbackIds)
  const forwardedQuery = new URLSearchParams(request.nextUrl.searchParams)
  forwardedQuery.delete('fallbackIds')
  const requestedChannel = Number(forwardedQuery.get('channel') || 0)
  const channel = Number.isFinite(requestedChannel) && requestedChannel > 0 ? Math.round(requestedChannel) : null

  const attempts: string[] = []
  const seen = new Set<string>()
  const pushAttempt = (url: string) => {
    if (!url || seen.has(url)) return
    seen.add(url)
    attempts.push(url)
  }

  for (const candidateId of candidates) {
    const query = new URLSearchParams(forwardedQuery)
    pushAttempt(`${primaryBase}/api/vehicles/${encodeURIComponent(candidateId)}/screenshot${query.toString() ? `?${query.toString()}` : ''}`)
    pushAttempt(`${livePreviewBase}/api/vehicles/${encodeURIComponent(candidateId)}/screenshot${query.toString() ? `?${query.toString()}` : ''}`)
  }

  let lastError: Response | null = null
  for (const url of attempts) {
    try {
      const response = await fetchWithTimeout(url, 4500)
      if (response.ok) {
        return new Response(response.body, {
          status: response.status,
          headers: copyProxyHeaders(response),
        })
      }
      lastError = response
    } catch (error) {
      console.error('[video-server/screenshot] Proxy failed:', url, error)
    }
  }

  try {
    const fallback = await resolveGoHubScreenshotLatest(livePreviewBase, candidates, channel)
    if (fallback) {
      return new Response(fallback.body, {
        status: fallback.status,
        headers: copyProxyHeaders(fallback),
      })
    }
  } catch (error) {
    console.error('[video-server/screenshot] latest fallback failed:', error)
  }

  if (lastError) {
    const contentType = lastError.headers.get('content-type') || 'text/plain; charset=utf-8'
    const text = await lastError.text().catch(() => '')
    return new Response(text || 'Screenshot unavailable', {
      status: lastError.status,
      headers: {
        'content-type': contentType,
        'cache-control': 'no-store',
      },
    })
  }

  return Response.json(
    { success: false, message: 'No screenshot available for requested vehicle/channel' },
    { status: 404 },
  )
}

async function handleLiveReady(request: NextRequest): Promise<Response> {
  const sim = String(request.nextUrl.searchParams.get('sim') || '').trim()
  if (!sim) {
    return Response.json({ success: false, message: 'sim is required' }, { status: 400 })
  }
  const fallbackIds = request.nextUrl.searchParams.get('fallbackIds')
  const candidates = buildCandidateVehicleIds(sim, fallbackIds)
  const channelParsed = Number(request.nextUrl.searchParams.get('channel') || 1)
  const channel = Number.isFinite(channelParsed) && channelParsed > 0 ? Math.round(channelParsed) : 1
  const maxAgeMsParsed = Number(request.nextUrl.searchParams.get('maxAgeMs') || 20000)
  const maxAgeMs = Number.isFinite(maxAgeMsParsed) && maxAgeMsParsed > 0 ? Math.round(maxAgeMsParsed) : 20000

  const runtimeBase = getLiveVideoRuntimeBaseUrl()
  const livePreviewBase = getLivePreviewBaseUrl()
  const readyProbeTimeoutMs = 1200
  const checks: Array<{ source: string; url: string }> = [
    { source: 'live.streams', url: `${livePreviewBase}/api/live/streams?maxAgeMs=${encodeURIComponent(String(maxAgeMs))}` },
    { source: 'live.screenshots.latest', url: `${livePreviewBase}/api/live/screenshots/latest` },
    { source: 'live.vehicles', url: `${livePreviewBase}/api/live/vehicles` },
    { source: 'runtime.connected', url: `${runtimeBase}/api/vehicles/connected` },
  ]

  for (const check of checks) {
    try {
      const response = await fetchWithTimeout(check.url, readyProbeTimeoutMs)
      if (!response.ok) continue
      const payload = await response.json().catch(() => ({}))

      if (check.source === 'live.streams') {
        const root = readRecord(payload)
        const rows = Array.isArray(root.rows) ? root.rows : []
        const candidateSet = new Set(candidates.flatMap((value) => [value, normalizeVehicleAlias(value)]))
        const found = rows.some((entry) => {
          const row = readRecord(entry)
          const vehicleId = String(row.vehicleId ?? row.id ?? '').trim()
          const normalized = normalizeVehicleAlias(vehicleId)
          const rowChannel = Number(row.channel ?? 0)
          return (candidateSet.has(vehicleId) || candidateSet.has(normalized)) && rowChannel === channel
        })
        if (found) {
          return Response.json({
            success: true,
            ready: true,
            source: check.source,
            channel,
            sim,
            matchedVehicleIds: candidates,
            checkedAt: new Date().toISOString(),
          })
        }
        continue
      }

      if (check.source === 'live.screenshots.latest') {
        if (isChannelReadyFromLatestScreenshots(payload, candidates, channel)) {
          return Response.json({
            success: true,
            ready: true,
            source: check.source,
            channel,
            sim,
            matchedVehicleIds: candidates,
            checkedAt: new Date().toISOString(),
          })
        }
        continue
      }

      if (isChannelReadyInPayload(payload, candidates, channel)) {
        return Response.json({
          success: true,
          ready: true,
          source: check.source,
          channel,
          sim,
          matchedVehicleIds: candidates,
          checkedAt: new Date().toISOString(),
        })
      }
    } catch {
      // Continue to next check source.
    }
  }

  return Response.json({
    success: true,
    ready: false,
    source: 'none',
    channel,
    sim,
    matchedVehicleIds: candidates,
    checkedAt: new Date().toISOString(),
  })
}

function toInt(value: string | null, fallback: number, min: number, max: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(n)));
}

function isResolvedStatus(status: string): boolean {
  const normalized = String(status || '').trim().toLowerCase();
  return normalized === 'resolved' || normalized === 'closed';
}

function normalizeAlertStatus(raw: AnyRecord): string {
  const status = String(raw?.status || '').trim().toLowerCase();
  if (status) return status;
  if (raw?.resolved === true) return 'resolved';
  return 'new';
}

function normalizeAlertPriority(raw: AnyRecord): 'critical' | 'high' | 'medium' | 'low' {
  const p = String(raw?.priority || '').trim().toLowerCase();
  if (p === 'critical' || p === 'high' || p === 'medium' || p === 'low') return p;
  return 'medium';
}

function normalizeTimestamp(raw: AnyRecord): string {
  const ts = raw?.timestamp || raw?.last_occurrence || raw?.created_at || raw?.loggedAt;
  const d = new Date(ts || Date.now());
  if (Number.isNaN(d.getTime())) return new Date().toISOString();
  return d.toISOString();
}

function toProxyMediaUrl(rawValue: unknown, baseUrl: string): string {
  const raw = String(rawValue || '').trim();
  if (!raw) return '';
  const normalized = normalizeProxiedMediaUrls(raw, baseUrl);
  return typeof normalized === 'string' ? normalized : raw;
}

function sortByLatest(a: AnyRecord, b: AnyRecord): number {
  const ta = new Date(a?.last_occurrence || a?.timestamp || a?.created_at || 0).getTime();
  const tb = new Date(b?.last_occurrence || b?.timestamp || b?.created_at || 0).getTime();
  return tb - ta;
}

function buildAlertMediaLinks(alertId: string) {
  const id = encodeURIComponent(alertId);
  return {
    alert: `/api/video-server/alerts/${id}`,
    media: `/api/video-server/alerts/${id}/media`,
    screenshots: `/api/video-server/alerts/${id}/screenshots`,
    videos: `/api/video-server/alerts/${id}/videos`,
    preVideo: `/api/video-server/alerts/${id}/video/pre`,
    postVideo: `/api/video-server/alerts/${id}/video/post`,
    requestReportVideo: `/api/video-server/alerts/${id}/request-report-video`,
    collectEvidence: `/api/video-server/alerts/${id}/collect-evidence`,
  };
}

function mapRecentAlert(raw: AnyRecord, baseUrl: string): AnyRecord {
  const id = String(raw?.id || '').trim();
  const vehicleId = String(raw?.vehicleId || raw?.device_id || raw?.vehicle_id || '').trim();
  const status = normalizeAlertStatus(raw);
  const priority = normalizeAlertPriority(raw);
  const timestamp = normalizeTimestamp(raw);
  const directVideo = toProxyMediaUrl(raw?.videoUrl || raw?.video_url, baseUrl);
  const metadata = (raw?.metadata && typeof raw.metadata === 'object') ? { ...raw.metadata } : {};
  const existingVideoClips = (metadata?.videoClips && typeof metadata.videoClips === 'object')
    ? metadata.videoClips
    : {};
  const mediaLinks = buildAlertMediaLinks(id);
  return {
    ...raw,
    id,
    vehicleId,
    vehicle_id: vehicleId,
    device_id: vehicleId || String(raw?.device_id || '').trim(),
    channel: Number(raw?.channel || 1) || 1,
    alert_type: String(raw?.alert_type || raw?.label || raw?.type || 'Alert'),
    type: String(raw?.type || raw?.alert_type || raw?.label || 'Alert'),
    status,
    priority,
    resolved: isResolvedStatus(status) || raw?.resolved === true,
    timestamp,
    created_at: raw?.created_at || raw?.loggedAt || timestamp,
    last_occurrence: raw?.last_occurrence || timestamp,
    videoUrl: directVideo || undefined,
    mediaLinks,
    metadata: {
      ...metadata,
      videoClips: {
        ...existingVideoClips,
        ...(directVideo ? { cameraVideo: directVideo } : {}),
      },
    },
  };
}

function groupAlertsByPriority(alerts: AnyRecord[]) {
  const grouped: Record<'critical' | 'high' | 'medium' | 'low', AnyRecord[]> = {
    critical: [],
    high: [],
    medium: [],
    low: [],
  };
  for (const alert of alerts) {
    grouped[normalizeAlertPriority(alert)].push(alert);
  }
  grouped.critical.sort(sortByLatest);
  grouped.high.sort(sortByLatest);
  grouped.medium.sort(sortByLatest);
  grouped.low.sort(sortByLatest);
  return grouped;
}

function filterAlertsByStatus(alerts: AnyRecord[], statusFilter: string): AnyRecord[] {
  const status = String(statusFilter || '').trim().toLowerCase();
  if (!status) return alerts;
  if (status === 'active') {
    return alerts.filter((a) => !isResolvedStatus(String(a?.status || '')) && a?.resolved !== true);
  }
  if (status === 'new') {
    return alerts.filter((a) => String(a?.status || '').toLowerCase() === 'new' && a?.resolved !== true);
  }
  if (status === 'resolved' || status === 'closed') {
    return alerts.filter((a) => isResolvedStatus(String(a?.status || '')) || a?.resolved === true);
  }
  return alerts.filter((a) => String(a?.status || '').toLowerCase() === status);
}

async function fetchRecentAlertsFromGoHub(baseUrl: string, limit: number): Promise<AnyRecord[]> {
  const boundedLimit = Math.max(1, Math.min(limit, 2000));
  const response = await fetch(`${baseUrl}/api/alerts/recent?limit=${boundedLimit}`, {
    method: 'GET',
    cache: 'no-store',
    next: { revalidate: 0 },
  });
  if (!response.ok) {
    throw new Error(`Alert hub recent endpoint returned ${response.status}`);
  }
  const payload = await response.json().catch(() => ({}));
  const rows = Array.isArray(payload?.alerts) ? payload.alerts : [];
  return rows.map((row: AnyRecord) => mapRecentAlert(row, baseUrl)).sort(sortByLatest);
}

function selectAlertVideoEntries(alert: AnyRecord, baseUrl: string) {
  const out: AnyRecord[] = [];
  const seen = new Set<string>();
  const push = (entry: AnyRecord, label: string) => {
    const url = toProxyMediaUrl(entry?.fileUrl || entry?.videoUrl || entry?.url || '', baseUrl);
    if (!url || seen.has(url)) return;
    seen.add(url);
    out.push({
      id: entry?.id || `${label}-${out.length + 1}`,
      label,
      url,
      storage_url: url,
      fileUrl: url,
      timestamp: entry?.createdAt || entry?.timestamp || alert?.timestamp,
    });
  };
  if (Array.isArray(alert?.videoCaptures)) {
    alert.videoCaptures.forEach((row: AnyRecord) => push(row, 'capture'));
  }
  if (Array.isArray(alert?.videoCapturesAllChannels)) {
    alert.videoCapturesAllChannels.forEach((row: AnyRecord) => push(row, 'capture'));
  }
  if (alert?.videoUrl) {
    push({ fileUrl: alert.videoUrl }, 'primary');
  }
  return out;
}

function buildAlertDetail(alert: AnyRecord, baseUrl: string): AnyRecord {
  const id = String(alert?.id || '').trim();
  const mediaLinks = buildAlertMediaLinks(id);
  const entries = selectAlertVideoEntries(alert, baseUrl);
  const primaryUrl = entries[0]?.url || toProxyMediaUrl(alert?.videoUrl, baseUrl) || '';
  const preUrl = primaryUrl || '';
  const postUrl = primaryUrl || '';
  const camUrl = primaryUrl || '';
  return {
    ...alert,
    mediaLinks,
    videoUrl: preUrl || undefined,
    preIncidentVideoUrl: preUrl || undefined,
    postIncidentVideoUrl: postUrl || undefined,
    cameraVideoUrl: camUrl || undefined,
    preIncidentRawUrl: preUrl,
    postIncidentRawUrl: postUrl,
    preIncidentReady: !!primaryUrl,
    postIncidentReady: !!primaryUrl,
    screenshots: [],
    metadata: {
      ...(alert?.metadata && typeof alert.metadata === 'object' ? alert.metadata : {}),
      videoClips: {
        ...((alert?.metadata?.videoClips && typeof alert.metadata.videoClips === 'object') ? alert.metadata.videoClips : {}),
        ...(primaryUrl ? { cameraVideo: camUrl, cameraPreVideo: preUrl, cameraPostVideo: postUrl } : {}),
      },
      captures: entries,
    },
  };
}

async function findAlertById(baseUrl: string, alertId: string): Promise<AnyRecord | null> {
  const alerts = await fetchRecentAlertsFromGoHub(baseUrl, 2000);
  return alerts.find((alert) => String(alert?.id || '') === String(alertId)) || null;
}

function okJson(payload: AnyRecord, status = 200): Response {
  return Response.json(payload, {
    status,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      Pragma: 'no-cache',
      Expires: '0',
    },
  });
}

async function handleAlertHubCompatGet(request: NextRequest, pathArray: string[], baseUrl: string): Promise<Response> {
  const search = request.nextUrl.searchParams;
  const second = String(pathArray[1] || '').trim().toLowerCase();
  const third = String(pathArray[2] || '').trim().toLowerCase();

  if (!second || second === 'active') {
    const limit = toInt(search.get('limit'), 200, 1, 2000);
    const statusFilter = String(search.get('status') || (second === 'active' ? 'active' : '')).trim().toLowerCase();
    let alerts = await fetchRecentAlertsFromGoHub(baseUrl, Math.max(limit, 200));
    if (!statusFilter && !second) {
      alerts = alerts.filter((a) => !isResolvedStatus(String(a?.status || '')) && a?.resolved !== true);
    } else if (statusFilter) {
      alerts = filterAlertsByStatus(alerts, statusFilter);
    }
    alerts = alerts.slice(0, limit);
    return okJson({
      success: true,
      alerts,
      count: alerts.length,
      source: 'go-vid-hub',
      target: baseUrl,
    });
  }

  if (second === 'by-priority') {
    const alerts = (await fetchRecentAlertsFromGoHub(baseUrl, 1000))
      .filter((a) => !isResolvedStatus(String(a?.status || '')) && a?.resolved !== true);
    return okJson({
      success: true,
      alertsByPriority: groupAlertsByPriority(alerts),
      count: alerts.length,
      source: 'go-vid-hub',
      target: baseUrl,
    });
  }

  if (second === 'unattended') {
    const minutes = toInt(search.get('minutes'), 30, 1, 1440);
    const cutoffMs = minutes * 60 * 1000;
    const nowMs = Date.now();
    const activeAlerts = (await fetchRecentAlertsFromGoHub(baseUrl, 1000))
      .filter((a) => !isResolvedStatus(String(a?.status || '')) && a?.resolved !== true);
    const unattendedAlerts = activeAlerts
      .map((a) => {
        const ts = new Date(a?.timestamp || a?.last_occurrence || 0).getTime();
        const ageMinutes = ts > 0 ? Math.floor((nowMs - ts) / 60000) : 0;
        return { ...a, minutes_unattended: Math.max(0, ageMinutes) };
      })
      .filter((a) => (a.minutes_unattended || 0) >= minutes)
      .sort((a, b) => (b.minutes_unattended || 0) - (a.minutes_unattended || 0));
    return okJson({
      success: true,
      unattendedAlerts,
      count: unattendedAlerts.length,
      thresholdMinutes: minutes,
      source: 'go-vid-hub',
      target: baseUrl,
    });
  }

  if (second === 'history') {
    const days = toInt(search.get('days'), 30, 1, 365)
    const limit = toInt(search.get('limit'), 200, 1, 2000)
    const deviceId = String(search.get('device_id') || search.get('vehicleId') || '').trim()
    const cutoffMs = Date.now() - days * 24 * 60 * 60 * 1000

    let alerts = await fetchRecentAlertsFromGoHub(baseUrl, Math.max(limit, 600))
    alerts = alerts.filter((row) => {
      const ts = new Date(row?.last_occurrence || row?.timestamp || row?.created_at || 0).getTime()
      if (!Number.isFinite(ts) || ts <= 0 || ts < cutoffMs) return false
      if (!deviceId) return true
      const rowVehicle = String(row?.vehicleId || row?.device_id || row?.vehicle_id || '').trim()
      return rowVehicle === deviceId
    })
    alerts.sort(sortByLatest)
    const history = alerts.slice(0, limit)

    return okJson({
      success: true,
      alerts: history,
      history,
      count: history.length,
      days,
      source: 'go-vid-hub',
      target: baseUrl,
    })
  }

  const alertId = second;
  const alert = await findAlertById(baseUrl, alertId);
  if (!alert) {
    return okJson({ success: false, message: `Alert ${alertId} not found`, target: baseUrl }, 404);
  }
  const detail = buildAlertDetail(alert, baseUrl);
  const entries = selectAlertVideoEntries(alert, baseUrl);
  const primaryUrl = entries[0]?.url || '';

  if (!third) {
    return okJson({ success: true, alert: detail, target: baseUrl });
  }

  if (third === 'history') {
    const history = [
      { action_type: 'created', action_at: detail.timestamp, notes: null },
      ...(isResolvedStatus(String(detail.status || ''))
        ? [{ action_type: 'resolved', action_at: detail.updated_at || detail.timestamp, notes: detail?.resolution_notes || null }]
        : []),
    ];
    return okJson({
      success: true,
      data: {
        alert_id: detail.id,
        device_id: detail.device_id,
        alert_type: detail.alert_type,
        priority: detail.priority,
        status: detail.status,
        history,
      },
      target: baseUrl,
    });
  }

  if (third === 'screenshots') {
    return okJson({
      success: true,
      screenshots: [],
      count: 0,
      source: 'go-vid-hub',
      target: baseUrl,
    });
  }

  if (third === 'media') {
    return okJson({
      success: true,
      alert: detail,
      screenshots: [],
      videos: entries,
      captures: entries,
      alertCaptures: entries,
      clipUrls: {
        pre: detail.preIncidentVideoUrl,
        post: detail.postIncidentVideoUrl,
        camera: detail.cameraVideoUrl,
        preRaw: detail.preIncidentRawUrl,
        postRaw: detail.postIncidentRawUrl,
      },
      target: baseUrl,
    });
  }

  if (third === 'videos') {
    return okJson({
      success: true,
      alert_id: detail.id,
      device_id: detail.device_id,
      channel: detail.channel,
      alert_type: detail.alert_type,
      timestamp: detail.timestamp,
      media_links: detail.mediaLinks,
      default_source: 'camera_sd',
      preferred_source: primaryUrl ? 'camera_sd' : 'none',
      videos: {
        pre_event: {
          path: primaryUrl || null,
          url: detail.preIncidentVideoUrl,
          raw_url: detail.preIncidentRawUrl || detail.preIncidentVideoUrl,
          frames: 0,
          duration: 0,
          description: 'Alert video from go-vid-hub recent captures',
        },
        post_event: {
          path: primaryUrl || null,
          url: detail.postIncidentVideoUrl,
          raw_url: detail.postIncidentRawUrl || detail.postIncidentVideoUrl,
          frames: 0,
          duration: 0,
          description: 'Alert video from go-vid-hub recent captures',
        },
        camera_sd: {
          path: primaryUrl || null,
          url: detail.cameraVideoUrl,
          raw_url: detail.cameraVideoUrl,
          request_url: detail.mediaLinks.requestReportVideo,
          description: 'Alert video from go-vid-hub recent captures',
        },
        database_records: entries,
      },
      total_videos: entries.length,
      has_pre_event: !!primaryUrl,
      has_post_event: !!primaryUrl,
      has_camera_video: !!primaryUrl,
      linked: { screenshotsLinked: 0, videosLinked: entries.length },
      target: baseUrl,
    });
  }

  if (third === 'video') {
    const clipType = String(pathArray[3] || '').trim().toLowerCase();
    const candidate =
      clipType === 'pre' ? detail.preIncidentRawUrl :
      clipType === 'post' ? detail.postIncidentRawUrl :
      clipType === 'camera' ? detail.cameraVideoUrl :
      '';
    if (!candidate) {
      return okJson({
        success: false,
        message: `No ${clipType || 'video'} clip available for alert ${alertId}`,
        target: baseUrl,
      }, 404);
    }
    const redirectUrl = candidate.startsWith('/')
      ? new URL(candidate, request.nextUrl.origin).toString()
      : candidate;
    return Response.redirect(redirectUrl, 302);
  }

  return okJson({
    success: false,
    message: `Unsupported alert path: ${pathArray.join('/')}`,
    target: baseUrl,
  }, 404);
}

async function handleAlertHubCompatPost(pathArray: string[], baseUrl: string, body: AnyRecord): Promise<Response> {
  const alertId = String(pathArray[1] || '').trim();
  const action = String(pathArray[2] || '').trim().toLowerCase();
  if (!alertId || !action) {
    return okJson({ success: false, message: 'Invalid alert route' }, 400);
  }

  if (action === 'close' || action === 'resolve-with-notes' || action === 'mark-false') {
    const payload: AnyRecord = { ...(body || {}), alertId };
    if (action === 'resolve-with-notes') {
      payload.closureType = 'resolved';
      payload.notes = body?.notes || payload.notes || '';
      payload.actor = body?.resolvedBy || body?.actor || 'srs-user';
    } else if (action === 'mark-false') {
      payload.closureType = 'false_alert';
      payload.notes = body?.notes || body?.reason || payload.notes || '';
      payload.reasonCode = body?.reasonCode || body?.false_alert_reason_code || '';
      payload.reasonLabel = body?.reasonLabel || body?.false_alert_reason || '';
      payload.actor = body?.actor || 'srs-user';
    } else if (!payload.closureType) {
      payload.closureType = 'resolved';
    }

    const closeRes = await fetch(`${baseUrl}/api/alerts/close`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      cache: 'no-store',
    });
    const closeBody = await closeRes.json().catch(() => ({}));
    const normalizedCloseBody = normalizeProxiedMediaUrls(closeBody, baseUrl);
    return okJson(
      typeof normalizedCloseBody === 'object' && normalizedCloseBody
        ? (normalizedCloseBody as AnyRecord)
        : { success: closeRes.ok, alertId, target: baseUrl },
      closeRes.status,
    );
  }

  if (action === 'acknowledge' || action === 'escalate' || action === 'collect-evidence' || action === 'request-report-video') {
    return okJson({
      success: true,
      alertId,
      action,
      message: `Action ${action} accepted (compat mode on go-vid-hub)`,
      target: baseUrl,
    });
  }

  return okJson({
    success: false,
    message: `Unsupported alert action: ${action}`,
    target: baseUrl,
  }, 404);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path: pathArray } = await params
  const path = pathArray.join('/')
  const firstSegment = String(pathArray[0] || '').toLowerCase()
  const secondSegment = String(pathArray[1] || '').toLowerCase()
  const thirdSegment = String(pathArray[2] || '').toLowerCase()

  if (firstSegment === 'live' && secondSegment === 'ready') {
    return handleLiveReady(request)
  }

  const searchParams = request.nextUrl.searchParams.toString()
  const target = resolveVideoServerProxyBase(pathArray)

  if (firstSegment === 'vehicles' && thirdSegment === 'live.mjpeg') {
    return handleVehicleLiveMjpegProxy(request, pathArray, target.baseUrl)
  }

  if (firstSegment === 'vehicles' && thirdSegment === 'screenshot') {
    return handleVehicleScreenshotProxy(request, pathArray, target.baseUrl)
  }

  const upstreamPath = (firstSegment === 'media' || firstSegment === 'captures') ? `/${path}` : `/api/${path}`
  const url = `${target.baseUrl}${upstreamPath}${searchParams ? `?${searchParams}` : ''}`
  const lowerPath = `/${path}`.toLowerCase()
  const isDirectMediaRequest =
    /\/file(?:$|\?)/i.test(lowerPath) ||
    /\.(mp4|m3u8|ts|m4s|jpg|jpeg|png|webp)(?:$|\?)/i.test(lowerPath)

  try {
    if (target.name === 'alertHub' && firstSegment === 'alerts') {
      return handleAlertHubCompatGet(request, pathArray, target.baseUrl);
    }

    const forwardedHeaders: Record<string, string> = {}
    const range = request.headers.get('range')
    if (range) forwardedHeaders['range'] = range

    const response = await fetch(url, {
      method: 'GET',
      headers: forwardedHeaders,
      cache: 'no-store',
      next: { revalidate: 0 },
    })

    if (isDirectMediaRequest) {
      const passHeaders = new Headers()
      const passThroughKeys = [
        'content-type',
        'content-length',
        'content-disposition',
        'cache-control',
        'accept-ranges',
        'content-range',
        'etag',
        'last-modified'
      ]
      passThroughKeys.forEach((key) => {
        const value = response.headers.get(key)
        if (value) passHeaders.set(key, value)
      })

      return new Response(response.body, {
        status: response.status,
        headers: passHeaders
      })
    }

    const contentType = response.headers.get('content-type') || ''

    if (contentType.includes('application/json')) {
      const data = await response.json()
      const normalizedData = normalizeProxiedMediaUrls(data, target.baseUrl)
      return Response.json(normalizedData, {
        status: response.status,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          Pragma: 'no-cache',
          Expires: '0'
        }
      })
    }

    const passHeaders = new Headers()
    const passThroughKeys = [
      'content-type',
      'content-length',
      'content-disposition',
      'cache-control',
      'accept-ranges',
      'content-range',
      'etag',
      'last-modified'
    ]
    passThroughKeys.forEach((key) => {
      const value = response.headers.get(key)
      if (value) passHeaders.set(key, value)
    })

    return new Response(response.body, {
      status: response.status,
      headers: passHeaders
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return Response.json(
      {
        success: false,
        message: `Failed to fetch from ${target.name}`,
        error: message,
        target: target.name,
        targetUrl: url
      },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path: pathArray } = await params
  const path = pathArray.join('/')
  const target = resolveVideoServerProxyBase(pathArray)
  const url = `${target.baseUrl}/api/${path}`
  const body = await request.json().catch(() => ({}))
  const firstSegment = String(pathArray[0] || '').toLowerCase()

  try {
    if (target.name === 'alertHub' && firstSegment === 'alerts') {
      return handleAlertHubCompatPost(pathArray, target.baseUrl, body as AnyRecord);
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    const data = await response.json()
    const normalizedData = normalizeProxiedMediaUrls(data, target.baseUrl)
    return Response.json(normalizedData, { status: response.status })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return Response.json(
      {
        success: false,
        message: `Failed to post to ${target.name}`,
        error: message,
        target: target.name,
        targetUrl: url
      },
      { status: 500 }
    )
  }
}
