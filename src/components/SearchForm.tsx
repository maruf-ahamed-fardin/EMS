'use client';

import { useMemo, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { matchMembers, type TeamMemberSummary } from '@/lib/search';
import { SearchIcon } from './icons';

/** Enough rows to scroll through without turning the page into a wall of people. */
const VISIBLE = 25;

export default function SearchForm({ members }: { members: TeamMemberSummary[] }) {
  const [query, setQuery] = useState('');
  const router = useRouter();

  // The whole team arrives with the page, so filtering is instant and never touches the network
  const results = useMemo(() => matchMembers(members, query), [members, query]);
  const shown = results.slice(0, VISIBLE);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    // Enter goes to the best match, so typing a username straight in still works as it always did
    const target = results[0]?.username ?? query.trim();
    if (target) router.push(`/${encodeURIComponent(target)}`);
  };

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit}>
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-300" />
          {/* text-base on phones: iOS zooms the page when focusing inputs smaller than 16px */}
          <input
            type="search"
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="Name, username or employee ID"
            aria-label="Search the team by name, username or employee ID"
            autoFocus
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="search"
            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-base text-slate-700 placeholder-slate-300 outline-none transition-all focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 sm:text-sm"
          />
        </div>
      </form>

      <p aria-live="polite" className="sr-only">
        {results.length} {results.length === 1 ? 'member' : 'members'} found
      </p>

      {results.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-400">
          Nobody matches “{query.trim()}”.
        </p>
      ) : (
        <ul className="-mx-2 max-h-96 overflow-y-auto">
          {shown.map(member => (
            <li key={member.username}>
              <Link
                href={`/${encodeURIComponent(member.username)}`}
                className="flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-indigo-50"
              >
                <Avatar member={member} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-slate-700">
                    {member.name || member.username}
                  </span>
                  <span className="block truncate text-xs text-slate-400">
                    {member.designation || member.role || `@${member.username}`}
                  </span>
                </span>
                {member.employeeId && (
                  <span className="shrink-0 text-[11px] font-medium text-slate-300">{member.employeeId}</span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}

      {results.length > shown.length && (
        <p className="text-center text-xs text-slate-400">
          {results.length - shown.length} more — keep typing to narrow it down
        </p>
      )}
    </div>
  );
}

function Avatar({ member }: { member: TeamMemberSummary }) {
  const [failed, setFailed] = useState(false);
  const initial = (member.name || member.username).charAt(0).toUpperCase();

  // An image that failed before hydration never fires onError, so check its state once it attaches
  const checkLoaded = (img: HTMLImageElement | null) => {
    if (img && img.complete && img.naturalWidth === 0) setFailed(true);
  };

  return (
    <span className="h-9 w-9 shrink-0 overflow-hidden rounded-full bg-gradient-to-br from-indigo-600 to-orange-500">
      {member.photo && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element -- any external host, and no layout shift at this size
        <img
          ref={checkLoaded}
          src={member.photo}
          alt=""
          className="h-full w-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <span className="flex h-full w-full items-center justify-center text-sm font-bold text-white">
          {initial}
        </span>
      )}
    </span>
  );
}
