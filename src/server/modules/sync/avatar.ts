import { createHash } from 'node:crypto';

export const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
const IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);
const BASE64_DATA_URL = /^data:([\w.+-]+\/[\w.+-]+);base64,([A-Za-z0-9+/=\s]+)$/;
// Base64 is 4 characters per 3 bytes; anything longer can't be under the limit
const MAX_DATA_URL_LENGTH = Math.ceil(MAX_AVATAR_BYTES / 3) * 4 + 100;
const MAX_LINK_LENGTH = 2048;

export type AvatarSource =
  | { kind: 'data'; mimeType: string; bytes: number; sourceHash: string }
  | { kind: 'external'; url: string; sourceHash: string };

export type AvatarResult = { avatar: AvatarSource } | { rejected: string };

function decodedSize(base64: string): number {
  const clean = base64.replace(/\s/g, '');
  const padding = clean.endsWith('==') ? 2 : clean.endsWith('=') ? 1 : 0;
  return Math.floor((clean.length * 3) / 4) - padding;
}

/**
 * Classifies an HR profile picture. Embedded images are imported (and re-encoded, like uploads).
 * Links are kept only if https, and the server never fetches them: that would open it to SSRF.
 */
export function readAvatar(value: string): AvatarResult {
  const sourceHash = createHash('sha256').update(value).digest('hex');

  if (value.startsWith('data:')) {
    if (value.length > MAX_DATA_URL_LENGTH) return { rejected: 'image is over the 2MB limit' };
    const match = BASE64_DATA_URL.exec(value);
    const mimeType = (match?.[1] ?? value.slice(5).split(/[;,]/, 1)[0] ?? '').toLowerCase();
    if (!IMAGE_TYPES.has(mimeType)) return { rejected: `unsupported image type "${mimeType}"` };
    if (!match?.[2]) return { rejected: 'image data is not base64' };
    const bytes = decodedSize(match[2]);
    if (bytes > MAX_AVATAR_BYTES) return { rejected: 'image is over the 2MB limit' };
    return { avatar: { kind: 'data', mimeType, bytes, sourceHash } };
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return { rejected: 'neither an embedded image nor a link' };
  }
  if (url.protocol !== 'https:') return { rejected: 'only https:// links are kept' };
  if (value.length > MAX_LINK_LENGTH) return { rejected: `link is longer than ${MAX_LINK_LENGTH} characters` };
  return { avatar: { kind: 'external', url: value, sourceHash } };
}
