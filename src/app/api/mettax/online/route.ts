import { NextRequest, NextResponse } from 'next/server';
import https from 'https';

const METTAX_BASE = 'https://www.skycamx.co.za/gps/v2/openapi';
const API_KEY = process.env.VIDEO_API_KEY || 'BD77yBg2Rw';
const API_SECRET = process.env.VIDEO_API_SECRET || 'jM6UdTKpTBeltqYPqlPP';

let cachedToken: string | null = null;
let tokenExpiry = 0;
let cachedDevices: any[] = [];
let devicesCacheExpiry = 0;

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

export async function POST(_req: NextRequest) {
  try {
    // Return cached result if fresh (30s)
    if (cachedDevices.length > 0 && Date.now() < devicesCacheExpiry) {
      return NextResponse.json({ success: true, data: { devices: cachedDevices }, cached: true });
    }

    // Step 1: Get customerId
    const customerRes = await mettaxPost('/customer/tree', { customerId: null });
    if (customerRes.code !== 0 || !customerRes.data?.length) {
      throw new Error('Unable to get customer ID');
    }
    const customerId = customerRes.data[0].id;

    // Step 2: Get device shadow (online status) — retry if result seems incomplete
    let shadowRes = await mettaxPost('/device/shadow/customer', { customerId });
    if (shadowRes.code !== 0) {
      throw new Error('Failed to get device status');
    }

    let devices = (shadowRes.data || []).map((d: any) => ({
      plateName: d.deviceData?.deviceName || '',
      deviceId: d.deviceData?.deviceId || '',
      online: d.expand?.status === true,
      lastSeen: d.expand?.reportTime || d.expand?.activeTime || '',
      cameras: 0,
    }));

    // If we got suspiciously few devices, retry once
    if (devices.length < 10) {
      await new Promise(r => setTimeout(r, 1000));
      shadowRes = await mettaxPost('/device/shadow/customer', { customerId });
      if (shadowRes.code === 0 && (shadowRes.data?.length || 0) > devices.length) {
        devices = (shadowRes.data || []).map((d: any) => ({
          plateName: d.deviceData?.deviceName || '',
          deviceId: d.deviceData?.deviceId || '',
          online: d.expand?.status === true,
          lastSeen: d.expand?.reportTime || d.expand?.activeTime || '',
          cameras: 0,
        }));
      }
    }

    // Only update cache if we got a reasonable result (>=80% of previous count, or first load)
    if (devices.length > 0 && (cachedDevices.length === 0 || devices.length >= cachedDevices.length * 0.8)) {
      cachedDevices = devices;
      devicesCacheExpiry = Date.now() + 5 * 60 * 1000;
    }

    // Return the best result we have
    const bestDevices = cachedDevices.length > devices.length ? cachedDevices : devices;
    return NextResponse.json({ success: true, data: { devices: bestDevices } });
  } catch (err: any) {
    console.error('[METTAX ONLINE] Error:', err.message);
    // Return cached result if available, even if stale
    if (cachedDevices.length > 0) {
      return NextResponse.json({ success: true, data: { devices: cachedDevices }, cached: true, stale: true });
    }
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
