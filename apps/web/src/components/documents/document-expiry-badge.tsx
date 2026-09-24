import type { DocumentExpiry } from '@ems/contracts';
import { CircleAlert, CircleCheck, Clock } from 'lucide-react';
import { formatDate } from '@/lib/employees';
import { EXPIRY_LABELS } from '@/lib/documents';
import { cn } from '@/lib/utils';

const STYLE: Record<DocumentExpiry, { icon: typeof Clock; className: string }> = {
  VALID: { icon: CircleCheck, className: 'bg-muted text-muted-foreground' },
  EXPIRING: { icon: Clock, className: 'bg-warning/15 text-warning-text' },
  EXPIRED: { icon: CircleAlert, className: 'bg-destructive/10 text-danger-text' },
};

/** "Expires 24 Sep 2026" with a colour and icon for how soon, never colour alone. */
export function DocumentExpiryBadge({ expiry, expiresAt }: { expiry: DocumentExpiry | null; expiresAt: string | null }) {
  if (!expiry || !expiresAt) return null;
  const { icon: Icon, className } = STYLE[expiry];
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap', className)}>
      <Icon className="size-3.5" aria-hidden />
      <span className="sr-only">{EXPIRY_LABELS[expiry]}: </span>
      {expiry === 'EXPIRED' ? 'Expired' : 'Expires'} {formatDate(expiresAt)}
    </span>
  );
}
