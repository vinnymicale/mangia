/**
 * The parts of the configuration vocabulary that are safe on either side of the
 * client/server boundary: names and shapes, no resolution and no I/O.
 *
 * These live apart from `config.ts` because that module imports the database
 * layer, and a `'use client'` component importing a *value* from it would drag
 * better-sqlite3 into the browser bundle. Types alone are erased at compile
 * time and could have stayed; constants cannot, so the split is by whether a
 * thing survives to runtime rather than by subject.
 */

export const SETTING_KEYS = [
  'llm.provider',
  'llm.apiKey',
  'llm.model',
  'llm.baseUrl',
  'drive.credentials',
  'drive.folderId',
  'drive.intervalHours',
  'drive.keepCount',
] as const

export type SettingKey = (typeof SETTING_KEYS)[number]

export const PROVIDERS = ['gemini', 'openai-compatible'] as const

export type ProviderKind = (typeof PROVIDERS)[number]
