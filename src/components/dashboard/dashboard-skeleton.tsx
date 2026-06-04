"use client";

export function DashboardSkeleton() {
  return (
    <div className="min-h-screen bg-slate-50 animate-pulse">
      {/* Top Navigation Skeleton */}
      <div className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between">
        <div className="h-8 w-48 bg-slate-200 rounded" />
        <div className="flex gap-3">
          <div className="h-8 w-24 bg-slate-200 rounded" />
          <div className="h-8 w-8 bg-slate-200 rounded-full" />
        </div>
      </div>

      {/* Tabs Skeleton */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        <div className="flex gap-2 mb-6">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-10 w-32 bg-slate-200 rounded-lg" />
          ))}
        </div>

        {/* Stats Cards Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 bg-white rounded-xl border border-slate-200 p-4">
              <div className="h-4 w-24 bg-slate-200 rounded mb-3" />
              <div className="h-8 w-16 bg-slate-200 rounded" />
            </div>
          ))}
        </div>

        {/* Content Area Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-40 bg-white rounded-xl border border-slate-200 p-4">
                <div className="h-5 w-48 bg-slate-200 rounded mb-4" />
                <div className="h-4 w-full bg-slate-200 rounded mb-2" />
                <div className="h-4 w-3/4 bg-slate-200 rounded mb-2" />
                <div className="h-4 w-1/2 bg-slate-200 rounded" />
              </div>
            ))}
          </div>
          <div className="space-y-4">
            {[1, 2].map((i) => (
              <div key={i} className="h-52 bg-white rounded-xl border border-slate-200 p-4">
                <div className="h-5 w-32 bg-slate-200 rounded mb-4" />
                <div className="h-4 w-full bg-slate-200 rounded mb-2" />
                <div className="h-4 w-2/3 bg-slate-200 rounded" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
