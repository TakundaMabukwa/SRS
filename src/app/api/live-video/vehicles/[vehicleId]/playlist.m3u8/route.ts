import { NextRequest, NextResponse } from "next/server";
import { getLivePreviewBaseUrl } from "@/lib/backend-hubs";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";
export const maxDuration = 60;

function buildCandidateVehicleIds(vehicleId: string, fallbackIds: string | null) {
  return Array.from(
    new Set(
      [vehicleId, ...(fallbackIds ? fallbackIds.split(",") : [])]
        .map((value) => String(value || "").trim())
        .filter(Boolean)
    )
  );
}

function rewritePlaylist(text: string, resolvedVehicleId: string, channel: string) {
  const assetBase = `/api/live-video/assets/${encodeURIComponent(resolvedVehicleId)}/${encodeURIComponent(channel)}`;

  return text
    .split(/\r?\n/)
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#") || /^https?:\/\//i.test(trimmed)) {
        return line;
      }

      const encodedPath = trimmed
        .split("/")
        .map((segment) => encodeURIComponent(segment))
        .join("/");

      return `${assetBase}/${encodedPath}`;
    })
    .join("\n");
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ vehicleId: string }> }
) {
  const { vehicleId } = await params;
  const fallbackIds = request.nextUrl.searchParams.get("fallbackIds");
  const candidates = buildCandidateVehicleIds(vehicleId, fallbackIds);
  const channel = String(request.nextUrl.searchParams.get("channel") || "1").trim() || "1";
  const waitMs = String(request.nextUrl.searchParams.get("waitMs") || "15000").trim() || "15000";
  const maxAgeMs = String(request.nextUrl.searchParams.get("maxAgeMs") || "20000").trim() || "20000";
  const upstreamBase = getLivePreviewBaseUrl();

  let lastErrorResponse: Response | null = null;

  for (const candidateId of candidates) {
    const query = new URLSearchParams({
      waitMs,
      maxAgeMs,
    });
    const upstreamUrl = `${upstreamBase}/api/vehicles/${encodeURIComponent(candidateId)}/live-hls/${encodeURIComponent(channel)}/playlist.m3u8?${query.toString()}`;

    try {
      const response = await fetch(upstreamUrl, {
        cache: "no-store",
      });

      if (response.ok) {
        const playlistText = await response.text();
        const rewritten = rewritePlaylist(playlistText, candidateId, channel);
        return new NextResponse(rewritten, {
          status: response.status,
          headers: {
            "content-type": "application/vnd.apple.mpegurl",
            "cache-control": "no-store, no-cache, must-revalidate, private",
            "x-live-source": response.headers.get("x-live-source") || "unknown",
            "x-live-updated-at": response.headers.get("x-live-updated-at") || "",
          },
        });
      }

      lastErrorResponse = response;
      if (response.status !== 404) {
        break;
      }
    } catch (error) {
      console.error("[live-video/playlist] Proxy failed for candidate", candidateId, error);
    }
  }

  if (lastErrorResponse) {
    const text = await lastErrorResponse.text().catch(() => "");
    return new NextResponse(text || "Live video playlist unavailable", {
      status: lastErrorResponse.status,
      headers: {
        "content-type":
          lastErrorResponse.headers.get("content-type") || "text/plain; charset=utf-8",
        "cache-control": "no-store",
      },
    });
  }

  return NextResponse.json(
    { success: false, message: "No live video playlist available for requested vehicle" },
    { status: 404 }
  );
}
