'use client';

import type { DataResponse, SearchResults } from '@/lib/validations';
import { Briefcase, Building2, LoaderCircle, Search } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { PersonAvatar } from '@/components/shared/person-avatar';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { api } from '@/lib/client/api-client';

const EMPTY: SearchResults = { employees: [], departments: [], positions: [] };

/** ⌘K / Ctrl+K search across people, departments and positions (plan §11). Results are scoped by the API. */
export function CommandSearch() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<{ q: string; data: SearchResults } | null>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === 'k' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen((value) => !value);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const q = query.trim();
  useEffect(() => {
    if (q.length < 2) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      api<DataResponse<SearchResults>>(`/search?q=${encodeURIComponent(q)}`)
        .then(({ data }) => !cancelled && setResults({ q, data }))
        .catch(() => !cancelled && setResults({ q, data: EMPTY }));
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [q]);

  const current = q.length >= 2 && results?.q === q ? results.data : null;
  const loading = q.length >= 2 && !current;

  function go(href: string) {
    setOpen(false);
    setQuery('');
    router.push(href);
  }

  return (
    <>
      <Button variant="outline" className="hidden h-9 w-56 justify-start gap-2 text-muted-foreground md:inline-flex" onClick={() => setOpen(true)}>
        <Search aria-hidden /> Search
        <kbd className="ml-auto rounded border bg-muted px-1.5 font-mono text-[10px] text-muted-foreground">Ctrl K</kbd>
      </Button>
      <Button variant="ghost" size="icon" className="size-11 md:hidden" onClick={() => setOpen(true)} aria-label="Search">
        <Search aria-hidden />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="top-[15%] translate-y-0 overflow-hidden p-0 sm:max-w-xl">
          <DialogTitle className="sr-only">Search</DialogTitle>
          <DialogDescription className="sr-only">Find people, departments and positions</DialogDescription>
          {/* The API already filtered and scoped the results; cmdk must not filter them again */}
          <Command shouldFilter={false} className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group]]:px-2 [&_[cmdk-input]]:h-12 [&_[cmdk-item]]:py-2.5">
        <CommandInput placeholder="Search people, departments, positions…" value={query} onValueChange={setQuery} />
        <CommandList>
          {q.length < 2 ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">Type at least 2 characters.</p>
          ) : loading ? (
            <p className="flex items-center justify-center gap-2 px-4 py-6 text-sm text-muted-foreground">
              <LoaderCircle className="size-4 animate-spin" aria-hidden /> Searching…
            </p>
          ) : (
            <>
              <CommandEmpty>No results for &ldquo;{q}&rdquo;.</CommandEmpty>
              {current && current.employees.length > 0 && (
                <CommandGroup heading="People">
                  {current.employees.map((e) => (
                    <CommandItem key={e.id} value={`employee-${e.id}`} onSelect={() => go(`/employees/${e.id}`)}>
                      <PersonAvatar name={e.name} size="sm" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{e.name}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {e.employeeCode} · {e.positionTitle} · {e.departmentName}
                        </span>
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
              {current && current.departments.length > 0 && (
                <CommandGroup heading="Departments">
                  {current.departments.map((d) => (
                    <CommandItem key={d.id} value={`department-${d.id}`} onSelect={() => go(`/departments/${d.id}`)}>
                      <Building2 aria-hidden /> {d.name}
                      <span className="ml-auto font-mono text-xs text-muted-foreground">{d.code}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
              {current && current.positions.length > 0 && (
                <CommandGroup heading="Positions">
                  {current.positions.map((p) => (
                    <CommandItem
                      key={p.id}
                      value={`position-${p.id}`}
                      onSelect={() => go(p.departmentId ? `/positions?departmentId=${p.departmentId}` : '/positions')}
                    >
                      <Briefcase aria-hidden /> {p.title}
                      <span className="ml-auto text-xs text-muted-foreground">{p.departmentName ?? 'Shared'}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </>
          )}
        </CommandList>
          </Command>
        </DialogContent>
      </Dialog>
    </>
  );
}
