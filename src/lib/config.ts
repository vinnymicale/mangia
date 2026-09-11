import { readFile } from 'node:fs/promises'
import { SETTING_KEYS, PROVIDERS, type SettingKey, type ProviderKind } from './config-shared'
import { getSettings, setSetting, clearSetting } from './db/settings'

/**
 * Configuration resolution: database row -> environment variable -> built-in
 * default.
 *
 * This module is the only place any of these environment variables is read.
 * Callers ask for resolved values and cannot tell which layer answered, which
 * is what lets the settings page override a deployment's .env without the
 * providers or the scheduler knowing anything changed.
 *
 * There is deliberately NO cache here, not even a memo with a short TTL. A
 * cache is exactly what would reintroduce the restart this feature exists to
 * remove; every read is a SQLite point lookup, which at this app's request
 * volume costs nothing worth reclaiming.
 */

export { SETTING_KEYS, PROVIDERS } from './config-shared'
export type { SettingKey, ProviderKind } from './config-shared'

/** Which environment variable stands in for a key when it has no row. */
const ENV_FALLBACK: Partial<Record<SettingKey, string>> = {
  'llm.provider': 'LLM_PROVIDER',
  'llm.apiKey': 'LLM_API_KEY',
  'llm.model': 'LLM_MODEL',
  'llm.baseUrl': 'LLM_BASE_URL',
  'drive.credentials': 'GOOGLE_DRIVE_CREDENTIALS',
  'drive.folderId': 'GOOGLE_DRIVE_FOLDER_ID',
  'drive.intervalHours': 'GOOGLE_DRIVE_BACKUP_INTERVAL_HOURS',
}

/** Keys whose value must never be returned to the client in full. */
const SECRET_KEYS = new Set<SettingKey>(['llm.apiKey', 'drive.credentials'])


const MODEL_DEFAULTS: Record<ProviderKind, string> = {
  gemini: 'gemini-2.5-flash',
  'openai-compatible': 'gpt-4o-mini',
}

const DEFAULT_INTERVAL_HOURS = 24
const DEFAULT_KEEP_COUNT = 14

/** The character the mask is built from, and the tell that a value is a mask. */
const MASK_CHAR = '•'

export type Source = 'db' | 'env' | 'default' | 'unset'

interface Resolved {
  value: string | null
  source: Source
}

export interface ServiceAccountKey {
  client_email: string
  private_key: string
}

export interface ResolvedConfig {
  llm: {
    provider: ProviderKind
    apiKey: string | null
    model: string
    baseUrl: string | null
  }
  drive: {
    /** Null when unset or unusable; `problem` says which. */
    key: ServiceAccountKey | null
    folderId: string | null
    intervalHours: number
    keepCount: number
    /** Set when credentials were supplied but cannot be used, so it can be fixed. */
    problem: string | null
    configured: boolean
  }
}

export interface MaskedValue {
  set: boolean
  mask: string | null
  source: Source
}

export interface DescribedConfig {
  llm: {
    provider: { value: ProviderKind; source: Source }
    apiKey: MaskedValue
    model: { value: string; source: Source }
    baseUrl: { value: string | null; source: Source }
  }
  drive: {
    credentials: MaskedValue
    folderId: { value: string | null; source: Source }
    intervalHours: { value: number; source: Source }
    keepCount: { value: number; source: Source }
    problem: string | null
    configured: boolean
  }
}

/** Reads every key once, applying the row -> env -> unset order. */
async function readAll(): Promise<Record<SettingKey, Resolved>> {
  const rows = await getSettings([...SETTING_KEYS])
  const out = {} as Record<SettingKey, Resolved>
  for (const key of SETTING_KEYS) {
    const row = rows[key]
    if (typeof row === 'string' && row.length > 0) {
      out[key] = { value: row, source: 'db' }
      continue
    }
    const envName = ENV_FALLBACK[key]
    const fromEnv = envName === undefined ? undefined : process.env[envName]?.trim()
    out[key] = fromEnv
      ? { value: fromEnv, source: 'env' }
      : { value: null, source: 'unset' }
  }
  return out
}

function isProvider(value: string): value is ProviderKind {
  return (PROVIDERS as readonly string[]).includes(value)
}

function parseServiceAccount(raw: string): ServiceAccountKey | { problem: string } {
  let parsed: Partial<ServiceAccountKey>
  try {
    parsed = JSON.parse(raw) as Partial<ServiceAccountKey>
  } catch {
    return { problem: 'That is not a Google service account key.' }
  }
  if (typeof parsed.client_email !== 'string' || typeof parsed.private_key !== 'string') {
    return { problem: 'That is not a Google service account key.' }
  }
  return { client_email: parsed.client_email, private_key: parsed.private_key }
}

/**
 * Credentials mean two different things depending on where they came from. A
 * row holds the key JSON itself, because that is what the file picker on the
 * settings page can produce. The environment variable keeps the meaning it has
 * always had -- a path to a key file on disk -- so existing deployments that
 * set it are unaffected.
 */
