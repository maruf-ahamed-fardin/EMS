# syntax=docker/dockerfile:1
# Build from ems/:  docker build -f backend/Dockerfile -t ems-api .
#   --target runtime  (default) the API: node dist/main.js as a non-root user
#   --target migrate  the release step: prisma migrate deploy, then catalogue sync
# Debian slim, not Alpine: argon2's prebuilt binary is used as shipped, with no compiler in the image.

FROM node:22-bookworm-slim AS base
WORKDIR /app
ENV NPM_CONFIG_UPDATE_NOTIFIER=false NPM_CONFIG_FUND=false
# .npmrc carries the supply-chain guard (ignore-scripts, min-release-age); npm ci honours it here too
COPY .npmrc package.json package-lock.json ./
COPY packages/contracts/package.json packages/contracts/
COPY backend/package.json backend/

FROM base AS build
RUN npm ci --workspace @ems/contracts --workspace @ems/backend
COPY packages/contracts packages/contracts
COPY backend backend
RUN npm run build -w @ems/contracts \
 && npm run prisma:generate -w @ems/backend \
 && npm run build -w @ems/backend

# Release step, run once per deploy before the new API starts (never at API start-up)
FROM build AS migrate
ENV NODE_ENV=production
WORKDIR /app/backend
USER node
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/catalogue/sync-cli.js"]

FROM base AS prod-deps
RUN npm ci --omit=dev --workspace @ems/contracts --workspace @ems/backend && mkdir -p backend/node_modules

FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production PORT=4000
WORKDIR /app
COPY --from=prod-deps /app/node_modules node_modules
# Packages npm couldn't hoist (a version only the backend uses)
COPY --from=prod-deps /app/backend/node_modules backend/node_modules
COPY --from=build /app/packages/contracts/package.json packages/contracts/package.json
COPY --from=build /app/packages/contracts/dist packages/contracts/dist
COPY --from=build /app/backend/package.json backend/package.json
COPY --from=build /app/backend/dist backend/dist
WORKDIR /app/backend
USER node
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/api/v1/health').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"
CMD ["node", "dist/main.js"]
