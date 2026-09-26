import { type AttendanceSettings, can, type DataResponse, type HolidayItem } from '@/lib/validations';
import type { Metadata } from 'next';
import { Forbidden } from '@/components/shared/module-page';
import { PageHeader } from '@/components/shared/page-header';
import { dhakaToday } from '@/lib/client/attendance';
import { serverApiJson } from '@/lib/client/server-api';
import { getSession } from '@/lib/client/session';
import { AttendanceSettingsForm, HolidaysCard } from './settings-forms';

export const metadata: Metadata = { title: 'Settings' };

/** Organization settings. Attendance and holidays arrive in Phase 6; the other sections in Phase 12. */
export default async function SettingsPage() {
  const session = await getSession();
  if (!session || !can(session.permissions, 'settings.manage')) return <Forbidden />;

  const year = Number(dhakaToday().slice(0, 4));
  const [{ data: attendance }, { data: holidays }] = await Promise.all([
    serverApiJson<DataResponse<AttendanceSettings>>('/settings/attendance'),
    serverApiJson<DataResponse<HolidayItem[]>>(`/holidays?year=${year}`),
  ]);

  return (
    <>
      <PageHeader title="Settings" description="The working calendar that attendance and leave are counted against." />
      <div className="grid grid-cols-1 max-w-3xl gap-6">
        <AttendanceSettingsForm initial={attendance} />
        <HolidaysCard year={year} initial={holidays} />
      </div>
    </>
  );
}
