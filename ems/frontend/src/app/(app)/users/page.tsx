import { can, type DataResponse, type ListResponse, type UserFormOptions, type UserListItem, userListQuery } from '@ems/contracts';
import { CircleCheck, CircleMinus, Lock, UsersRound } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Forbidden } from '@/components/shared/module-page';
import { PageHeader } from '@/components/shared/page-header';
import { Pagination } from '@/components/shared/pagination';
import { PersonAvatar } from '@/components/shared/person-avatar';
import { StatePanel } from '@/components/shared/state-panel';
import { Tag } from '@/components/shared/status-badge';
import { formatDateTime } from '@/lib/employees';
import { serverApiJson } from '@/lib/server-api';
import { getSession } from '@/lib/session';
import { cn } from '@/lib/utils';
import { UserFilters } from './user-filters';
import { CreateUserDialog, UserActions } from './user-dialogs';

export const metadata: Metadata = { title: 'Users' };

function AccountStatus({ user }: { user: UserListItem }) {
  const [Icon, label, tone] = user.lockedUntil
    ? [Lock, `Locked until ${formatDateTime(user.lockedUntil).split(', ')[1]}`, 'bg-warning/15 text-warning-text']
    : user.status === 'ACTIVE'
      ? [CircleCheck, 'Active', 'bg-success/12 text-success-text']
      : [CircleMinus, 'Inactive', 'bg-muted text-muted-foreground'];
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap', tone)}>
      <Icon className="size-3.5" aria-hidden /> {label}
    </span>
  );
}

function usersHref(params: Record<string, string | undefined>, changes: Record<string, string | undefined>): string {
  const merged: Record<string, string | undefined> = { ...params, ...changes };
  if (!('page' in changes)) delete merged.page;
  const query = new URLSearchParams(Object.entries(merged).filter((e): e is [string, string] => Boolean(e[1]))).toString();
  return query ? `/users?${query}` : '/users';
}

export default async function UsersPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const session = await getSession();
  if (!session || !can(session.permissions, 'user.view')) return <Forbidden />;

  const query = userListQuery.parse(await searchParams);
  const params = { q: query.q, roleId: query.roleId, status: query.status, page: query.page > 1 ? String(query.page) : undefined };
  const search = new URLSearchParams(Object.entries({ ...params, page: String(query.page), limit: '25' }).filter((e): e is [string, string] => Boolean(e[1])));
  const manage = can(session.permissions, 'user.manage');
  const [list, options] = await Promise.all([
    serverApiJson<ListResponse<UserListItem>>(`/users?${search.toString()}`),
    manage ? serverApiJson<DataResponse<UserFormOptions>>('/users/form-options').then((r) => r.data) : null,
  ]);

  return (
    <div className="grid grid-cols-1 gap-6">
      <PageHeader
        title="Users"
        description={manage ? 'Who can sign in, and with which role. Passwords are always chosen by their owners.' : 'Who can sign in, and with which role.'}
        actions={options && <CreateUserDialog options={options} />}
      />
      <section className="overflow-hidden rounded-2xl border bg-card shadow-panel">
        <UserFilters params={params} roles={options?.roles ?? [...new Map(list.data.map((u) => [u.role.id, { id: u.role.id, name: u.role.name }])).values()]} />
        {list.data.length === 0 ? (
          <StatePanel icon={UsersRound} title="No accounts match" description="Try another search or filter." className="border-0 shadow-none" />
        ) : (
          <>
            <ul className="divide-y">
              {list.data.map((user) => (
                <li key={user.id} className="flex items-start gap-3 px-4 py-3 md:items-center md:px-5">
                  <PersonAvatar name={user.name} />
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="font-medium">
                        {user.employee ? (
                          <Link href={`/employees/${user.employee.id}`} className="hover:underline">
                            {user.name}
                          </Link>
                        ) : (
                          user.name
                        )}
                      </span>
                      <Tag>{user.role.name}</Tag>
                      <AccountStatus user={user} />
                    </p>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {user.email}
                      {user.employee && ` · ${user.employee.employeeCode}`}
                      {' · '}
                      {user.lastLoginAt ? `last signed in ${formatDateTime(user.lastLoginAt)}` : 'never signed in'}
                    </p>
                  </div>
                  {options && <UserActions user={user} roles={options.roles} />}
                </li>
              ))}
            </ul>
            <div className="border-t">
              <Pagination meta={list.meta} noun="accounts" hrefFor={(page) => usersHref(params, { page: String(page) })} />
            </div>
          </>
        )}
      </section>
    </div>
  );
}
