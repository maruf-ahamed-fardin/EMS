import type { DataResponse, EmployeeDetail, EmployeeFormOptions } from '@/lib/validations';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Forbidden } from '@/components/shared/module-page';
import { PageHeader } from '@/components/shared/page-header';
import { ApiRequestError } from '@/lib/client/api-error';
import { serverApiJson } from '@/lib/client/server-api';
import { EditEmployeeForm } from './edit-employee-form';

export const metadata: Metadata = { title: 'Edit employee' };

export default async function EditEmployeePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let employee: EmployeeDetail;
  try {
    employee = (await serverApiJson<DataResponse<EmployeeDetail>>(`/employees/${encodeURIComponent(id)}`)).data;
  } catch (error) {
    if (error instanceof ApiRequestError && error.status === 404) notFound();
    throw error;
  }
  if (!employee.allowedActions.update || !employee.private) return <Forbidden />;

  const { data: options } = await serverApiJson<DataResponse<EmployeeFormOptions>>('/employees/form-options');
  return (
    <>
      <PageHeader title={`Edit ${employee.fullName}`} description={`${employee.employeeCode} · ${employee.position.title}`} />
      <EditEmployeeForm employee={employee} options={options} />
    </>
  );
}
