import { CircleCheck, TriangleAlert } from 'lucide-react';
import { cn } from '@/lib/client/utils';

/** A form-level message: announced to screen readers when it appears. */
export function FormAlert({ tone, children }: { tone: 'error' | 'success'; children: React.ReactNode }) {
  const Icon = tone === 'error' ? TriangleAlert : CircleCheck;
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={cn(
        'flex items-start gap-2.5 rounded-lg border px-3.5 py-3 text-sm',
        tone === 'error'
          ? 'border-destructive/30 bg-destructive/8 text-danger-text'
          : 'border-success/30 bg-success/8 text-success-text',
      )}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div>{children}</div>
    </div>
  );
}
