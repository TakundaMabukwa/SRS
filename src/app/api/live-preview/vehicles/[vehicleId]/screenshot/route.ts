import { NextRequest, NextResponse } from "next/server";
import { getLivePreviewBaseUrl } from "@/lib/backend-hubs";

export const dynamic = "force-dynamic";
export const revalidate = 0;

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
    const upstreamUrl = `${upstreamBase}/api/vehicles/${encodeURIComponent(candidateId)}/screenshot${
      forwardedQuery.toString() ? `?${forwardedQuery.toString()}` : ""
    }`;

    try {
      const response = await fetch(upstreamUrl, {
        cache: "no-store",
        signal: AbortSignal.timeout(12000),
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
