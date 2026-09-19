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
| 3 | Employees | **Done.** Deferred to their phases: photo upload (12). Documents are added from the profile rather than in the create form (see architecture.md). |
| 4 | Departments and positions | **Done.** Delete with active employees returns 409 with the count. |
| 5 | Dashboard and global search | **Done.** Every overview number is checked against direct SQL counts for all three variants. Visual check of the charts in a browser still to do. |
| 6 | Attendance | **Done.** Late, absent and leave rules tested against PostgreSQL, including a check-in just after midnight in Dhaka. |
| 7 | Leave | **Done.** Types, prorated balances with capped carry-forward, preview, request, approve/reject/cancel, HR balance adjustment, review queue and profile Leave tab. Parallel submits can't overdraw a balance (tested against PostgreSQL). Leave notifications arrive with Phase 9. |
| 8 | Documents | **Done.** Local and S3 storage, upload checked by bytes, 60-second links, private types, soft delete, document types, expiry list and reminders, Documents tab and `/documents`. Cross-employee access returns 404; no storage key appears in any response (tested against PostgreSQL). Photo upload moves to Phase 12 with the profile screens. |
| 9 | Notifications | **Done.** Service with a channel interface (in-app), triggers for leave requests and decisions, expiring documents, new employees, attendance issues and password changes, the header bell and `/notifications`. Every trigger creates exactly one row per recipient, and a failed change creates none (tested against PostgreSQL). |
| 10 | Reports | **Done.** Employees, attendance, leave and departments reports, scoped, with filters, totals and a JSON preview; CSV, XLSX and PDF exports streamed in batches, capped at 50 000 rows (413) and audited. A 50 000-row export stays under 10 MB of live memory in every format (tested against PostgreSQL). |
| 11 | Audit log viewer | Next |
| 12 | Hardening, users, roles and settings screens | |

## Constraints

- No real credentials or HR data until the September 2026 password and token rotation is confirmed (D8).
- Every phase ends with the gate in plan §13: typecheck, lint, tests, no migration drift, a manual check
  at 375, 768 and 1280 px, then a commit.
