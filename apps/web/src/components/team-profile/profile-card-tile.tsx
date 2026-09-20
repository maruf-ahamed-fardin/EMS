import type { TeamProfileListItem } from '@ems/contracts';
import { Building2, Mail } from 'lucide-react';
import Link from 'next/link';
import { ProfileAvatar } from './profile-avatar';

/** One card in the grid. The whole tile is the link, so the hit area is the card. */
export function ProfileCardTile({ person }: { person: TeamProfileListItem }) {
  return (
    <Link
      href={`/team-profile/${person.employeeId}`}
      className="group block rounded-2xl bg-gradient-to-r from-primary via-[#7b3fe4] to-[#d9481f] p-px shadow-panel transition-shadow hover:shadow-lg focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
    >
      <div className="h-full rounded-[calc(var(--radius)+8px)] bg-card p-5">
        <div className="flex items-center gap-3">
          <ProfileAvatar initials={person.initials} size="sm" />
          <div className="min-w-0">
            <div className="truncate font-bold tracking-tight group-hover:text-primary">{person.fullName}</div>
            <div className="truncate text-sm text-muted-foreground">{person.position}</div>
          </div>
        </div>

        <div className="mt-4 space-y-2 text-[13px] text-muted-foreground">
          <div className="flex items-center gap-2">
            <Mail aria-hidden className="size-3.5 shrink-0" />
            <span className="truncate">{person.email}</span>
          </div>
          <div className="flex items-center gap-2">
            <Building2 aria-hidden className="size-3.5 shrink-0" />
            <span className="truncate">
              {person.department} &middot; {person.workLocation}
            </span>
          </div>
        </div>

        <div className="mt-4 border-t pt-3 font-mono text-[11.5px] text-muted-foreground">{person.employeeCode}</div>
      </div>
    </Link>
  );
}
