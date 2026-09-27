import Link from 'next/link';
import SearchForm from '@/components/SearchForm';
import { getAllTeamMembers } from '@/lib/team';

export default async function SearchPage() {
  const members = await getAllTeamMembers();

  return (
    <div className="rounded-3xl border border-slate-200/80 bg-white/95 p-6 shadow-[0_20px_50px_-12px_rgba(15,23,42,0.08)] ring-1 ring-slate-900/5 backdrop-blur-xl sm:p-8">
      <div className="mb-6 text-center">
        <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">Find a Team Member</h1>
        <p className="mt-1.5 text-sm text-slate-500">Search by name, username, or employee ID</p>
      </div>

      <SearchForm members={members} />

      {members.length > 0 && (
        <div className="mt-6 border-t border-slate-100 pt-5">
          <p className="mb-2.5 text-center text-xs font-semibold text-slate-400 uppercase tracking-wider">Quick explore team:</p>
          <div className="flex flex-wrap justify-center gap-1.5">
            {members.map((m) => (
              <Link
                key={m.username}
                href={`/${encodeURIComponent(m.username || '')}`}
                className="inline-flex items-center gap-1.5 rounded-full border border-slate-200/80 bg-slate-50/80 px-3 py-1 text-xs text-slate-600 transition-all hover:border-slate-300 hover:bg-slate-100 hover:text-slate-900 shadow-2xs"
              >
                <span className="font-medium">{m.name}</span>
                {m.employeeId && (
                  <span className="font-mono text-[10px] text-slate-400">({m.employeeId})</span>
                )}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
