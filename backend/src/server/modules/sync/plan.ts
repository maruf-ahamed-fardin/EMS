import { isSafeLink } from '@/server/lib/links';
import { USERNAME_PATTERN, isReservedUsername } from '@/server/modules/members/usernames';
import { readAvatar, type AvatarSource } from './avatar';
import type { HrProfile, HrSnapshot, HrUser } from './snapshot';

// Works out what a sync would change, without touching the database. Rules:
// - HR owns name, role, designation, employee ID and whether someone exists; it always wins.
// - Contacts, socials and photo follow HR only until the member claims their profile.
// - Members are matched by employee ID, falling back to username.
// - `manual` members are never touched; clashes with them are reported as conflicts.
// - A member missing from HR is made inactive, never deleted.

export interface MemberFields {
  username: string;
  hrEmployeeId: string | null;
  name: string | null;
  jobRole: string | null;
  designation: string | null;
}
const MEMBER_KEYS = ['username', 'hrEmployeeId', 'name', 'jobRole', 'designation'] as const;

export const PROFILE_KEYS = [
  'email', 'personalPhone', 'businessPhone', 'whatsapp', 'legacyPhone', 'facebook', 'instagram', 'github', 'portfolio',
] as const;
export type ProfileKey = (typeof PROFILE_KEYS)[number];
export type ProfileFields = Record<ProfileKey, string | null>;

export interface CurrentMember extends MemberFields {
  id: string;
  status: 'active' | 'inactive';
  source: 'hr' | 'manual';
  profileClaimed: boolean;
  profile: ProfileFields | null;
  avatarSourceHash: string | null;
}

export type SyncAction =
  | { type: 'create'; fields: MemberFields; profile: ProfileFields | null; avatar: AvatarSource | null }
  | { type: 'update'; memberId: string; username: string; changes: Partial<MemberFields>; reactivate: boolean }
  | { type: 'profile'; memberId: string; username: string; profile: ProfileFields; changed: ProfileKey[] }
  /** `avatar: null` removes the photo */
  | { type: 'avatar'; memberId: string; username: string; avatar: AvatarSource | null }
  | { type: 'deactivate'; memberId: string; username: string };

export type ConflictCode =
  | 'missing-username' | 'invalid-username' | 'reserved-username' | 'duplicate-username'
  | 'duplicate-employee-id' | 'manual-member' | 'username-taken';
export type WarningCode = 'missing-employee-id' | 'dropped-field' | 'avatar-rejected' | 'unknown-profile-fields';

export interface SyncIssue<Code extends string = string> {
  code: Code;
  /** Username, employee ID or record number: never contact details */
  subject: string;
  detail: string;
}

export interface SyncSummary {
  hrRecords: number;
  created: number;
  updated: number;
  renamed: number;
  reactivated: number;
  deactivated: number;
  profilesCopied: number;
  avatarsChanged: number;
  conflicts: number;
  warnings: number;
}

export interface SyncPlan {
  actions: SyncAction[];
  conflicts: SyncIssue<ConflictCode>[];
  warnings: SyncIssue<WarningCode>[];
  summary: SyncSummary;
  /** Tripped when so many members would change that the HR data is more likely broken than edited */
  breaker: { tripped: boolean; changed: number; limit: number };
}

/** Share of active HR members a run may change (rename, edit or deactivate) before it's refused */
export const MAX_CHANGE_RATIO = 0.2;
// ...but always allow a couple, or a small team could never make a normal edit
const MIN_CHANGE_LIMIT = 2;

const EMAIL = /^[^\s@]+@[^\s@]+$/;

const lower = (value: string) => value.toLowerCase();

function countBy(values: (string | undefined)[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const value of values) {
    if (value) counts.set(lower(value), (counts.get(lower(value)) ?? 0) + 1);
  }
  return counts;
}

