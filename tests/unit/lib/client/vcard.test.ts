import type { TeamProfileDetail } from '@/lib/validations';
import { describe, expect, it } from 'vitest';
import { buildVCard, vCardFileName } from '@/lib/client/vcard';

const card: TeamProfileDetail = {
  employeeId: '01a0ae57-505a-76b7-9bc4-9d3a2b6a075a',
  employeeCode: 'SX-017',
  fullName: 'Anika Sarkar',
  initials: 'AS',
  position: 'Software Engineer',
  department: 'Development',
  workLocation: 'Remote',
  email: 'anika@selorax.test',
  hasPhoto: false,
  photoUrl: null,
  hasTag: false,
  personalPhone: '+8801711234567',
  businessPhone: '+8801811234567',
  bloodGroup: 'B_POS',
  headline: 'Happy to pair on anything React.',
  links: [{ kind: 'GITHUB', url: 'https://github.com/anikasarkar' }],
  managerName: 'Tanvir Hasan',
  joiningDate: '2025-02-20',
  isSelf: false,
};

describe('buildVCard', () => {
  it('produces a vCard a phone will import', () => {
    const vcf = buildVCard(card);
    expect(vcf.startsWith('BEGIN:VCARD\r\nVERSION:3.0\r\n')).toBe(true);
    expect(vcf.endsWith('END:VCARD\r\n')).toBe(true);
    // CRLF throughout: some Windows clients reject a bare newline
    expect(vcf.split('\n').every((line) => line === '' || line.endsWith('\r'))).toBe(true);
  });

  it('splits the name into given and family parts', () => {
    expect(buildVCard(card)).toContain('N:Sarkar;Anika;;;');
    expect(buildVCard({ ...card, fullName: 'Prince' })).toContain('N:;Prince;;;');
    expect(buildVCard({ ...card, fullName: 'Maruf Ahamed Fardin' })).toContain('N:Fardin;Maruf Ahamed;;;');
  });

  it('marks the business number as work and the personal one as mobile', () => {
    const vcf = buildVCard(card);
    expect(vcf).toContain('TEL;TYPE=WORK,VOICE:+8801811234567');
    expect(vcf).toContain('TEL;TYPE=CELL,VOICE:+8801711234567');
  });

  it('leaves out a number the card does not show', () => {
    const vcf = buildVCard({ ...card, personalPhone: null, businessPhone: null });
    expect(vcf).not.toContain('TEL');
  });

  it('escapes the characters that would end a field early', () => {
    const vcf = buildVCard({ ...card, fullName: 'Rahman, Md; Jr', department: 'R&D\\Labs' });
    expect(vcf).toContain('FN:Rahman\\, Md\\; Jr');
    expect(vcf).toContain('ORG:SeloraX;R&D\\\\Labs');
  });

  it('never writes the blood group into a contact file', () => {
    expect(buildVCard(card)).not.toContain('B_POS');
  });
});

describe('vCardFileName', () => {
  it('is safe to write to a disk', () => {
    expect(vCardFileName(card)).toBe('Anika-Sarkar.vcf');
    expect(vCardFileName({ ...card, fullName: 'A/B: "C"' })).toBe('A-B-C.vcf');
  });

  it('falls back to the employee code when a name has nothing usable', () => {
    expect(vCardFileName({ ...card, fullName: '###' })).toBe('SX-017.vcf');
  });
});
