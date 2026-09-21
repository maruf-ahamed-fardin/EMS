import { z } from 'zod';
import { type PageMeta, paginationQuery } from './api';
import { BloodGroup } from './enums';

/**
 * Team Profile: the staff directory every signed-in person can browse, and the card behind it.
 *
 * Its shapes are deliberately separate from `employees.ts`. An employee record carries date of
 * birth, home address and emergency contact; a card must never be able to return them, so it has
 * its own narrow types and its own select list in the API rather than reusing the employee one.
 */

/** The five link kinds a card can show. Anything else is not rendered, so no unknown icons. */
export const TeamProfileLinkKind = ['FACEBOOK', 'INSTAGRAM', 'GITHUB', 'LINKEDIN', 'WEBSITE'] as const;
export type TeamProfileLinkKind = (typeof TeamProfileLinkKind)[number];

export interface TeamProfileLink {
  kind: TeamProfileLinkKind;
  url: string;
}

/**
 * One card in the grid. Enough to recognise someone and reach them; nothing private. Personal
 * phone and blood group stay on the full card, one click away.
 */
export interface TeamProfileListItem {
  employeeId: string;
  employeeCode: string;
  fullName: string;
  /** Falls back to initials in the UI when the person has no photo. */
  initials: string;
  position: string;
  department: string;
  workLocation: string;
  email: string;
  hasPhoto: boolean;
  /** Whether a tag has been issued for this person, so the grid can mark it. */
  hasTag: boolean;
  /** Self-declared, optional. */
  businessPhone: string | null;
  /** A line the person writes about themselves, at most 120 characters. */
  headline: string | null;
  links: TeamProfileLink[];
  managerName: string | null;
  joiningDate: string;
}

export interface TeamProfileDetail extends TeamProfileListItem {
  /** `employees.phone`. Hidden when the person has hidden it, and never on a public card. */
  personalPhone: string | null;
  /** Self-declared, optional; hidden on a public card. */
  bloodGroup: BloodGroup | null;
  /** True when this card is the viewer's own, so the UI can offer Edit. */
  isSelf: boolean;
}

/**
 * `GET /team-profile`. With `team_profile.browse` it is an ordinary page of the directory. Without
 * it, it is a lookup: nothing until the viewer searches, and then only the one person the search
 * names. A search that names several people returns nobody and sets `ambiguous`.
 */
export interface TeamProfileListResponse {
  data: TeamProfileListItem[];
  meta: PageMeta;
  mode: 'browse' | 'lookup';
  ambiguous: boolean;
}

// ─── Queries ────────────────────────────────────────────────────────────────────────────────────

export const teamProfileQuery = paginationQuery.extend({
  /** Matches a name or an employee code, case-insensitively. */
  q: z.string().trim().min(1).max(100).optional(),
  departmentId: z.uuid().optional(),
  workLocation: z.string().trim().min(1).max(120).optional(),
});
export type TeamProfileQuery = z.infer<typeof teamProfileQuery>;

/** The filter values the page offers, built from the people who are actually listed. */
export interface TeamProfileFilters {
  departments: { id: string; name: string }[];
  workLocations: string[];
}

// ─── Editing your own card ──────────────────────────────────────────────────────────────────────

const HTTPS_ONLY = 'Use a full https:// address';

/** Links must be https: a card is rendered for other people, and http invites a downgrade. */
const linkUrl = z
  .url({ protocol: /^https$/, hostname: z.regexes.domain })
  .max(300)
  .refine((value) => !value.includes('..'), HTTPS_ONLY);

export const updateOwnTeamProfileSchema = z.object({
  businessPhone: z.string().trim().min(5).max(30).nullable().optional(),
  bloodGroup: z.enum(BloodGroup).nullable().optional(),
  headline: z.string().trim().max(120).nullable().optional(),
  /** Hides `employees.phone` from the card without deleting it from the employee record. */
  showPersonalPhone: z.boolean().optional(),
  links: z
    .array(z.object({ kind: z.enum(TeamProfileLinkKind), url: linkUrl }))
    .max(TeamProfileLinkKind.length)
    .optional(),
});
export type UpdateOwnTeamProfileInput = z.infer<typeof updateOwnTeamProfileSchema>;

/** What the owner sees when editing, including the fields a viewer never gets. */
export interface OwnTeamProfile {
  businessPhone: string | null;
  bloodGroup: BloodGroup | null;
  headline: string | null;
  showPersonalPhone: boolean;
  personalPhone: string;
  links: TeamProfileLink[];
  hasPhoto: boolean;
}

// ─── Photos ─────────────────────────────────────────────────────────────────────────────────────

/** Small enough that a card loads instantly; large enough for a retina avatar. */
export const PHOTO_MAX_BYTES = 2 * 1024 * 1024;
export const PHOTO_CONTENT_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export type PhotoContentType = (typeof PHOTO_CONTENT_TYPES)[number];
