/**
 * Web NFC, typed here because TypeScript's DOM library does not include it yet. It exists only in
 * Chrome on Android, over https (or localhost), so every caller checks {@link nfcReader} first and
 * offers the QR code where it returns null.
 */

interface NdefRecordInit {
  recordType: 'url' | 'text' | 'mime';
  mediaType?: string;
  data: string | BufferSource;
}

interface NdefRecord {
  recordType: string;
  mediaType?: string;
  encoding?: string;
  data?: DataView;
}

interface NdefReadingEvent extends Event {
  serialNumber: string;
  message: { records: NdefRecord[] };
}

interface NdefReader {
  scan(options?: { signal?: AbortSignal }): Promise<void>;
  write(message: { records: NdefRecordInit[] }, options?: { signal?: AbortSignal; overwrite?: boolean }): Promise<void>;
  addEventListener(type: 'reading', listener: (event: NdefReadingEvent) => void, options?: { signal?: AbortSignal }): void;
  addEventListener(type: 'readingerror', listener: () => void, options?: { signal?: AbortSignal }): void;
}

type NdefReaderConstructor = new () => NdefReader;

/** A new reader, or null where the browser has no Web NFC. */
export function nfcReader(): NdefReader | null {
  if (typeof window === 'undefined') return null;
  const Reader = (window as unknown as { NDEFReader?: NdefReaderConstructor }).NDEFReader;
  return Reader ? new Reader() : null;
}

export function nfcSupported(): boolean {
  return typeof window !== 'undefined' && 'NDEFReader' in window;
}

/**
 * Writes a card to a tag: the vCard first, so a phone that taps it offers to save the contact,
 * then the card's link for anyone signed in to the EMS.
 */
export async function writeCardTag(vcard: string, url: string, signal: AbortSignal): Promise<void> {
  const reader = nfcReader();
  if (!reader) throw new Error('NFC is not available in this browser');
  await reader.write(
    {
      records: [
        { recordType: 'mime', mediaType: 'text/vcard', data: new TextEncoder().encode(vcard) },
        { recordType: 'url', data: url },
      ],
    },
    { signal },
  );
}

/** Waits for one tag and returns the first URL, vCard or text it carries. */
export async function readTag(signal: AbortSignal): Promise<string> {
  const reader = nfcReader();
  if (!reader) throw new Error('NFC is not available in this browser');
  await reader.scan({ signal });
  return new Promise((resolve, reject) => {
    reader.addEventListener('readingerror', () => reject(new Error('That tag could not be read. Try holding it still.')), { signal });
    reader.addEventListener(
      'reading',
      (event) => {
        for (const record of event.message.records) {
          if (!record.data) continue;
          const text = new TextDecoder(record.encoding ?? 'utf-8').decode(record.data);
          if (record.recordType === 'url' || record.recordType === 'text' || record.mediaType === 'text/vcard') {
            resolve(text);
            return;
          }
        }
        reject(new Error('That tag holds nothing this app can read.'));
      },
      { signal },
    );
  });
}
