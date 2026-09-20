import { cn } from '@/lib/utils';

const SIZES = {
  sm: { ring: 'size-13 p-[2px]', inner: 'text-[15px]' },
  md: { ring: 'size-[76px] p-[3px]', inner: 'text-2xl' },
  lg: { ring: 'size-[116px] p-1', inner: 'text-4xl' },
} as const;

/**
 * The card's avatar: initials on the brand gradient, inside a gradient ring with a white gap.
 *
 * A photo goes in the same slot once `employees.photo_key` is served; `hasPhoto` is already on the
 * API shape, so only this component changes when it is.
 */
export function ProfileAvatar({
  initials,
  size = 'md',
  className,
}: {
  initials: string;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const { ring, inner } = SIZES[size];
  return (
    <span
      aria-hidden
      className={cn('block shrink-0 rounded-full bg-gradient-to-br from-primary via-[#7b3fe4] to-[#d9481f] shadow-lg shadow-primary/25', ring, className)}
    >
      <span className="block size-full rounded-full bg-card p-[3px]">
        <span
          className={cn(
            'grid size-full place-items-center rounded-full bg-gradient-to-br from-[#6c5cff] to-[#4a37d8] font-extrabold text-white',
            inner,
          )}
        >
          {initials}
        </span>
      </span>
    </span>
  );
}
