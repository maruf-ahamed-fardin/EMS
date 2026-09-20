import { cn, initials } from '@/lib/utils';

const SIZES = { sm: 'size-8 text-xs', md: 'size-10 text-sm', xl: 'size-16 text-xl md:size-20 md:text-2xl' } as const;

/** Initials on a soft brand tint. Photos arrive with documents (Phase 8). */
export function PersonAvatar({ name, size = 'md', className }: { name: string; size?: keyof typeof SIZES; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn('grid shrink-0 place-items-center rounded-full bg-accent font-semibold text-accent-foreground', SIZES[size], className)}
    >
      {initials(name)}
    </span>
  );
}
