import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createTestDatabase } from '@/test/setupDb'

let cleanup: () => void
let scratch: string

const ENV_KEYS = [
  'LLM_PROVIDER', 'LLM_API_KEY', 'LLM_MODEL', 'LLM_BASE_URL',
  'GOOGLE_DRIVE_CREDENTIALS', 'GOOGLE_DRIVE_FOLDER_ID',
  'GOOGLE_DRIVE_BACKUP_INTERVAL_HOURS',
]

const KEY_JSON = JSON.stringify({
  client_email: 'backup@mangia.iam.gserviceaccount.com',
  private_key: '-----BEGIN PRIVATE KEY-----\nMIIdeadbeef\n-----END PRIVATE KEY-----\n',
})

beforeAll(() => {
  const testDb = createTestDatabase()
  process.env.DATABASE_URL = testDb.url
  scratch = mkdtempSync(join(tmpdir(), 'mangia-config-'))
  cleanup = () => {
    testDb.cleanup()
    rmSync(scratch, { recursive: true, force: true })
  }
})

afterAll(() => cleanup())

// Both halves of the resolution order are global state, so each test starts
// from an empty table and an empty environment.
beforeEach(async () => {
  const { db } = await import('./db/client')
  await db.setting.deleteMany()
  for (const key of ENV_KEYS) delete process.env[key]
})

describe('resolution order', () => {
  it('falls back to the built-in default when neither row nor env is set', async () => {
    const { resolveConfig } = await import('./config')
    const config = await resolveConfig()
    expect(config.llm.provider).toBe('gemini')
    expect(config.llm.apiKey).toBeNull()
    expect(config.drive.intervalHours).toBe(24)
    expect(config.drive.keepCount).toBe(14)
  })

  it('uses the environment variable when there is no row', async () => {
    process.env.LLM_MODEL = 'from-env'
    const { resolveConfig } = await import('./config')
    expect((await resolveConfig()).llm.model).toBe('from-env')
  })

  it('prefers the database row over the environment variable', async () => {
    process.env.LLM_MODEL = 'from-env'
    const { setSetting } = await import('./db/settings')
    await setSetting('llm.model', 'from-db')
    const { resolveConfig } = await import('./config')
    expect((await resolveConfig()).llm.model).toBe('from-db')
  })

  it('reads the database on every call, so a change needs no restart', async () => {
    const { resolveConfig } = await import('./config')
    expect((await resolveConfig()).llm.apiKey).toBeNull()
    const { setSetting } = await import('./db/settings')
    await setSetting('llm.apiKey', 'sk-live')
    expect((await resolveConfig()).llm.apiKey).toBe('sk-live')
  })

  it('defaults the model per provider', async () => {
    const { setSetting } = await import('./db/settings')
    const { resolveConfig } = await import('./config')
    expect((await resolveConfig()).llm.model).toBe('gemini-2.5-flash')
    await setSetting('llm.provider', 'openai-compatible')
    expect((await resolveConfig()).llm.model).toBe('gpt-4o-mini')
  })

  it('ignores an interval that would busy-loop the timer', async () => {
    const { setSetting } = await import('./db/settings')
    const { resolveConfig } = await import('./config')
    await setSetting('drive.intervalHours', '0')
    expect((await resolveConfig()).drive.intervalHours).toBe(24)
    await setSetting('drive.intervalHours', 'nonsense')
    expect((await resolveConfig()).drive.intervalHours).toBe(24)
  })
})

describe('drive credentials have two forms', () => {
  it('parses a database value as inline service account JSON', async () => {
    const { setSetting } = await import('./db/settings')
    await setSetting('drive.credentials', KEY_JSON)
    const { resolveConfig } = await import('./config')
    const key = (await resolveConfig()).drive.key
    expect(key).toMatchObject({ client_email: 'backup@mangia.iam.gserviceaccount.com' })
  })

  it('reads an environment value as a path to a key file', async () => {
    const path = join(scratch, 'key.json')
    writeFileSync(path, KEY_JSON)
    process.env.GOOGLE_DRIVE_CREDENTIALS = path
    const { resolveConfig } = await import('./config')
    const key = (await resolveConfig()).drive.key
    expect(key).toMatchObject({ client_email: 'backup@mangia.iam.gserviceaccount.com' })
  })

  it('reports a malformed blob as a problem rather than throwing', async () => {
    const { setSetting } = await import('./db/settings')
    await setSetting('drive.credentials', 'not json at all')
    const { resolveConfig } = await import('./config')
    const drive = (await resolveConfig()).drive
    expect(drive.key).toBeNull()
    expect(drive.problem).toMatch(/service account key/i)
  })

  it('reports an unreadable key file as a problem naming the path', async () => {
    process.env.GOOGLE_DRIVE_CREDENTIALS = join(scratch, 'missing.json')
    const { resolveConfig } = await import('./config')
    const drive = (await resolveConfig()).drive
    expect(drive.key).toBeNull()
    expect(drive.problem).toContain('missing.json')
  })
})

