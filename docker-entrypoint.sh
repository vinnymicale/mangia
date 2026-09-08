#!/bin/sh
set -e

# Apply schema migrations, then the FTS objects Prisma does not manage.
node ./scripts/migrate.mjs
node ./scripts/ensure-fts.mjs

exec node server.js
