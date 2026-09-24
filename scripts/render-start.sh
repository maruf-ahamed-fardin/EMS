#!/usr/bin/env bash
# Container entry point for render.Dockerfile. Runs the release step, then the API and the web app
# side by side; if either one exits, the container exits and Render restarts it.
set -euo pipefail

# Render gives every web service its public https URL; the API needs it for CSRF, cookies and emails
export APP_URL="${APP_URL:-${RENDER_EXTERNAL_URL:-}}"
WEB_PORT="${PORT:-3000}"

cd /app/apps/api

# Release step: migrations, then permissions and system roles for this build
npx prisma migrate deploy
node dist/catalogue/sync-cli.js

# First deploy only: creates the Super Admin, who sets a password with "Forgot password?".
# It refuses once a Super Admin exists, which is the normal case on every later start.
if [ -n "${ADMIN_EMAIL:-}" ]; then
  node dist/users/create-admin-cli.js "$ADMIN_EMAIL" || echo "First admin not created (see above); continuing"
fi

PORT=4000 node dist/main.js &
api=$!

cd /app/apps/web/.next/standalone
PORT="$WEB_PORT" HOSTNAME=0.0.0.0 node apps/web/server.js &
web=$!

trap 'kill -TERM "$api" "$web" 2>/dev/null' TERM INT
wait -n "$api" "$web"
status=$?
kill -TERM "$api" "$web" 2>/dev/null || true
exit "$status"
