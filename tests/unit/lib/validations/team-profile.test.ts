import { describe, expect, it } from 'vitest';
import { linkMatchesKind, updateOwnTeamProfileSchema } from '@/lib/validations/team-profile';

describe('card links', () => {
  it('lets each network point only to its own site', () => {
    expect(linkMatchesKind('DISCORD', 'https://discord.com/users/123')).toBe(true);
    expect(linkMatchesKind('DISCORD', 'https://discord.gg/selorax')).toBe(true);
    expect(linkMatchesKind('FACEBOOK', 'https://www.facebook.com/anika')).toBe(true);
    expect(linkMatchesKind('LINKEDIN', 'https://bd.linkedin.com/in/anika')).toBe(true);

    expect(linkMatchesKind('GITHUB', 'https://github.com.evil.test/anika')).toBe(false);
    expect(linkMatchesKind('GITHUB', 'https://notgithub.com/anika')).toBe(false);
    expect(linkMatchesKind('INSTAGRAM', 'https://facebook.com/anika')).toBe(false);
    expect(linkMatchesKind('DISCORD', 'not a url')).toBe(false);
  });

  it('lets a website be anywhere', () => {
    expect(linkMatchesKind('WEBSITE', 'https://anika.dev')).toBe(true);
  });

  it('accepts any subset of networks, including none', () => {
    const parse = (links: { kind: string; url: string }[]) => updateOwnTeamProfileSchema.safeParse({ links }).success;
    expect(parse([])).toBe(true);
    expect(parse([{ kind: 'DISCORD', url: 'https://discord.com/users/123' }])).toBe(true);
    expect(
      parse([
        { kind: 'GITHUB', url: 'https://github.com/anika' },
        { kind: 'LINKEDIN', url: 'https://linkedin.com/in/anika' },
      ]),
    ).toBe(true);
  });

  it('refuses a link on the wrong site, plain http, or two of one kind', () => {
    const parse = (links: { kind: string; url: string }[]) => updateOwnTeamProfileSchema.safeParse({ links }).success;
    expect(parse([{ kind: 'GITHUB', url: 'https://evil.test/login' }])).toBe(false);
    expect(parse([{ kind: 'GITHUB', url: 'http://github.com/anika' }])).toBe(false);
    expect(
      parse([
        { kind: 'GITHUB', url: 'https://github.com/a' },
        { kind: 'GITHUB', url: 'https://github.com/b' },
      ]),
    ).toBe(false);
  });
});
