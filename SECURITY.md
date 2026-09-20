# Security

## Reporting a vulnerability

Report privately. Do not open a public issue, and do not include a working exploit in the first
message.

Use GitHub's **Report a vulnerability** button under this repository's Security tab (Private
vulnerability reporting), or email the maintainers directly if that is disabled.

Please include what an attacker can do, the smallest reproduction you have, which version or commit
you tested, and whether the data involved is seed data or real. You will get an acknowledgement, and
we will tell you when a fix ships.

## What we consider in scope

The API's authentication, session and CSRF handling, the permission catalogue and scope rules,
document storage and download links, and anything that lets one employee read or change another's
records. `docs/security.md` lists every control, where it lives and which test proves it — a gap
between that document and the code is itself worth reporting.

## What this repository deliberately does not contain

No real credentials and no real HR data, until the September 2026 password and token rotation is
confirmed (decision D8 in `docs/plan.md`). Everything here is built on seed data, and
`npm run db:seed` refuses to run in production. If you find something in the history that looks like
a real secret, report it privately rather than opening an issue.

## Supply chain

`.npmrc` refuses any package published less than seven days ago and never runs install scripts.
`npm run check:payload` looks for code hidden after long runs of spaces, and CI runs it before
installing anything. Both exist because of the September 2026 incident. Don't weaken either to get a
newer version faster; if a dependency genuinely needs an exception, say so in the pull request.
