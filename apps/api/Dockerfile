# syntax=docker/dockerfile:1
# Build from the repository root:  docker build -f apps/api/Dockerfile -t ems-api .
#   --target runtime  (default) the API: node dist/main.js as a non-root user
#   --target migrate  the release step: prisma migrate deploy, then catalogue sync
# Debian slim, not Alpine: argon2's prebuilt binary is used as shipped, with no compiler in the image.

FROM node:22-bookworm-slim AS base
WORKDIR /app
# Keep Yarn's cache in the layer instead of a global directory outside it
ENV YARN_ENABLE_GLOBAL_CACHE=false
# .yarnrc.yml carries the supply-chain guards (enableScripts, npmMinimalAgeGate) and the pinned
# release the whole project uses; both must be in the image before any install runs.
COPY .yarnrc.yml yarn.lock package.json ./
COPY .yarn/releases .yarn/releases
COPY packages/contracts/package.json packages/contracts/
COPY apps/api/package.json apps/api/

FROM base AS build
RUN yarn workspaces focus @ems/contracts @ems/backend
COPY packages/contracts packages/contracts
COPY apps/api apps/api
RUN yarn workspace @ems/contracts run build \
 && yarn workspace @ems/backend run prisma:generate \
 && yarn workspace @ems/backend run build

# Release step, run once per deploy before the new API starts (never at API start-up)
FROM build AS migrate
ENV NODE_ENV=production
WORKDIR /app/apps/api
USER node
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/catalogue/sync-cli.js"]

FROM base AS prod-deps
RUN yarn workspaces focus --production @ems/contracts @ems/backend && mkdir -p apps/api/node_modules

FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production PORT=4000
WORKDIR /app
COPY --from=prod-deps /app/node_modules node_modules
# Packages yarn couldn't hoist (a version only the backend uses)
COPY --from=prod-deps /app/apps/api/node_modules apps/api/node_modules
COPY --from=build /app/packages/contracts/package.json packages/contracts/package.json
COPY --from=build /app/packages/contracts/dist packages/contracts/dist
COPY --from=build /app/apps/api/package.json apps/api/package.json
COPY --from=build /app/apps/api/dist apps/api/dist
WORKDIR /app/apps/api
USER node
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/api/v1/health').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"
CMD ["node", "dist/main.js"]
