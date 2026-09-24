-- Discord joins the card's link kinds. BEFORE 'GITHUB' so the database's enum order, which
-- `orderBy: { kind: 'asc' }` follows, matches the order in schema.prisma and on the card.
ALTER TYPE "TeamProfileLinkKind" ADD VALUE 'DISCORD' BEFORE 'GITHUB';
