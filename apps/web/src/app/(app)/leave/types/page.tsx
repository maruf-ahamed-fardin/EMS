import { can, type DataResponse, type LeaveTypeItem } from '@ems/contracts';
import { Tags } from 'lucide-react';
import type { Metadata } from 'next';
import { DeleteButton } from '@/components/shared/delete-button';
import { Forbidden } from '@/components/shared/module-page';
import { PageHeader } from '@/components/shared/page-header';
import { StatePanel } from '@/components/shared/state-panel';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { serverApiJson } from '@/lib/server-api';
import { getSession } from '@/lib/session';
import { LeaveTypeDialog } from './leave-type-dialog';

export const metadata: Metadata = { title: 'Leave types' };

export default async function LeaveTypesPage() {
  const session = await getSession();
  if (!session || !can(session.permissions, 'leave.manage_types')) return <Forbidden />;
  const { data: types } = await serverApiJson<DataResponse<LeaveTypeItem[]>>('/leave/types?includeInactive=true');

  return (
    <div className="grid grid-cols-1 gap-6">
      <PageHeader title="Leave types" description="What people can take, and how much each year. New paid types give everyone this year's balance straight away." actions={<LeaveTypeDialog />} />
      {types.length === 0 ? (
        <StatePanel icon={Tags} title="No leave types yet" description="Add Annual, Sick and Casual leave to get started." />
      ) : (
        <div className="overflow-hidden rounded-2xl border bg-card shadow-panel">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-5">Type</TableHead>
                <TableHead>Per year</TableHead>
                <TableHead className="hidden sm:table-cell">Carry over</TableHead>
                <TableHead className="hidden md:table-cell">Paid</TableHead>
                <TableHead className="hidden md:table-cell">Waiting</TableHead>
                <TableHead className="w-24 pr-5 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {types.map((type) => (
                <TableRow key={type.id}>
                  <TableCell className="pl-5">
                    <p className="font-medium">
                      {type.name}
                      {!type.isActive && <span className="ml-2 text-xs text-muted-foreground">(inactive)</span>}
                    </p>
                    <p className="font-mono text-xs text-muted-foreground">{type.code}</p>
                  </TableCell>
                  <TableCell className="tabular">{type.isPaid ? `${type.defaultDaysPerYear} days` : '—'}</TableCell>
                  <TableCell className="hidden tabular sm:table-cell">{type.carryForwardMax > 0 ? `up to ${type.carryForwardMax}` : 'None'}</TableCell>
                  <TableCell className="hidden md:table-cell">{type.isPaid ? 'Paid' : 'Unpaid'}</TableCell>
                  <TableCell className="hidden tabular md:table-cell">{type.pendingRequests}</TableCell>
                  <TableCell className="pr-5">
                    <div className="flex justify-end gap-1">
                      <LeaveTypeDialog type={type} />
                      <DeleteButton
                        size="icon"
                        label={`Delete ${type.name}`}
                        path={`/leave/types/${type.id}`}
                        title={`Delete ${type.name}?`}
                        description="Nobody can request it any more. Past requests and balances are kept."
                        successMessage={`${type.name} deleted`}
                        blockedReason={type.pendingRequests > 0 ? `${type.pendingRequests} requests are still waiting for a decision.` : undefined}
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
