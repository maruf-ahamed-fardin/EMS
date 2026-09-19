import { can, type DataResponse, type PermissionItem, type RoleItem } from '@ems/contracts';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Forbidden } from '@/components/shared/module-page';
import { PageHeader } from '@/components/shared/page-header';
import { serverApiJson } from '@/lib/server-api';
import { getSession } from '@/lib/session';
import { cn } from '@/lib/utils';
import { RoleEditor } from './role-editor';

export const metadata: Metadata = { title: 'Roles & permissions' };

export default async function RolesPage({ searchParams }: { searchParams: Promise<{ role?: string }> }) {
  const session = await getSession();
  if (!session || !can(session.permissions, 'role.manage')) return <Forbidden />;

  const [{ data: roles }, { data: catalogue }] = await Promise.all([
    serverApiJson<DataResponse<RoleItem[]>>('/roles'),
    serverApiJson<DataResponse<PermissionItem[]>>('/permissions'),
  ]);
  const { role: requested } = await searchParams;
  const role = roles.find((r) => r.key === requested) ?? roles.find((r) => r.editable) ?? roles[0]!;

  return (
    <div className="grid grid-cols-1 gap-6">
      <PageHeader title="Roles & permissions" description="What each role can see and do. Own means their own record, Team their direct reports, Everyone the whole organization." />
      <nav aria-label="Roles" className="-mx-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:px-0">
        {roles.map((r) => (
          <Link
            key={r.id}
            href={`/roles?role=${r.key}`}
            aria-current={r.id === role.id ? 'page' : undefined}
            className={cn(
              'inline-flex h-9 shrink-0 items-center gap-2 rounded-full border px-3.5 text-sm font-medium hover:bg-secondary',
              r.id === role.id && 'border-primary/30 bg-accent text-accent-foreground hover:bg-accent',
            )}
          >
            {r.name}
            <span className="text-xs text-muted-foreground tabular">{r.userCount}</span>
          </Link>
        ))}
      </nav>
      {role.description && <p className="-mt-2 text-sm text-muted-foreground">{role.description}</p>}
      {/* Keyed by role, so switching roles starts from that role's saved grants */}
      <RoleEditor key={role.id} role={role} catalogue={catalogue} canGrantAdmin={session.role.key === 'super_admin'} />
    </div>
  );
}
