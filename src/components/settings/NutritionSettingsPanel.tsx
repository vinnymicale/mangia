'use client'

import { useState } from 'react'
import { Wheat } from 'lucide-react'
import { button, card } from '@/components/ui'
import { cn } from '@/lib/utils'
import { Outcome, SecretField, saveSettings, testConnection } from './SettingsParts'
import type { DescribedConfig } from '@/lib/config'

/**
 * The USDA FoodData Central key behind the macro estimates. Optional: without
 * one the client uses the shared demo key, which is enough to try the feature
 * but runs out quickly on a large collection.
 */
export function NutritionSettingsPanel({ initial }: { initial: DescribedConfig['usda'] }) {
  const [usda, setUsda] = useState(initial)
  /** Null means "not touched", so the key is left out of the update entirely. */
  const [apiKey, setApiKey] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)

  async function submit(settings: Record<string, string | null>) {
    setBusy(true)
    setError(null)
    setStatus(null)
    const result = await saveSettings(settings)
    setBusy(false)
    if (!result.ok) {
      setError(result.error)
      return
    }
    setUsda((result.config as DescribedConfig).usda)
    setApiKey(null)
    setStatus('Saved.')
  }

  function save() {
    // Nothing touched is nothing to save; an empty update would still say "Saved."
    if (apiKey === null) return
    void submit({ 'usda.apiKey': apiKey.trim() === '' ? null : apiKey.trim() })
  }

  async function test() {
    setBusy(true)
    setError(null)
    setStatus('Testing…')
    setStatus(await testConnection('usda'))
    setBusy(false)
  }

  return (
    <section className={cn(card, 'space-y-5 p-6')}>
      <div className="space-y-1">
        <h2 className="text-[17px] font-semibold text-(--color-ink)">Nutrition</h2>
        <p className="text-[13px] text-(--color-ink-2)">
          Macro estimates come from USDA FoodData Central. A key is free from{' '}
          <a
            href="https://fdc.nal.usda.gov/api-key-signup"
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-2"
          >
            api.data.gov
          </a>
          .
        </p>
      </div>

      <SecretField
        label="USDA API key"
        value={usda.apiKey}
        placeholder="Paste a new key"
        hint={
          usda.apiKey.set
            ? 'Shown as its last four characters once saved.'
            : 'Without a key, the shared demo key is used, limited to 30 requests an hour.'
        }
        onChange={setApiKey}
        onClear={() => void submit({ 'usda.apiKey': null })}
      />

      <div className="flex flex-wrap items-center gap-2.5">
        <button
          type="button"
          onClick={save}
          disabled={busy || apiKey === null}
          className={cn(button())}
        >
          Save
        </button>
        <button
          type="button"
          onClick={() => void test()}
          disabled={busy}
          className={cn(button({ variant: 'secondary' }))}
        >
          <Wheat size={16} aria-hidden />
          Test connection
        </button>
      </div>

      <Outcome error={error} status={status} />
    </section>
  )
}