async function loadKey(
  credentials: Resolved,
): Promise<{ key: ServiceAccountKey | null; problem: string | null }> {
  if (credentials.value === null) return { key: null, problem: null }

  let raw = credentials.value
  if (credentials.source === 'env') {
    try {
      raw = await readFile(credentials.value, 'utf8')
    } catch {
      return {
        key: null,
        problem: `The credentials file at ${credentials.value} could not be read.`,
      }
    }
  }

  const parsed = parseServiceAccount(raw)
  if ('problem' in parsed) return { key: null, problem: parsed.problem }
  return { key: parsed, problem: null }
}

/** Never zero or negative: that would busy-loop the timer. */
function positiveNumber(resolved: Resolved, fallback: number): number {
  const value = Number(resolved.value)
  if (!Number.isFinite(value) || value <= 0) return fallback
  return value
}

/** The typed, fully-resolved configuration. For server use only: holds secrets. */
export async function resolveConfig(): Promise<ResolvedConfig> {
  const all = await readAll()

  const providerRaw = all['llm.provider'].value
  const provider: ProviderKind =
    providerRaw !== null && isProvider(providerRaw) ? providerRaw : 'gemini'

  const { key, problem } = await loadKey(all['drive.credentials'])

  return {
    llm: {
      provider,
      apiKey: all['llm.apiKey'].value,
      model: all['llm.model'].value ?? MODEL_DEFAULTS[provider],
      baseUrl: all['llm.baseUrl'].value,
    },
    drive: {
      key,
      folderId: all['drive.folderId'].value,
      intervalHours: positiveNumber(all['drive.intervalHours'], DEFAULT_INTERVAL_HOURS),
      keepCount: Math.floor(positiveNumber(all['drive.keepCount'], DEFAULT_KEEP_COUNT)),
      problem,
      configured: key !== null,
    },
  }
}

/**
 * The mask is the only representation of a secret that ever leaves the server.
 * Four characters is enough to recognise which key is installed and far too few
 * to use.
 */
function maskOf(value: string): string {
  return MASK_CHAR.repeat(8) + value.slice(-4)
}

function looksLikeMask(value: string): boolean {
  return value.includes(MASK_CHAR)
}

/** The client-safe view. Secrets appear only as masks. */
export async function describeConfig(): Promise<DescribedConfig> {
  const all = await readAll()
  const config = await resolveConfig()

  const apiKey = all['llm.apiKey']
  const credentials = all['drive.credentials']

  return {
    llm: {
      provider: {
        value: config.llm.provider,
        source: all['llm.provider'].source === 'unset' ? 'default' : all['llm.provider'].source,
      },
      apiKey:
        apiKey.value === null
          ? { set: false, mask: null, source: 'unset' }
          : { set: true, mask: maskOf(apiKey.value), source: apiKey.source },
      model: {
        value: config.llm.model,
        source: all['llm.model'].source === 'unset' ? 'default' : all['llm.model'].source,
      },
      baseUrl: { value: config.llm.baseUrl, source: all['llm.baseUrl'].source },
    },
    drive: {
      // The service account's address, not a tail of the key: it is the part
      // that identifies which account is installed, and it is already the thing
      // the user has to share the Drive folder with.
      credentials:
        credentials.value === null
          ? { set: false, mask: null, source: 'unset' }
          : {
              set: true,
              mask: config.drive.key?.client_email ?? null,
              source: credentials.source,
            },
      folderId: { value: config.drive.folderId, source: all['drive.folderId'].source },
      intervalHours: {
        value: config.drive.intervalHours,
        source:
          all['drive.intervalHours'].source === 'unset'
            ? 'default'
            : all['drive.intervalHours'].source,
      },
      keepCount: {
        value: config.drive.keepCount,
        source: all['drive.keepCount'].source === 'unset' ? 'default' : all['drive.keepCount'].source,
      },
      problem: config.drive.problem,
      configured: config.drive.configured,
    },
  }
}

export type SettingUpdate = Record<string, string | null>

/**
 * Applies a partial update. A key that is absent is left alone -- that is what
 * makes it safe for the page to submit a form containing a masked field it
 * never touched. An explicit null clears the row, falling back to whatever the
 * environment or the default says.
 */
export async function applySettings(update: SettingUpdate): Promise<void> {
  const entries: [string, string | null][] = Object.entries(update)

  // Validate everything before writing anything, so a bad field cannot leave a
  // half-applied update behind.
  for (const [key, value] of entries) {
    if (!(SETTING_KEYS as readonly string[]).includes(key)) {
      throw new Error(`Unknown setting: ${key}`)
    }
    if (value === null) continue

    if (SECRET_KEYS.has(key as SettingKey) && looksLikeMask(value)) {
      throw new Error(
        `${key} looks like a mask rather than a real value. Leave the field alone to keep the stored value.`,
      )
    }
    if (key === 'llm.provider' && !isProvider(value)) {
      throw new Error(`Unknown provider: ${value}`)
    }
    if (key === 'drive.credentials') {
      const parsed = parseServiceAccount(value)
      if ('problem' in parsed) throw new Error(parsed.problem)
    }
    if (key === 'drive.intervalHours' || key === 'drive.keepCount') {
      const parsed = Number(value)
      if (!Number.isFinite(parsed) || parsed <= 0) {
        throw new Error(`${key} must be a number greater than zero.`)
      }
    }
  }

  for (const [key, value] of entries) {
    if (value === null || value === '') await clearSetting(key)
    else await setSetting(key, value)
  }
}
