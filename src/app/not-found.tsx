import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="tactile-card rounded-3xl p-6 text-center sm:p-8 max-w-sm sm:max-w-md w-full">
      <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Team Member Not Found</h1>
      <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">The team member you are looking for does not exist.</p>
      <Link
        href="/"
        className="mt-6 block w-full touch-manipulation rounded-xl bg-gradient-to-r from-orange-500 to-amber-600 px-4 py-3 text-sm font-semibold text-white shadow-md shadow-orange-500/20 transition-all hover:from-orange-400 hover:to-amber-500 active:scale-[0.99]"
      >
        Return to Directory
      </Link>
    </div>
  );
}
