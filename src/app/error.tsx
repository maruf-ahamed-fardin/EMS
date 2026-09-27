'use client';

// Shown when a page throws, e.g. the database is unreachable
export default function Error({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <div className="tactile-card rounded-3xl p-6 text-center sm:p-8 max-w-sm sm:max-w-md w-full">
      <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Something went wrong</h1>
      <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">We couldn&apos;t load this page. Please try again.</p>
      <button
        type="button"
        onClick={() => retry()}
        className="mt-6 w-full cursor-pointer touch-manipulation rounded-xl bg-gradient-to-r from-orange-500 to-amber-600 px-4 py-3 text-sm font-semibold text-white shadow-md shadow-orange-500/20 transition-all hover:from-orange-400 hover:to-amber-500 active:scale-[0.99]"
      >
        Try again
      </button>
    </div>
  );
}
