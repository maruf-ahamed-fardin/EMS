import { can, type DataResponse, type DepartmentListItem } from '@ems/contracts';
import { Briefcase, Building2, ChevronRight, Users } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Forbidden } from '@/components/shared/module-page';
import { PageHeader } from '@/components/shared/page-header';
import { PersonAvatar } from '@/components/shared/person-avatar';
import { StatePanel } from '@/components/shared/state-panel';
import { serverApiJson } from '@/lib/server-api';
import { getSession } from '@/lib/session';
import { DepartmentFormDialog } from './department-form-dialog';

export const metadata: Metadata = { title: 'Departments' };

export default async function DepartmentsPage() {
  const session = await getSession();
  if (!session || !can(session.permissions, 'department.view')) return <Forbidden />;

  const canCreate = can(session.permissions, 'department.create');
  const canEdit = can(session.permissions, 'department.update');
  // People who manage departments also see inactive ones, to reactivate them
  const { data: departments } = await serverApiJson<DataResponse<DepartmentListItem[]>>(
    `/departments${canEdit ? '?includeInactive=true' : ''}`,
  );
  const people = departments.reduce((sum, d) => sum + d.activeEmployeeCount, 0);

  return (
    <>
      <PageHeader
        title="Departments"
        description={`${departments.length} ${departments.length === 1 ? 'department' : 'departments'} · ${people} active ${people === 1 ? 'person' : 'people'}`}
        actions={canCreate && <DepartmentFormDialog />}
      />

      {departments.length === 0 ? (
        <StatePanel
          icon={Building2}
          title="No departments yet"
          description={canCreate ? 'Create the first department, then add its positions.' : 'Departments will appear here once HR creates them.'}
        />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {departments.map((department) => (
            <li key={department.id}>
              <Link
                href={`/departments/${department.id}`}
                className="group flex h-full flex-col rounded-2xl border bg-card p-5 shadow-panel transition-colors outline-none hover:border-primary/40 focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="truncate text-lg font-semibold group-hover:underline">{department.name}</h2>
                    <p className="font-mono text-xs text-muted-foreground">{department.code}</p>
                  </div>
                  {!department.isActive ? (
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">Inactive</span>
                  ) : (
                    <ChevronRight className="size-5 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden />
                  )}
                </div>
                {department.description && <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{department.description}</p>}

                <div className="mt-auto pt-5">
                  <div className="flex items-center gap-2.5 border-t pt-4">
                    {department.head ? (
                      <>
                        <PersonAvatar name={department.head.name} size="sm" />
                        <div className="min-w-0 text-sm">
                          <p className="truncate font-medium">{department.head.name}</p>
                          <p className="truncate text-xs text-muted-foreground">Head · {department.head.positionTitle}</p>
                        </div>
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground">No head assigned</p>
                    )}
                  </div>
                  <dl className="mt-4 flex gap-5 text-sm">
                    <div className="flex items-center gap-1.5">
                      <Users className="size-4 text-muted-foreground" aria-hidden />
                      <dt className="sr-only">Active employees</dt>
                      <dd className="font-semibold tabular">{department.activeEmployeeCount}</dd>
                      <span className="text-muted-foreground" aria-hidden>
                        people
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Briefcase className="size-4 text-muted-foreground" aria-hidden />
                      <dt className="sr-only">Positions</dt>
                      <dd className="font-semibold tabular">{department.positionCount}</dd>
                      <span className="text-muted-foreground" aria-hidden>
                        positions
                      </span>
                    </div>
                  </dl>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
