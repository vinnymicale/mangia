#!/bin/sh
set -e

# /data may be a bind mount Docker created as root (e.g. an Unraid host path
# that didn't exist yet), which the unprivileged `node` user below can't
# write to. Fix ownership here, while still root, then drop privileges.
chown -R node:node /data

# Apply schema migrations, then the FTS objects Prisma does not manage.
su-exec node node ./scripts/migrate.mjs
su-exec node node ./scripts/ensure-fts.mjs

exec su-exec node node server.js
