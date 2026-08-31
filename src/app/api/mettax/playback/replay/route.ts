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

const agent = new https.Agent({ rejectUnauthorized: false, keepAlive: true });

function mettaxPostRaw(endpoint: string, body: Record<string, unknown>, token?: string, timeoutMs = 15000): Promise<any> {
  return new Promise((resolve) => {
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
      timeout: timeoutMs,
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (!data || !data.trim()) { resolve({ code: -1, msg: 'Empty response' }); return; }
        try { resolve(JSON.parse(data)); }
        catch { resolve({ code: -1, msg: 'Invalid JSON' }); }
      });
    });
    req.on('timeout', () => { req.destroy(); resolve({ code: -1, msg: 'timeout' }); });
    req.on('error', (err) => resolve({ code: -1, msg: err.message }));
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

async function mettaxPost(endpoint: string, body: Record<string, unknown>, timeoutMs = 15000) {
  const token = await getMettaxToken();
  let data = await mettaxPostRaw(endpoint, body, token, timeoutMs);
  if (data.code === 10000 || data.code === 10001) {
    cachedToken = null;
    tokenExpiry = 0;
    const newToken = await getMettaxToken();
    data = await mettaxPostRaw(endpoint, body, newToken, timeoutMs);
  }
  return data;
}

async function getUploadTasks(): Promise<any[]> {
  if (cachedUploadTasks.length > 0 && Date.now() < uploadTasksExpiry) {
    return cachedUploadTasks;
  }
  const taskData = await mettaxPost('/video/history/upload/task', { pageSize: 200, pageIndex: 1 }, 15000);
  if (taskData.code === 0 && Array.isArray(taskData.data?.records)) {
    cachedUploadTasks = taskData.data.records;
    uploadTasksExpiry = Date.now() + UPLOAD_CACHE_TTL;
  }
  return cachedUploadTasks;
}

export async function POST(req: NextRequest) {
  try {
    const { deviceId, channelId, startTime, endTime } = await req.json();
    if (!deviceId || !startTime || !endTime) {
      return NextResponse.json({ success: false, message: 'deviceId, startTime, endTime required' });
    }

    // ── Step 1: Try live replay (streams from device, 10s timeout) ──
    const data = await mettaxPost('/video/history/replay', {
      deviceId,
      channelId: Number(channelId || 1),
      playbackType: 0,
      fastForwardOrBackward: 1,
      startTime,
      endTime,
    }, 10000);

    console.log('[PLAYBACK REPLAY] deviceId:', deviceId, 'code:', data.code, 'msg:', data.msg);

    if (data.code === 0 && data.data) {
      console.log('[PLAYBACK REPLAY] live FLV stream:', data.data);
      return NextResponse.json({ success: true, data: { replayUrl: data.data } });
    }

    // ── Step 2: Device offline/slow — fall back to cached uploaded MP4 ──
    console.log('[PLAYBACK REPLAY] live replay unavailable, checking cached upload tasks');
    const allTasks = await getUploadTasks();

    let match = allTasks.find((t: any) =>
      t.deviceId === deviceId &&
      t.status === 1 &&
      t.fileUrl &&
      t.channelId === Number(channelId || 1) &&
      t.fileStartTime <= endTime &&
      t.fileEndTime >= startTime
    );

    if (!match) {
      match = allTasks.find((t: any) =>
        t.deviceId === deviceId &&
        t.status === 1 &&
        t.fileUrl &&
        t.channelId === Number(channelId || 1)
      );
    }

    if (match) {
      console.log('[PLAYBACK REPLAY] using uploaded MP4:', match.fileUrl);
      return NextResponse.json({ success: true, data: { replayUrl: match.fileUrl } });
    }

    return NextResponse.json({ success: false, message: data.msg === 'timeout' ? 'Device did not respond. It may be offline.' : (data.msg || 'No replay available.') });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message });
  }
}
