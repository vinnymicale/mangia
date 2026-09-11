import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import { createTestDatabase } from '@/test/setupDb'

// The route re-registers the backup timer on any drive.* write. That is the
// behaviour under test in one case below, and unwanted noise in the others, so
// it is mocked rather than left to schedule real work in the test process.
vi.mock('@/lib/backup/scheduler', () => ({
  restartBackupScheduler: vi.fn().mockResolvedValue(undefined),
}))

import { restartBackupScheduler } from '@/lib/backup/scheduler'

let cleanup: () => void

beforeAll(() => {
  const database = createTestDatabase()
  process.env.DATABASE_URL = database.url
  cleanup = database.cleanup
})

afterAll(() => cleanup())

beforeEach(async () => {
  for (const name of [
    'LLM_PROVIDER',
    'LLM_API_KEY',
    'LLM_MODEL',
    'LLM_BASE_URL',
    'GOOGLE_DRIVE_CREDENTIALS',
    'GOOGLE_DRIVE_FOLDER_ID',
    'GOOGLE_DRIVE_BACKUP_INTERVAL_HOURS',
  ]) {
    delete process.env[name]
  }
  const { clearSetting } = await import('@/lib/db/settings')
  const { SETTING_KEYS } = await import('@/lib/config')
  for (const key of SETTING_KEYS) await clearSetting(key)
  vi.mocked(restartBackupScheduler).mockClear()
})

function put(settings: Record<string, string | null>): Request {
  return new Request('http://x/api/settings', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ settings }),
  })
}

describe('GET /api/settings', () => {
  it('describes the configuration without any secret in it', async () => {
    const { setSetting } = await import('@/lib/db/settings')
    await setSetting('llm.apiKey', 'sk-super-secret-value')
    const { GET } = await import('./route')

    const body = await (await GET()).json()
    expect(body.llm.apiKey.set).toBe(true)
    // The whole security property of this route in one assertion: the response
    // proves a key is set without ever carrying the key.
    expect(JSON.stringify(body)).not.toContain('sk-super-secret-value')
  })
})

describe('PUT /api/settings', () => {
  it('saves only the keys it was given', async () => {
    const { setSetting } = await import('@/lib/db/settings')
    await setSetting('llm.apiKey', 'kept')
    const { PUT } = await import('./route')

    await PUT(put({ 'llm.model': 'gemini-2.5-pro' }))

    const { getSetting } = await import('@/lib/db/settings')
    expect(await getSetting('llm.model')).toBe('gemini-2.5-pro')
    // An absent key means "leave alone". Without this, saving the form with an
    // untouched masked field would wipe the stored key.
    expect(await getSetting('llm.apiKey')).toBe('kept')
  })

  it('clears a key when given an explicit null', async () => {
    const { setSetting, getSetting } = await import('@/lib/db/settings')
    await setSetting('llm.apiKey', 'to-be-removed')
    const { PUT } = await import('./route')

    await PUT(put({ 'llm.apiKey': null }))
    expect(await getSetting('llm.apiKey')).toBeNull()
  })

  it('rejects an unknown key', async () => {
    const { PUT } = await import('./route')
    const response = await PUT(put({ 'llm.somethingElse': 'x' }))
    expect(response.status).toBe(400)
  })

  it('rejects a body that is not a settings object', async () => {
    const { PUT } = await import('./route')
    const response = await PUT(
      new Request('http://x/api/settings', { method: 'PUT', body: 'not json' }),
    )
    expect(response.status).toBe(400)
  })

  it('reports a validation failure with the message rather than a 500', async () => {
    const { PUT } = await import('./route')
    const response = await PUT(put({ 'drive.intervalHours': 'often' }))
    expect(response.status).toBe(400)
    expect((await response.json()).error).toMatch(/interval/i)
  })

  // The no-restart guarantee at the route level: writing anything about backups
  // re-registers the timer, so the new interval or key is in effect at once.
  it('re-registers the backup scheduler after a drive change', async () => {
    const { PUT } = await import('./route')
    await PUT(put({ 'drive.intervalHours': '6' }))
    expect(restartBackupScheduler).toHaveBeenCalled()
  })

  it('leaves the scheduler alone when only the LLM changed', async () => {
    const { PUT } = await import('./route')
    await PUT(put({ 'llm.model': 'gpt-4o' }))
    expect(restartBackupScheduler).not.toHaveBeenCalled()
  })
})
