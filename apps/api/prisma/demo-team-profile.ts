import { BloodGroup, TeamProfileLinkKind } from '@ems/contracts';
import type { PrismaClient } from '../src/generated/prisma/client';

/**
 * Fills in the Team Profile cards for the demo people, so the directory looks like a directory
 * rather than a list of half-empty cards. Everything here is invented: no real number, no real
 * account (plan D8).
 *
 * Deterministic from the employee code, so re-seeding produces the same cards.
 */

const HEADLINES = [
  'Works on the attendance and leave services.',
  'Happy to pair on anything React.',
  'Ask me about onboarding and payroll questions.',
  'Design systems, accessibility and the odd illustration.',
  'Looking after merchant accounts in Dhaka.',
  'Numbers, budgets and the month-end close.',
  'Writing about what we ship.',
  'Testing what everyone else builds.',
];

/** A small, stable hash so every demo person gets the same card on every seed. */
function seedFrom(code: string): number {
  let value = 0;
  for (const char of code) value = (value * 31 + char.charCodeAt(0)) >>> 0;
  return value;
}

function handleFor(firstName: string, lastName: string): string {
  return `${firstName}${lastName}`.toLowerCase().replace(/[^a-z]/g, '');
}

export async function seedDemoTeamProfiles(prisma: PrismaClient) {
  const people = await prisma.employee.findMany({
    where: { deletedAt: null, status: 'ACTIVE' },
    select: { id: true, employeeCode: true, firstName: true, lastName: true },
    orderBy: { employeeCode: 'asc' },
  });

  let cards = 0;
  let links = 0;

  for (const person of people) {
    const n = seedFrom(person.employeeCode);
    // Roughly four in five publish a card; the rest stay as they come, which is a real state too
    if (n % 5 === 4) continue;

    const bloodGroup = BloodGroup[n % BloodGroup.length]!;
    const headline = HEADLINES[n % HEADLINES.length]!;
    const businessPhone = `+8809${String(600000000 + (n % 99999999)).slice(0, 9)}`;
    const handle = handleFor(person.firstName, person.lastName);

    await prisma.employee.update({ where: { id: person.id }, data: { bloodGroup } });
    await prisma.teamProfile.upsert({
      where: { employeeId: person.id },
      create: {
        employeeId: person.id,
        businessPhone,
        headline,
        // One in seven keeps their personal number off the card
        showPersonalPhone: n % 7 !== 0,
      },
      update: { businessPhone, headline, showPersonalPhone: n % 7 !== 0 },
    });
    cards += 1;

    // Between one and four links each, always the same ones for the same person
    const chosen = TeamProfileLinkKind.filter((_, index) => (n >> index) % 2 === 0).slice(0, 4);
    const urls: Record<(typeof TeamProfileLinkKind)[number], string> = {
      FACEBOOK: `https://facebook.com/${handle}`,
      INSTAGRAM: `https://instagram.com/${handle}`,
      GITHUB: `https://github.com/${handle}`,
      LINKEDIN: `https://linkedin.com/in/${handle}`,
      WEBSITE: `https://${handle}.example.com`,
    };

    await prisma.teamProfileLink.deleteMany({ where: { employeeId: person.id } });
    if (chosen.length > 0) {
      await prisma.teamProfileLink.createMany({
        data: chosen.map((kind) => ({ employeeId: person.id, kind, url: urls[kind] })),
      });
      links += chosen.length;
    }
  }

  return { cards, links, withoutCard: people.length - cards };
}
