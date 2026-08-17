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
        try { resolve(JSON.parse(data)); }
        catch { reject(new Error('Invalid JSON from Mettax')); }
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
    const { alarmId } = await req.json();

    if (!alarmId) {
      return NextResponse.json({ success: false, message: 'alarmId required' }, { status: 400 });
    }

    // 1. Fetch screenshots/videos from /alarm/file/id
    const mediaRes = await mettaxPost('/alarm/file/id', { alarmId });
    let files: Array<{ fileUrl: string; fileType: string; fileSize: number }> = [];

    if (mediaRes.code === 0 && Array.isArray(mediaRes.data)) {
      files = mediaRes.data;
    }

    const screenshots = files
      .filter(f => f.fileType === '00' || f.fileType === '01' || !f.fileType)
      .map((f, i) => ({ id: `mettax-${i}`, url: f.fileUrl, type: 'screenshot' }));

    const videos = files
      .filter(f => f.fileType === '02')
      .map((f, i) => ({
        id: `mettax-v${i}`,
        url: f.fileUrl,
        type: 'video',
      }));

    return NextResponse.json({ success: true, screenshots, videos, files });
  } catch (err: any) {
    console.error('[METTAX MEDIA] Error:', err.message);
    return NextResponse.json({ success: false, message: err.message, stack: err.stack }, { status: 500 });
  }
}
