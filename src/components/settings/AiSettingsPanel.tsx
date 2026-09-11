'use client'

import { useState } from 'react'
import { Sparkles } from 'lucide-react'
import { button, card } from '@/components/ui'
import { field } from '@/components/ui'
import { cn } from '@/lib/utils'
import { Field, Outcome, SecretField, saveSettings, testConnection } from './SettingsParts'
import type { DescribedConfig } from '@/lib/config'
// Values come from config-shared, not config: importing a runtime value from
// config.ts here would pull the database layer into the browser bundle.
import { PROVIDERS, type ProviderKind } from '@/lib/config-shared'

const PROVIDER_LABELS: Record<ProviderKind, string> = {
  gemini: 'Google Gemini',
  'openai-compatible': 'OpenAI-compatible',
}

/**
 * The AI integration's settings. Saving here takes effect on the next request:
 * `getProvider` re-reads configuration every time it is called, so there is
 * nothing cached to invalidate and nothing to restart.
 */
export function AiSettingsPanel({ initial }: { initial: DescribedConfig['llm'] }) {
  const [llm, setLlm] = useState(initial)
  const [provider, setProvider] = useState<ProviderKind>(initial.provider.value)
  const [model, setModel] = useState(initial.model.value)
  const [baseUrl, setBaseUrl] = useState(initial.baseUrl.value ?? '')
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
    const next = (result.config as DescribedConfig).llm
    setLlm(next)
    setApiKey(null)
    setProvider(next.provider.value)
    setModel(next.model.value)
    setBaseUrl(next.baseUrl.value ?? '')
    setStatus('Saved.')
  }

  function save() {
    const settings: Record<string, string | null> = {
      'llm.provider': provider,
      'llm.model': model.trim() === '' ? null : model.trim(),
      'llm.baseUrl': baseUrl.trim() === '' ? null : baseUrl.trim(),
    }
    // Absent, not null: null would clear a key the user never opened.
    if (apiKey !== null) settings['llm.apiKey'] = apiKey.trim() === '' ? null : apiKey.trim()
    void submit(settings)
  }

  async function test() {
    setBusy(true)
    setError(null)
    setStatus('Testing…')
    setStatus(await testConnection('llm'))
    setBusy(false)
  }

  return (
    <section className={cn(card, 'space-y-5 p-6')}>
      <div className="space-y-1">
        <h2 className="text-[17px] font-semibold text-(--color-ink)">AI integration</h2>
        <p className="text-[13px] text-(--color-ink-2)">
          Used to import a recipe from a URL and to make sense of ingredient lines the parser
          cannot. Mangia works without it; those two features do not.
        </p>
      </div>

      <Field label="Provider" source={llm.provider.source}>
        <select
          aria-label="Provider"
          value={provider}
          onChange={(event) => setProvider(event.target.value as ProviderKind)}
          className={cn(field, 'w-full')}
        >
          {PROVIDERS.map((kind) => (
            <option key={kind} value={kind}>
              {PROVIDER_LABELS[kind]}
            </option>
          ))}
        </select>
      </Field>

      <SecretField
        label="API key"
        value={llm.apiKey}
        placeholder="Paste a new key"
        hint="Shown as its last four characters once saved. The full value never leaves the server."
        onChange={setApiKey}
        onClear={() => void submit({ 'llm.apiKey': null })}
      />

      <Field
        label="Model"
        source={llm.model.source}
        hint="Leave blank for the provider's default."
      >
        <input
          aria-label="Model"
          value={model}
          onChange={(event) => setModel(event.target.value)}
          className={cn(field, 'w-full')}
        />
      </Field>

      {/* Only an OpenAI-compatible endpoint needs an address; Gemini's is fixed. */}
      {provider === 'openai-compatible' && (
        <Field
          label="Base URL"
          source={llm.baseUrl.source}
          hint="For example http://localhost:11434/v1 for a local Ollama."
        >
          <input
            aria-label="Base URL"
            value={baseUrl}
            placeholder="https://…/v1"
            onChange={(event) => setBaseUrl(event.target.value)}
            className={cn(field, 'w-full')}
          />
        </Field>
      )}

      <div className="flex flex-wrap items-center gap-2.5">
        <button type="button" onClick={save} disabled={busy} className={cn(button())}>
          Save
        </button>
        <button
          type="button"
          onClick={() => void test()}
          disabled={busy}
          className={cn(button({ variant: 'secondary' }))}
        >
          <Sparkles size={16} aria-hidden />
          Test connection
        </button>
      </div>

      <Outcome error={error} status={status} />
    </section>
  )
}
