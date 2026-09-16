import { findTeamMember } from '@/lib/team';
import { siteUrl } from '@/lib/site';
import { problem, route } from '@/server/lib/http';
import { safeUrl } from '@/server/lib/links';
import { buildVCard, vCardFilename } from '@/server/lib/vcard';

/**
 * The member as a .vcf file, so a visitor can save them straight into their phone's contacts.
 *
 * A route rather than a browser-side download: it works with no JavaScript, it can be linked to
 * and put in a QR code, and the phone recognises the file by its content type rather than by
 * whatever a blob URL happens to be called.
 */
export const GET = route<{ username: string }>(async (_request, { params }) => {
  const username = decodeURIComponent(params.username);
  const member = await findTeamMember(username);
  // notFound() throws a control-flow error that route() would report as a 500, so answer directly
  if (!member) return problem(404, 'Not Found', 'No such team member');

  const { user, profileData, profilePic } = member;
  const canonical = user.username ?? username;

  const vcard = buildVCard({
    username: canonical,
    name: user.name,
    designation: user.designation,
    role: user.role,
    employeeId: user.employeeId,
    email: profileData?.email,
    personalPhone: profileData?.personalPhone || profileData?.phone,
    businessPhone: profileData?.businessPhone,
    whatsapp: profileData?.whatsapp,
    // Embedded images are skipped: a 2MB data: URL inside a contact card bloats every address book
    photo: profilePic && !profilePic.startsWith('data:') ? profilePic : undefined,
    // Absolute, so an address book links them: HR stores bare domains like "github.com/me"
    socials: Object.values(profileData?.socials ?? {}).map(link => safeUrl(link) ?? undefined),
    profileUrl: new URL(`/${encodeURIComponent(canonical)}`, siteUrl()).toString(),
    organization: 'SeloraX',
  });

  return new Response(vcard, {
    headers: {
      'Content-Type': 'text/vcard; charset=utf-8',
      'Content-Disposition': `attachment; filename="${vCardFilename(canonical)}"`,
      'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
    },
  });
});
