'use client';

import { ErrorState } from '@/components/shared/error-state';

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorState reference={error.digest} onRetry={reset} />;
}
