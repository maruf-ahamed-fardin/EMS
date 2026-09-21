import type { TeamProfileListItem } from '@ems/contracts';
import { CalendarDays, Mail, MapPin, Phone, UserRound } from 'lucide-react';
import Link from 'next/link';
import { formatDate } from '@/lib/employees';
import { tenure } from '@/lib/team-profile';
import { cn } from '@/lib/utils';
import { ProfileAvatar } from './profile-avatar';
import { ProfileLinks } from './profile-links';

/**
 * A cover tint per department, so a team reads as a team across the grid. Static class strings,
 * because Tailwind only generates classes it can see written out.
 */
const COVERS = [
  'from-indigo-500/25 via-violet-500/15 to-transparent',
  'from-sky-500/25 via-cyan-500/15 to-transparent',
  'from-emerald-500/25 via-teal-500/15 to-transparent',
  'from-amber-500/25 via-orange-500/15 to-transparent',
  'from-rose-500/25 via-pink-500/15 to-transparent',
  'from-fuchsia-500/25 via-purple-500/15 to-transparent',
] as const;

function coverFor(department: string): string {
  let hash = 0;
  for (const char of department) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return COVERS[hash % COVERS.length]!;
}

/** A labelled fact in the card's two-column block. */
function Fact({ icon: Icon, label, children }: { icon: typeof Mail; label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="flex items-center gap-1.5 text-[10.5px] font-semibold tracking-wider text-muted-foreground uppercase">
        <Icon aria-hidden className="size-3" />
        {label}
      </dt>
      <dd className="mt-0.5 truncate text-[13px] font-medium">{children}</dd>
    </div>
  );
}

/**
 * One card in the grid. The name's link is stretched over the whole card, so the card is the hit
 * area, while the email, phone and profile links sit above it and stay separately clickable —
 * nesting them inside one big link would be invalid HTML.
 */
export function ProfileCardTile({ person }: { person: TeamProfileListItem }) {
  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-2xl border bg-card shadow-panel transition-all focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 hover:-translate-y-0.5 hover:shadow-lg">
      <div className={cn('relative h-20 bg-gradient-to-br', coverFor(person.department))}>
        <span className="absolute top-3 left-3 inline-flex items-center gap-1 rounded-full bg-card/80 px-2.5 py-1 text-[11px] font-semibold backdrop-blur">
          <MapPin aria-hidden className="size-3" />
          {person.workLocation}
        </span>
        <span className="absolute top-3 right-3 rounded-full bg-card/80 px-2.5 py-1 font-mono text-[11px] text-muted-foreground backdrop-blur">
          {person.employeeCode}
        </span>
      </div>

      <div className="flex flex-1 flex-col px-5 pb-5">
        <ProfileAvatar initials={person.initials} size="md" className="-mt-10" />

        <h2 className="mt-3 truncate text-[17px] font-extrabold tracking-tight">
          <Link
            href={`/team-profile/${person.employeeId}`}
            className="outline-none group-hover:text-primary after:absolute after:inset-0"
          >
            {person.fullName}
          </Link>
        </h2>
        <p className="mt-0.5 truncate text-sm text-muted-foreground">
          {person.position} <span aria-hidden>&middot;</span>{' '}
          <span className="font-semibold text-foreground/80">{person.department}</span>
        </p>

        {person.headline && (
          <p className="mt-3 line-clamp-2 border-l-2 border-primary/40 pl-3 text-[13px] text-muted-foreground italic">
            {person.headline}
          </p>
        )}

        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 rounded-xl bg-secondary/50 p-3">
          <Fact icon={UserRound} label="Reports to">
            {person.managerName ?? '—'}
          </Fact>
          <Fact icon={CalendarDays} label="With us">
            <span title={`Joined ${formatDate(person.joiningDate)}`}>{tenure(person.joiningDate)}</span>
          </Fact>
          <Fact icon={Mail} label="Email">
            <a href={`mailto:${person.email}`} title={person.email} className="relative z-10 hover:text-primary">
              {person.email}
            </a>
          </Fact>
          <Fact icon={Phone} label="Phone">
            {person.businessPhone ? (
              <a href={`tel:${person.businessPhone}`} className="relative z-10 hover:text-primary">
                {person.businessPhone}
              </a>
            ) : (
              <span className="text-muted-foreground">Not listed</span>
            )}
          </Fact>
        </dl>

        {person.links.length > 0 && (
          <ProfileLinks links={person.links} size="sm" className="relative z-10 mt-4 justify-start" />
        )}
      </div>
    </article>
  );
}
