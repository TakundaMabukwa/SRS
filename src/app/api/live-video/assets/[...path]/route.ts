import { NextResponse } from "next/server";
import { getLivePreviewBaseUrl } from "@/lib/backend-hubs";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";
export const maxDuration = 60;

function copyHeaders(response: Response) {
  const headers = new Headers();
  for (const key of ["content-type", "content-length", "cache-control", "etag", "last-modified"]) {
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
  request: Request,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const [vehicleId = "", channel = "", ...fileParts] = path || [];

  if (!vehicleId || !channel || fileParts.length === 0) {
    return NextResponse.json(
      { success: false, message: "vehicleId, channel, and asset path are required" },
      { status: 400 }
    );
  }

  const upstreamBase = getLivePreviewBaseUrl();
  const upstreamPath = fileParts.map((segment) => encodeURIComponent(segment)).join("/");
  const url = new URL(request.url);
  const query = url.searchParams.toString();
  const upstreamUrl = `${upstreamBase}/media/live-hls/${encodeURIComponent(vehicleId)}/ch${encodeURIComponent(channel)}/${upstreamPath}${query ? `?${query}` : ""}`;

  try {
    const response = await fetch(upstreamUrl, {
      cache: "no-store",
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      return new NextResponse(text || "Live video asset unavailable", {
        status: response.status,
        headers: {
          "content-type": response.headers.get("content-type") || "text/plain; charset=utf-8",
          "cache-control": "no-store",
        },
      });
    }

    return new NextResponse(response.body, {
      status: response.status,
      headers: copyHeaders(response),
    });
  } catch (error) {
    console.error("[live-video/assets] Proxy failed:", error);
    return NextResponse.json(
      { success: false, message: "Failed to fetch live video asset" },
      { status: 500 }
    );
  }
}
