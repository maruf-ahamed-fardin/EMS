'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Search, X, ArrowRight, CornerDownLeft, Sparkles } from 'lucide-react';
import type { PublicMemberSummary, Department } from '@/lib/team';

interface MemberDirectoryProps {
  initialMembers: PublicMemberSummary[];
}

const DEPARTMENTS: (Department | 'All')[] = [
  'All',
  'Engineering',
  'Design',
  'Operations',
  'Executive',
];

export default function MemberDirectory({ initialMembers }: MemberDirectoryProps) {
  const [query, setQuery] = useState('');
  const [activeDept, setActiveDept] = useState<Department | 'All'>('All');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // Global keyboard shortcut: Press "/" to focus search input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement !== inputRef.current) {
        e.preventDefault();
        inputRef.current?.focus();
      } else if (e.key === 'Escape' && document.activeElement === inputRef.current) {
        setQuery('');
        inputRef.current?.blur();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Filter members by query and department
  const filteredMembers = useMemo(() => {
    const q = query.trim().toLowerCase();

    return initialMembers.filter((m) => {
      // Department filter
      if (activeDept !== 'All' && m.department !== activeDept) {
        return false;
      }

      if (!q) return true;

      const name = (m.name || '').toLowerCase();
      const username = (m.username || '').toLowerCase();
      const employeeId = (m.employeeId || '').toLowerCase();
      const designation = (m.designation || m.role || '').toLowerCase();
      const skills = (m.skills || []).map((s) => s.toLowerCase());

      return (
        name.includes(q) ||
        username.includes(q) ||
        employeeId.includes(q) ||
        designation.includes(q) ||
        skills.some((s) => s.includes(q))
      );
    });
  }, [initialMembers, query, activeDept]);

  // Reset selected index when filtered list changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [filteredMembers]);

  // Handle keyboard navigation in list (Arrow Up / Down / Enter)
  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (filteredMembers.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % filteredMembers.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filteredMembers.length) % filteredMembers.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const target = filteredMembers[selectedIndex] || filteredMembers[0];
      if (target) {
        router.push(`/${encodeURIComponent(target.username)}`);
      }
    }
  };

  return (
    <div className="w-full max-w-2xl space-y-6 animate-in fade-in duration-300">
      
      {/* Search Header and Command Box */}
      <div className="tactile-card rounded-3xl p-6 sm:p-8">
        <div className="mb-6 text-center">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-orange-500/30 bg-orange-500/10 px-3 py-1 text-xs font-semibold text-orange-600 dark:border-orange-400/25 dark:bg-orange-400/10 dark:text-orange-400 mb-2">
            <Sparkles className="h-3.5 w-3.5" />
            SeloraX Precision Directory
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl dark:text-zinc-100">
            Find a Team Member
          </h1>
          <p className="mt-1.5 text-xs sm:text-sm text-zinc-500 dark:text-zinc-400">
            Search by name, employee ID (<span className="font-mono text-xs">SX-001</span>), or tech stack
          </p>
        </div>

        {/* Command Palette Input */}
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleInputKeyDown}
            placeholder="Search by name, ID, or skills (e.g. Ashek, SX-001, Next.js)..."
            aria-label="Search team members"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            className="w-full rounded-2xl border border-zinc-200/90 bg-zinc-50/80 py-3.5 pl-11 pr-24 text-sm text-zinc-900 placeholder-zinc-400 outline-none transition focus:border-zinc-900 focus:bg-white focus:ring-4 focus:ring-zinc-900/5 dark:border-zinc-800/90 dark:bg-zinc-900/80 dark:text-zinc-100 dark:placeholder-zinc-500 dark:focus:border-zinc-100 dark:focus:ring-white/5"
          />

          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
            {query ? (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-200 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200 transition"
                title="Clear query"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : (
              <kbd className="hidden sm:inline-flex items-center gap-0.5 rounded-md border border-zinc-200 bg-white px-2 py-0.5 font-mono text-[10px] font-semibold text-zinc-400 shadow-2xs dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-500">
                /
              </kbd>
            )}
          </div>
        </div>

        {/* Department Filter Pills */}
        <div className="mt-4 flex flex-wrap items-center gap-1.5 pt-1">
          <span className="mr-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
            Department:
          </span>
          {DEPARTMENTS.map((dept) => {
            const isActive = activeDept === dept;
            return (
              <button
                key={dept}
                type="button"
                onClick={() => setActiveDept(dept)}
                className={`cursor-pointer rounded-xl px-3 py-1 text-xs font-semibold transition active:scale-95 ${
                  isActive
                    ? 'border border-zinc-900 bg-zinc-900 text-white shadow-2xs dark:border-white dark:bg-white dark:text-zinc-900'
                    : 'border border-zinc-200 bg-zinc-100/80 text-zinc-600 hover:bg-zinc-200 dark:border-zinc-800 dark:bg-zinc-900/80 dark:text-zinc-400 dark:hover:bg-zinc-800'
                }`}
              >
                {dept}
              </button>
            );
          })}
        </div>

        {/* Live Filter Results Count */}
        <div className="mt-5 flex items-center justify-between border-t border-zinc-100 pt-3 text-[11px] font-medium text-zinc-400 dark:border-zinc-800/80 dark:text-zinc-500">
          <span>
            {filteredMembers.length} member{filteredMembers.length === 1 ? '' : 's'} available
          </span>
          <span className="flex items-center gap-1">
            <CornerDownLeft className="h-3 w-3" />
            <span className="hidden sm:inline">Press Enter to view selected</span>
          </span>
        </div>

        {/* Member Cards Grid / List */}
        <div className="mt-3 space-y-2">
          {filteredMembers.length > 0 ? (
            filteredMembers.map((member, index) => {
              const isSelected = index === selectedIndex;
              return (
                <Link
                  key={member.username}
                  href={`/${encodeURIComponent(member.username)}`}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={`group flex items-center justify-between gap-4 rounded-2xl border p-3.5 transition-all ${
                    isSelected
                      ? 'border-orange-500/60 bg-orange-500/[0.04] shadow-sm dark:border-orange-400/60 dark:bg-orange-400/[0.04]'
                      : 'border-zinc-200/80 bg-white/70 hover:border-zinc-300 dark:border-zinc-800/80 dark:bg-zinc-900/70 dark:hover:border-zinc-700'
                  }`}
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    {/* Avatar */}
                    <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-zinc-200/80 bg-zinc-100 overflow-hidden dark:border-zinc-700 dark:bg-zinc-800 shadow-2xs">
                      {member.profilePic ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={member.profilePic}
                          alt={member.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span className="font-bold text-sm text-zinc-600 dark:text-zinc-300">
                          {(member.name || '?').charAt(0).toUpperCase()}
                        </span>
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-zinc-900 group-hover:text-orange-600 dark:text-zinc-100 dark:group-hover:text-orange-400 transition-colors">
                          {member.name}
                        </span>

                        {member.employeeId && (
                          <span className="font-mono text-[10px] rounded-md bg-zinc-100 px-1.5 py-0.5 font-semibold text-zinc-600 border border-zinc-200/80 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700">
                            {member.employeeId}
                          </span>
                        )}

                        {member.department && (
                          <span className="text-[10px] rounded-md bg-indigo-500/10 px-1.5 py-0.5 font-semibold text-indigo-600 dark:bg-indigo-400/10 dark:text-indigo-400">
                            {member.department}
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate mt-0.5">
                        {member.designation || member.role || `@${member.username}`}
                      </p>

                      {/* Micro Skill Chips in Search Results */}
                      {member.skills && member.skills.length > 0 && (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {member.skills.slice(0, 3).map((s) => (
                            <span
                              key={s}
                              className="text-[10px] rounded-md bg-zinc-100 px-1.5 py-0.5 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
                            >
                              {s}
                            </span>
                          ))}
                          {member.skills.length > 3 && (
                            <span className="text-[10px] text-zinc-400">
                              +{member.skills.length - 3}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-zinc-400 group-hover:bg-zinc-900 group-hover:text-white dark:bg-zinc-800 dark:text-zinc-400 dark:group-hover:bg-white dark:group-hover:text-zinc-900 transition text-xs shadow-2xs">
                    <ArrowRight className="h-3.5 w-3.5" />
                  </span>
                </Link>
              );
            })
          ) : (
            <div className="py-12 text-center">
              <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                No team member matched &ldquo;{query}&rdquo;
              </p>
              <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
                Try searching with another name, employee ID (SX-001), or tech stack.
              </p>
            </div>
          )}
        </div>

        {/* Quick Explore Chips */}
        {initialMembers.length > 0 && (
          <div className="mt-6 border-t border-zinc-100 pt-4 dark:border-zinc-800/80">
            <p className="mb-2 text-center text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
              Quick Explore Team
            </p>
            <div className="flex flex-wrap justify-center gap-1.5">
              {initialMembers.map((m) => (
                <Link
                  key={m.username}
                  href={`/${encodeURIComponent(m.username)}`}
                  className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200/80 bg-zinc-100/70 px-3 py-1 text-xs text-zinc-600 transition hover:border-zinc-300 hover:bg-zinc-200/70 hover:text-zinc-900 dark:border-zinc-800 dark:bg-zinc-800/70 dark:text-zinc-400 dark:hover:border-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                >
                  <span className="font-medium">{m.name}</span>
                  {m.employeeId && (
                    <span className="font-mono text-[10px] text-zinc-400">
                      ({m.employeeId})
                    </span>
                  )}
                </Link>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
