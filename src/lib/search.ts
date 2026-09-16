/**
 * Matching for the team directory. Pure and free of server imports, so the search box can filter
 * in the browser: the whole team is sent with the page, which makes results instant and means
 * typing never hits the database.
 */
export interface TeamMemberSummary {
  username: string;
  name?: string;
  designation?: string;
  role?: string;
  employeeId?: string;
  /** Only ever a link. Embedded images stay on the profile page, so the list stays small. */
  photo?: string;
}

const lower = (value: string | undefined) => (value ?? '').toLowerCase();

/** The fields a search looks at, most identifying first. */
const haystack = (member: TeamMemberSummary) =>
  [member.name, member.username, member.employeeId, member.designation, member.role].map(lower);

/**
 * Lower sorts first. An exact username or employee ID wins, then a name that starts with the
 * query, then anything that merely contains it - so typing "ma" puts Maruf above Rahman.
 */
function rank(member: TeamMemberSummary, query: string): number {
  if (lower(member.username) === query || lower(member.employeeId) === query) return 0;
  if (lower(member.name).startsWith(query)) return 1;
  if (lower(member.username).startsWith(query)) return 2;
  if (lower(member.name).split(/\s+/).some(word => word.startsWith(query))) return 3;
  return 4;
}

const byName = (a: TeamMemberSummary, b: TeamMemberSummary) =>
  (a.name ?? a.username).localeCompare(b.name ?? b.username);

/**
 * Members matching every word of the query, best first. An empty query returns everyone, so the
 * page doubles as a directory. Multiple words all have to match somewhere, which is what makes
 * "maruf fardin" and "fardin maruf" both find the same person.
 */
export function matchMembers(members: TeamMemberSummary[], query: string): TeamMemberSummary[] {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return [...members].sort(byName);

  const matched = members.filter(member => {
    const fields = haystack(member);
    return terms.every(term => fields.some(field => field.includes(term)));
  });

  const whole = terms.join(' ');
  return matched.sort((a, b) => rank(a, whole) - rank(b, whole) || byName(a, b));
}