function findExisting(
  user: HrUser,
  byEmployeeId: Map<string, CurrentMember>,
  byUsername: Map<string, CurrentMember>,
): CurrentMember | undefined {
  const byId = user.employeeId ? byEmployeeId.get(lower(user.employeeId)) : undefined;
  if (byId) return byId;
  const byName = user.username ? byUsername.get(lower(user.username)) : undefined;
  // Same username but both have different employee IDs: a different person who reused the username
  if (byName?.source === 'hr' && byName.hrEmployeeId && user.employeeId) return undefined;
  return byName;
}

type Warn = (code: WarningCode, detail: string) => void;

function cleanProfile(hr: HrProfile | undefined, warn: Warn): ProfileFields {
  const field = (label: string, value: string | undefined, max: number, check?: [(v: string) => boolean, string]) => {
    if (value === undefined) return null;
    if (value.length > max) {
      warn('dropped-field', `${label} is longer than ${max} characters`);
      return null;
    }
    if (check && !check[0](value)) {
      warn('dropped-field', `${label} ${check[1]}`);
      return null;
    }
    return value;
  };
  const link = (label: string, value: string | undefined) => field(label, value, 1024, [isSafeLink, 'is not an http(s) link']);

  return {
    email: field('email', hr?.email, 254, [v => EMAIL.test(v), 'is not an email address']),
    personalPhone: field('personalPhone', hr?.personalPhone, 40),
    businessPhone: field('businessPhone', hr?.businessPhone, 40),
    whatsapp: field('whatsapp', hr?.whatsapp, 40),
    legacyPhone: field('phone', hr?.phone, 40),
    facebook: link('socials.facebook', hr?.socials.facebook),
    instagram: link('socials.instagram', hr?.socials.instagram),
    github: link('socials.github', hr?.socials.github),
    portfolio: link('socials.portfolio', hr?.socials.portfolio),
  };
}

function avatarFor(value: string | undefined, warn: Warn): AvatarSource | null {
  if (!value) return null;
  const result = readAvatar(value);
  if ('rejected' in result) {
    warn('avatar-rejected', result.rejected);
    return null;
  }
  return result.avatar;
}

const changedFields = (member: MemberFields, next: MemberFields): Partial<MemberFields> =>
  Object.fromEntries(MEMBER_KEYS.filter(key => member[key] !== next[key]).map(key => [key, next[key]]));

