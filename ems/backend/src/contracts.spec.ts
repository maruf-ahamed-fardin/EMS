import { ALL_ENUMS } from '@ems/contracts';
import * as prismaEnums from './generated/prisma/enums';

/** The UI and API validate against @ems/contracts; the database against Prisma. They must agree. */
describe('enums shared with @ems/contracts', () => {
  it.each(Object.entries(ALL_ENUMS))('%s matches the Prisma enum', (name, values) => {
    const prismaEnum = (prismaEnums as Record<string, Record<string, string>>)[name];
    expect(prismaEnum).toBeDefined();
    expect(Object.values(prismaEnum ?? {}).sort()).toEqual([...values].sort());
  });
});
