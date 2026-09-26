import { can, type DataResponse, type EmployeeFormOptions } from '@/lib/validations';
import type { Metadata } from 'next';
import { Forbidden } from '@/components/shared/module-page';
import { PageHeader } from '@/components/shared/page-header';
import { serverApiJson } from '@/lib/client/server-api';
import { getSession } from '@/lib/auth/session';
import { CreateEmployeeWizard } from './create-employee-wizard';

export const metadata: Metadata = { title: 'Add employee' };

export default async function NewEmployeePage() {
  const session = await getSession();
  if (!session || !can(session.permissions, 'employee.create')) return <Forbidden />;

  const { data: options } = await serverApiJson<DataResponse<EmployeeFormOptions>>('/employees/form-options');

  return (
    <>
      <PageHeader title="Add employee" description="Four short steps, then a review before anything is saved." />
      <CreateEmployeeWizard options={options} />
    </>
  );
}
