"use client";

import ScreenshotsDashboardTab from "@/components/dashboard/screenshots-dashboard-tab";

export default function ScreenshotsMonitorPage() {
  return (
    <div className="min-h-screen bg-slate-100 p-4 md:p-6">
      <ScreenshotsDashboardTab detachable={false} />
    </div>
  );
}
