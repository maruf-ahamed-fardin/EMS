import type { DataResponse, EmployeeDetail } from '@ems/contracts';
import { KeyRound, UserRound } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHeader } from '@/components/shared/page-header';
import { PersonAvatar } from '@/components/shared/person-avatar';
import { StatePanel } from '@/components/shared/state-panel';
import { Tag } from '@/components/shared/status-badge';
import { Button } from '@/components/ui/button';
import { ApiRequestError } from '@/lib/api-error';
import { EMPLOYMENT_TYPE_LABELS, formatDate } from '@/lib/employees';
import { serverApiJson } from '@/lib/server-api';
import { MyContactForm } from './my-contact-form';

export const metadata: Metadata = { title: 'My profile' };

export default async function MyProfilePage() {
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

  return (
    <>
      <PageHeader
        title="My profile"
        description="HR keeps your job details up to date. You can change your contact details here."
        actions={
          <Button asChild variant="outline" className="h-10">
            <Link href="/profile/security">
              <KeyRound aria-hidden /> Password & sign-in
            </Link>
          </Button>
        }
      />
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
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="truncate text-right font-medium">{value}</dd>
              </div>
            ))}
          </dl>
        </aside>
        {me.private && <MyContactForm phone={me.phone} details={me.private} />}
      </div>
    </>
  );
}
