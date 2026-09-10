import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

let dir: string
const saved = { ...process.env }

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'mangia-drive-'))
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
  process.env = { ...saved }
})

function writeKey(overrides: Record<string, unknown> = {}): string {
  const path = join(dir, 'key.json')
  writeFileSync(
    path,
    JSON.stringify({
      type: 'service_account',
      client_email: 'backups@example.iam.gserviceaccount.com',
      private_key: '-----BEGIN PRIVATE KEY-----\nnot-a-real-key\n-----END PRIVATE KEY-----\n',
      ...overrides,
    }),
  )
  return path
}

describe('readDriveConfig', () => {
  it('reports unconfigured when no credentials are set', async () => {
    delete process.env.GOOGLE_DRIVE_CREDENTIALS
    const { readDriveConfig } = await import('./drive')

    const config = await readDriveConfig()
    expect(config.configured).toBe(false)
  })

  it('reads a service account key from the path in the environment', async () => {
    process.env.GOOGLE_DRIVE_CREDENTIALS = writeKey()
    const { readDriveConfig } = await import('./drive')

    const config = await readDriveConfig()
    expect(config.configured).toBe(true)
    expect(config.clientEmail).toBe('backups@example.iam.gserviceaccount.com')
  })

  it('reports unconfigured, not a crash, when the file is missing', async () => {
    process.env.GOOGLE_DRIVE_CREDENTIALS = join(dir, 'absent.json')
    const { readDriveConfig } = await import('./drive')

    const config = await readDriveConfig()
    expect(config.configured).toBe(false)
    expect(config.problem).toMatch(/could not be read|not found/i)
  })

  it('reports a problem when the file is not a service account key', async () => {
    process.env.GOOGLE_DRIVE_CREDENTIALS = writeKey({ private_key: undefined })
    const { readDriveConfig } = await import('./drive')

    const config = await readDriveConfig()
    expect(config.configured).toBe(false)
    expect(config.problem).toMatch(/service account/i)
  })

  it('never exposes the private key to callers', async () => {
    process.env.GOOGLE_DRIVE_CREDENTIALS = writeKey()
    const { readDriveConfig } = await import('./drive')

    // The config is rendered on a settings page; a key that reaches the client
    // is a key in the page source.
    const config = await readDriveConfig()
    expect(JSON.stringify(config)).not.toContain('BEGIN PRIVATE KEY')
  })
})

describe('backupIntervalHours', () => {
  it('defaults to daily when unset', async () => {
    delete process.env.GOOGLE_DRIVE_BACKUP_INTERVAL_HOURS
    const { backupIntervalHours } = await import('./drive')
    expect(backupIntervalHours()).toBe(24)
  })

  it('honours an explicit interval', async () => {
    process.env.GOOGLE_DRIVE_BACKUP_INTERVAL_HOURS = '6'
    const { backupIntervalHours } = await import('./drive')
    expect(backupIntervalHours()).toBe(6)
  })

  it('falls back to daily rather than scheduling a runaway loop', async () => {
    process.env.GOOGLE_DRIVE_BACKUP_INTERVAL_HOURS = '0'
    const { backupIntervalHours } = await import('./drive')
    expect(backupIntervalHours()).toBe(24)
  })
})
