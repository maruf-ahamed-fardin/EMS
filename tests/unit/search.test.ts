import { describe, expect, it } from 'vitest';
import { matchMembers, type TeamMemberSummary } from '@/lib/search';

const TEAM: TeamMemberSummary[] = [
  { username: 'maruf', name: 'Maruf Ahamed Fardin', designation: 'Full-stack Developer', employeeId: 'SX-004' },
  { username: 'ashekrabbani', name: 'Ashek Rabbani', designation: 'Software Engineer', employeeId: 'SX-001' },
  { username: 'nadia', name: 'Nadia Islam', role: 'Design', employeeId: 'SX-003' },
  { username: 'marufa', name: 'Marufa Khatun', designation: 'QA Engineer', employeeId: 'SX-007' },
  { username: 'noname', employeeId: 'SX-009' },
];

const names = (results: TeamMemberSummary[]) => results.map(member => member.username);

describe('matchMembers', () => {
  it('returns everyone, alphabetically, for an empty query', () => {
    expect(names(matchMembers(TEAM, ''))).toEqual(['ashekrabbani', 'maruf', 'marufa', 'nadia', 'noname']);
    expect(names(matchMembers(TEAM, '   '))).toHaveLength(TEAM.length);
  });

  it('finds someone by their full name, which the old exact lookup could not', () => {
    expect(names(matchMembers(TEAM, 'Maruf Ahamed Fardin'))).toEqual(['maruf']);
  });

  it('finds someone by surname alone', () => {
    expect(names(matchMembers(TEAM, 'fardin'))).toEqual(['maruf']);
  });

  it('matches words in any order', () => {
    expect(names(matchMembers(TEAM, 'fardin maruf'))).toEqual(['maruf']);
  });

  it('ignores case and surrounding space', () => {
    expect(names(matchMembers(TEAM, '  ASHEK  '))).toEqual(['ashekrabbani']);
  });

  it('searches usernames, employee IDs and job titles too', () => {
    expect(names(matchMembers(TEAM, 'SX-003'))).toEqual(['nadia']);
    expect(names(matchMembers(TEAM, 'engineer'))).toEqual(['ashekrabbani', 'marufa']);
    expect(names(matchMembers(TEAM, 'design'))).toEqual(['nadia']);
  });

  it('puts an exact username above someone who merely starts with it', () => {
    // Typing a known username should not be beaten by an alphabetically earlier partial match
    expect(names(matchMembers(TEAM, 'maruf'))).toEqual(['maruf', 'marufa']);
  });

  it('ranks a name that starts with the query above one that contains it', () => {
    const team: TeamMemberSummary[] = [
      { username: 'b', name: 'Zahid Rahman' },
      { username: 'a', name: 'Rahman Ali' },
    ];
    expect(names(matchMembers(team, 'rahman'))).toEqual(['a', 'b']);
  });

  it('returns nothing when nobody matches', () => {
    expect(matchMembers(TEAM, 'zzzz')).toEqual([]);
  });

  it('requires every word to match, not just one', () => {
    expect(matchMembers(TEAM, 'maruf rabbani')).toEqual([]);
  });

  it('copes with a member who has no name', () => {
    expect(names(matchMembers(TEAM, 'noname'))).toEqual(['noname']);
    expect(names(matchMembers(TEAM, 'SX-009'))).toEqual(['noname']);
  });

  it('does not modify the array it was given', () => {
    const original = [...TEAM];
    matchMembers(TEAM, '');
    expect(TEAM).toEqual(original);
  });
});
