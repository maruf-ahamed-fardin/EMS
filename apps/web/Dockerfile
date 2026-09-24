# syntax=docker/dockerfile:1
# The EMS in one image: the web app with the API inside it (apps/web/server). Build from the root:
#   docker build -f apps/web/Dockerfile -t ems .                  (default target: the app)
#   docker build -f apps/web/Dockerfile --target migrate -t ems-migrate .
#     the release step, run once per deploy before the new app starts: migrations, then catalogue sync
# Debian slim, not Alpine: argon2's prebuilt binary is used as shipped, with no compiler in the image.

FROM node:22-bookworm-slim AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1 YARN_ENABLE_GLOBAL_CACHE=false
# .yarnrc.yml carries the supply-chain guards (enableScripts, npmMinimalAgeGate) and the pinned
# release the whole project uses; both must be in the image before any install runs.
COPY .yarnrc.yml yarn.lock package.json ./
COPY .yarn/releases .yarn/releases
COPY apps/web/package.json apps/web/
COPY apps/web/server/package.json apps/web/server/
COPY apps/web/contracts/package.json apps/web/contracts/

FROM base AS build
RUN yarn workspaces focus @ems/contracts @ems/backend @ems/frontend
COPY apps/web apps/web
ENV BUILD_STANDALONE=1 NODE_ENV=production
RUN yarn workspace @ems/contracts run build \
 && yarn workspace @ems/backend run prisma:generate \
 && yarn workspace @ems/backend run build \
 && yarn workspace @ems/frontend run build

# Release step, run once per deploy before the new app starts (never at start-up)
FROM build AS migrate
WORKDIR /app/apps/web/server
USER node
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/catalogue/sync-cli.js"]

FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0 NEXT_TELEMETRY_DISABLED=1
WORKDIR /app
# The standalone server with only the files it traced (including the packages the API loads at run
# time), plus the static assets it serves
COPY --from=build --chown=node:node /app/apps/web/.next/standalone ./
COPY --from=build --chown=node:node /app/apps/web/.next/static ./apps/web/.next/static
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/api/v1/health').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"
CMD ["node", "apps/web/server.js"]
