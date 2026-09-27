'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Search, X, ArrowRight, CornerDownLeft } from 'lucide-react';
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
    <div className="w-full max-w-xl my-auto animate-in fade-in zoom-in-95 duration-200">
      
      {/* Search Card */}
      <div className="tactile-card rounded-2xl sm:rounded-3xl p-4 sm:p-6">
        
        {/* Compact Header */}
        <div className="mb-4 text-center">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
            Find a Team Member
          </h1>
          <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
            Search by name, employee ID (<span className="font-mono text-[11px]">SX-001</span>), or tech stack
          </p>
        </div>

        {/* Command Palette Input */}
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
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
            className="w-full rounded-xl border border-zinc-200/90 bg-zinc-50/80 py-2.5 pl-10 pr-20 text-xs sm:text-sm text-zinc-900 placeholder-zinc-400 outline-none transition focus:border-zinc-900 focus:bg-white focus:ring-4 focus:ring-zinc-900/5 dark:border-zinc-800/90 dark:bg-zinc-900/80 dark:text-zinc-100 dark:placeholder-zinc-500 dark:focus:border-zinc-100 dark:focus:ring-white/5"
          />

          <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
            {query ? (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="flex h-5 w-5 cursor-pointer items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-200 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200 transition"
                title="Clear query"
              >
                <X className="h-3 w-3" />
              </button>
            ) : (
              <kbd className="hidden sm:inline-flex items-center gap-0.5 rounded-md border border-zinc-200 bg-white px-1.5 py-0.5 font-mono text-[9px] font-semibold text-zinc-400 shadow-2xs dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-500">
                /
              </kbd>
            )}
          </div>
        </div>

        {/* Department Filter Pills */}
        <div className="mt-2.5 flex flex-wrap items-center gap-1">
          <span className="mr-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
            Dept:
          </span>
          {DEPARTMENTS.map((dept) => {
            const isActive = activeDept === dept;
            return (
              <button
                key={dept}
                type="button"
                onClick={() => setActiveDept(dept)}
                className={`cursor-pointer rounded-lg px-2.5 py-0.5 text-[11px] font-medium transition active:scale-95 ${
                  isActive
                    ? 'border border-zinc-900 bg-zinc-900 text-white shadow-2xs dark:border-white dark:bg-white dark:text-zinc-900 font-semibold'
                    : 'border border-zinc-200 bg-zinc-100/80 text-zinc-600 hover:bg-zinc-200 dark:border-zinc-800 dark:bg-zinc-900/80 dark:text-zinc-400 dark:hover:bg-zinc-800'
                }`}
              >
                {dept}
              </button>
            );
          })}
        </div>

        {/* Results Count & Shortcut Info */}
        <div className="mt-3 flex items-center justify-between border-t border-zinc-100/80 pt-2 text-[10px] font-medium text-zinc-400 dark:border-zinc-800/80 dark:text-zinc-500">
          <span>
            {filteredMembers.length} member{filteredMembers.length === 1 ? '' : 's'}
          </span>
          <span className="flex items-center gap-1">
            <CornerDownLeft className="h-2.5 w-2.5" />
            <span className="hidden sm:inline">Press Enter to select</span>
          </span>
        </div>

        {/* Scrollable Member Cards: Fits inside card without expanding page */}
        <div className="mt-2 max-h-[230px] sm:max-h-[270px] overflow-y-auto space-y-1.5 pr-1">
          {filteredMembers.length > 0 ? (
            filteredMembers.map((member, index) => {
              const isSelected = index === selectedIndex;
              return (
                <Link
                  key={member.username}
                  href={`/${encodeURIComponent(member.username)}`}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={`group flex items-center justify-between gap-3 rounded-xl border p-2 sm:p-2.5 transition-all ${
                    isSelected
                      ? 'border-orange-500/60 bg-orange-500/[0.04] shadow-2xs dark:border-orange-400/60 dark:bg-orange-400/[0.04]'
                      : 'border-zinc-200/80 bg-white/70 hover:border-zinc-300 dark:border-zinc-800/80 dark:bg-zinc-900/70 dark:hover:border-zinc-700'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    {/* Avatar */}
                    <div className="relative flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-full border border-zinc-200/80 bg-zinc-100 overflow-hidden dark:border-zinc-700 dark:bg-zinc-800 shadow-2xs">
                      {member.profilePic ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={member.profilePic}
                          alt={member.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span className="font-bold text-xs text-zinc-600 dark:text-zinc-300">
                          {(member.name || '?').charAt(0).toUpperCase()}
                        </span>
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs sm:text-sm font-semibold text-zinc-900 group-hover:text-orange-600 dark:text-zinc-100 dark:group-hover:text-orange-400 transition-colors">
                          {member.name}
                        </span>

                        {member.employeeId && (
                          <span className="font-mono text-[9px] rounded-md bg-zinc-100 px-1 py-0.2 font-semibold text-zinc-600 border border-zinc-200/80 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700">
                            {member.employeeId}
                          </span>
                        )}

                        {member.department && (
                          <span className="text-[9px] rounded-md bg-indigo-500/10 px-1.5 py-0.2 font-semibold text-indigo-600 dark:bg-indigo-400/10 dark:text-indigo-400">
                            {member.department}
                          </span>
                        )}
                      </div>

                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
                        {member.designation || member.role || `@${member.username}`}
                      </p>
                    </div>
                  </div>

                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-zinc-400 group-hover:bg-zinc-900 group-hover:text-white dark:bg-zinc-800 dark:text-zinc-400 dark:group-hover:bg-white dark:group-hover:text-zinc-900 transition text-[10px] shadow-2xs">
                    <ArrowRight className="h-3 w-3" />
                  </span>
                </Link>
              );
            })
          ) : (
            <div className="py-8 text-center">
              <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                No team member matched &ldquo;{query}&rdquo;
              </p>
              <p className="mt-0.5 text-[11px] text-zinc-400 dark:text-zinc-500">
                Try searching with another name or employee ID.
              </p>
            </div>
          )}
        </div>

        {/* Quick Explore Chips */}
        {initialMembers.length > 0 && (
          <div className="mt-3 border-t border-zinc-100/80 pt-2 text-center dark:border-zinc-800/70">
            <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 mr-1.5">
              Quick explore:
            </span>
            <div className="inline-flex flex-wrap justify-center gap-1">
              {initialMembers.map((m) => (
                <Link
                  key={m.username}
                  href={`/${encodeURIComponent(m.username)}`}
                  className="inline-flex items-center gap-1 rounded-full border border-zinc-200/80 bg-zinc-100/70 px-2 py-0.5 text-[10px] text-zinc-600 transition hover:border-zinc-300 hover:bg-zinc-200/70 hover:text-zinc-900 dark:border-zinc-800 dark:bg-zinc-800/70 dark:text-zinc-400 dark:hover:border-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                >
                  <span className="font-medium">{m.name}</span>
                  {m.employeeId && (
                    <span className="font-mono text-[9px] text-zinc-400">
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
