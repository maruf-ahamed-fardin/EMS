import SearchForm from '@/components/SearchForm';
import { listTeamMembers } from '@/lib/team';

/**
 * Rendered per request, not prerendered at build.
 *
 * A page with `revalidate` is built once during `next build`, which would make the whole build
 * depend on reaching the HR database - it would fail in CI and in any Docker build, and on a
 * deploy that could reach it, the directory would be frozen at build time. The profile pages avoid
 * this with an empty generateStaticParams; a single page has no such escape, so it renders live.
 * loadTeamData already caches for 30 seconds in memory, so this costs at most one query per
 * 30 seconds per instance - the same refresh window ISR would have given.
 */
export const dynamic = 'force-dynamic';

export default async function SearchPage() {
  const members = await listTeamMembers();

  return (
    <div className="animate-rise overflow-hidden rounded-3xl bg-white shadow-[0_24px_70px_-20px_rgba(2,6,23,0.75)] ring-1 ring-white/10">
      {/* A sliver of the brand gradient, matching the profile card */}
      <div className="h-1.5 w-full bg-gradient-to-r from-indigo-600 via-violet-500 to-orange-500" />

      <div className="p-6 sm:p-8">
        <div className="mb-6 text-center">
          <h1 className="text-xl font-bold tracking-tight text-slate-900">Find a Team Member</h1>
          <p className="mt-1 text-sm text-slate-400">
            {members.length > 0
              ? `Search ${members.length} people by name, username or employee ID`
              : 'Search by name, username or employee ID'}
          </p>
        </div>
        <SearchForm members={members} />
      </div>
    </div>
  );
}
