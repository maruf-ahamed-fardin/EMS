import { BLOOD_GROUP_LABELS, can, type DataResponse, type TeamProfileDetail } from '@ems/contracts';
import { ArrowLeft, Building2, Droplet, Mail, MapPin, Phone } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Forbidden } from '@/components/shared/module-page';
import { CardActions } from '@/components/team-profile/card-actions';
import { ProfileAvatar } from '@/components/team-profile/profile-avatar';
import { ProfileLinks } from '@/components/team-profile/profile-links';
import { SaveContactButton } from '@/components/team-profile/save-contact-button';
import { ApiRequestError } from '@/lib/api-error';
import { formatDate } from '@/lib/employees';
import { serverApiJson } from '@/lib/server-api';
import { getSession } from '@/lib/session';

export const metadata: Metadata = { title: 'Team Profile' };

async function loadCard(employeeId: string): Promise<TeamProfileDetail> {
  try {
    const response = await serverApiJson<DataResponse<TeamProfileDetail>>(`/team-profile/${employeeId}`);
    return response.data;
  } catch (error) {
    if (error instanceof ApiRequestError && error.status === 404) notFound();
    throw error;
  }
}

/** One row of the contact block: an icon tile, the value, and an optional action beside it. */
function Row({
  icon: Icon,
  label,
  children,
  action,
  tone = 'brand',
}: {
  icon: typeof Mail;
  label: string;
  children: React.ReactNode;
  action?: React.ReactNode;
  tone?: 'brand' | 'blood';
}) {
  return (
    <div className="flex items-center gap-3.5 border-t px-3 py-3 first:border-t-0">
      <span
        aria-hidden
        className={
          tone === 'blood'
            ? 'grid size-10 shrink-0 place-items-center rounded-xl bg-destructive/10 text-danger-text'
            : 'grid size-10 shrink-0 place-items-center rounded-xl bg-accent text-accent-foreground'
        }
      >
        <Icon className="size-[17px]" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate font-semibold">{children}</div>
        <div className="mt-0.5 text-[11px] text-muted-foreground">{label}</div>
      </div>
      {action}
    </div>
  );
}

export default async function TeamProfileCardPage({ params }: { params: Promise<{ employeeId: string }> }) {
  const session = await getSession();
  if (!session || !can(session.permissions, 'team_profile.view')) return <Forbidden />;

  const { employeeId } = await params;
  const card = await loadCard(employeeId);
  const blood = card.bloodGroup ? BLOOD_GROUP_LABELS[card.bloodGroup] : null;

  return (
    <div className="mx-auto w-full max-w-xl">
      <nav aria-label="Breadcrumb" className="mb-3">
        <Link
          href="/team-profile"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft aria-hidden className="size-4" />
          Team Profile
        </Link>
      </nav>

      <article className="overflow-hidden rounded-3xl bg-card shadow-panel">
        <div aria-hidden className="h-[7px] bg-gradient-to-r from-primary via-[#7b3fe4] to-[#d9481f]" />

        <div className="flex flex-col items-center px-6 pt-7 pb-6 sm:px-8">
          <ProfileAvatar initials={card.initials} size="lg" />

          <h1 className="mt-4 text-center text-[26px] font-extrabold tracking-tight text-balance">{card.fullName}</h1>
          {card.headline && <p className="mt-1.5 text-center text-sm text-muted-foreground">{card.headline}</p>}

          <div className="mt-2.5 flex flex-wrap items-center justify-center gap-2">
            <span className="rounded-full bg-accent px-3.5 py-1.5 text-[12.5px] font-semibold text-accent-foreground">
              {card.position}
            </span>
            <span className="rounded-full bg-secondary px-3 py-1.5 font-mono text-[11.5px] text-muted-foreground">
              {card.employeeCode}
            </span>
            {blood && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-destructive/10 px-3 py-1.5 text-[11.5px] font-bold text-danger-text">
                <Droplet aria-hidden className="size-3" />
                {blood}
              </span>
            )}
          </div>

          <div className="mt-5 w-full rounded-2xl border bg-secondary/40 p-2">
            <Row
              icon={Mail}
              label="Email"
              action={
                <SaveContactButton variant="copy" value={card.email} label={`Copy ${card.fullName}’s email address`} />
              }
            >
              <a href={`mailto:${card.email}`} className="hover:text-primary">
                {card.email}
              </a>
            </Row>

            {card.personalPhone && (
              <Row icon={Phone} label="Personal">
                <a href={`tel:${card.personalPhone}`} className="hover:text-primary">
                  {card.personalPhone}
                </a>
              </Row>
            )}

            {card.businessPhone && (
              <Row icon={Phone} label="Business">
                <a href={`tel:${card.businessPhone}`} className="hover:text-primary">
                  {card.businessPhone}
                </a>
              </Row>
            )}

            <Row icon={Building2} label={card.managerName ? `Reports to ${card.managerName}` : 'Department'}>
              {card.department}
            </Row>

            <Row icon={MapPin} label={`Joined ${formatDate(card.joiningDate)}`}>
              {card.workLocation}
            </Row>
          </div>

          {card.links.length > 0 && <ProfileLinks links={card.links} className="mt-5" />}

          <CardActions card={card} className="mt-5 w-full rounded-2xl border bg-secondary/40 p-1.5" />

          {card.isSelf && (
            <Link
              href="/profile"
              className="mt-2.5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl border-[1.5px] px-5 font-bold hover:bg-secondary"
            >
              Edit my card
            </Link>
          )}
        </div>
      </article>
    </div>
  );
}
