# syntax=docker/dockerfile:1

FROM node:22-alpine AS base
WORKDIR /app

FROM base AS deps
RUN apk add --no-cache libc6-compat
COPY package.json package-lock.json ./
RUN npm ci

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build
RUN ./node_modules/.bin/esbuild db/migrate.ts \
      --bundle \
      --platform=node \
      --format=esm \
      --outfile=migrate.mjs \
      --banner:js="import { createRequire } from 'module'; const require = createRequire(import.meta.url);" \
 && ./node_modules/.bin/esbuild db/seed.ts \
      --bundle \
      --platform=node \
      --format=esm \
      --alias:@=. \
      --outfile=seed.mjs \
      --banner:js="import { createRequire } from 'module'; const require = createRequire(import.meta.url);"

FROM base AS runner
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    UPLOAD_DIR=/app/uploads

RUN mkdir -p /app/.next /app/uploads/reports /app/uploads/avatars \
 && chown -R node:node /app

COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/public ./public
COPY --from=builder --chown=node:node /app/migrate.mjs ./migrate.mjs
COPY --from=builder --chown=node:node /app/seed.mjs ./seed.mjs
COPY --from=builder --chown=node:node /app/drizzle ./drizzle

USER node

EXPOSE 3000

CMD ["sh", "-c", "node migrate.mjs && node server.js"]
