import { createHash } from 'node:crypto';
import type { PhotoContentType } from '@/lib/validations';

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPEG = Buffer.from([0xff, 0xd8, 0xff]);
const RIFF = Buffer.from('RIFF', 'latin1');
const WEBP = Buffer.from('WEBP', 'latin1');

/**
 * A photo's real type, read from its bytes: JPEG, PNG or WebP, or null for anything else. The file
 * name and the browser's declared type are never trusted, as with documents (`sniff.ts`). An SVG is
 * refused on purpose: it is a document that can carry script, not a picture.
 */
export function sniffPhotoType(bytes: Buffer): PhotoContentType | null {
  if (bytes.subarray(0, PNG.length).equals(PNG)) return 'image/png';
  if (bytes.subarray(0, JPEG.length).equals(JPEG)) return 'image/jpeg';
  if (bytes.length >= 12 && bytes.subarray(0, 4).equals(RIFF) && bytes.subarray(8, 12).equals(WEBP)) return 'image/webp';
  return null;
}

/**
 * Where a card's photo is served. `v` is a hash of the storage key, which is new for every upload,
 * so the URL changes when the photo does and browsers can cache it for good. A one-way hash of a
 * random key says nothing about the key itself.
 */
export function photoUrl(employeeId: string, photoKey: string | null): string | null {
  if (!photoKey) return null;
  const version = createHash('sha256').update(photoKey).digest('base64url').slice(0, 12);
  return `/api/v1/team-profile/${employeeId}/photo?v=${version}`;
}
