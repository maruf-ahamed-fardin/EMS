'use client';

import { EMPLOYEE_SORTS, EmploymentType, type EmployeeSort } from '@/lib/validations';
import { LoaderCircle, Search, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { EMPLOYMENT_TYPE_LABELS, employeesHref } from '@/lib/client/employees';
import { SEARCH_MAX_LENGTH, useUrlSearch } from '@/lib/client/use-url-search';

const ANY = '__any__';

const SORT_LABELS: Record<EmployeeSort, string> = {
  name: 'Name A–Z',
  '-name': 'Name Z–A',
  code: 'ID, lowest first',
  '-code': 'ID, highest first',
  joined: 'Joined, oldest first',
  '-joined': 'Joined, newest first',
  created: 'Added, oldest first',
  '-created': 'Added, newest first',
};

/** Search, filters and sort. Every change goes into the URL, so the server renders the new list. */
export function EmployeeFilters({
  params,
  departments,
}: {
  params: Record<string, string | undefined>;
  departments: Array<{ id: string; name: string }>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function go(changes: Record<string, string | undefined>) {
    startTransition(() => router.replace(employeesHref(params, changes), { scroll: false }));
  }

  // Search as you type, after a short pause; follows the URL when it changes some other way
  const [search, setSearch] = useUrlSearch(params.q, (q) => go({ q }));

  return (
    <div className="flex flex-col gap-3 border-b p-4 lg:flex-row lg:items-center">
      <div className="relative lg:w-80">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input
          type="search"
          maxLength={SEARCH_MAX_LENGTH}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search name, ID or email"
          aria-label="Search employees"
          className="h-10 pr-9 pl-9"
        />
        {pending ? (
          <LoaderCircle className="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-muted-foreground" aria-label="Updating" />
        ) : (
          search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute top-1/2 right-2 grid size-7 -translate-y-1/2 place-items-center rounded-md text-muted-foreground hover:bg-secondary"
              aria-label="Clear search"
            >
              <X className="size-4" aria-hidden />
            </button>
          )
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:ml-auto lg:flex">
        {departments.length > 0 && (
          <FilterSelect
            label="Department"
            value={params.departmentId}
            onChange={(value) => go({ departmentId: value })}
            options={departments.map((d) => ({ value: d.id, label: d.name }))}
          />
        )}
        <FilterSelect
          label="Type"
          value={params.employmentType}
          onChange={(value) => go({ employmentType: value })}
          options={EmploymentType.map((type) => ({ value: type, label: EMPLOYMENT_TYPE_LABELS[type] }))}
        />
        <Select value={params.sort ?? 'name'} onValueChange={(value) => go({ sort: value === 'name' ? undefined : value })}>
          <SelectTrigger className="col-span-2 h-10 w-full sm:col-span-1 lg:w-48" aria-label="Sort">
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="end">
            {EMPLOYEE_SORTS.map((sort) => (
              <SelectItem key={sort} value={sort}>
                {SORT_LABELS[sort]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string | undefined;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string | undefined) => void;
}) {
  return (
    <Select value={value ?? ANY} onValueChange={(next) => onChange(next === ANY ? undefined : next)}>
      <SelectTrigger className="h-10 w-full lg:w-44" aria-label={label}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ANY}>{label}: any</SelectItem>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
