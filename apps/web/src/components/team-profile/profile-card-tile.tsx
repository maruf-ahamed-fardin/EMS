import type { TeamProfileListItem } from '@ems/contracts';
import { Mail, MapPin, Phone, UserRound } from 'lucide-react';
import Link from 'next/link';
import { formatDate } from '@/lib/employees';
import { tenure } from '@/lib/team-profile';
import { cn } from '@/lib/utils';
import { CardActions } from './card-actions';
import { ProfileAvatar } from './profile-avatar';
import { ProfileLinks } from './profile-links';

/**
 * A colour per department, used for its badge, so a team reads as a team across the grid. Static
 * class strings, because Tailwind only generates classes it can see written out.
 */
const DEPARTMENT_TONES = [
  'bg-indigo-500/10 text-indigo-700 ring-indigo-500/20 dark:text-indigo-300',
  'bg-sky-500/10 text-sky-700 ring-sky-500/20 dark:text-sky-300',
  'bg-emerald-500/10 text-emerald-700 ring-emerald-500/20 dark:text-emerald-300',
  'bg-amber-500/10 text-amber-700 ring-amber-500/20 dark:text-amber-300',
  'bg-rose-500/10 text-rose-700 ring-rose-500/20 dark:text-rose-300',
  'bg-fuchsia-500/10 text-fuchsia-700 ring-fuchsia-500/20 dark:text-fuchsia-300',
] as const;

function toneFor(department: string): string {
  let hash = 0;
  for (const char of department) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return DEPARTMENT_TONES[hash % DEPARTMENT_TONES.length]!;
}

/** One contact line: an icon tile, then the value. Links sit above the card's stretched link. */
function Line({ icon: Icon, children }: { icon: typeof Mail; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 items-center gap-2.5 text-[13px]">
      <span aria-hidden className="grid size-7 shrink-0 place-items-center rounded-lg bg-secondary text-muted-foreground">
        <Icon className="size-3.5" />
      </span>
      <span className="min-w-0 flex-1 truncate">{children}</span>
    </div>
  );
}

/**
 * One card in the grid, laid out like an ID badge: the brand band with the employee ID, the
 * person, how to reach them, and the actions (save, QR, NFC, share) along the bottom.
 *
 * The name's link is stretched over the card so the whole card opens the full profile, while the
 * email, phone, profile links and actions sit above it and stay separately clickable — nesting
 * them inside one big link would be invalid HTML.
 */
export function ProfileCardTile({ person, className }: { person: TeamProfileListItem; className?: string }) {
  const time = tenure(person.joiningDate);
  return (
    <article
      className={cn(
        'group relative flex h-full flex-col overflow-hidden rounded-2xl border bg-card shadow-panel transition-all duration-200 focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 hover:-translate-y-1 hover:shadow-xl hover:shadow-primary/10',
        className,
      )}
    >
      {/* The brand band: the same in both themes, like a printed badge */}
      <div className="relative h-[112px] overflow-hidden bg-gradient-to-br from-[#1d1b4f] via-[#3b2aa8] to-[#7b3fe4]">
        <div
          aria-hidden
          className="absolute inset-0 opacity-25 [background-image:radial-gradient(rgba(255,255,255,0.55)_1px,transparent_1px)] [background-size:14px_14px]"
        />
        <div aria-hidden className="absolute -top-10 -right-8 size-32 rounded-full bg-[#d9481f]/40 blur-2xl" />
        <div className="relative flex items-start justify-between px-4 pt-3.5 text-white sm:px-5">
          <span className="text-[10.5px] font-bold tracking-[0.18em] uppercase opacity-85">SeloraX · Team</span>
          <span className="rounded-md bg-white/15 px-2 py-0.5 font-mono text-[11px] font-medium ring-1 ring-white/25 backdrop-blur">
            {person.employeeCode}
          </span>
        </div>
      </div>

      <div className="flex flex-1 flex-col px-4 pb-4 sm:px-5">
        {/* relative + z-10: the band is positioned, so without its own stacking the avatar slides under it */}
        <div className="relative z-10 -mt-11 flex justify-center">
          <ProfileAvatar initials={person.initials} size="md" />
        </div>

        <h2 className="mt-4 flex items-center justify-center gap-1 text-center text-[17px] leading-tight font-extrabold tracking-tight">
          <Link
            href={`/team-profile/${person.employeeId}`}
            className="truncate outline-none group-hover:text-primary after:absolute after:inset-0"
          >
            {person.fullName}
          </Link>
        </h2>
        <p className="mt-1 truncate text-center text-sm font-medium text-muted-foreground">{person.position}</p>

        <div className="mt-3.5 flex flex-wrap items-center justify-center gap-1.5">
          <span className={cn('rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold ring-1 ring-inset', toneFor(person.department))}>
            {person.department}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-0.5 text-[11.5px] font-medium text-muted-foreground">
            <MapPin aria-hidden className="size-3" />
            {person.workLocation}
          </span>
          <span
            className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-0.5 text-[11.5px] font-medium text-muted-foreground"
            title={`Joined ${formatDate(person.joiningDate)}`}
          >
            <span aria-hidden className="size-1.5 rounded-full bg-emerald-500" />
            {time === 'New' ? 'New joiner' : time}
          </span>
        </div>

        {person.headline && (
          <p className="mt-4 line-clamp-2 text-center text-[13px] leading-relaxed text-muted-foreground italic">
            “{person.headline}”
          </p>
        )}

        <div className="mt-5 border-t pt-5">
          <div className="mx-auto w-fit max-w-full space-y-3">
            <Line icon={Mail}>
              <a href={`mailto:${person.email}`} title={person.email} className="relative z-10 hover:text-primary hover:underline">
                {person.email}
              </a>
            </Line>
            <Line icon={Phone}>
              {person.businessPhone ? (
                <a href={`tel:${person.businessPhone}`} className="relative z-10 hover:text-primary hover:underline">
                  {person.businessPhone}
                </a>
              ) : (
                <span className="text-muted-foreground">No business number</span>
              )}
            </Line>
            <Line icon={UserRound}>
              {person.managerName ? (
                <>
                  <span className="text-muted-foreground">Reports to </span>
                  {person.managerName}
                </>
              ) : (
                <span className="text-muted-foreground">No manager listed</span>
              )}
            </Line>
          </div>
        </div>

        {person.links.length > 0 && (
          <ProfileLinks links={person.links} size="sm" className="relative z-10 mt-5" />
        )}

        {/* mt-auto keeps the actions on the bottom edge when cards in a row differ in height */}
        <div className="relative z-10 mt-auto pt-5">
          <CardActions card={person} className="border-t pt-3" />
        </div>
      </div>
    </article>
  );
}
