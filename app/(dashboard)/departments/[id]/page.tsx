import { can, type DataResponse, type DepartmentDetail, type DepartmentListItem, type PositionListItem } from '@/lib/validations';
import { Briefcase, ChevronRight, UserRoundX, Users } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { DeleteButton } from '@/components/shared/delete-button';
import { PersonAvatar } from '@/components/shared/person-avatar';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ApiRequestError } from '@/lib/client/api-error';
import { formatInstantDate } from '@/lib/client/employees';
import { serverApiJson } from '@/lib/client/server-api';
import { getSession } from '@/lib/auth/session';
import { PositionFormDialog } from '../../positions/position-form-dialog';
import { DepartmentFormDialog } from '../department-form-dialog';

export const metadata: Metadata = { title: 'Department' };

export default async function DepartmentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let department: DepartmentDetail;
  try {
    department = (await serverApiJson<DataResponse<DepartmentDetail>>(`/departments/${encodeURIComponent(id)}`)).data;
  } catch (error) {
    if (error instanceof ApiRequestError && error.status === 404) notFound();
    throw error;
  }

  const session = await getSession();
  const canSeeEmployees = session ? can(session.permissions, 'employee.view', 'TEAM') : false;
  const { allowedActions: allowed } = department;
  const departmentOptions = allowed.managePositions
    ? (await serverApiJson<DataResponse<DepartmentListItem[]>>('/departments')).data.map((d) => ({ id: d.id, name: d.name }))
    : [];
  const deleteBlocked =
    department.activeEmployeeCount > 0
      ? `${department.activeEmployeeCount} active ${department.activeEmployeeCount === 1 ? 'employee works' : 'employees work'} here. Move them first.`
      : undefined;

  return (
    <>
      <nav aria-label="Breadcrumb" className="mb-4 flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link href="/departments" className="hover:text-foreground hover:underline">
          Departments
        </Link>
        <ChevronRight className="size-3.5" aria-hidden />
        <span className="truncate text-foreground" aria-current="page">
          {department.name}
        </span>
      </nav>

      <section className="rounded-2xl border bg-card p-5 shadow-panel md:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight">{department.name}</h1>
              <span className="rounded-md bg-muted px-2 py-0.5 font-mono text-xs">{department.code}</span>
              {!department.isActive && <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">Inactive</span>}
            </div>
            {department.description && <p className="mt-2 max-w-2xl text-muted-foreground">{department.description}</p>}
            <p className="mt-2 text-xs text-muted-foreground">Created {formatInstantDate(department.createdAt)}</p>
          </div>
          {(allowed.update || can(session?.permissions ?? {}, 'department.delete')) && (
            <div className="flex flex-wrap gap-2">
              {allowed.update && <DepartmentFormDialog department={department} />}
              {can(session?.permissions ?? {}, 'department.delete') && (
                <DeleteButton
                  path={`/departments/${department.id}`}
                  title={`Delete ${department.name}?`}
                  description="The department and its positions disappear from lists and forms. Its code can be reused. Past records and the audit history are kept."
                  successMessage={`${department.name} was deleted`}
                  redirectTo="/departments"
                  blockedReason={deleteBlocked}
                />
              )}
            </div>
          )}
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 border-t pt-5 sm:grid-cols-2 lg:grid-cols-4">
          <Stat icon={Users} label="Active employees" value={department.activeEmployeeCount} />
          <Stat icon={UserRoundX} label="Inactive employees" value={department.inactiveEmployeeCount} />
          <Stat icon={Briefcase} label="Positions" value={department.positionCount} />
          <div className="flex items-center gap-3">
            {department.head ? (
              <>
                <PersonAvatar name={department.head.name} />
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Head of department</p>
                  {canSeeEmployees ? (
                    <Link href={`/employees/${department.head.id}`} className="block truncate font-semibold hover:underline">
                      {department.head.name}
                    </Link>
                  ) : (
                    <p className="truncate font-semibold">{department.head.name}</p>
                  )}
                </div>
              </>
            ) : (
              <div>
                <p className="text-xs text-muted-foreground">Head of department</p>
                <p className="font-semibold">Not assigned</p>
              </div>
            )}
          </div>
        </div>

        {canSeeEmployees && department.activeEmployeeCount > 0 && (
          <Button asChild variant="link" className="mt-3 h-auto px-0">
            <Link href={`/employees?departmentId=${department.id}`}>
              View the people in {department.name} <ChevronRight aria-hidden />
            </Link>
          </Button>
        )}
      </section>

      <section className="mt-6 overflow-hidden rounded-2xl border bg-card shadow-panel" aria-labelledby="positions-title">
        <div className="flex items-center justify-between gap-3 border-b px-5 py-4">
          <div>
            <h2 id="positions-title" className="font-semibold">
              Positions
            </h2>
            <p className="text-sm text-muted-foreground">Job titles people in {department.name} can hold.</p>
          </div>
          {allowed.managePositions && <PositionFormDialog departments={departmentOptions} defaultDepartmentId={department.id} />}
        </div>
        {department.positions.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-muted-foreground">No positions yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-5">Title</TableHead>
                <TableHead>Level</TableHead>
                <TableHead>Active holders</TableHead>
                {allowed.managePositions && <TableHead className="w-24 pr-5 text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {department.positions.map((position) => {
                const asListItem: PositionListItem = { ...position, department: { id: department.id, name: department.name } };
                return (
                  <TableRow key={position.id}>
                    <TableCell className="pl-5 font-medium">
                      {position.title}
                      {!position.isActive && <span className="ml-2 text-xs text-muted-foreground">(inactive)</span>}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{position.level ?? '—'}</TableCell>
                    <TableCell className="tabular">{position.activeEmployeeCount}</TableCell>
                    {allowed.managePositions && (
                      <TableCell className="pr-5">
                        <div className="flex justify-end gap-1">
                          <PositionFormDialog departments={departmentOptions} position={asListItem} />
                          <DeleteButton
                            size="icon"
                            label={`Delete ${position.title}`}
                            path={`/positions/${position.id}`}
                            title={`Delete ${position.title}?`}
                            description="It disappears from lists and forms. Past records keep it."
                            successMessage={`${position.title} was deleted`}
                            blockedReason={
                              position.activeEmployeeCount > 0
                                ? `${position.activeEmployeeCount} active ${position.activeEmployeeCount === 1 ? 'employee holds' : 'employees hold'} this position.`
                                : undefined
                            }
                          />
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </section>
    </>
  );
}

function Stat({ icon: Icon, label, value }: { icon: typeof Users; label: string; value: number }) {
  return (
    <div className="flex items-center gap-3">
      <span className="grid size-10 place-items-center rounded-xl bg-accent text-accent-foreground">
        <Icon className="size-5" aria-hidden />
      </span>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-xl font-bold tabular">{value}</p>
      </div>
    </div>
  );
}
