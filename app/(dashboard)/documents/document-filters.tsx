'use client';

import { LoaderCircle, Search } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { documentsHref } from '@/lib/client/documents';
import { SEARCH_MAX_LENGTH, useUrlSearch } from '@/hooks/useUrlSearch';

const ANY = '__any__';

/** Search and document type. Every change goes into the URL, so the server renders the new list. */
export function DocumentFilters({
  params,
  types,
}: {
  params: Record<string, string | undefined>;
  types: Array<{ id: string; name: string }>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function go(changes: Record<string, string | undefined>) {
    startTransition(() => router.replace(documentsHref(params, changes), { scroll: false }));
  }

  // Search as you type, after a short pause; follows the URL when it changes some other way
  const [search, setSearch] = useUrlSearch(params.q, (q) => go({ q }));

  return (
    <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center">
      <div className="relative sm:w-80">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input
          type="search"
          maxLength={SEARCH_MAX_LENGTH}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search title, person or type"
          aria-label="Search documents"
          className="h-10 pr-9 pl-9"
        />
        {pending && <LoaderCircle className="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-muted-foreground" aria-label="Updating" />}
      </div>
      <Select value={params.documentTypeId ?? ANY} onValueChange={(value) => go({ documentTypeId: value === ANY ? undefined : value })}>
        <SelectTrigger className="h-10 w-full sm:ml-auto sm:w-56" aria-label="Document type">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ANY}>All types</SelectItem>
          {types.map((t) => (
            <SelectItem key={t.id} value={t.id}>
              {t.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
