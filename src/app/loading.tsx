export default function Loading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-white">
      <div className="flex flex-col items-center gap-4">
        <div className="relative h-12 w-12">
          <div className="absolute h-full w-full rounded-full border-4 border-slate-200"></div>
          <div className="absolute h-full w-full animate-spin rounded-full border-4 border-slate-900 border-t-transparent"></div>
        </div>
        <p className="text-sm font-medium text-slate-500 animate-pulse">Loading...</p>
      </div>
    </div>
  );
}
