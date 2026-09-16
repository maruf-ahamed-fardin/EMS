import { describe, expect, it } from 'vitest';
import { buildVCard, vCardFilename } from '@/server/lib/vcard';

const FULL = {
  username: 'maruf',
  name: 'Maruf Ahamed Fardin',
  designation: 'Full-stack Developer',
  role: 'Engineering',
  employeeId: 'SX-004',
  email: 'maruf@selorax.io',
  personalPhone: '+8801711234567',
  businessPhone: '+8801811234567',
  whatsapp: '+880 1811-234567',
  socials: ['https://github.com/SeloraX-io'],
  profileUrl: 'https://team.selorax.io/maruf',
  organization: 'SeloraX',
};

const lines = (vcard: string) => vcard.split('\r\n');
const line = (vcard: string, prefix: string) => lines(vcard).filter(l => l.startsWith(prefix));

describe('buildVCard', () => {
  it('is a well-formed vCard 3.0', () => {
    const vcard = buildVCard(FULL);
    expect(lines(vcard)[0]).toBe('BEGIN:VCARD');
    expect(lines(vcard)[1]).toBe('VERSION:3.0');
    expect(lines(vcard).at(-2)).toBe('END:VCARD');
  });

  it('uses CRLF, which Outlook requires', () => {
    const vcard = buildVCard(FULL);
    expect(vcard).toContain('\r\n');
    expect(vcard.replace(/\r\n/g, '')).not.toContain('\n');
  });

  it('splits the name so phones sort and search it correctly', () => {
    expect(line(buildVCard(FULL), 'N:')).toEqual(['N:Fardin;Maruf;Ahamed;;']);
    expect(line(buildVCard(FULL), 'FN:')).toEqual(['FN:Maruf Ahamed Fardin']);
  });

  it('handles a single-word name', () => {
    expect(line(buildVCard({ username: 'nadia', name: 'Nadia' }), 'N:')).toEqual(['N:Nadia;;;;']);
  });

  it('falls back to the username when there is no name', () => {
    const vcard = buildVCard({ username: 'nocontact' });
    expect(line(vcard, 'FN:')).toEqual(['FN:nocontact']);
  });

  it('prefers designation over role for the title', () => {
    expect(line(buildVCard(FULL), 'TITLE:')).toEqual(['TITLE:Full-stack Developer']);
    expect(line(buildVCard({ username: 'x', role: 'Design' }), 'TITLE:')).toEqual(['TITLE:Design']);
  });

  it('does not repeat WhatsApp when it is one of the other numbers', () => {
    // Same digits as businessPhone, written differently: one TEL each for work and cell, no third
    expect(line(buildVCard(FULL), 'TEL')).toHaveLength(2);
  });

  it('includes WhatsApp when it is a separate number', () => {
    expect(line(buildVCard({ ...FULL, whatsapp: '+8801999999999' }), 'TEL')).toHaveLength(3);
  });

  it('leaves out every field that was not given', () => {
    const vcard = buildVCard({ username: 'bare' });
    for (const field of ['TITLE:', 'EMAIL', 'TEL', 'PHOTO', 'ORG:', 'NOTE:']) {
      expect(line(vcard, field)).toEqual([]);
    }
  });

  it('escapes the characters that carry meaning in a vCard', () => {
    const vcard = buildVCard({ username: 'x', name: 'Ali', designation: 'Dev, Ops; Lead' });
    expect(line(vcard, 'TITLE:')[0]).toBe(String.raw`TITLE:Dev\, Ops\; Lead`);
  });

  it('folds a line longer than 75 characters onto continuation lines', () => {
    const vcard = buildVCard({ username: 'x', photo: `https://cdn.selorax.io/${'a'.repeat(200)}.jpg` });
    for (const l of lines(vcard)) expect(l.length).toBeLessThanOrEqual(75);
    // A continuation line starts with a space, which is how a parser rejoins them
    expect(lines(vcard).some(l => l.startsWith(' '))).toBe(true);
  });

  it('never embeds an image, only links to one', () => {
    const vcard = buildVCard({ username: 'x', photo: 'https://cdn.selorax.io/a.webp' });
    expect(line(vcard, 'PHOTO')).toEqual(['PHOTO;VALUE=URI:https://cdn.selorax.io/a.webp']);
  });

  it('records the employee ID where an address book will show it', () => {
    expect(line(buildVCard(FULL), 'NOTE:')).toEqual(['NOTE:Employee ID: SX-004']);
  });

  it('lists the profile URL and every social link', () => {
    const urls = line(buildVCard(FULL), 'URL:');
    expect(urls).toContain('URL:https://team.selorax.io/maruf');
    expect(urls).toContain('URL:https://github.com/SeloraX-io');
  });

  it('skips socials that are empty', () => {
    const vcard = buildVCard({ username: 'x', socials: ['', undefined, 'https://selorax.io'] });
    expect(line(vcard, 'URL:')).toEqual(['URL:https://selorax.io']);
  });
});

describe('vCardFilename', () => {
  it('names the file after the member', () => {
    expect(vCardFilename('maruf')).toBe('maruf.vcf');
  });

  it('strips anything that would be awkward in a filename', () => {
    expect(vCardFilename(String.raw`a/b\c:d`)).toBe('a_b_c_d.vcf');
  });
});
