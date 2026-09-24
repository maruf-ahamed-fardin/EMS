'use client';

import { ErrorState } from '@/components/shared/error-state';

// `retry` fetches the page again; `reset` would only re-render the same failed result
export default function AppError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <ErrorState reference={error.digest} onRetry={retry} />;
}
