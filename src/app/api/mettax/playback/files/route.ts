import { NextRequest, NextResponse } from 'next/server';
import https from 'https';

const METTAX_BASE = 'https://www.skycamx.co.za/gps/v2/openapi';
const API_KEY = process.env.VIDEO_API_KEY || 'BD77yBg2Rw';
const API_SECRET = process.env.VIDEO_API_SECRET || 'jM6UdTKpTBeltqYPqlPP';

let cachedToken: string | null = null;
let tokenExpiry = 0;
let cachedUploadTasks: any[] = [];
let uploadTasksExpiry = 0;
const UPLOAD_CACHE_TTL = 2 * 60 * 1000;

const agent = new https.Agent({ rejectUnauthorized: false });

function mettaxPostRaw(endpoint: string, body: Record<string, unknown>, token?: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const url = new URL(`${METTAX_BASE}${endpoint}`);
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = token;
    const bodyStr = JSON.stringify(body);
    headers['Content-Length'] = Buffer.byteLength(bodyStr).toString();

    const req = https.request({
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname,
      method: 'POST',
      headers,
      agent,
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (!data || !data.trim()) { resolve({ code: -1, msg: 'Empty response' }); return; }
        try { resolve(JSON.parse(data)); }
        catch { resolve({ code: -1, msg: 'Invalid JSON' }); }
      });
    });
    req.on('error', reject);
    req.write(bodyStr);
    req.end();
  });
}

async function getMettaxToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken;
  const data = await mettaxPostRaw('/system/createToken', { apiKey: API_KEY, apiSecret: API_SECRET });
  if (data.code !== 0 || !data.data) throw new Error(data.msg || 'Mettax auth failed');
  cachedToken = data.data;
  tokenExpiry = Date.now() + 4 * 60 * 60 * 1000;
  return cachedToken;
}

async function mettaxPost(endpoint: string, body: Record<string, unknown>) {
  const token = await getMettaxToken();
  let data = await mettaxPostRaw(endpoint, body, token);
  if (data.code === 10000 || data.code === 10001) {
    cachedToken = null;
    tokenExpiry = 0;
    const newToken = await getMettaxToken();
    data = await mettaxPostRaw(endpoint, body, newToken);
  }
  return data;
}

async function getUploadTasks(): Promise<any[]> {
  if (cachedUploadTasks.length > 0 && Date.now() < uploadTasksExpiry) {
    return cachedUploadTasks;
  }
  const taskData = await mettaxPost('/video/history/upload/task', { pageSize: 200, pageIndex: 1 });
  if (taskData.code === 0 && Array.isArray(taskData.data?.records)) {
    cachedUploadTasks = taskData.data.records;
    uploadTasksExpiry = Date.now() + UPLOAD_CACHE_TTL;
  }
  return cachedUploadTasks;
}

export async function POST(req: NextRequest) {
  try {
    const { deviceId, channelId, startTime, endTime } = await req.json();
    if (!deviceId) {
      return NextResponse.json({ success: false, message: 'deviceId required', data: { files: [] } });
    }

    const now = new Date();
    const defaultEnd = (endTime || now.toISOString()).replace('T', ' ').slice(0, 19);
    const defaultStart = startTime || new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString().replace('T', ' ').slice(0, 19);

    // ── Step 1: Try history/list (device online) ──
    const data = await mettaxPost('/video/history/list', {
      deviceId,
      channelId: Number(channelId || 1),
      startTime: defaultStart,
      endTime: defaultEnd,
    });

    console.log('[PLAYBACK FILES] deviceId:', deviceId, 'history/list code:', data.code, 'msg:', data.msg);

    let files: any[] = [];

    if (data.code === 0 && Array.isArray(data.data)) {
      // Return ALL files from history/list — they're on the device and streamable via replay
      files = data.data
        .filter((r: any) => !channelId || r.channelId === Number(channelId))
        .map((r: any) => ({
          deviceName: r.deviceName || '',
          channelId: r.channelId,
          fileSize: r.fileSize || 0,
          startTime: r.startTime || '',
          endTime: r.endTime || '',
          fileUrl: r.fileUrl || null,
          fileType: r.fileType || '',
          streamable: true,
        }));
      console.log('[PLAYBACK FILES] history/list returned', files.length, 'files from device');
    }

    // ── Step 2: Also check upload tasks for this device + day ──
    const allTasks = await getUploadTasks();
    const dayPrefix = defaultStart.slice(0, 10); // "2026-08-31"

    const taskFiles = allTasks
      .filter((t: any) =>
        t.deviceId === deviceId &&
        t.status === 1 &&
        t.fileUrl &&
        (!channelId || t.channelId === Number(channelId)) &&
        t.fileStartTime &&
        t.fileStartTime.startsWith(dayPrefix)
      )
      .map((t: any) => ({
        deviceName: t.deviceName || '',
        channelId: t.channelId,
        fileSize: t.fileSize || 0,
        startTime: t.fileStartTime || '',
        endTime: t.fileEndTime || '',
        fileUrl: t.fileUrl,
        fileType: 'mp4',
      }));

    // Merge: history/list files + upload task files, deduplicate by startTime
    const seen = new Set(files.map((f: any) => `${f.channelId}_${f.startTime}`));
    for (const tf of taskFiles) {
      const key = `${tf.channelId}_${tf.startTime}`;
      if (!seen.has(key)) {
        files.push(tf);
        seen.add(key);
      }
    }

    // Sort by startTime
    files.sort((a: any, b: any) => (a.startTime || '').localeCompare(b.startTime || ''));

    console.log('[PLAYBACK FILES] total available:', files.length, 'for device', deviceId);
    return NextResponse.json({ success: true, data: { files } });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message, data: { files: [] } });
  }
}
