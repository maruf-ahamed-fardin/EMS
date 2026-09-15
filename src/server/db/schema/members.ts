import { char, mysqlEnum, mysqlTable, uniqueIndex, varchar } from 'drizzle-orm/mysql-core';
import { createdAt, dateTime, mediumblob, updatedAt } from './columns';

// Text columns rely on the database default collation (utf8mb4_0900_ai_ci), so unique
// usernames and employee IDs are unique regardless of letter case.

export const members = mysqlTable('members', {
  /** ULID */
  id: char('id', { length: 26 }).primaryKey(),
  /** Public URL slug, e.g. /ashekrabbani */
  username: varchar('username', { length: 64 }).notNull(),
  hrEmployeeId: varchar('hr_employee_id', { length: 64 }),
  name: varchar('name', { length: 191 }),
  /** The HR app's `role` field */
  jobRole: varchar('job_role', { length: 191 }),
  designation: varchar('designation', { length: 191 }),
  status: mysqlEnum('status', ['active', 'inactive']).notNull().default('active'),
  /** `hr` members are kept in step with the HR app; `manual` ones are never touched by the sync */
  source: mysqlEnum('source', ['hr', 'manual']).notNull(),
  /** When the member disappeared from the HR data (they're made inactive, never deleted) */
  hrMissingSince: dateTime('hr_missing_since'),
  /** Set on first login or edit. From then on contacts, socials and photo are the member's own, not HR's. */
  profileClaimedAt: dateTime('profile_claimed_at'),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, table => [
  uniqueIndex('members_username_unique').on(table.username),
  uniqueIndex('members_hr_employee_id_unique').on(table.hrEmployeeId),
]);

/** Old usernames, so links from before an HR rename still redirect */
export const usernameAliases = mysqlTable('username_aliases', {
  alias: varchar('alias', { length: 64 }).primaryKey(),
  memberId: char('member_id', { length: 26 }).notNull().references(() => members.id, { onDelete: 'cascade' }),
  createdAt: createdAt(),
});

export const memberProfiles = mysqlTable('member_profiles', {
  memberId: char('member_id', { length: 26 }).primaryKey().references(() => members.id, { onDelete: 'cascade' }),
  email: varchar('email', { length: 254 }),
  personalPhone: varchar('personal_phone', { length: 40 }),
  businessPhone: varchar('business_phone', { length: 40 }),
  whatsapp: varchar('whatsapp', { length: 40 }),
  /** The HR app's older single `phone` field, kept so /api/team-profile answers exactly as before */
  legacyPhone: varchar('legacy_phone', { length: 40 }),
  facebook: varchar('facebook', { length: 1024 }),
  instagram: varchar('instagram', { length: 1024 }),
  github: varchar('github', { length: 1024 }),
  portfolio: varchar('portfolio', { length: 1024 }),
  updatedAt: updatedAt(),
});

/** A member's photo: either a stored WebP image or an https link to one hosted elsewhere */
export const memberAvatars = mysqlTable('member_avatars', {
  memberId: char('member_id', { length: 26 }).primaryKey().references(() => members.id, { onDelete: 'cascade' }),
  /** sha256 of `image`; part of the image URL so it can be cached forever */
  hash: char('hash', { length: 64 }),
  image: mediumblob('image'),
  /** Never fetched by the server (that would allow SSRF); browsers load it directly */
  externalUrl: varchar('external_url', { length: 2048 }),
  /** sha256 of the HR value this photo came from, so the sync can tell when it changes. Null for uploads. */
  sourceHash: char('source_hash', { length: 64 }),
  updatedAt: updatedAt(),
});
