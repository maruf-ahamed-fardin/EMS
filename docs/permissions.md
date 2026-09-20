# Roles and permissions

The catalogue and the default matrix are code in `packages/contracts` (`permissions.ts`, `roles.ts`)
and are described in [plan.md §4](plan.md). At runtime the database is the source of truth: the
defaults are created by `syncCatalogue()` (release step and dev seed) and then changed in Roles & permissions.

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
| API | `@RequirePermission()` guard, then `ScopeService` turns the scope into a Prisma `where` | **The security boundary** |
| Services | Row-level rules such as "not your own leave request" | Security |
| Frontend | `<Can>`, `useCan()`, the navigation filter and page guards | Presentation only |

A page the user can't open renders "You don't have access to this page". An API call for a record
outside the caller's scope answers 404, not 403, so it doesn't confirm the record exists.

## Using it in a module

```ts
@RequirePermission('employee.view')                 // 403 without the permission
@Get('employees/:id')
async findOne(@CurrentAuth() auth: AuthContext, @Param('id') id: string) {
  const employee = await this.prisma.employee.findFirst({
    // Out of scope matches nothing, so the caller gets 404 and learns nothing.
    // Never spread employeeWhere next to `id`: an OWN scope's own `id` would replace it.
    where: this.scope.employeeById(auth, 'employee.view', id),
  });
  if (!employee) throw new NotFoundException();
  return { data: toView(employee) };
}
```

Permission changes reach sessions within 60 seconds (the `PermissionsService` cache), and at once on
the instance that made them.

## Team Profile: the one unscoped module

`team_profile.view` has no scope. Every other "view" permission narrows to OWN, TEAM or ALL, but a
staff directory that shows only your own team is not a directory, so this one always reaches
everyone. What makes that safe is the response rather than the reach: `CARD_SELECT` in
`team-profile.service.ts` is a short, explicit column list, and `team-profile-shape.spec.ts` fails
if a private field ever reaches a card. `team_profile.manage_own` lets a person edit their own card
and nobody else's; editing someone else's is `employee.update`.

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
