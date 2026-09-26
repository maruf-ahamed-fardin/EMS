import {
  can,
  type DataResponse,
  type TeamProfileFilters as Filters,
  type TeamProfileListResponse,
  teamProfileQuery,
} from '@/lib/validations';
import { SearchX, UserSearch, Users } from 'lucide-react';
import type { Metadata } from 'next';
import { Forbidden } from '@/components/shared/module-page';
import { PageHeader } from '@/components/shared/page-header';
import { Pagination } from '@/components/shared/pagination';
import { StatePanel } from '@/components/shared/state-panel';
import { ProfileCardTile } from '@/components/employee/profile-card-tile';
import { redirectPastLastPage } from '@/lib/client/pagination';
import { parseSearchParams } from '@/lib/client/search-params';
import { serverApiJson } from '@/lib/client/server-api';
import { getSession } from '@/lib/auth/session';
import { teamProfileHref } from '@/lib/client/team-profile';
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

  // Browsing everyone is for HR, managers and admins; everyone else looks one person up at a time.
  // The API enforces this — the page only chooses what to draw.
  const browse = can(session.permissions, 'team_profile.browse');

  const [list, filters] = await Promise.all([
    serverApiJson<TeamProfileListResponse>(`/team-profile?${apiQuery.toString()}`),
    browse
      ? serverApiJson<DataResponse<Filters>>('/team-profile/filters').then((response) => response.data)
      : Promise.resolve(null),
  ]);
  if (list.mode === 'browse') {
    redirectPastLastPage(list.meta, (page) => teamProfileHref(params, { page: String(page) }));
  }

  const searching = Boolean(params.q ?? params.departmentId ?? params.workLocation);

  return (
    <>
      <PageHeader
        title="Team Profile"
        description={
          list.mode === 'browse'
            ? 'Everyone at SeloraX. Search, filter by team or place, and open a card to get in touch.'
            : 'Look up a colleague by full name, work email or employee ID, or scan their card.'
        }
      />

      <div className="mb-5">
        <TeamProfileFilters params={params} filters={filters} />
      </div>

      {list.mode === 'lookup' ? (
        <LookupResult list={list} query={params.q} />
      ) : list.data.length === 0 ? (
        <StatePanel
          icon={SearchX}
          title="Nobody matches that"
          description="Try part of a name, or an employee ID such as SX-001."
        />
      ) : (
        <>
          <p className="mb-4 inline-flex items-center gap-2 text-sm text-muted-foreground">
            <Users aria-hidden className="size-4" />
            {list.meta.total} {list.meta.total === 1 ? 'person' : 'people'}
            {searching ? ' match' : ''}
          </p>

          <ul className="grid list-none grid-cols-1 gap-4 p-0 sm:grid-cols-2 sm:gap-5 xl:grid-cols-3 2xl:grid-cols-4">
            {list.data.map((person) => (
              <li key={person.employeeId}>
                <ProfileCardTile person={person} />
              </li>
            ))}
          </ul>

          <div className="mt-5 rounded-2xl border bg-card">
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

/**
 * A lookup shows the person searched for — or everyone who shares that exact name, each with their
 * own employee ID — or explains why it shows nobody.
 */
function LookupResult({ list, query }: { list: TeamProfileListResponse; query: string | undefined }) {
  const [first] = list.data;
  if (first && list.data.length === 1) {
    return (
      <div className="mx-auto w-full max-w-md">
        <ProfileCardTile person={first} />
      </div>
    );
  }
  if (first) {
    return (
      <>
        <p className="mb-4 inline-flex items-center gap-2 text-sm text-muted-foreground">
          <Users aria-hidden className="size-4" />
          {list.data.length} people are called {first.fullName}. Check the employee ID to find the one you mean.
        </p>
        <ul className="grid list-none grid-cols-1 gap-4 p-0 sm:grid-cols-2 sm:gap-5 xl:grid-cols-3 2xl:grid-cols-4">
          {list.data.map((person) => (
            <li key={person.employeeId}>
              <ProfileCardTile person={person} />
            </li>
          ))}
        </ul>
      </>
    );
  }
  if (!query) {
    return (
      <StatePanel
        icon={UserSearch}
        title="Who are you looking for?"
        description="Type a colleague’s full name, work email or employee ID (such as SX-001), or scan their QR code or NFC tag."
      />
    );
  }
  if (list.ambiguous) {
    return (
      <StatePanel
        icon={UserSearch}
        title="Different people match that"
        description="Type their full name, or use their work email or employee ID, to find the one you mean."
      />
    );
  }
  return (
    <StatePanel icon={SearchX} title="Nobody matches that" description="Check the spelling, or try their employee ID such as SX-001." />
  );
}
