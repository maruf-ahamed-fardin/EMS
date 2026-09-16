# syntax=docker/dockerfile:1
FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
RUN npm ci

FROM node:24-alpine AS build
WORKDIR /app
# Statically rendered pages bake absolute URLs in at build time, so the public URL has to be known
# here: `docker build --build-arg SITE_URL=https://team.selorax.io .`. Setting it only on the
# running container leaves link previews and canonical URLs pointing at localhost.
ARG SITE_URL
ENV NEXT_TELEMETRY_DISABLED=1 BUILD_STANDALONE=1 SITE_URL=$SITE_URL
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:24-alpine AS run
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
RUN addgroup -S app && adduser -S app -G app
COPY --from=build --chown=app:app /app/.next/standalone ./
COPY --from=build --chown=app:app /app/.next/static ./.next/static
USER app
EXPOSE 3000
CMD ["node", "server.js"]
