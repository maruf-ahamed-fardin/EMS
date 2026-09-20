import { CARD_SELECT, type CardRow, toDetail, toListItem } from './team-profile.service';

/**
 * Team Profile is the one place where everyone sees everyone, so what keeps it safe is the shape
 * rather than a scope. These fail the moment a private field reaches a card — the mistake this
 * feature is most likely to make later.
 */
describe('the Team Profile shape', () => {
  /** A row with a private value in every column the select is allowed to read. */
  const row: CardRow = {
    id: '01a0ae57-505a-76b7-9bc4-9d3a2b6a075a',
    employeeCode: 'SX-017',
    firstName: 'Anika',
    lastName: 'Sarkar',
    email: 'anika@demo.selorax.test',
    phone: '+8801711234567',
    bloodGroup: 'B_POS',
    workLocation: 'Remote',
    joiningDate: new Date('2025-02-20T00:00:00Z'),
    photoKey: 'employees/01a0/photo.jpg',
    department: { id: '01a0ae57-501d-704a-813c-e7f7eaff9647', name: 'Development' },
    position: { title: 'Software Engineer' },
    manager: { firstName: 'Tanvir', lastName: 'Hasan' },
    teamProfile: {
      businessPhone: '+8801811234567',
      headline: 'Happy to pair on anything React.',
      showPersonalPhone: true,
      links: [{ kind: 'GITHUB', url: 'https://github.com/anikasarkar' }],
    },
  };

  it('never reads a private employee column', () => {
    for (const column of ['dateOfBirth', 'address', 'emergencyContact', 'gender', 'deletedAt']) {
      expect(CARD_SELECT).not.toHaveProperty(column);
    }
  });

  it('takes only a name from the manager, not their whole record', () => {
    expect(Object.keys(CARD_SELECT.manager.select).sort()).toEqual(['firstName', 'lastName']);
  });

  it('turns the storage key into a yes or no, and never returns the key itself', () => {
    // photoKey is read, because there is no other way to know a photo exists
    expect(CARD_SELECT).toHaveProperty('photoKey');
    const card = toDetail(row, null);
    expect(card.hasPhoto).toBe(true);
    expect(JSON.stringify(card)).not.toContain('photo.jpg');
    expect(toListItem(row)).not.toHaveProperty('photoKey');
  });

  it('returns exactly the fields a card shows, and no others', () => {
    expect(Object.keys(toDetail(row, null)).sort()).toEqual(
      [
        'employeeId', 'employeeCode', 'fullName', 'initials', 'position', 'department', 'workLocation',
        'email', 'hasPhoto', 'hasTag', 'personalPhone', 'businessPhone', 'bloodGroup', 'headline',
        'links', 'managerName', 'joiningDate', 'isSelf',
      ].sort(),
    );
  });

  it('hides the personal number when the person turned it off', () => {
    const shown = toDetail(row, null);
    expect(shown.personalPhone).toBe('+8801711234567');

    const hidden = toDetail({ ...row, teamProfile: { ...row.teamProfile!, showPersonalPhone: false } }, null);
    expect(hidden.personalPhone).toBeNull();
    expect(JSON.stringify(hidden)).not.toContain('8801711234567');
  });

  it('shows the personal number by default, before anyone edits their card', () => {
    expect(toDetail({ ...row, teamProfile: null }, null).personalPhone).toBe('+8801711234567');
  });

  it('marks the viewer’s own card', () => {
    expect(toDetail(row, row.id).isSelf).toBe(true);
    expect(toDetail(row, '01a0ae57-0000-0000-0000-000000000000').isSelf).toBe(false);
    expect(toDetail(row, null).isSelf).toBe(false);
  });

  it('gives a date, not a timestamp, for the joining date', () => {
    expect(toDetail(row, null).joiningDate).toBe('2025-02-20');
  });
});
