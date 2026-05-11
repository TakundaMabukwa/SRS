import { NextRequest, NextResponse } from "next/server";
import { getLivePreviewBaseUrl } from "@/lib/backend-hubs";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type LiveScreenshotResult = {
  vehicleId?: string;
  channel?: number;
  ok?: boolean;
  fileUrl?: string;
};

function normalizeVehicleAlias(value: string) {
  const trimmed = String(value || "").trim();
  if (!/^\d+$/.test(trimmed)) return trimmed;
  if (trimmed.startsWith("862") && trimmed.length > 12) {
    return trimmed.slice(3);
  }
  return trimmed;
}

function buildCandidateVehicleIds(vehicleId: string, fallbackIds: string | null) {
  return Array.from(
    new Set(
      [vehicleId, ...(fallbackIds ? fallbackIds.split(",") : [])]
        .map((value) => String(value || "").trim())
        .filter(Boolean)
    )
  );
}

function copyHeaders(response: Response) {
  const headers = new Headers();
  for (const key of [
    "content-type",
    "content-length",
    "cache-control",
    "etag",
    "last-modified",
    "x-preview-updated-at",
    "x-preview-sequence",
  ]) {
    const value = response.headers.get(key);
    if (value) {
      headers.set(key, value);
    }
  }

  if (!headers.has("cache-control")) {
    headers.set("cache-control", "no-store, no-cache, must-revalidate, private");
  }

  return headers;
}

function getRequestedChannel(query: URLSearchParams) {
  const parsed = Number(query.get("channel") || 0);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.round(parsed);
}

async function resolveGoHubScreenshot(
  upstreamBase: string,
  candidates: string[],
  channel: number | null
) {
  const latestUrl = `${upstreamBase}/api/live/screenshots/latest`;
  const latestResponse = await fetch(latestUrl, {
    cache: "no-store",
    signal: AbortSignal.timeout(4500),
  });
  if (!latestResponse.ok) {
    return null;
  }

  const latestPayload = await latestResponse.json().catch(() => ({}));
  const results = Array.isArray((latestPayload as { results?: unknown[] }).results)
    ? ((latestPayload as { results?: unknown[] }).results as LiveScreenshotResult[])
    : [];

  const candidateSet = new Set(
    candidates
      .flatMap((value) => [String(value || "").trim(), normalizeVehicleAlias(String(value || "").trim())])
      .filter(Boolean)
  );

  const match = results.find((result) => {
    const vehicle = String(result.vehicleId || "").trim();
    const normalizedVehicle = normalizeVehicleAlias(vehicle);
    const resultChannel = Number(result.channel || 0);
    const channelMatch = channel ? resultChannel === channel : resultChannel > 0;
    return !!result.ok && !!result.fileUrl && channelMatch && (candidateSet.has(vehicle) || candidateSet.has(normalizedVehicle));
  });

  if (!match?.fileUrl) {
    return null;
  }

  const fileUrl = String(match.fileUrl).trim();
  const absoluteUrl = /^https?:\/\//i.test(fileUrl) ? fileUrl : `${upstreamBase}${fileUrl.startsWith("/") ? "" : "/"}${fileUrl}`;
  const imageResponse = await fetch(absoluteUrl, {
    cache: "no-store",
    signal: AbortSignal.timeout(4500),
  });
  if (!imageResponse.ok) {
    return null;
  }

  return imageResponse;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ vehicleId: string }> }
) {
  const { vehicleId } = await params;
  const fallbackIds = request.nextUrl.searchParams.get("fallbackIds");
  const candidates = buildCandidateVehicleIds(vehicleId, fallbackIds);
  const forwardedQuery = new URLSearchParams(request.nextUrl.searchParams);
  forwardedQuery.delete("fallbackIds");
  const requestedChannel = getRequestedChannel(forwardedQuery);

  const upstreamBase = getLivePreviewBaseUrl();
  let lastErrorResponse: Response | null = null;

  for (const candidateId of candidates) {
    const upstreamUrl = `${upstreamBase}/api/vehicles/${encodeURIComponent(candidateId)}/screenshot${
      forwardedQuery.toString() ? `?${forwardedQuery.toString()}` : ""
    }`;

    try {
      const response = await fetch(upstreamUrl, {
        cache: "no-store",
        signal: AbortSignal.timeout(4500),
      });

      if (response.ok) {
        return new NextResponse(response.body, {
          status: response.status,
          headers: copyHeaders(response),
        });
      }

      lastErrorResponse = response;
      if (response.status !== 404) {
        break;
      }
    } catch (error) {
      console.error("[live-preview/screenshot] Proxy failed for candidate", candidateId, error);
    }
  }

  try {
    const screenshotResponse = await resolveGoHubScreenshot(upstreamBase, candidates, requestedChannel);
    if (screenshotResponse) {
      return new NextResponse(screenshotResponse.body, {
        status: screenshotResponse.status,
        headers: copyHeaders(screenshotResponse),
      });
    }
  } catch (error) {
    console.error("[live-preview/screenshot] Go Hub screenshot fallback failed:", error);
  }

  if (lastErrorResponse) {
    const contentType = lastErrorResponse.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const payload = await lastErrorResponse.json().catch(() => ({}));
      return NextResponse.json(payload, { status: lastErrorResponse.status });
    }

    const text = await lastErrorResponse.text().catch(() => "");
    return new NextResponse(text || "Live preview screenshot unavailable", {
      status: lastErrorResponse.status,
      headers: {
        "content-type": contentType || "text/plain; charset=utf-8",
        "cache-control": "no-store",
      },
    });
  }

  return NextResponse.json(
    { success: false, message: "No live preview screenshot available for requested vehicle" },
    { status: 404 }
  );
}
