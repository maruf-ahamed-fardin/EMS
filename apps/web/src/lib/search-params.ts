import type { z } from 'zod';

/**
 * A page's search params through its list-query schema, leaving out any parameter that doesn't fit
 * (a hand-edited `?page=0`, an id from an old link, a search pasted past the length limit), so the page
 * shows the list with that filter off rather than an error.
 */
export function parseSearchParams<S extends z.ZodType>(schema: S, params: Record<string, unknown>): z.output<S> {
  const input: Record<string, unknown> = { ...params };
  for (;;) {
    const result = schema.safeParse(input);
    if (result.success) return result.data;
    const invalid = result.error.issues.map((issue) => String(issue.path[0])).filter((key) => key in input);
    // Nothing left to drop: a required parameter is missing, which is the page's own mistake
    if (invalid.length === 0) return schema.parse(input);
    for (const key of invalid) delete input[key];
  }
}
