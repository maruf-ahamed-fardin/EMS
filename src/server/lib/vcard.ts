/**
 * vCard 3.0, the version phones and Outlook agree on. 4.0 is newer but iOS and several Android
 * address books still read 3.0 more reliably, and nothing here needs a 4.0 feature.
 */
export interface VCardInput {
  username: string;
  name?: string;
  designation?: string;
  role?: string;
  employeeId?: string;
  email?: string;
  personalPhone?: string;
  businessPhone?: string;
  whatsapp?: string;
  /** A link to the photo, never the image itself */
  photo?: string;
  socials?: (string | undefined)[];
  /** This member's page, used as the contact's URL */
  profileUrl?: string;
  organization?: string;
}

const BACKSLASH = String.fromCharCode(92);

/** Backslash, comma, semicolon and newlines carry meaning in a vCard value. */
const escape = (value: string) =>
  value
    .split(BACKSLASH).join(BACKSLASH + BACKSLASH)
    .split('\n').join(BACKSLASH + 'n')
    .split(',').join(BACKSLASH + ',')
    .split(';').join(BACKSLASH + ';');

/**
 * RFC 2426 lines are at most 75 octets; a longer one continues on the next line starting with a
 * space. Photo URLs and long job titles cross that easily, and some parsers drop the overflow.
 */
function fold(line: string): string {
  if (line.length <= 75) return line;
  const parts = [line.slice(0, 75)];
  for (let i = 75; i < line.length; i += 74) parts.push(' ' + line.slice(i, i + 74));
  return parts.join('\r\n');
}

const digits = (value: string | undefined) => (value ?? '').replace(/[^0-9]/g, '');
const sameDigits = (a: string | undefined, b: string | undefined) =>
  Boolean(digits(a)) && digits(a) === digits(b);

/**
 * Splits a display name into vCard's structured N field: family;given;additional.
 * "Maruf Ahamed Fardin" becomes Fardin;Maruf;Ahamed, which is how phones sort and search it.
 */
function structuredName(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return escape(parts[0]) + ';;;;';
  const family = parts[parts.length - 1];
  const given = parts[0];
  const middle = parts.slice(1, -1).join(' ');
  return `${escape(family)};${escape(given)};${escape(middle)};;`;
}

export function buildVCard(input: VCardInput): string {
  const display = input.name?.trim() || input.username;
  const title = input.designation || input.role;

  const lines: string[] = ['BEGIN:VCARD', 'VERSION:3.0'];
  const add = (line: string) => lines.push(fold(line));

  add(`FN:${escape(display)}`);
  add(`N:${structuredName(display)}`);
  if (input.organization) add(`ORG:${escape(input.organization)}`);
  if (title) add(`TITLE:${escape(title)}`);
  if (input.email) add(`EMAIL;TYPE=INTERNET,WORK:${escape(input.email)}`);
  if (input.businessPhone) add(`TEL;TYPE=WORK,VOICE:${escape(input.businessPhone)}`);
  if (input.personalPhone) add(`TEL;TYPE=CELL,VOICE:${escape(input.personalPhone)}`);
  // Only when it is a number of its own; otherwise it duplicates one of the two above
  if (input.whatsapp && !sameDigits(input.whatsapp, input.personalPhone) && !sameDigits(input.whatsapp, input.businessPhone)) {
    add(`TEL;TYPE=CELL,VOICE:${escape(input.whatsapp)}`);
  }
  if (input.photo) add(`PHOTO;VALUE=URI:${escape(input.photo)}`);
  if (input.profileUrl) add(`URL:${escape(input.profileUrl)}`);
  for (const social of input.socials ?? []) {
    if (social) add(`URL:${escape(social)}`);
  }
  if (input.employeeId) add(`NOTE:${escape('Employee ID: ' + input.employeeId)}`);
  // Address books show a re-downloaded card as updated rather than duplicating it
  add(`REV:${new Date().toISOString().replace(/\.[0-9]{3}/, '')}`);
  add('END:VCARD');

  // CRLF is required by the spec, and Outlook in particular will not parse bare newlines
  return lines.join('\r\n') + '\r\n';
}

/** A filename phones show sensibly in the download tray. */
export const vCardFilename = (username: string) => `${username.replace(/[^\w.-]/g, '_')}.vcf`;
