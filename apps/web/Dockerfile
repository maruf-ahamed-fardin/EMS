# syntax=docker/dockerfile:1
# Build from the repository root:  docker build -f apps/web/Dockerfile --build-arg API_ORIGIN=http://api:4000 -t ems-web .
# API_ORIGIN is where the web server forwards /api/*. Next bakes rewrites in at build time, so it is a
# build argument: use the API's address on the private network, the same in every environment.

FROM node:22-bookworm-slim AS build
WORKDIR /app
ENV NPM_CONFIG_UPDATE_NOTIFIER=false NPM_CONFIG_FUND=false NEXT_TELEMETRY_DISABLED=1
COPY .npmrc package.json package-lock.json ./
COPY packages/contracts/package.json packages/contracts/
COPY apps/web/package.json apps/web/
RUN npm ci --workspace @ems/contracts --workspace @ems/frontend
COPY packages/contracts packages/contracts
COPY apps/web apps/web
ARG API_ORIGIN
RUN test -n "$API_ORIGIN" || (echo "Set --build-arg API_ORIGIN, e.g. http://api:4000" >&2 && exit 1)
ENV API_ORIGIN=$API_ORIGIN BUILD_STANDALONE=1 NODE_ENV=production
RUN npm run build -w @ems/contracts && npm run build -w @ems/frontend

FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0 NEXT_TELEMETRY_DISABLED=1
WORKDIR /app
# The standalone server with only the files it traced, plus the static assets it serves
COPY --from=build --chown=node:node /app/apps/web/.next/standalone ./
COPY --from=build --chown=node:node /app/apps/web/.next/static ./apps/web/.next/static
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/login').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"
CMD ["node", "apps/web/server.js"]
