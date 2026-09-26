'use client';

import { TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StatePanel } from './state-panel';

export function ErrorState({
  title = 'Something went wrong',
  description = "We couldn't load this page. Try again, and if it keeps happening, share the reference below with support.",
  reference,
  onRetry,
  className,
}: {
  title?: string;
  description?: string;
  /** The API's requestId or Next's error digest, so a report can be matched to the logs. */
  reference?: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <StatePanel
      className={className}
      icon={TriangleAlert}
      tone="danger"
      role="alert"
      title={title}
      description={
        <>
          {description}
          {reference && (
            <span className="mt-3 block font-mono text-xs text-muted-foreground">Reference: {reference}</span>
          )}
        </>
      }
      action={onRetry && <Button onClick={onRetry}>Try again</Button>}
    />
  );
}
