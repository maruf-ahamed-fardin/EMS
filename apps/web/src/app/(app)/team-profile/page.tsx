import {
  can,
  type DataResponse,
  type ListResponse,
  type TeamProfileFilters as Filters,
  type TeamProfileListItem,
  teamProfileQuery,
} from '@ems/contracts';
import { SearchX } from 'lucide-react';
import type { Metadata } from 'next';
import { Forbidden } from '@/components/shared/module-page';
import { PageHeader } from '@/components/shared/page-header';
import { Pagination } from '@/components/shared/pagination';
import { StatePanel } from '@/components/shared/state-panel';
import { ProfileCardTile } from '@/components/team-profile/profile-card-tile';
import { redirectPastLastPage } from '@/lib/pagination';
import { parseSearchParams } from '@/lib/search-params';
import { serverApiJson } from '@/lib/server-api';
import { getSession } from '@/lib/session';
import { teamProfileHref } from '@/lib/team-profile';
import { TeamProfileFilters } from './team-profile-filters';

export const metadata: Metadata = { title: 'Team Profile' };

type SearchParams = Record<string, string | string[] | undefined>;

function flatten(params: SearchParams): Record<string, string | undefined> {
  return Object.fromEntries(Object.entries(params).map(([key, value]) => [key, Array.isArray(value) ? value[0] : value]));
}

export default async function TeamProfilePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const session = await getSession();
  if (!session || !can(session.permissions, 'team_profile.view')) return <Forbidden />;

  const raw = flatten(await searchParams);
  const query = parseSearchParams(teamProfileQuery, raw);
  // Only the parameters that passed validation go to the API and back into links
  const params = Object.fromEntries(
    Object.entries(raw).filter(([key]) => (query as Record<string, unknown>)[key] !== undefined),
  );
  const apiQuery = new URLSearchParams(
    Object.entries({ ...params, page: String(query.page), limit: String(query.limit) }).filter(
      (entry): entry is [string, string] => typeof entry[1] === 'string' && entry[1] !== '',
    ),
  );

  const [list, filters] = await Promise.all([
    serverApiJson<ListResponse<TeamProfileListItem>>(`/team-profile?${apiQuery.toString()}`),
    serverApiJson<DataResponse<Filters>>('/team-profile/filters').then((response) => response.data),
  ]);
  redirectPastLastPage(list.meta, (page) => teamProfileHref(params, { page: String(page) }));

  const searching = Boolean(params.q ?? params.departmentId ?? params.workLocation);

  return (
    <>
      <PageHeader
        title="Team Profile"
        description="Everyone at SeloraX. Search by name or employee ID, then open a card to get in touch."
      />

      <div className="mb-5">
        <TeamProfileFilters params={params} filters={filters} />
      </div>

      {list.data.length === 0 ? (
        <StatePanel
          icon={SearchX}
          title="Nobody matches that"
          description="Try part of a name, or an employee ID such as SX-001."
        />
      ) : (
        <>
          <p className="mb-4 text-sm text-muted-foreground">
            {list.meta.total} {list.meta.total === 1 ? 'person' : 'people'}
            {searching ? ' match' : ''}
          </p>

          <ul className="grid list-none grid-cols-1 gap-4 p-0 sm:grid-cols-2 xl:grid-cols-3">
            {list.data.map((person) => (
              <li key={person.employeeId}>
                <ProfileCardTile person={person} />
              </li>
            ))}
          </ul>

          <div className="mt-2 rounded-2xl border bg-card">
            <Pagination
              meta={list.meta}
              hrefFor={(page) => teamProfileHref(params, { page: String(page) })}
              noun="people"
            />
          </div>
        </>
      )}
    </>
  );
}
