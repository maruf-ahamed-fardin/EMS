import { encode } from 'uqr';

/**
 * A QR code as a matrix of dark (`true`) and light modules, including a quiet zone. The text is
 * encoded as UTF-8 bytes so a name like "Ayesha Chowdhury · SX-054" survives every scanner.
 * Error correction M: a phone screen photographed at an angle still reads.
 */
export function qrMatrix(text: string): boolean[][] {
  return encode(Array.from(new TextEncoder().encode(text)), { ecc: 'M', border: 2 }).data;
}

/** The link to a card on this site, for a QR code or an NFC tag. */
export function cardUrl(origin: string, employeeId: string): string {
  return `${origin}/team-profile/${employeeId}`;
}

/**
 * What a scanned code points to on this site, if anything: the employee ID of one of our cards.
 * Anything else — another site, a relative path, a lookalike host — is not followed.
 */
export function cardIdFromScan(text: string, origin: string): string | null {
  let url: URL;
  try {
    url = new URL(text.trim());
  } catch {
    return null;
  }
  if (url.origin !== origin) return null;
  const match = /^\/team-profile\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/?$/i.exec(url.pathname);
  return match?.[1] ?? null;
}

/** The name, email and phone in a scanned vCard, for showing what a contact code holds. */
export function readVCard(text: string): { name: string; email: string | null; phone: string | null } | null {
  if (!/^BEGIN:VCARD/i.test(text.trim())) return null;
  // Unfold continuation lines (RFC 6350 §3.2), then read the first value of each field
  const lines = text.replace(/\r?\n[ \t]/g, '').split(/\r?\n/);
  const field = (name: string) => {
    const line = lines.find((l) => l.toUpperCase().startsWith(`${name}:`) || l.toUpperCase().startsWith(`${name};`));
    if (!line) return null;
    return line.slice(line.indexOf(':') + 1).replace(/\\([,;\\])/g, '$1').replace(/\\n/gi, ' ').trim() || null;
  };
  const name = field('FN');
  if (!name) return null;
  return { name, email: field('EMAIL'), phone: field('TEL') };
}
