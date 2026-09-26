import type { TeamProfileDetail, TeamProfileListItem } from '@/lib/validations';

/** A grid card or a full card: the grid simply has no personal number to add. */
export type VCardSource = TeamProfileListItem & Partial<Pick<TeamProfileDetail, 'personalPhone'>>;

/**
 * vCard 3.0: the format every phone and mail client reads. 3.0 rather than 4.0 because iOS and
 * Android both import it without complaint.
 *
 * Values are escaped per RFC 6350 §3.3 — a comma, semicolon or backslash in a name or address
 * would otherwise end the field early and produce a broken contact.
 */
function escape(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
}

function splitName(fullName: string): { first: string; last: string } {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return { first: parts[0] ?? '', last: '' };
  return { first: parts.slice(0, -1).join(' '), last: parts.at(-1) ?? '' };
}

export function buildVCard(card: VCardSource): string {
  const { first, last } = splitName(card.fullName);
  const lines = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `N:${escape(last)};${escape(first)};;;`,
    `FN:${escape(card.fullName)}`,
    `ORG:SeloraX;${escape(card.department)}`,
    `TITLE:${escape(card.position)}`,
    `EMAIL;TYPE=WORK:${escape(card.email)}`,
  ];

  if (card.businessPhone) lines.push(`TEL;TYPE=WORK,VOICE:${escape(card.businessPhone)}`);
  if (card.personalPhone) lines.push(`TEL;TYPE=CELL,VOICE:${escape(card.personalPhone)}`);
  for (const link of card.links) lines.push(`URL:${escape(link.url)}`);
  // The employee code is what makes two people with the same name tellable apart in a phonebook
  lines.push(`NOTE:${escape(`SeloraX ${card.employeeCode} · ${card.workLocation}`)}`);
  lines.push('END:VCARD');

  // CRLF, as the spec requires; some Windows clients refuse a bare LF
  return `${lines.join('\r\n')}\r\n`;
}

export function vCardFileName(card: VCardSource): string {
  const safe = card.fullName.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '');
  return `${safe || card.employeeCode}.vcf`;
}
