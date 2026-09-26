'use client';

import { UserStatus } from '@/lib/validations';
import { LoaderCircle, Search } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SEARCH_MAX_LENGTH, useUrlSearch } from '@/lib/client/use-url-search';

const ANY = '__any__';
const STATUS_LABELS: Record<UserStatus, string> = { ACTIVE: 'Active', INACTIVE: 'Inactive', LOCKED: 'Locked' };

/** The /users URL with some filters changed; a new filter goes back to page 1. */
function href(params: Record<string, string | undefined>, changes: Record<string, string | undefined>): string {
  const merged: Record<string, string | undefined> = { ...params, ...changes };
  if (!('page' in changes)) delete merged.page;
  const query = new URLSearchParams(Object.entries(merged).filter((e): e is [string, string] => Boolean(e[1]))).toString();
  return query ? `/users?${query}` : '/users';
}

export function UserFilters({ params, roles }: { params: Record<string, string | undefined>; roles: Array<{ id: string; name: string }> }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const go = (changes: Record<string, string | undefined>) => startTransition(() => router.replace(href(params, changes), { scroll: false }));

  // Search as you type, after a short pause; follows the URL when it changes some other way
  const [search, setSearch] = useUrlSearch(params.q, (q) => go({ q }));

  return (
    <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center">
      <div className="relative sm:w-80">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input type="search" maxLength={SEARCH_MAX_LENGTH} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, email or ID" aria-label="Search accounts" className="h-10 pr-9 pl-9" />
        {pending && <LoaderCircle className="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-muted-foreground" aria-label="Updating" />}
      </div>
      <div className="grid grid-cols-2 gap-3 sm:ml-auto sm:flex">
        <Select value={params.roleId ?? ANY} onValueChange={(v) => go({ roleId: v === ANY ? undefined : v })}>
          <SelectTrigger className="h-10 w-full sm:w-44" aria-label="Role">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ANY}>All roles</SelectItem>
            {roles.map((r) => (
              <SelectItem key={r.id} value={r.id}>
                {r.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={params.status ?? ANY} onValueChange={(v) => go({ status: v === ANY ? undefined : v })}>
          <SelectTrigger className="h-10 w-full sm:w-36" aria-label="Status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ANY}>Any status</SelectItem>
            {UserStatus.map((s) => (
              <SelectItem key={s} value={s}>
                {STATUS_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
