import { execSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/**
 * Creates a throwaway SQLite database with the current schema applied.
 * Returns a cleanup function.
 */
export function createTestDatabase(): { url: string; cleanup: () => void } {
  const dir = mkdtempSync(join(tmpdir(), 'mangia-test-'))
  const file = join(dir, 'test.db')
  const url = `file:${file}`
  execSync('npx prisma db push', {
    env: { ...process.env, DATABASE_URL: url },
    stdio: 'pipe',
  })
  return { url, cleanup: () => rmSync(dir, { recursive: true, force: true }) }
}
