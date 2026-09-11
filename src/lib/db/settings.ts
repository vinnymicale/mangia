import { db } from './client'

/**
 * The Setting table's only accessor. It knows about rows and nothing about
 * what they mean -- which keys exist, which are secret, and what a missing row
 * falls back to all live in `lib/config.ts`.
 */
export async function getSetting(key: string): Promise<string | null> {
  const row = await db.setting.findUnique({ where: { key } })
  return row?.value ?? null
}

export async function setSetting(key: string, value: string): Promise<void> {
  await db.setting.upsert({
    where: { key },
    create: { key, value },
    update: { value },
  })
}

/** Clearing a key that was never set is a no-op, not an error. */
export async function clearSetting(key: string): Promise<void> {
  await db.setting.deleteMany({ where: { key } })
}

/** Reads several keys in one query. Keys with no row are simply absent. */
export async function getSettings(keys: string[]): Promise<Record<string, string>> {
  const rows = await db.setting.findMany({ where: { key: { in: keys } } })
  return Object.fromEntries(rows.map((row) => [row.key, row.value]))
}
