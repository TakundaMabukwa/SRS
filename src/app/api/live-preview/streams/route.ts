import { NextResponse } from "next/server";
import { getLivePreviewBaseUrl } from "@/lib/backend-hubs";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type GenericRecord = Record<string, unknown>;

function readRecord(value: unknown): GenericRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as GenericRecord)
    : {};
}

function toPositiveNumber(value: unknown): number | null {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.round(parsed);
}

function parseChannelArray(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  const channels = value
    .map((entry) => {
      if (typeof entry === "number" || typeof entry === "string") {
        return toPositiveNumber(entry);
      }
      const record = readRecord(entry);
      return toPositiveNumber(record.logicalChannel ?? record.channel ?? record.channelId);
    })
    .filter((entry): entry is number => Number.isFinite(entry) && entry > 0);

  return Array.from(new Set(channels)).sort((a, b) => a - b);
}

function normalizeLiveVehiclesPayload(payload: unknown) {
  const root = readRecord(payload);
  const rows = Array.isArray(root.vehicles)
    ? root.vehicles
    : Array.isArray(root.data)
      ? root.data
      : [];

  const now = Date.now();
  const normalizedRows: Array<Record<string, unknown>> = [];

  for (const entry of rows) {
    const record = readRecord(entry);
    const vehicleId = String(record.id ?? record.vehicleId ?? record.phone ?? "").trim();
    if (!vehicleId) continue;

    const streamRows = Array.isArray(record.streams) ? record.streams : [];
    const streamByChannel = new Map<number, GenericRecord>();
    for (const streamEntry of streamRows) {
      const streamRecord = readRecord(streamEntry);
      const channel = toPositiveNumber(streamRecord.channel);
      if (!channel) continue;
      streamByChannel.set(channel, streamRecord);
    }

    const channels = Array.from(
      new Set([
        ...parseChannelArray(record.activeStreams),
        ...parseChannelArray(record.channels),
        ...Array.from(streamByChannel.keys()),
      ])
    ).sort((a, b) => a - b);

    for (const channel of channels) {
      const streamRecord = streamByChannel.get(channel) || {};
      const updatedAt = String(streamRecord.lastSeenAt ?? "").trim();
      const updatedAtMsFromIso = updatedAt ? Date.parse(updatedAt) : 0;
      const updatedAtMs = Number.isFinite(updatedAtMsFromIso) && updatedAtMsFromIso > 0 ? updatedAtMsFromIso : now;

      normalizedRows.push({
        vehicleId,
        channel,
        updatedAtMs,
        updatedAt: updatedAt || new Date(updatedAtMs).toISOString(),
        lastDataType: streamRecord.lastDataType ?? null,
        lastPayloadType: streamRecord.lastPayloadType ?? null,
      });
    }
  }

  return {
    success: true,
    source: "go-hub-live-vehicles",
    count: normalizedRows.length,
    rows: normalizedRows,
  };
}

async function fetchJson(url: string, timeoutMs: number) {
  const response = await fetch(url, {
    cache: "no-store",
    signal: AbortSignal.timeout(timeoutMs),
  });

  const payload = await response.json().catch(() => ({}));
  return { response, payload };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const maxAgeMs = url.searchParams.get("maxAgeMs");
  const query = new URLSearchParams();
  if (maxAgeMs) {
    query.set("maxAgeMs", maxAgeMs);
  }

  const upstreamBase = getLivePreviewBaseUrl();
  let lastStatus = 500;
  let lastPayload: unknown = { success: false, message: "Failed to fetch live preview streams" };

  try {
    const upstreamLiveStreams = `${upstreamBase}/api/live/streams${query.toString() ? `?${query.toString()}` : ""}`;
    const { response, payload } = await fetchJson(upstreamLiveStreams, 4500);
    if (response.ok) {
      return NextResponse.json(payload, { status: response.status });
    }
    lastStatus = response.status;
    lastPayload = payload;
  } catch (error) {
    console.error("[live-preview/streams] Primary proxy failed:", error);
  }

  try {
    const upstreamLiveVehicles = `${upstreamBase}/api/live/vehicles`;
    const { response, payload } = await fetchJson(upstreamLiveVehicles, 4500);
    if (response.ok) {
      return NextResponse.json(normalizeLiveVehiclesPayload(payload), { status: 200 });
    }
    lastStatus = response.status;
    lastPayload = payload;
  } catch (error) {
    console.error("[live-preview/streams] Fallback proxy failed:", error);
  }

  return NextResponse.json(lastPayload, { status: lastStatus || 500 });
}
