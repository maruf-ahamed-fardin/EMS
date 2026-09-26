import type { PageMeta } from '@/lib/validations';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils/cn';

/** Page numbers to show: first, last, and two either side of the current page, with gaps. */
export function pageWindow(page: number, totalPages: number): Array<number | 'gap'> {
  const pages = new Set([1, totalPages, page - 1, page, page + 1].filter((p) => p >= 1 && p <= totalPages));
  const sorted = [...pages].sort((a, b) => a - b);
  const result: Array<number | 'gap'> = [];
  for (const [index, value] of sorted.entries()) {
    if (index > 0 && value - sorted[index - 1]! > 1) result.push('gap');
    result.push(value);
  }
  return result;
}

export function Pagination({ meta, hrefFor, noun }: { meta: PageMeta; hrefFor: (page: number) => string; noun: string }) {
  const first = meta.total === 0 ? 0 : (meta.page - 1) * meta.limit + 1;
  const last = Math.min(meta.page * meta.limit, meta.total);
  const linkClass =
    'grid h-9 min-w-9 place-items-center rounded-md px-2 text-sm font-medium outline-none hover:bg-secondary focus-visible:ring-[3px] focus-visible:ring-ring/50';

  return (
    <nav aria-label="Pagination" className="flex flex-col items-center justify-between gap-3 px-4 py-3 sm:flex-row">
      <p className="text-sm text-muted-foreground tabular">
        {first}–{last} of {meta.total} {noun}
      </p>
      {meta.totalPages > 1 && (
        <ul className="flex items-center gap-1">
          <li>
            {meta.page > 1 ? (
              <Link href={hrefFor(meta.page - 1)} className={linkClass} aria-label="Previous page">
                <ChevronLeft className="size-4" aria-hidden />
              </Link>
            ) : (
              <span className={cn(linkClass, 'pointer-events-none opacity-40')} aria-hidden>
                <ChevronLeft className="size-4" />
              </span>
            )}
          </li>
          {pageWindow(meta.page, meta.totalPages).map((item, index) =>
            item === 'gap' ? (
              <li key={`gap-${index}`} className="px-1 text-muted-foreground" aria-hidden>
                …
              </li>
            ) : (
              <li key={item}>
                <Link
                  href={hrefFor(item)}
                  aria-current={item === meta.page ? 'page' : undefined}
                  className={cn(linkClass, 'tabular', item === meta.page && 'bg-accent text-accent-foreground')}
                >
                  {item}
                </Link>
              </li>
            ),
          )}
          <li>
            {meta.page < meta.totalPages ? (
              <Link href={hrefFor(meta.page + 1)} className={linkClass} aria-label="Next page">
                <ChevronRight className="size-4" aria-hidden />
              </Link>
            ) : (
              <span className={cn(linkClass, 'pointer-events-none opacity-40')} aria-hidden>
                <ChevronRight className="size-4" />
              </span>
            )}
          </li>
        </ul>
      )}
    </nav>
  );
}
