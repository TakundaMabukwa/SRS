import { NextRequest } from 'next/server'
import { resolveVideoServerProxyBase } from '@/lib/backend-hubs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

type AnyRecord = Record<string, any>

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
  const searchParams = request.nextUrl.searchParams.toString()
  const target = resolveVideoServerProxyBase(pathArray)
  const firstSegment = String(pathArray[0] || '').toLowerCase()
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
