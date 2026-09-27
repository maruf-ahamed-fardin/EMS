'use client';

import { useState, useMemo, useTransition, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { SearchIcon } from './icons';
import type { PublicMemberSummary } from '@/lib/team';

interface SearchFormProps {
  members?: PublicMemberSummary[];
}

export default function SearchForm({ members = [] }: SearchFormProps) {
  const [query, setQuery] = useState('');
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  // Normalize query: trim and convert to lowercase for case-insensitive matching
  const cleanQuery = query.trim().toLowerCase();

  // Real-time filter: matches any substring in name, username, or employee ID
  const matchingMembers = useMemo(() => {
    if (!cleanQuery) return [];
    return members.filter((m) => {
      const name = (m.name || '').toLowerCase();
      const username = (m.username || '').toLowerCase();
      const empId = (m.employeeId || '').toLowerCase();
      const designation = (m.designation || m.role || '').toLowerCase();

      return (
        name.includes(cleanQuery) ||
        username.includes(cleanQuery) ||
        empId.includes(cleanQuery) ||
        designation.includes(cleanQuery)
      );
    });
  }, [cleanQuery, members]);

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!cleanQuery) return;

    // If there is a matching profile, navigate directly to that member
    if (matchingMembers.length > 0) {
      startTransition(() => {
        router.push(`/${encodeURIComponent(matchingMembers[0].username)}`);
      });
      return;
    }

    // Otherwise navigate to query (backend will also try case-insensitive resolution)
    startTransition(() => {
      router.push(`/${encodeURIComponent(cleanQuery)}`);
    });
  };

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, username, or ID (e.g. Ashek, SX-001)"
            aria-label="Search by name, username, or employee ID"
            autoFocus
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="search"
            className="w-full rounded-xl border border-slate-200 bg-slate-50/70 py-3 pl-11 pr-10 text-base text-slate-900 placeholder-slate-400 outline-none transition-all focus:border-slate-900 focus:bg-white focus:ring-4 focus:ring-slate-900/5 sm:text-sm"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 flex h-6 w-6 cursor-pointer items-center justify-center rounded-full text-xs text-slate-400 hover:bg-slate-200 hover:text-slate-700"
              title="Clear search"
            >
              ✕
            </button>
          )}
        </div>

        <button
          type="submit"
          disabled={isPending || !cleanQuery}
          className="w-full cursor-pointer touch-manipulation rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-xs transition-all hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40 active:scale-[0.99]"
        >
          {isPending
            ? 'Loading…'
            : matchingMembers.length > 0
            ? `View ${matchingMembers[0].name}`
            : 'View Profile'}
        </button>
      </form>

      {/* Live matching profiles list ("oi name er sathe match korlei show korbe profile gulu") */}
      {cleanQuery && (
        <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-slate-50/70 p-2 shadow-xs transition-all">
          <div className="flex items-center justify-between px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            <span>
              {matchingMembers.length > 0
                ? `Found ${matchingMembers.length} matching profile${matchingMembers.length > 1 ? 's' : ''}`
                : 'No matching profile'}
            </span>
            <span className="text-[10px] text-slate-500 lowercase">case-insensitive</span>
          </div>

          {matchingMembers.length > 0 ? (
            <div className="divide-y divide-slate-100 mt-1">
              {matchingMembers.map((member) => (
                <Link
                  key={member.username}
                  href={`/${encodeURIComponent(member.username)}`}
                  className="group flex items-center justify-between gap-3 rounded-xl border border-slate-200/60 bg-white p-2.5 my-1 shadow-2xs transition-all hover:border-slate-300 hover:shadow-xs hover:bg-slate-50/80"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full border border-slate-200 bg-gradient-to-br from-indigo-600 to-orange-500 text-white flex items-center justify-center font-bold text-sm shadow-2xs">
                      {member.profilePic ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={member.profilePic}
                          alt={member.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        (member.name || '?').charAt(0).toUpperCase()
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-semibold text-sm text-slate-800 group-hover:text-indigo-600 transition-colors">
                          {member.name}
                        </span>
                        {member.employeeId && (
                          <span className="font-mono text-[10px] rounded-md bg-slate-100 text-slate-600 px-1.5 py-0.5 border border-slate-200/60 font-medium">
                            {member.employeeId}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 truncate">
                        {member.designation || member.role || `@${member.username}`}
                      </p>
                    </div>
                  </div>

                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-slate-400 group-hover:bg-slate-900 group-hover:text-white transition-all text-xs shrink-0">
                    ➔
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <div className="py-5 px-3 text-center">
              <p className="text-xs font-medium text-slate-600">
                No profile matched &ldquo;<span className="font-bold text-slate-900">{query}</span>&rdquo;
              </p>
              <p className="mt-1 text-[11px] text-slate-400">
                Try searching by first name, last name, or employee ID.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
