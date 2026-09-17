# Database

PostgreSQL 16 through Prisma 7. The schema is `backend/prisma/schema.prisma`; the design and every table
are described in [plan.md §3](plan.md). This page covers the conventions and how to change the schema.

## Conventions

- **Names:** tables and columns are `snake_case` (`@@map`, `@map`); the Prisma client uses camelCase.
- **Keys:** `uuid` primary keys generated as UUIDv7 (`@default(uuid(7))`), so they sort by creation time.
- **Time:** every timestamp is `timestamptz(3)`. Calendar days (`work_date`, leave dates, holidays,
  date of birth) are `date`. The working day is computed in the organization's time zone (Asia/Dhaka by
  default) in one place, in Phase 6.
- **Every table** has `created_at` and `updated_at`, except `audit_logs`, which is append-only.
- **Soft delete** (`deleted_at`) on employees, departments, positions, leave types, document types and
  documents. Their unique constraints are **partial** (`WHERE deleted_at IS NULL`, Prisma's
  `partialIndexes` preview feature), so a deleted record never blocks reusing its code or email.
- **Emails** are `citext`: unique regardless of letter case.
- **Name search** uses trigram GIN indexes on `first_name` and `last_name`.
- **Money-like amounts** (leave days) are `numeric(5,1)`, never floats.

## What Prisma doesn't model

These live only in migration SQL. Prisma leaves them alone, but keep them in mind when editing tables:

| Object | Migration | Purpose |
|---|---|---|
| `citext`, `pg_trgm` extensions | `20260917000000_init` | Case-insensitive emails, fuzzy search |
| `leave_balances_not_overdrawn`, `leave_balances_amounts_non_negative` | init | Last line of defence for balances |
| `leave_requests_dates_ordered`, `leave_requests_days_positive` | init | |
| `leave_types_days_non_negative` | init | |
| `attendances_minutes_non_negative`, `attendances_out_after_in` | init | |
| `documents_size_positive`, `documents_sha256_hex` | init | |
| `users_failed_login_count_non_negative` | init | |

`backend/test/database.e2e-spec.ts` applies all migrations to a clean database and checks these.

## Changing the schema

1. Edit `schema.prisma`.
2. `npm run db:migrate` (needs `DATABASE_URL` and `SHADOW_DATABASE_URL`). Name the migration after the change.
3. If the change needs something Prisma can't express (a CHECK, an extension), add it to the generated
   `migration.sql` before committing, and list it in the table above.
4. `npm run db:generate`, then the tests.

CI fails when `schema.prisma` has changes that no migration creates.

## Production

- `prisma migrate deploy` runs as a release step, never when the app starts.
- The backend refuses to start in production unless `DATABASE_URL` has `sslmode=verify-full` (or
  `require`), or `DATABASE_ALLOW_INSECURE=true` is set for a private network.
- Backups: managed Postgres point-in-time recovery (plan §12), documented in Phase 12.
