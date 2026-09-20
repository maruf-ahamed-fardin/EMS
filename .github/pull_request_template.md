## What this changes

<!-- The change in a sentence or two, and why it is needed. Link the issue if there is one. -->

## How it was verified

<!-- What you actually ran or clicked, not what CI will run. Note anything you could not verify. -->

- [ ] `yarn check:payload`
- [ ] `yarn typecheck`
- [ ] `yarn lint`
- [ ] `yarn test`
- [ ] Database-backed tests (`TEST_DATABASE_URL` set) — needed when this touches Prisma or a service

## Checks that catch the usual mistakes

- [ ] Schema changes come with the generated migration (`yarn db:migrate`)
- [ ] New or changed rules are enforced in the API, not only hidden in the UI, and a test proves it
- [ ] New permissions are in the catalogue in `packages/contracts` and given to the right roles
- [ ] Writes are audited
- [ ] New configuration goes through `apps/api/src/config/env.ts`, and errors name the variable,
      never its value
- [ ] No real credentials or HR data (plan D8) — seed data only
- [ ] `docs/` updated when behaviour, API or security controls changed
