import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';
import { ApiRequestError } from './api-error';

/**
 * Puts the API's field errors on the matching inputs and returns the message for the form as a whole
 * (or null when every problem belongs to a field).
 */
export function applyApiError<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
  fields: readonly Path<T>[],
): string | null {
  if (!(error instanceof ApiRequestError)) return 'Something went wrong. Check your connection and try again.';

  let unplaced = false;
  for (const [field, message] of Object.entries(error.errors)) {
    if ((fields as readonly string[]).includes(field)) setError(field as Path<T>, { type: 'server', message });
    else unplaced = true;
  }
  if (Object.keys(error.errors).length > 0 && !unplaced) return null;

  if (error.status === 429) return 'Too many attempts. Wait a minute and try again.';
  if (error.status >= 500) {
    return `Something went wrong on our side. Try again in a moment${error.requestId ? ` (reference ${error.requestId})` : ''}.`;
  }
  return error.message;
}
