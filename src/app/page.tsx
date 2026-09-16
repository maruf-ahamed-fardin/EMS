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
    <div className="rounded-3xl bg-white p-6 shadow-2xl sm:p-8">
      <div className="mb-6 text-center">
        <h1 className="text-xl font-bold text-slate-800">Find a Team Member</h1>
        <p className="mt-1 text-sm text-slate-400">
          {members.length > 0 ? `Search ${members.length} people by name, username or employee ID` : 'Search by name, username or employee ID'}
        </p>
      </div>
      <SearchForm members={members} />
    </div>
  );
}
