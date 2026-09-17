# Requirements

The specification is the "Master prompt: production employee management system". Scope, assumptions and
the definition of done per phase are in [plan.md §1, §13 and §15](plan.md). This page tracks progress.

## In scope

Authentication, roles and permissions, employees, departments, positions, dashboard, attendance, leave,
documents, in-app notifications, reports (CSV, XLSX, PDF), audit logs, users, settings, global search,
tests and deployment preparation.

## Later (extension points only)

Payroll, performance, recruitment, onboarding, assets; email, SMS and push delivery; biometric, RFID and
mobile check-in.

## Progress

| Phase | Deliverable | Status |
|---|---|---|
| 1 | Architecture: workspace, contracts, API skeleton, schema and baseline migration, app shell, CI, docs | **Done.** Migration applied to PostgreSQL 16; no drift. |
| 2 | Authentication and RBAC | **Done.** Auth flows and the authorization matrix pass against PostgreSQL. |
| 3 | Employees | **Done.** Deferred to their phases: photo upload and the Documents step (8), leave balance proration (7), Attendance/Leave/Documents profile tabs (6–8). |
| 4 | Departments and positions | **Done.** Delete with active employees returns 409 with the count. |
| 5 | Dashboard and global search | Next |
| 6 | Attendance | |
| 7 | Leave | |
| 8 | Documents | |
| 9 | Notifications | |
| 10 | Reports | |
| 11 | Audit log viewer | |
| 12 | Hardening, users, roles and settings screens | |

## Constraints

- No real credentials or HR data until the September 2026 password and token rotation is confirmed (D8).
- Every phase ends with the gate in plan §13: typecheck, lint, tests, no migration drift, a manual check
  at 375, 768 and 1280 px, then a commit.
