import { NextRequest, NextResponse } from 'next/server';
import { getLiveVideoRuntimeBaseUrl } from '@/lib/backend-hubs';

function readRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function normalizeConnectedVehicles(payload: unknown) {
  const root = readRecord(payload);
  const rootData = readRecord(root.data);
  const vehicles = Array.isArray(payload)
    ? payload
    : Array.isArray(root.vehicles)
      ? root.vehicles
      : Array.isArray(root.data)
        ? root.data
        : Array.isArray(rootData.vehicles)
          ? rootData.vehicles
          : [];

  return {
    success: true,
    data: {
      devices: vehicles.map((entry) => {
        const vehicle = readRecord(entry);
        const deviceId = String(
          vehicle.id ??
            vehicle.deviceId ??
            vehicle.vehicleId ??
            vehicle.phone ??
            ''
        ).trim();
        const rawChannels = Array.isArray(vehicle.channels) ? vehicle.channels : [];
        const channels = rawChannels
          .map((channelEntry) => {
            const channel = readRecord(channelEntry);
            const channelId = Number(
              channel.logicalChannel ??
                channel.channelId ??
                channel.channel ??
                0
            );
            if (!Number.isFinite(channelId) || channelId <= 0) return null;
            return {
              channelId,
              streamUrl: `/api/video-server/stream/${encodeURIComponent(deviceId)}/${encodeURIComponent(String(channelId))}/playlist.m3u8`,
            };
          })
          .filter(Boolean);

        return {
          plateName: String(vehicle.displayLabel ?? vehicle.registration ?? deviceId).trim(),
          deviceId,
          channels,
          cameras: channels.length,
          connected: vehicle.connected !== false,
          activeStreams: Array.isArray(vehicle.activeStreams) ? vehicle.activeStreams : [],
        };
      }),
    },
  };
}

export async function GET() {
  try {
    const videoServerUrl = getLiveVideoRuntimeBaseUrl();

    const legacyResponse = await fetch(`${videoServerUrl}/api/stream/network`, {
      method: 'GET',
    }).catch(() => null);

    if (legacyResponse?.ok) {
      const data = await legacyResponse.json();
      return NextResponse.json(data, { status: legacyResponse.status });
    }

    const connectedResponse = await fetch(`${videoServerUrl}/api/vehicles/connected`, {
      method: 'GET',
    });

    const data = await connectedResponse.json();
    return NextResponse.json(
      normalizeConnectedVehicles(data),
      { status: connectedResponse.status }
    );
  } catch (error) {
    console.error('Error proxying video streams request:', error);
    return NextResponse.json(
      { error: 'Failed to fetch video streams' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const videoServerUrl = getLiveVideoRuntimeBaseUrl();

    const response = await fetch(`${videoServerUrl}/api/stream/vehicles/streams`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Error proxying video streams request:', error);
    return NextResponse.json(
      { error: 'Failed to fetch video streams' },
      { status: 500 }
    );
  }
}
