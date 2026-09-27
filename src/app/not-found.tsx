import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="rounded-3xl bg-white p-6 text-center shadow-2xl sm:p-8">
      <h1 className="text-xl font-bold text-slate-800">Team Member Not Found</h1>
      <p className="mt-2 text-sm text-slate-500">The team member you are looking for does not exist.</p>
      <Link
        href="/"
        className="mt-6 block w-full touch-manipulation rounded-xl bg-gradient-to-r from-indigo-600 to-orange-500 px-4 py-3 text-sm font-semibold text-white transition-all hover:from-indigo-500 hover:to-orange-400"
      >
        Search again
      </Link>
    </div>
  );
}
