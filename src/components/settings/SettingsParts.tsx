'use client'

import { useState, type ReactNode } from 'react'
import { button, field, label as labelClass } from '@/components/ui'
import { cn } from '@/lib/utils'

/** Mirrors `MaskedValue` in lib/config.ts. */
export interface MaskedValue {
  set: boolean
  mask: string | null
  source: 'db' | 'env' | 'default' | 'unset'
}

export type Source = MaskedValue['source']

/**
 * Says where a value comes from, but only when that is worth knowing. A value
 * saved here needs no explanation; one arriving from the environment does,
 * because editing it moves the setting into the database and the .env entry
 * stops mattering -- worth knowing before you type over it.
 */
export function SourceNote({ source }: { source: Source }) {
  if (source !== 'env') return null
  return <span className="text-[12px] font-normal text-(--color-ink-2)">from the environment</span>
}

export function Field({
  label,
  hint,
  source,
  children,
}: {
  label: string
  hint?: ReactNode
  source?: Source
  children: ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-baseline gap-2">
        <span className={labelClass}>{label}</span>
        {source !== undefined && <SourceNote source={source} />}
      </div>
      {children}
      {hint !== undefined && <p className="text-[13px] text-(--color-ink-2)">{hint}</p>}
    </div>
  )
}

/**
 * A secret that is already stored, shown as its mask with a way to replace it.
 *
 * The mask is never editable and never submitted. Replacing swaps in an empty
 * input, so what the server receives is either a genuinely new value or no
 * mention of the key at all -- there is no path by which a mask can be saved
 * back over the real value it stands for.
 */
export function SecretField({
  label,
  value,
  placeholder,
  hint,
  onChange,
  onClear,
  children,
}: {
  label: string
  value: MaskedValue
  placeholder?: string
  hint?: ReactNode
  /** The new secret, or null when the user backs out of replacing. */
  onChange: (next: string | null) => void
  onClear: () => void
  /** Replaces the plain text input, for the Drive key's file picker. */
  children?: () => ReactNode
}) {
  const [replacing, setReplacing] = useState(false)

  function stopReplacing() {
    setReplacing(false)
    onChange(null)
  }

  if (value.set && !replacing) {
    return (
      <Field label={label} source={value.source} hint={hint}>
        <div className="flex flex-wrap items-center gap-2.5">
          <code className="min-w-0 flex-1 truncate rounded-[7px] border border-(--color-border) bg-(--color-surface) px-3.5 py-2.5 text-[13px] text-(--color-ink-2)">
            {value.mask ?? 'set'}
          </code>
          <button
            type="button"
            onClick={() => setReplacing(true)}
            className={cn(button({ variant: 'secondary' }))}
          >
            Replace
          </button>
          <button type="button" onClick={onClear} className={cn(button({ variant: 'ghost' }))}>
            Clear
          </button>
        </div>
      </Field>
    )
  }

  return (
    <Field label={label} hint={hint}>
      <div className="flex flex-wrap items-center gap-2.5">
        {children === undefined ? (
          <input
            type="password"
            aria-label={label}
            placeholder={placeholder}
            autoComplete="off"
            className={cn(field, 'min-w-0 flex-1')}
            onChange={(event) => onChange(event.target.value)}
          />
        ) : (
          children()
        )}
        {value.set && (
          <button type="button" onClick={stopReplacing} className={cn(button({ variant: 'ghost' }))}>
            Cancel
          </button>
        )}
      </div>
    </Field>
  )
}

/** The outcome lines shared by every panel: one error slot, one status slot. */
export function Outcome({ error, status }: { error: string | null; status: string | null }) {
  return (
    <>
      {error !== null && (
        <p role="alert" className="text-[13px] text-(--color-alert)">
          {error}
        </p>
      )}
      {status !== null && (
        <p role="status" className="text-[13px] text-(--color-ink-2)">
          {status}
        </p>
      )}
    </>
  )
}

/**
 * Saves a partial update. Shared because both panels have the same contract
 * with the route: send only the keys that changed, take the refreshed
 * description back, and report in one line what happened.
 */
export async function saveSettings(
  settings: Record<string, string | null>,
): Promise<{ ok: true; config: unknown } | { ok: false; error: string }> {
  try {
    const response = await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ settings }),
    })
    const body = await response.json()
    if (!response.ok) return { ok: false, error: body?.error ?? 'That could not be saved.' }
    return { ok: true, config: body }
  } catch {
    return { ok: false, error: 'That could not be saved.' }
  }
}

/** Runs a connection test. A failed test is a normal answer, not an error. */
export async function testConnection(target: 'llm' | 'drive'): Promise<string> {
  try {
    const response = await fetch('/api/settings/test', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ target }),
    })
    const body = await response.json()
    return body?.detail ?? body?.error ?? 'The test gave no answer.'
  } catch {
    return 'The test could not be run.'
  }
}
