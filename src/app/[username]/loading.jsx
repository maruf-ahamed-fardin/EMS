// Skeleton shown instantly while a profile renders for the first time
export default function Loading() {
  return (
    <div className="overflow-hidden rounded-3xl bg-white shadow-2xl" aria-busy="true" aria-label="Loading profile">
      <div className="flex justify-center pt-8 pb-4">
        <div className="h-24 w-24 animate-pulse rounded-full bg-slate-200 sm:h-28 sm:w-28" />
      </div>
      <div className="flex flex-col items-center gap-2 px-6 pb-5">
        <div className="h-6 w-36 animate-pulse rounded-lg bg-slate-200" />
        <div className="h-5 w-20 animate-pulse rounded-full bg-slate-100" />
      </div>
      <div className="mx-4 mb-5 space-y-3 rounded-2xl border border-slate-100 bg-slate-50 p-4 sm:mx-5">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 shrink-0 animate-pulse rounded-lg bg-slate-200" />
          <div className="h-4 w-40 animate-pulse rounded bg-slate-200" />
        </div>
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 shrink-0 animate-pulse rounded-lg bg-slate-200" />
          <div className="h-4 w-32 animate-pulse rounded bg-slate-200" />
        </div>
      </div>
      <div className="mx-5 border-t border-slate-100 pt-4 pb-6">
        <div className="mx-auto h-3 w-48 animate-pulse rounded bg-slate-100" />
      </div>
    </div>
  );
}
