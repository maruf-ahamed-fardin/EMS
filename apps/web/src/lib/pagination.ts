import type { PageMeta } from '@ems/contracts';
import { redirect } from 'next/navigation';

/**
 * A page past the end goes to the last one: the last item on it was just approved or deleted, or the
 * link is old. Otherwise the list would look empty, with no pagination to get back.
 */
export function redirectPastLastPage(meta: PageMeta, hrefFor: (page: number) => string): void {
  if (meta.page > meta.totalPages) redirect(hrefFor(meta.totalPages));
}
