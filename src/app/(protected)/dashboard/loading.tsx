export default function LoadingDashboard() {
  return (
    <div className="min-h-screen w-full bg-slate-50 p-6">
      <div className="mx-auto w-full max-w-[1400px] space-y-6">
        <div className="flex items-center justify-between">
          <div className="h-9 w-64 animate-pulse rounded bg-slate-200" />
          <div className="h-9 w-40 animate-pulse rounded bg-slate-200" />
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="h-24 animate-pulse rounded-xl bg-slate-200" />
          <div className="h-24 animate-pulse rounded-xl bg-slate-200" />
          <div className="h-24 animate-pulse rounded-xl bg-slate-200" />
        </div>

        <div className="h-12 w-full animate-pulse rounded-xl bg-slate-200" />

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="h-72 animate-pulse rounded-xl bg-slate-200" />
          <div className="h-72 animate-pulse rounded-xl bg-slate-200" />
        </div>
      </div>
    </div>
  );
}
