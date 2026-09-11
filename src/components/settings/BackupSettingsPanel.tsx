'use client'

import { useRef, useState } from 'react'
import { CloudUpload, Plug } from 'lucide-react'
import { button, card, field } from '@/components/ui'
import { cn } from '@/lib/utils'
import { Field, Outcome, SecretField, saveSettings, testConnection } from './SettingsParts'
import { ManualBackup } from './ManualBackup'
import type { DescribedConfig } from '@/lib/config'

export interface BackupRun {
  at: string
  ok: boolean
  detail: string
}

function when(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

/**
 * Google Drive backups, plus the manual download and restore.
 *
 * Saving any drive.* value makes the settings route re-register the backup
 * timer from what was just written, so a changed interval or a swapped key is
 * in effect immediately rather than at the next restart.
 */
export function BackupSettingsPanel({
  initial,
  initialRun,
}: {
  initial: DescribedConfig['drive']
  initialRun: BackupRun | null
}) {
  const [drive, setDrive] = useState(initial)
  const [folderId, setFolderId] = useState(initial.folderId.value ?? '')
  const [intervalHours, setIntervalHours] = useState(String(initial.intervalHours.value))
  const [keepCount, setKeepCount] = useState(String(initial.keepCount.value))
  /** Null means "not touched": the key stays out of the update entirely. */
  const [credentials, setCredentials] = useState<string | null>(null)
  const [keyFileName, setKeyFileName] = useState<string | null>(null)
  const [run, setRun] = useState<BackupRun | null>(initialRun)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const keyInput = useRef<HTMLInputElement>(null)

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
    const next = (result.config as DescribedConfig).drive
    setDrive(next)
    setCredentials(null)
    setKeyFileName(null)
    setFolderId(next.folderId.value ?? '')
    setIntervalHours(String(next.intervalHours.value))
    setKeepCount(String(next.keepCount.value))
    setStatus('Saved. Backups are scheduled from these values from now on.')
  }

  function save() {
    const settings: Record<string, string | null> = {
      'drive.folderId': folderId.trim() === '' ? null : folderId.trim(),
      'drive.intervalHours': intervalHours.trim() === '' ? null : intervalHours.trim(),
      'drive.keepCount': keepCount.trim() === '' ? null : keepCount.trim(),
    }
    if (credentials !== null) settings['drive.credentials'] = credentials
    void submit(settings)
  }

  /**
   * The key file is read here and its contents become the value. It is never
   * uploaded as a file and its path is not retained -- picking it is just the
   * motion the user already has, because Google hands the key over as a
   * download.
   */
  async function readKeyFile(file: File) {
    setError(null)
    try {
      const text = await file.text()
      JSON.parse(text)
      setCredentials(text)
      setKeyFileName(file.name)
    } catch {
      setError('That file is not valid JSON. Pick the key file Google gave you.')
    } finally {
      if (keyInput.current) keyInput.current.value = ''
    }
  }

  async function test() {
    setBusy(true)
    setError(null)
    setStatus('Testing…')
    setStatus(await testConnection('drive'))
    setBusy(false)
  }

  async function backUpNow() {
    setBusy(true)
    setError(null)
    setStatus(null)
    try {
      const response = await fetch('/api/backup/drive', { method: 'POST' })
      const body = await response.json()
      if (!response.ok) throw new Error(body?.error ?? 'The backup failed.')
      setRun(body.lastRun)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The backup failed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className={cn(card, 'space-y-5 p-6')}>
      <div className="space-y-1">
        <h2 className="text-[17px] font-semibold text-(--color-ink)">Backups</h2>
        <p className="text-[13px] text-(--color-ink-2)">
          A Google service account uploads a copy of everything to one Drive folder on a schedule.
          Create the account in the Google Cloud console, download its key, then share the folder
          with the account&rsquo;s address.
        </p>
      </div>

      <SecretField
        label="Service account key"
        value={drive.credentials}
        hint="Shown as the service account's address once set. That is the address the Drive folder must be shared with."
        onChange={(next) => {
          setCredentials(next)
          if (next === null) setKeyFileName(null)
        }}
        onClear={() => void submit({ 'drive.credentials': null })}
      >
        {() => (
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => keyInput.current?.click()}
              className={cn(button({ variant: 'secondary' }))}
            >
              Choose key file
            </button>
            <span className="min-w-0 truncate text-[13px] text-(--color-ink-2)">
              {keyFileName ?? 'No file chosen'}
            </span>
            <input
              ref={keyInput}
              type="file"
              accept="application/json,.json"
              className="sr-only"
              aria-label="Service account key file"
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) void readKeyFile(file)
              }}
            />
          </div>
        )}
      </SecretField>

      <Field
        label="Drive folder id"
        source={drive.folderId.source}
        hint="The last part of the folder's URL in Drive."
      >
        <input
          aria-label="Drive folder id"
          value={folderId}
          onChange={(event) => setFolderId(event.target.value)}
          className={cn(field, 'w-full')}
        />
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Back up every" source={drive.intervalHours.source} hint="Hours.">
          <input
            aria-label="Back up every"
            type="number"
            min={1}
            value={intervalHours}
            onChange={(event) => setIntervalHours(event.target.value)}
            className={cn(field, 'w-full')}
          />
        </Field>
        <Field
          label="Keep"
          source={drive.keepCount.source}
          hint="Archives. Older ones are deleted after each run."
        >
          <input
            aria-label="Keep"
            type="number"
            min={1}
            value={keepCount}
            onChange={(event) => setKeepCount(event.target.value)}
            className={cn(field, 'w-full')}
          />
        </Field>
      </div>

      {drive.problem !== null && (
        <p role="alert" className="text-[13px] text-(--color-alert)">
          {drive.problem}
        </p>
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
          <Plug size={16} aria-hidden />
          Test connection
        </button>
        <button
          type="button"
          onClick={() => void backUpNow()}
          disabled={busy || !drive.configured}
          className={cn(button({ variant: 'secondary' }))}
        >
          <CloudUpload size={16} aria-hidden />
          {busy ? 'Working…' : 'Back up now'}
        </button>
      </div>

      <Outcome error={error} status={status} />

      {run !== null && (
        <p role="status" className="text-[13px] text-(--color-ink-2)">
          {run.ok
            ? `Last backup ${when(run.at)} — ${run.detail}`
            : `Last attempt ${when(run.at)} failed — ${run.detail}`}
        </p>
      )}

      <p className="text-[13px] text-(--color-ink-2)">
        Backups run only while Mangia is running. If the machine is off at the scheduled time, the
        next backup happens after it starts up again.
      </p>

      {/* The by-hand path, which needs no Google account at all. */}
      <div className="space-y-3 border-t border-(--color-border) pt-5">
        <h3 className="text-[15px] font-semibold text-(--color-ink)">By hand</h3>
        <ManualBackup />
      </div>
    </section>
  )
}
