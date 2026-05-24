export default function RootLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-app-bg">
      <div className="rounded-2xl border border-slate-200 bg-white px-6 py-5 shadow-xl">
        <div className="flex items-center gap-3">
          <span className="h-6 w-6 animate-spin rounded-full border-2 border-teal-600 border-t-transparent" />
          <div>
            <p className="text-sm font-semibold text-slate-800">Loading page</p>
            <p className="text-xs text-slate-500">Please wait a moment...</p>
          </div>
        </div>
      </div>
    </div>
  );
}
