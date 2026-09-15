'use client';

import { useState, useTransition, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { SearchIcon } from './icons';

export default function SearchForm() {
  const [query, setQuery] = useState('');
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmed = query.trim();
    if (trimmed) startTransition(() => router.push(`/${encodeURIComponent(trimmed)}`));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="relative">
        <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-300" />
        {/* text-base on phones: iOS zooms the page when focusing inputs smaller than 16px */}
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="e.g. ashekrabbani or SX-001"
          aria-label="Username or employee ID"
          autoFocus
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="search"
          className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-base text-slate-700 placeholder-slate-300 outline-none transition-all focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 sm:text-sm"
        />
      </div>
      <button
        type="submit"
        disabled={isPending}
        className="w-full cursor-pointer touch-manipulation rounded-xl bg-gradient-to-r from-indigo-600 to-orange-500 px-4 py-3 text-sm font-semibold text-white transition-all hover:from-indigo-500 hover:to-orange-400 disabled:cursor-wait disabled:opacity-70"
      >
        {isPending ? 'Loading…' : 'View Profile'}
      </button>
    </form>
  );
}
