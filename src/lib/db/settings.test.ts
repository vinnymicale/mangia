import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { createTestDatabase } from '@/test/setupDb'

let cleanup: () => void

beforeAll(() => {
  const testDb = createTestDatabase()
  process.env.DATABASE_URL = testDb.url
  cleanup = testDb.cleanup
})

afterAll(() => cleanup())

beforeEach(async () => {
  const { db } = await import('./client')
  await db.setting.deleteMany()
})

describe('settings rows', () => {
  it('returns null for a key that was never set', async () => {
    const { getSetting } = await import('./settings')
    expect(await getSetting('llm.apiKey')).toBeNull()
  })

  it('round-trips a value', async () => {
    const { getSetting, setSetting } = await import('./settings')
    await setSetting('llm.model', 'gemini-2.5-flash')
    expect(await getSetting('llm.model')).toBe('gemini-2.5-flash')
  })

  it('overwrites rather than duplicating on a second write', async () => {
    const { getSetting, setSetting } = await import('./settings')
    await setSetting('llm.model', 'first')
    await setSetting('llm.model', 'second')
    expect(await getSetting('llm.model')).toBe('second')
  })

  it('clears a key, and clearing an absent key is not an error', async () => {
    const { getSetting, setSetting, clearSetting } = await import('./settings')
    await setSetting('llm.apiKey', 'secret')
    await clearSetting('llm.apiKey')
    expect(await getSetting('llm.apiKey')).toBeNull()
    await expect(clearSetting('llm.apiKey')).resolves.toBeUndefined()
  })

  it('reads many keys at once, omitting the unset ones', async () => {
    const { setSetting, getSettings } = await import('./settings')
    await setSetting('llm.model', 'a')
    await setSetting('drive.folderId', 'b')
    const found = await getSettings(['llm.model', 'drive.folderId', 'llm.baseUrl'])
    expect(found).toEqual({ 'llm.model': 'a', 'drive.folderId': 'b' })
  })
})