describe('describeConfig never exposes a secret', () => {
  it('masks the api key to its last four characters', async () => {
    const { setSetting } = await import('./db/settings')
    await setSetting('llm.apiKey', 'sk-supersecret-abcd')
    const { describeConfig } = await import('./config')
    const view = await describeConfig()
    expect(view.llm.apiKey.set).toBe(true)
    expect(view.llm.apiKey.mask).toBe('••••••••abcd')
    expect(JSON.stringify(view)).not.toContain('supersecret')
  })

  it('masks the drive key with its client_email and no private key', async () => {
    const { setSetting } = await import('./db/settings')
    await setSetting('drive.credentials', KEY_JSON)
    const { describeConfig } = await import('./config')
    const view = await describeConfig()
    expect(view.drive.credentials.mask).toBe('backup@mangia.iam.gserviceaccount.com')
    expect(JSON.stringify(view)).not.toContain('BEGIN PRIVATE KEY')
    expect(JSON.stringify(view)).not.toContain('MIIdeadbeef')
  })

  it('says a secret is unset without inventing a mask', async () => {
    const { describeConfig } = await import('./config')
    const view = await describeConfig()
    expect(view.llm.apiKey).toEqual({ set: false, mask: null, source: 'unset' })
  })

  it('reports where each value came from', async () => {
    process.env.LLM_API_KEY = 'from-env-key'
    const { setSetting } = await import('./db/settings')
    await setSetting('llm.model', 'from-db')
    const { describeConfig } = await import('./config')
    const view = await describeConfig()
    expect(view.llm.apiKey.source).toBe('env')
    expect(view.llm.model.source).toBe('db')
    expect(view.llm.provider.source).toBe('default')
  })
})

describe('applySettings', () => {
  it('writes a value and leaves other keys alone', async () => {
    const { applySettings, resolveConfig } = await import('./config')
    await applySettings({ 'llm.model': 'chosen' })
    expect((await resolveConfig()).llm.model).toBe('chosen')
    expect((await resolveConfig()).llm.provider).toBe('gemini')
  })

  // The rule that makes a masked field safe to submit: an omitted key is
  // untouched, so the mask the page rendered can never be saved over the key.
  it('leaves a secret untouched when the field is omitted', async () => {
    const { applySettings, resolveConfig } = await import('./config')
    await applySettings({ 'llm.apiKey': 'sk-real' })
    await applySettings({ 'llm.model': 'something-else' })
    expect((await resolveConfig()).llm.apiKey).toBe('sk-real')
  })

  it('refuses to store a value that looks like a mask', async () => {
    const { applySettings, resolveConfig } = await import('./config')
    await applySettings({ 'llm.apiKey': 'sk-real' })
    await expect(applySettings({ 'llm.apiKey': '••••••••real' })).rejects.toThrow(/mask/i)
    expect((await resolveConfig()).llm.apiKey).toBe('sk-real')
  })

  it('clears a key when given null, falling back to the environment', async () => {
    process.env.LLM_MODEL = 'from-env'
    const { applySettings, resolveConfig } = await import('./config')
    await applySettings({ 'llm.model': 'from-db' })
    expect((await resolveConfig()).llm.model).toBe('from-db')
    await applySettings({ 'llm.model': null })
    expect((await resolveConfig()).llm.model).toBe('from-env')
  })

  it('rejects an unknown key', async () => {
    const { applySettings } = await import('./config')
    await expect(applySettings({ 'llm.nope': 'x' })).rejects.toThrow(/llm\.nope/)
  })

  it('rejects a provider it cannot build', async () => {
    const { applySettings } = await import('./config')
    await expect(applySettings({ 'llm.provider': 'hal9000' })).rejects.toThrow(/provider/i)
  })

  it('rejects credentials that are not a service account key', async () => {
    const { applySettings } = await import('./config')
    await expect(
      applySettings({ 'drive.credentials': JSON.stringify({ hello: 'world' }) }),
    ).rejects.toThrow(/service account key/i)
  })
})
