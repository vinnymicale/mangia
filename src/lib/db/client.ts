import { PrismaClient } from '@/generated/prisma/client'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'

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
