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

function decodeUriSafe(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function normalizeAssetPath(rawPath: string, resolvedVehicleId: string, channel: string) {
  const [pathPart, queryPart = ""] = String(rawPath || "").split("?");
  const decodedPath = decodeUriSafe(pathPart).replace(/^https?:\/\/[^/]+/i, "").replace(/^\/+/, "");

  const candidatePrefixes = [
    `media/live-hls/${resolvedVehicleId}/ch${channel}/`,
    `live-hls/${resolvedVehicleId}/ch${channel}/`,
    `media/live-hls/${encodeURIComponent(resolvedVehicleId)}/ch${encodeURIComponent(channel)}/`,
    `live-hls/${encodeURIComponent(resolvedVehicleId)}/ch${encodeURIComponent(channel)}/`,
  ];

  const withoutPrefix = candidatePrefixes.reduce((acc, prefix) => {
    return acc.startsWith(prefix) ? acc.slice(prefix.length) : acc;
  }, decodedPath);

  const cleanedSegments = withoutPrefix
    .split("/")
    .map((segment) => segment.trim())
    .filter((segment) => !!segment && segment !== "." && segment !== "..")
    .map((segment) => encodeURIComponent(segment));

  return {
    encodedPath: cleanedSegments.join("/"),
    query: queryPart.trim(),
  };
}

function rewritePlaylist(text: string, resolvedVehicleId: string, channel: string) {
  const assetBase = `/api/live-video/assets/${encodeURIComponent(resolvedVehicleId)}/${encodeURIComponent(channel)}`;

  return text
    .split(/\r?\n/)
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) {
        return line;
      }

      const { encodedPath, query } = normalizeAssetPath(trimmed, resolvedVehicleId, channel);
      if (!encodedPath) {
        return line;
      }

      return `${assetBase}/${encodedPath}${query ? `?${query}` : ""}`;
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
