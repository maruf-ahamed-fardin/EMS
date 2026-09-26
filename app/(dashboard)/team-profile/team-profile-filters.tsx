'use client';

import type { TeamProfileFilters as Filters } from '@/lib/validations';
import { LoaderCircle, Search, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { ScanDialog } from '@/components/employee/scan-dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { teamProfileHref } from '@/lib/client/team-profile';
import { SEARCH_MAX_LENGTH, useUrlSearch } from '@/hooks/useUrlSearch';

const ANY = '__any__';

/**
 * Search and filters. Every change goes into the URL, so the server renders the new list. Without
 * `filters` (a viewer who can only look people up) it is the search box alone.
 */
export function TeamProfileFilters({
  params,
  filters,
}: {
  params: Record<string, string | undefined>;
  filters: Filters | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function go(changes: Record<string, string | undefined>) {
    startTransition(() => router.replace(teamProfileHref(params, changes), { scroll: false }));
  }

  // Search as you type, after a short pause; follows the URL when it changes some other way
  const [search, setSearch] = useUrlSearch(params.q, (q) => go({ q }));

  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
      <div className="relative lg:flex-1">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input
          type="search"
          maxLength={SEARCH_MAX_LENGTH}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={filters ? 'Search by name, email or employee ID' : 'Full name, work email or employee ID'}
          aria-label="Search the team profile"
          className="h-11 pr-9 pl-9"
        />
        {pending ? (
          <LoaderCircle
            className="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-muted-foreground"
            aria-label="Updating"
          />
        ) : (
          search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              aria-label="Clear the search"
              className="absolute top-1/2 right-2 grid size-6 -translate-y-1/2 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="size-4" aria-hidden />
            </button>
          )
        )}
      </div>

      {filters && (
        <>
          <Select
            value={params.departmentId ?? ANY}
            onValueChange={(value) => go({ departmentId: value === ANY ? undefined : value })}
          >
            <SelectTrigger className="h-11 lg:w-56" aria-label="Filter by department">
              <SelectValue placeholder="All departments" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>All departments</SelectItem>
              {filters.departments.map((department) => (
                <SelectItem key={department.id} value={department.id}>
                  {department.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={params.workLocation ?? ANY}
            onValueChange={(value) => go({ workLocation: value === ANY ? undefined : value })}
          >
            <SelectTrigger className="h-11 lg:w-48" aria-label="Filter by location">
              <SelectValue placeholder="All locations" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>All locations</SelectItem>
              {filters.workLocations.map((location) => (
                <SelectItem key={location} value={location}>
                  {location}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </>
      )}

      <ScanDialog />
    </div>
  );
}
