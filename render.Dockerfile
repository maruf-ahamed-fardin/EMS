# syntax=docker/dockerfile:1
# The whole EMS in one container, for render.yaml (Render's free plan: one web service, one database).
# The web app listens on Render's $PORT and forwards /api/* to the API on 127.0.0.1:4000 inside the
# container, so the browser only ever sees one origin. scripts/render-start.sh runs the release step
# (migrations, catalogue sync) and then starts both processes.
#   docker build -f render.Dockerfile -t ems-render .
# The production images stay apps/api/Dockerfile and apps/web/Dockerfile.

FROM node:22-bookworm-slim
WORKDIR /app
ENV YARN_ENABLE_GLOBAL_CACHE=false NEXT_TELEMETRY_DISABLED=1
# .yarnrc.yml carries the supply-chain guards (enableScripts, npmMinimalAgeGate) and the pinned release
COPY .yarnrc.yml yarn.lock package.json ./
COPY .yarn/releases .yarn/releases
COPY packages/contracts/package.json packages/contracts/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
# Dev dependencies stay: the start script needs the prisma CLI for `migrate deploy`
RUN yarn workspaces focus @ems/contracts @ems/backend @ems/frontend

COPY packages/contracts packages/contracts
COPY apps/api apps/api
COPY apps/web apps/web
# Next bakes the rewrite target in at build time; the API is in the same container
ENV API_ORIGIN=http://127.0.0.1:4000 BUILD_STANDALONE=1 NODE_ENV=production
RUN yarn workspace @ems/contracts run build \
 && yarn workspace @ems/backend run prisma:generate \
 && yarn workspace @ems/backend run build \
 && yarn workspace @ems/frontend run build \
 && cp -r apps/web/.next/static apps/web/.next/standalone/apps/web/.next/static \
 && chown -R node:node apps/web/.next

COPY scripts/render-start.sh /usr/local/bin/render-start.sh
USER node
CMD ["bash", "/usr/local/bin/render-start.sh"]
