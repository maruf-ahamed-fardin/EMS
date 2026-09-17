# Roles and permissions

The catalogue and the default matrix are code in `packages/contracts` (`permissions.ts`, `roles.ts`)
and are described in [plan.md §4](plan.md). At runtime the database is the source of truth: the
defaults are seeded once (Phase 2) and then changed in Roles & permissions.

## Model

- A **permission** is `module.action`, such as `leave.approve`.
- A role grants a permission with a **scope**:
  - `OWN`: records about the user's own employee record.
  - `TEAM`: the user's direct reports (`employees.manager_id` = the user's employee), plus their own.
  - `ALL`: everyone.
- `can(map, key, atLeast)` in contracts compares scopes by reach (`OWN` < `TEAM` < `ALL`).

## Where it is enforced

| Layer | How | Trust |
|---|---|---|
| API (Phase 2) | `@RequirePermission()` guard, then `ScopeService` turns the scope into a Prisma `where` | **The security boundary** |
| Services | Row-level rules such as "not your own leave request" | Security |
| Frontend | `<Can>`, `useCan()`, the navigation filter and page guards | Presentation only |

A page the user can't open renders "You don't have access to this page". An API call for a record
outside the caller's scope answers 404, not 403, so it doesn't confirm the record exists.

## Default roles

| Role | Summary |
|---|---|
| Super Admin | Everything, including users and role permissions |
| HR / Admin | Everything except managing users and role permissions |
| Manager | Own record plus direct reports: employees, attendance, leave approval, team documents (non-sensitive), team reports |
| Employee | Own record: attendance check-in, leave requests, own documents |

Tests in `packages/contracts/src/permissions.test.ts` and `frontend/src/lib/navigation.test.ts` pin the
important edges (only Super Admin manages roles; managers never see private fields or settings; an
employee's menu). Extend them when the matrix changes.
