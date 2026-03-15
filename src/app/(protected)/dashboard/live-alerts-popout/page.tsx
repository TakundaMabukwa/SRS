"use client";

import { useSearchParams } from "next/navigation";
import VideoAlertsDashboardTab from "@/components/dashboard/video-alerts-dashboard-tab";

const allowedSeverities = new Set(["all", "critical", "high", "medium", "low"]);

export default function LiveAlertsPopoutPage() {
  const searchParams = useSearchParams();
  const rawSeverity = String(searchParams.get("severity") || "all").toLowerCase();
  const severity = allowedSeverities.has(rawSeverity) ? rawSeverity : "all";

  return (
    <div className="min-h-screen bg-slate-100">
      <VideoAlertsDashboardTab
        standaloneMode
        standaloneSeverity={severity as "all" | "critical" | "high" | "medium" | "low"}
      />
    </div>
  );
}
