FROM node:22-alpine AS deps
WORKDIR /app
# better-sqlite3's install script runs node-gyp rebuild, so this stage needs a
# build toolchain. Only this stage: the runner copies the finished package.
RUN apk add --no-cache python3 make g++
COPY package.json package-lock.json prisma.config.ts ./
# The postinstall hook runs `prisma generate`, which needs the schema.
COPY prisma ./prisma
RUN npm ci

FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# The build only needs a syntactically valid URL; no database is touched.
ENV DATABASE_URL="file:/data/mangia.db"
RUN npx prisma generate && npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV DATABASE_URL="file:/data/mangia.db"

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
# The generated Prisma client is TypeScript, so Next compiles it into the server
# chunks, so it needs no copying. better-sqlite3 does: the adapter loads it
# lazily, so Next's tracer only bundles its package.json, leaving a stub that
# fails on first query. The Prisma CLI stays out — scripts/migrate.mjs applies
# migrations through better-sqlite3 instead.
COPY --from=builder /app/node_modules/better-sqlite3 ./node_modules/better-sqlite3
COPY scripts ./scripts
COPY docker-entrypoint.sh ./docker-entrypoint.sh

RUN mkdir -p /data && chown -R node:node /data /app
USER node
VOLUME ["/data"]
EXPOSE 3000

ENTRYPOINT ["./docker-entrypoint.sh"]
