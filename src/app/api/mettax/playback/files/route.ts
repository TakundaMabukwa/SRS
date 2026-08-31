import { NextRequest, NextResponse } from 'next/server';
import https from 'https';

const METTAX_BASE = 'https://www.skycamx.co.za/gps/v2/openapi';
const API_KEY = process.env.VIDEO_API_KEY || 'BD77yBg2Rw';
const API_SECRET = process.env.VIDEO_API_SECRET || 'jM6UdTKpTBeltqYPqlPP';

let cachedToken: string | null = null;
let tokenExpiry = 0;

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

export async function POST(req: NextRequest) {
  try {
    const { deviceId, channelId, startTime, endTime } = await req.json();
    if (!deviceId) {
      return NextResponse.json({ success: false, message: 'deviceId required', data: { files: [] } });
    }

    const now = new Date();
    const defaultEnd = (endTime || now.toISOString()).replace('T', ' ').slice(0, 19);
    const defaultStart = startTime || new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString().replace('T', ' ').slice(0, 19);

    const body: Record<string, unknown> = {
      deviceId,
      channelId: Number(channelId || 1),
      startTime: defaultStart,
      endTime: defaultEnd,
    };

    const data = await mettaxPost('/video/history/list', body);

    console.log('[PLAYBACK FILES] deviceId:', deviceId, 'code:', data.code, 'records:', data.data?.length);

    if (data.code !== 0) {
      return NextResponse.json({ success: false, message: data.msg || 'Failed', data: { files: [] } });
    }

    const allRecords = Array.isArray(data.data) ? data.data : [];

    const records = allRecords
      .filter((r: any) => !channelId || r.channelId === Number(channelId))
      .map((r: any) => ({
        deviceName: r.deviceName || '',
        channelId: r.channelId,
        fileSize: r.fileSize || 0,
        startTime: r.startTime || '',
        endTime: r.endTime || '',
        fileUrl: r.fileUrl || null,
        fileType: r.fileType || '',
      }));

    return NextResponse.json({ success: true, data: { files: records } });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message, data: { files: [] } });
  }
}
