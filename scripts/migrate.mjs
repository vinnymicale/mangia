// Applies Prisma migrations using better-sqlite3 directly.
//
// The Prisma 7 CLI is a bundle with unbundled runtime dependencies, so it cannot
// be cherry-picked into the standalone runtime image without dragging in a full
// install. The migrations are plain DDL, so we apply them here and record them in
// the same `_prisma_migrations` table the CLI uses, keeping `prisma migrate` in
// development aware of what this image has already applied.
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { createHash, randomUUID } from 'node:crypto'
import { join } from 'node:path'
import Database from 'better-sqlite3'

const url = process.env.DATABASE_URL ?? 'file:/data/mangia.db'
const db = new Database(url.replace(/^file:/, ''))
db.pragma('journal_mode = WAL')

db.exec(`CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "checksum" TEXT NOT NULL,
  "finished_at" DATETIME,
  "migration_name" TEXT NOT NULL,
  "logs" TEXT,
  "rolled_back_at" DATETIME,
  "started_at" DATETIME NOT NULL DEFAULT current_timestamp,
  "applied_steps_count" INTEGER UNSIGNED NOT NULL DEFAULT 0
)`)

const root = './prisma/migrations'
// `manual` holds the FTS objects, applied separately by ensure-fts.mjs.
const names = readdirSync(root, { withFileTypes: true })
  .filter((e) => e.isDirectory() && e.name !== 'manual')
  .map((e) => e.name)
  .sort()

const done = new Set(
  db.prepare('SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NOT NULL')
    .all().map((r) => r.migration_name),
)

const record = db.prepare(
  `INSERT INTO _prisma_migrations (id, checksum, finished_at, migration_name, applied_steps_count)
   VALUES (?, ?, current_timestamp, ?, 1)`,
)

for (const name of names) {
  if (done.has(name)) continue
  const file = join(root, name, 'migration.sql')
  if (!existsSync(file)) continue
  const sql = readFileSync(file, 'utf8')
  // Each migration is one atomic unit: a partial apply would leave the recorded
  // history disagreeing with the actual schema.
  db.exec('BEGIN')
  try {
    db.exec(sql)
    record.run(randomUUID(), createHash('sha256').update(sql).digest('hex'), name)
    db.exec('COMMIT')
  } catch (err) {
    db.exec('ROLLBACK')
    throw new Error(`Migration ${name} failed: ${err.message}`)
  }
  console.log(`Applied migration ${name}`)
}

db.close()
console.log('Migrations up to date.')
