import jsQR from 'jsqr';
import { describe, expect, it } from 'vitest';
import { cardIdFromScan, cardUrl, qrMatrix, readVCard } from './qr';
import { buildVCard, type VCardSource } from './vcard';

const ORIGIN = 'https://ems.selorax.test';
const ID = '01a0ae57-505a-76b7-9bc4-9d3a2b6a075a';

const card: VCardSource = {
  employeeId: ID,
  employeeCode: 'SX-054',
  fullName: 'Ayesha Chowdhury',
  initials: 'AC',
  position: 'Account Executive',
  department: 'Sales',
  workLocation: 'Dhaka office',
  email: 'ayesha.chowdhury@demo.selorax.test',
  hasPhoto: false,
  hasTag: false,
  businessPhone: '+8809600000054',
  headline: null,
  links: [],
  managerName: null,
  joiningDate: '2024-03-01',
};

/** Draws the matrix as pixels, the way a camera would see it, and reads it back. */
function scan(matrix: boolean[][], scale = 4): string | null {
  const size = matrix.length * scale;
  const pixels = new Uint8ClampedArray(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const value = matrix[Math.floor(y / scale)]![Math.floor(x / scale)] ? 0 : 255;
      pixels.set([value, value, value, 255], (y * size + x) * 4);
    }
  }
  return jsQR(pixels, size, size)?.data ?? null;
}

describe('QR codes', () => {
  it('round-trips a whole vCard, including non-ASCII text', () => {
    const vcard = buildVCard(card);
    expect(vcard).toContain('·'); // the NOTE line: UTF-8 has to survive
    expect(scan(qrMatrix(vcard))).toBe(vcard);
  });

  it('round-trips a card link', () => {
    const url = cardUrl(ORIGIN, ID);
    expect(scan(qrMatrix(url))).toBe(url);
  });
});

describe('cardIdFromScan', () => {
  it('opens only our own card links', () => {
    expect(cardIdFromScan(`${ORIGIN}/team-profile/${ID}`, ORIGIN)).toBe(ID);
    expect(cardIdFromScan(`${ORIGIN}/team-profile/${ID}/`, ORIGIN)).toBe(ID);
  });

  it('ignores another site, a lookalike host, another page and plain text', () => {
    expect(cardIdFromScan(`https://evil.test/team-profile/${ID}`, ORIGIN)).toBeNull();
    expect(cardIdFromScan(`https://ems.selorax.test.evil.test/team-profile/${ID}`, ORIGIN)).toBeNull();
    expect(cardIdFromScan(`${ORIGIN}/employees/${ID}`, ORIGIN)).toBeNull();
    expect(cardIdFromScan(`${ORIGIN}/team-profile/${ID}/../../settings`, ORIGIN)).toBeNull();
    expect(cardIdFromScan('javascript:alert(1)', ORIGIN)).toBeNull();
    expect(cardIdFromScan('hello', ORIGIN)).toBeNull();
  });
});

describe('readVCard', () => {
  it('reads the name, email and first phone of a card', () => {
    expect(readVCard(buildVCard(card))).toEqual({
      name: 'Ayesha Chowdhury',
      email: 'ayesha.chowdhury@demo.selorax.test',
      phone: '+8809600000054',
    });
  });

  it('unescapes values and rejects anything that is not a vCard', () => {
    expect(readVCard('BEGIN:VCARD\r\nFN:Das\\, Asif\r\nEND:VCARD')?.name).toBe('Das, Asif');
    expect(readVCard('https://example.test')).toBeNull();
    expect(readVCard('BEGIN:VCARD\r\nEND:VCARD')).toBeNull();
  });
});
