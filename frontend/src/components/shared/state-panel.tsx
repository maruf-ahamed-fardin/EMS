import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

type Tone = 'neutral' | 'brand' | 'danger' | 'warning';

const TONES: Record<Tone, string> = {
  neutral: 'bg-muted text-muted-foreground',
  brand: 'bg-accent text-accent-foreground',
  danger: 'bg-destructive/10 text-danger-text',
  warning: 'bg-warning/12 text-warning-text',
};

/**
 * The one layout behind empty, error, forbidden and "coming in a later phase" states (plan §11),
 * so every page says what happened and offers the next step the same way.
 */
export function StatePanel({
  icon: Icon,
  title,
  description,
  action,
  tone = 'neutral',
  role,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  tone?: Tone;
  role?: 'alert' | 'status';
  className?: string;
}) {
  return (
    <div
      role={role}
      className={cn(
        'flex flex-col items-center rounded-2xl border bg-card px-6 py-14 text-center shadow-panel md:py-20',
        className,
      )}
    >
      <span className={cn('mb-4 grid size-12 place-items-center rounded-xl', TONES[tone])}>
        <Icon className="size-6" aria-hidden />
      </span>
      <h2 className="text-lg font-semibold">{title}</h2>
      {description && <p className="mt-1.5 max-w-md text-sm text-muted-foreground text-pretty">{description}</p>}
      {action && <div className="mt-6 flex flex-wrap justify-center gap-2">{action}</div>}
    </div>
  );
}
