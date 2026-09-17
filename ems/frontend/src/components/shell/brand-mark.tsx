import { cn } from '@/lib/utils';

export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        'grid size-8 shrink-0 place-items-center rounded-[10px] text-sm font-bold text-white shadow-sm',
        className,
      )}
      style={{ backgroundImage: 'var(--brand-gradient)' }}
    >
      S
    </span>
  );
}