export function planSync(snapshot: HrSnapshot, current: CurrentMember[]): SyncPlan {
  const actions: SyncAction[] = [];
  const conflicts: SyncIssue<ConflictCode>[] = [];
  const warnings: SyncIssue<WarningCode>[] = [];

  const byEmployeeId = new Map<string, CurrentMember>();
  const byUsername = new Map<string, CurrentMember>();
  for (const member of current) {
    if (member.hrEmployeeId) byEmployeeId.set(lower(member.hrEmployeeId), member);
    byUsername.set(lower(member.username), member);
  }
  const usernameCounts = countBy(snapshot.users.map(user => user.username));
  const employeeIdCounts = countBy(snapshot.users.map(user => user.employeeId));
  const matched = new Set<string>();

  if (snapshot.unknownProfileFields.length > 0) {
    warnings.push({
      code: 'unknown-profile-fields',
      subject: 'sharedProfiles',
      detail: `not imported: ${snapshot.unknownProfileFields.join(', ')}`,
    });
  }

  snapshot.users.forEach((user, index) => {
    const { username, employeeId } = user;
    const subject = username ?? (employeeId ? `employee ${employeeId}` : `record #${index + 1}`);
    const conflict = (code: ConflictCode, detail: string) => void conflicts.push({ code, subject, detail });
    const warn: Warn = (code, detail) => void warnings.push({ code, subject, detail });

    const existing = findExisting(user, byEmployeeId, byUsername);
    // Counted even if the record is rejected below, so a conflict never deactivates anyone
    if (existing) matched.add(existing.id);

    if (!username) return conflict('missing-username', 'the HR record has no username');
    if (!USERNAME_PATTERN.test(username)) {
      return conflict('invalid-username', 'only letters, digits, ".", "_" and "-" are allowed, up to 64 characters');
    }
    if (isReservedUsername(username)) return conflict('reserved-username', 'this username is taken by a page on the site');
    if ((usernameCounts.get(lower(username)) ?? 0) > 1) return conflict('duplicate-username', 'several HR records use this username');
    if (employeeId && (employeeIdCounts.get(lower(employeeId)) ?? 0) > 1) {
      return conflict('duplicate-employee-id', `several HR records use employee ID ${employeeId}`);
    }
    if (existing?.source === 'manual') {
      return conflict('manual-member', 'a manually added member has this username, so the HR record was not applied');
    }
    const holder = byUsername.get(lower(username));
    if (holder && holder.id !== existing?.id) {
      const owner = holder.hrEmployeeId ? ` (employee ${holder.hrEmployeeId})` : '';
      return conflict('username-taken', `the username belongs to another member${owner}`);
    }
    if (!employeeId) warn('missing-employee-id', 'matched by username only, so a rename in HR will look like a new person');

    const fields: MemberFields = {
      username,
      hrEmployeeId: employeeId ?? null,
      name: user.name ?? null,
      jobRole: user.role ?? null,
      designation: user.designation ?? null,
    };
    const profile = cleanProfile(snapshot.profiles.get(username), warn);
    const avatar = avatarFor(snapshot.pictures.get(username), warn);

    if (!existing) {
      const hasProfile = PROFILE_KEYS.some(key => profile[key] !== null);
      actions.push({ type: 'create', fields, profile: hasProfile ? profile : null, avatar });
      return;
    }

    const changes = changedFields(existing, fields);
    const reactivate = existing.status === 'inactive';
    if (Object.keys(changes).length > 0 || reactivate) {
      actions.push({ type: 'update', memberId: existing.id, username: existing.username, changes, reactivate });
    }

    if (existing.profileClaimed) return;
    const changed = PROFILE_KEYS.filter(key => (existing.profile?.[key] ?? null) !== profile[key]);
    if (changed.length > 0) {
      actions.push({ type: 'profile', memberId: existing.id, username: existing.username, profile, changed });
    }
    if (existing.avatarSourceHash !== (avatar?.sourceHash ?? null)) {
      actions.push({ type: 'avatar', memberId: existing.id, username: existing.username, avatar });
    }
  });

  for (const member of current) {
    if (member.source === 'hr' && member.status === 'active' && !matched.has(member.id)) {
      actions.push({ type: 'deactivate', memberId: member.id, username: member.username });
    }
  }

  const updates = actions.filter(action => action.type === 'update');
  const edited = updates.filter(action => Object.keys(action.changes).length > 0);
  const deactivated = actions.filter(action => action.type === 'deactivate').length;
  const activeHr = current.filter(member => member.source === 'hr' && member.status === 'active').length;
  const changed = edited.length + deactivated;
  const limit = Math.max(MIN_CHANGE_LIMIT, Math.floor(activeHr * MAX_CHANGE_RATIO));

  return {
    actions,
    conflicts,
    warnings,
    summary: {
      hrRecords: snapshot.users.length,
      created: actions.filter(action => action.type === 'create').length,
      updated: edited.length,
      renamed: edited.filter(action => action.changes.username !== undefined).length,
      reactivated: updates.filter(action => action.reactivate).length,
      deactivated,
      profilesCopied: actions.filter(action => action.type === 'profile').length,
      avatarsChanged: actions.filter(action => action.type === 'avatar').length,
      conflicts: conflicts.length,
      warnings: warnings.length,
    },
    // A first import (no members yet) creates everyone and can't trip it
    breaker: { tripped: activeHr > 0 && changed > limit, changed, limit },
  };
}
