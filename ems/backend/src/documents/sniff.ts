import type { DocumentMimeType } from '@ems/contracts';

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPEG = Buffer.from([0xff, 0xd8, 0xff]);
const PDF = Buffer.from('%PDF-', 'latin1');
const ZIP = Buffer.from([0x50, 0x4b, 0x03, 0x04]);

/**
 * The document's real type, read from its bytes (plan §7): PDF, PNG, JPEG or DOCX, or null for
 * anything else. The file name and the browser's declared type are never trusted. A DOCX is a zip, so
 * it only counts when its directory holds a Word document; macro-enabled files are refused.
 */
export function sniffDocumentType(bytes: Buffer): DocumentMimeType | null {
  if (bytes.subarray(0, PDF.length).equals(PDF)) return 'application/pdf';
  if (bytes.subarray(0, PNG.length).equals(PNG)) return 'image/png';
  if (bytes.subarray(0, JPEG.length).equals(JPEG)) return 'image/jpeg';
  if (bytes.subarray(0, ZIP.length).equals(ZIP)) {
    const names = zipEntryNames(bytes);
    if (names && names.has('[Content_Types].xml') && names.has('word/document.xml') && ![...names].some(isMacroPart)) {
      return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    }
  }
  return null;
}

/** File names in a zip's central directory, or null when it isn't a readable zip. */
function zipEntryNames(bytes: Buffer): Set<string> | null {
  // The end-of-central-directory record is in the last 22 + 65535 (comment) bytes
  const floor = Math.max(0, bytes.length - 22 - 0xffff);
  let end = -1;
  for (let i = bytes.length - 22; i >= floor; i--) {
    if (bytes.readUInt32LE(i) === 0x06054b50) {
      end = i;
      break;
    }
  }
  if (end < 0) return null;

  const count = bytes.readUInt16LE(end + 10);
  let offset = bytes.readUInt32LE(end + 16);
  const names = new Set<string>();
  for (let i = 0; i < count; i++) {
    if (offset + 46 > bytes.length || bytes.readUInt32LE(offset) !== 0x02014b50) return null;
    const nameLength = bytes.readUInt16LE(offset + 28);
    const extraLength = bytes.readUInt16LE(offset + 30);
    const commentLength = bytes.readUInt16LE(offset + 32);
    if (offset + 46 + nameLength > bytes.length) return null;
    names.add(bytes.toString('utf8', offset + 46, offset + 46 + nameLength));
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return names;
}

/**
 * A VBA project or its data, under any name or letter case (zip names are case-sensitive, Office's
 * aren't). A .docx with one is a renamed .docm.
 */
function isMacroPart(name: string): boolean {
  return /vbaproject\.bin$|vbadata\.xml$/i.test(name);
}
