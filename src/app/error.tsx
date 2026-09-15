'use client';

// Shown when a page throws, e.g. the database is unreachable
export default function Error({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <div className="rounded-3xl bg-white p-6 text-center shadow-2xl sm:p-8">
      <h1 className="text-xl font-bold text-slate-800">Something went wrong</h1>
      <p className="mt-2 text-sm text-slate-500">We couldn&apos;t load this page. Please try again.</p>
      <button
        type="button"
        onClick={() => retry()}
        className="mt-6 w-full cursor-pointer touch-manipulation rounded-xl bg-gradient-to-r from-indigo-600 to-orange-500 px-4 py-3 text-sm font-semibold text-white transition-all hover:from-indigo-500 hover:to-orange-400"
      >
        Try again
      </button>
    </div>
  );
}
