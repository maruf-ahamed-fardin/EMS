import type { z } from 'zod';

/**
 * `{ "address.city": "Required" }`: one message per field, the first zod reported. Forms show one
 * message under each input, so the rest would never be seen.
 */
export function zodIssuesToFieldErrors(error: unknown): Record<string, string> {
  const issues = (error as z.ZodError | undefined)?.issues ?? [];
  const errors: Record<string, string> = {};
  for (const issue of issues) {
    const field = issue.path.map(String).join('.') || '_';
    errors[field] ??= issue.message;
  }
  return errors;
}
