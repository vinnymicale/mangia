import path from 'node:path'
import { defineConfig } from 'prisma/config'

// Prisma 7 no longer reads `url` from the schema; migrate/studio read it here.
// The application connects through the better-sqlite3 adapter in src/lib/db/client.ts.
export default defineConfig({
  schema: path.join('prisma', 'schema.prisma'),
  migrations: {
    path: path.join('prisma', 'migrations'),
  },
  datasource: {
    url: process.env.DATABASE_URL ?? 'file:./dev.db',
  },
})
