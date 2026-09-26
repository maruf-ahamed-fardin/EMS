import { can, type DataResponse, type DepartmentListItem, type PositionListItem } from '@/lib/validations';
import { Briefcase } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { DeleteButton } from '@/components/shared/delete-button';
import { Forbidden } from '@/components/shared/module-page';
import { PageHeader } from '@/components/shared/page-header';
import { StatePanel } from '@/components/shared/state-panel';
import { Tag } from '@/components/shared/status-badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { serverApiJson } from '@/lib/client/server-api';
import { getSession } from '@/lib/client/session';
import { cn } from '@/lib/client/utils';
import { PositionFormDialog } from './position-form-dialog';

export const metadata: Metadata = { title: 'Positions' };

export default async function PositionsPage({ searchParams }: { searchParams: Promise<{ departmentId?: string }> }) {
  const session = await getSession();
  if (!session || !can(session.permissions, 'position.view')) return <Forbidden />;

  const { departmentId } = await searchParams;
  const canManage = can(session.permissions, 'position.manage');
  const query = new URLSearchParams({ ...(departmentId ? { departmentId } : {}), ...(canManage ? { includeInactive: 'true' } : {}) });
  const [{ data: positions }, { data: departments }] = await Promise.all([
    serverApiJson<DataResponse<PositionListItem[]>>(`/positions?${query.toString()}`),
    serverApiJson<DataResponse<DepartmentListItem[]>>('/departments'),
  ]);
  const departmentOptions = departments.map((d) => ({ id: d.id, name: d.name }));

  return (
    <>
      <PageHeader
        title="Positions"
        description={`${positions.length} ${positions.length === 1 ? 'position' : 'positions'}`}
        actions={canManage && <PositionFormDialog departments={departmentOptions} defaultDepartmentId={departmentId} />}
      />

      <nav aria-label="Filter by department" className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0">
        {[{ id: undefined, name: 'All departments' }, ...departmentOptions].map((option) => (
          <Link
            key={option.id ?? 'all'}
            href={option.id ? `/positions?departmentId=${option.id}` : '/positions'}
            aria-current={option.id === departmentId ? 'page' : undefined}
            className={cn(
              'inline-flex h-9 shrink-0 items-center rounded-full border px-3.5 text-sm font-medium hover:bg-secondary',
              option.id === departmentId && 'border-primary/30 bg-accent text-accent-foreground hover:bg-accent',
            )}
          >
            {option.name}
          </Link>
        ))}
      </nav>

      {positions.length === 0 ? (
        <StatePanel icon={Briefcase} title="No positions here yet" description={canManage ? 'Add a position to get started.' : undefined} />
      ) : (
        <div className="overflow-hidden rounded-2xl border bg-card shadow-panel">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-5">Title</TableHead>
                <TableHead>Department</TableHead>
                <TableHead className="hidden sm:table-cell">Level</TableHead>
                <TableHead>Holders</TableHead>
                {canManage && <TableHead className="w-24 pr-5 text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {positions.map((position) => (
                <TableRow key={position.id}>
                  <TableCell className="pl-5 font-medium">
                    {position.title}
                    {!position.isActive && <span className="ml-2 text-xs text-muted-foreground">(inactive)</span>}
                  </TableCell>
                  <TableCell>
                    {position.department ? (
                      <Link href={`/departments/${position.department.id}`} className="hover:underline">
                        <Tag>{position.department.name}</Tag>
                      </Link>
                    ) : (
                      <span className="text-sm text-muted-foreground">Shared</span>
                    )}
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground sm:table-cell">{position.level ?? '—'}</TableCell>
                  <TableCell className="tabular">{position.activeEmployeeCount}</TableCell>
                  {canManage && (
                    <TableCell className="pr-5">
                      <div className="flex justify-end gap-1">
                        <PositionFormDialog departments={departmentOptions} position={position} />
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
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );
}
