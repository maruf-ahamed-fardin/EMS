import { cn } from '@/lib/utils/cn';

const SIZES = {
  sm: { ring: 'size-13 p-[2px]', inner: 'text-[15px]' },
  md: { ring: 'size-[76px] p-[3px]', inner: 'text-2xl' },
  lg: { ring: 'size-[116px] p-1', inner: 'text-4xl' },
} as const;

/**
 * The card's avatar: the person's photo, or their initials on the brand gradient, inside a
 * gradient ring with a white gap. Decorative — the name is always written next to it.
 */
export function ProfileAvatar({
  initials,
  photoUrl,
  size = 'md',
  className,
}: {
  initials: string;
  photoUrl?: string | null;
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
        {photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- served by our API behind the session; next/image would proxy it again
          <img src={photoUrl} alt="" loading="lazy" decoding="async" className="block size-full rounded-full bg-secondary object-cover" />
        ) : (
          <span
            className={cn(
              'grid size-full place-items-center rounded-full bg-gradient-to-br from-[#6c5cff] to-[#4a37d8] font-extrabold text-white',
              inner,
            )}
          >
            {initials}
          </span>
        )}
      </span>
    </span>
  );
}
