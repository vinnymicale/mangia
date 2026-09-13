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
# The OCR engine, whole. Its recognition runs in a worker the library spawns as
# a child process by file path, so the tracer sees the entry point and none of
# what the worker itself requires -- the core's WASM binaries among them. Both
# packages are copied outright rather than trusting a trace through a spawn.
COPY --from=builder /app/node_modules/tesseract.js ./node_modules/tesseract.js
COPY --from=builder /app/node_modules/tesseract.js-core ./node_modules/tesseract.js-core
# Its runtime dependencies, for the same reason: nothing the worker requires is
# reachable from the traced entry point. node-fetch, is-url and
# regenerator-runtime the trace already brought in through the main module.
COPY --from=builder /app/node_modules/bmp-js ./node_modules/bmp-js
COPY --from=builder /app/node_modules/idb-keyval ./node_modules/idb-keyval
COPY --from=builder /app/node_modules/wasm-feature-detect ./node_modules/wasm-feature-detect
COPY --from=builder /app/node_modules/zlibjs ./node_modules/zlibjs
COPY scripts ./scripts
COPY docker-entrypoint.sh ./docker-entrypoint.sh

RUN apk add --no-cache su-exec && mkdir -p /data && chown -R node:node /data /app
VOLUME ["/data"]
EXPOSE 3000

# Stays root at container start so the entrypoint can fix ownership of a
# bind-mounted /data (e.g. an Unraid host path Docker creates as root) before
# dropping to the unprivileged `node` user to run the app.
ENTRYPOINT ["./docker-entrypoint.sh"]
