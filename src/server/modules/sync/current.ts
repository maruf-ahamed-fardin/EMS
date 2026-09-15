import { eq } from 'drizzle-orm';
import type { Db } from '@/server/db/client';
import { memberAvatars, memberProfiles, members } from '@/server/db/schema';
import { PROFILE_KEYS, type CurrentMember, type ProfileFields } from './plan';

/** Every member as the sync planner sees them */
export async function loadCurrentMembers(db: Db): Promise<CurrentMember[]> {
  const rows = await db
    .select({ member: members, profile: memberProfiles, avatarSourceHash: memberAvatars.sourceHash })
    .from(members)
    .leftJoin(memberProfiles, eq(memberProfiles.memberId, members.id))
    .leftJoin(memberAvatars, eq(memberAvatars.memberId, members.id));

  return rows.map(({ member, profile, avatarSourceHash }) => ({
    id: member.id,
    username: member.username,
    hrEmployeeId: member.hrEmployeeId,
    name: member.name,
    jobRole: member.jobRole,
    designation: member.designation,
    status: member.status,
    source: member.source,
    profileClaimed: member.profileClaimedAt !== null,
    profile: profile && (Object.fromEntries(PROFILE_KEYS.map(key => [key, profile[key]])) as ProfileFields),
    avatarSourceHash: avatarSourceHash ?? null,
  }));
}
