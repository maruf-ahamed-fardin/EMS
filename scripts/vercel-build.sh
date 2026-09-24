#!/usr/bin/env bash
# Vercel's build for the one EMS project (Root Directory: apps/web). Builds contracts, the API and the
# web app, then, for production deployments only, runs the release step: migrations and the
# permission catalogue sync. Preview deployments never touch the database schema.
set -euo pipefail
cd "$(dirname "$0")/.."

node scripts/check-payload.mjs
yarn workspace @ems/contracts run build
yarn workspace @ems/backend run prisma:generate
yarn workspace @ems/backend run build
yarn workspace @ems/frontend run build

if [ "${VERCEL_ENV:-}" = "production" ]; then
  # Migrations need a direct connection; Neon's integration names it DATABASE_URL_UNPOOLED
  DATABASE_URL="${DATABASE_URL_UNPOOLED:-$DATABASE_URL}" yarn workspace @ems/backend run db:deploy
  yarn workspace @ems/backend run catalogue:sync
fi
