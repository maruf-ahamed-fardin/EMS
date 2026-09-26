import { can, type DataResponse, type EmployeeDetail, type OwnTeamProfile, type TeamProfileDetail } from '@/lib/validations';
import { ContactRound, KeyRound, UserRound } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHeader } from '@/components/shared/page-header';
import { PersonAvatar } from '@/components/shared/person-avatar';
import { StatePanel } from '@/components/shared/state-panel';
import { Tag } from '@/components/shared/status-badge';
import { PhotoEditor } from '@/components/team-profile/photo-editor';
import { ProfileCardTile } from '@/components/team-profile/profile-card-tile';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ApiRequestError } from '@/lib/client/api-error';
import { EMPLOYMENT_TYPE_LABELS, formatDate } from '@/lib/client/employees';
import { serverApiJson } from '@/lib/client/server-api';
import { getSession } from '@/lib/client/session';
import { MyCardForm } from './my-card-form';
import { MyContactForm } from './my-contact-form';

export const metadata: Metadata = { title: 'My profile' };

const TABS = ['details', 'card'] as const;

function initialsOf(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  return `${parts[0]?.charAt(0) ?? ''}${parts.length > 1 ? (parts.at(-1)?.charAt(0) ?? '') : ''}`.toUpperCase();
}

export default async function MyProfilePage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const session = await getSession();
  const { tab } = await searchParams;
  let me: EmployeeDetail;
  try {
    me = (await serverApiJson<DataResponse<EmployeeDetail>>('/me/profile')).data;
  } catch (error) {
    if (error instanceof ApiRequestError && error.status === 404) {
      return (
        <>
          <PageHeader title="My profile" />
          <StatePanel
            icon={UserRound}
            title="No employee record is linked to your account"
            description="Your sign-in works, but HR hasn't connected it to an employee record. Ask HR if you expected one."
            action={
              <Button asChild variant="outline">
                <Link href="/profile/security">
                  <KeyRound aria-hidden /> Password & sign-in
                </Link>
              </Button>
            }
          />
        </>
      );
    }
    throw error;
  }

  // The card is a separate resource, and a missing one is not a reason to fail the page
  const permissions = session?.permissions ?? {};
  const [card, preview] = can(permissions, 'team_profile.manage_own')
    ? await Promise.all([
        serverApiJson<DataResponse<OwnTeamProfile>>('/team-profile/me')
          .then((response) => response.data)
          .catch(() => null),
        // What colleagues see: the saved card, refreshed after every save
        can(permissions, 'team_profile.view')
          ? serverApiJson<DataResponse<TeamProfileDetail>>(`/team-profile/${me.id}`)
              .then((response) => response.data)
              .catch(() => null)
          : Promise.resolve(null),
      ])
    : [null, null];

  const initialTab = card && (TABS as readonly string[]).includes(tab ?? '') ? tab! : 'details';

  const details = (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[320px_1fr]">
      <aside className="h-fit rounded-2xl border bg-card p-5 shadow-panel">
        <div className="flex items-center gap-3">
          <PersonAvatar name={me.fullName} size="md" />
          <div className="min-w-0">
            <p className="truncate font-semibold">{me.fullName}</p>
            <p className="truncate text-sm text-muted-foreground">{me.position.title}</p>
          </div>
        </div>
        <dl className="mt-5 grid grid-cols-1 gap-3 text-sm">
          {[
            ['Employee ID', me.employeeCode],
            ['Department', <Tag key="d">{me.department.name}</Tag>],
            ['Manager', me.manager?.name ?? '—'],
            ['Employment', EMPLOYMENT_TYPE_LABELS[me.employmentType]],
            ['Joined', formatDate(me.joiningDate)],
            ['Work email', me.email],
          ].map(([label, value]) => (
            <div key={label as string} className="flex justify-between gap-3">
              <dt className="shrink-0 text-muted-foreground">{label}</dt>
              <dd className="min-w-0 truncate text-right font-medium">{value}</dd>
            </div>
          ))}
        </dl>
      </aside>
      {me.private && <MyContactForm phone={me.phone} details={me.private} />}
    </div>
  );

  return (
    <>
      <PageHeader
        title="My profile"
        description="HR keeps your job details up to date. You can change your contact details and your Team Profile card here."
        actions={
          <Button asChild variant="outline" className="h-10">
            <Link href="/profile/security">
              <KeyRound aria-hidden /> Password & sign-in
            </Link>
          </Button>
        }
      />

      {card ? (
        // Keyed by the tab in the URL, so a link to ?tab=card (and Back) opens that tab
        <Tabs key={initialTab} defaultValue={initialTab}>
          <TabsList className="grid h-auto w-full grid-cols-2 sm:inline-flex sm:w-auto">
            <TabsTrigger value="details" className="h-10 gap-2 px-4">
              <UserRound aria-hidden className="size-4" />
              My details
            </TabsTrigger>
            <TabsTrigger value="card" className="h-10 gap-2 px-4">
              <ContactRound aria-hidden className="size-4" />
              <span className="sm:hidden">My card</span>
              <span className="hidden sm:inline">Team Profile card</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="mt-5">
            {details}
          </TabsContent>

          <TabsContent value="card" className="mt-5">
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px] xl:grid-cols-[1fr_380px]">
              {preview && (
                <section aria-labelledby="card-preview" className="lg:order-2">
                  <div className="lg:sticky lg:top-20">
                    <h2 id="card-preview" className="mb-2.5 text-sm font-semibold text-muted-foreground">
                      How colleagues see it
                    </h2>
                    <div className="mx-auto max-w-sm lg:max-w-none">
                      <ProfileCardTile person={preview} />
                    </div>
                    <p className="mt-2.5 text-xs text-muted-foreground">Updates when you save.</p>
                  </div>
                </section>
              )}
              <div className="flex min-w-0 flex-col gap-6 lg:order-1">
                <PhotoEditor photoUrl={card.photoUrl} initials={initialsOf(me.fullName)} />
                <MyCardForm card={card} employeeId={me.id} />
              </div>
            </div>
          </TabsContent>
        </Tabs>
      ) : (
        details
      )}
    </>
  );
}
