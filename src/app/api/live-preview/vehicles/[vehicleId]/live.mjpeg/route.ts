import { NextRequest, NextResponse } from "next/server";
import { getLivePreviewBaseUrl } from "@/lib/backend-hubs";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";
export const maxDuration = 300;

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
    "connection",
    "pragma",
    "expires",
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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ vehicleId: string }> }
) {
  const { vehicleId } = await params;
  const fallbackIds = request.nextUrl.searchParams.get("fallbackIds");
  const candidates = buildCandidateVehicleIds(vehicleId, fallbackIds);
  const forwardedQuery = new URLSearchParams(request.nextUrl.searchParams);
  forwardedQuery.delete("fallbackIds");

  const upstreamBase = getLivePreviewBaseUrl();
  let lastErrorResponse: Response | null = null;

  for (const candidateId of candidates) {
    const upstreamUrl = `${upstreamBase}/api/vehicles/${encodeURIComponent(candidateId)}/live.mjpeg${
      forwardedQuery.toString() ? `?${forwardedQuery.toString()}` : ""
    }`;

    try {
      const response = await fetch(upstreamUrl, {
        cache: "no-store",
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
      console.error("[live-preview/mjpeg] Proxy failed for candidate", candidateId, error);
    }
  }

  if (lastErrorResponse) {
    const text = await lastErrorResponse.text().catch(() => "");
    return new NextResponse(text || "Live preview unavailable", {
      status: lastErrorResponse.status,
      headers: {
        "content-type":
          lastErrorResponse.headers.get("content-type") || "text/plain; charset=utf-8",
        "cache-control": "no-store",
      },
    });
  }

  return NextResponse.json(
    { success: false, message: "No live preview stream available for requested vehicle" },
    { status: 404 }
  );
}
