import { PrismaClient } from '@/generated/prisma/client'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'

/**
 * better-sqlite3 ships a prebuilt binary built against Node 22's ABI. On an
 * older major it does not throw -- it segfaults inside the Database
 * constructor, killing the process with no stack and nothing to catch. That is
 * unrecoverable and close to undiagnosable, so refuse to start instead.
 *
 * package.json engines plus engine-strict catches `npm install`, but nothing
 * guards `npm run dev` in a shell that switched Node afterwards, which is
 * exactly how this bites.
 */
const MIN_NODE_MAJOR = 22
const nodeMajor = Number(process.versions.node.split('.')[0])
if (nodeMajor < MIN_NODE_MAJOR) {
  throw new Error(
    `Mangia needs Node ${MIN_NODE_MAJOR}+ but is running Node ${process.versions.node}. ` +
      'better-sqlite3 would segfault on the first query. Run `nvm use` (see .nvmrc), then retry.',
  )
}

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient
  ftsReady?: Promise<void>
}

function createClient(): PrismaClient {
  const url = process.env.DATABASE_URL ?? 'file:./dev.db'
  const adapter = new PrismaBetterSqlite3({ url })
  return new PrismaClient({ adapter })
}

export const db: PrismaClient = globalForPrisma.prisma ?? createClient()

// Next.js dev mode reloads modules on every edit; without this the process
// accumulates one connection pool per reload.
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db

/**
 * The FTS5 virtual table lives outside the Prisma schema, so it has to be
 * created at boot rather than by a migration. Callers await this once before
 * their first query; the promise is cached so concurrent requests share it.
 *
 * This deliberately does NOT run at module scope: search.ts imports `db` from
 * here, so calling it from this file would create an import cycle in which
 * ensureFtsSchema runs before `db` is assigned.
 *
 * The category backfill rides along for the same reason -- it too fixes up
 * rows that predate a schema feature, and it too needs `db` to exist first.
 */
export function ensureDbReady(): Promise<void> {
  globalForPrisma.ftsReady ??= (async () => {
    const { ensureFtsSchema } = await import('./search')
    await ensureFtsSchema()
    const { backfillCategories } = await import('./ingredients')
    await backfillCategories()
  })()
  return globalForPrisma.ftsReady
}
