import { NextResponse } from "next/server";
import { getLivePreviewBaseUrl } from "@/lib/backend-hubs";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const maxAgeMs = url.searchParams.get("maxAgeMs");
    const query = new URLSearchParams();
    if (maxAgeMs) {
      query.set("maxAgeMs", maxAgeMs);
    }

    const upstreamBase = getLivePreviewBaseUrl();
    const upstreamUrl = `${upstreamBase}/api/live/streams${query.toString() ? `?${query.toString()}` : ""}`;
    const response = await fetch(upstreamUrl, {
      cache: "no-store",
      signal: AbortSignal.timeout(12000),
    });

    const payload = await response.json().catch(() => ({}));
    return NextResponse.json(payload, { status: response.status });
  } catch (error) {
    console.error("[live-preview/streams] Proxy failed:", error);
    return NextResponse.json(
      { success: false, message: "Failed to fetch live preview streams" },
      { status: 500 }
    );
  }
}
