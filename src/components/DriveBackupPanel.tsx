'use client'

import { useState } from 'react'
import { CloudUpload } from 'lucide-react'
import { button } from '@/components/ui'
import { cn } from '@/lib/utils'

export interface DriveStatus {
  configured: boolean
  clientEmail: string | null
  folderId: string | null
  intervalHours: number
  problem: string | null
}

export interface DriveRun {
  at: string
  ok: boolean
  detail: string
}

function when(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

export function DriveBackupPanel({
  status,
  initialRun,
}: {
  status: DriveStatus
  initialRun: DriveRun | null
}) {
  const [run, setRun] = useState(initialRun)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function backUpNow() {
    setBusy(true)
    setError(null)
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

  // Unconfigured is the normal state, not an error: most installations will
  // never set this up, so it explains itself rather than nagging.
  if (!status.configured) {
    return (
      <div className="space-y-3 text-[13px] text-(--color-ink-2)">
        {status.problem !== null && (
          <p role="alert" className="text-(--color-alert)">
            {status.problem}
          </p>
        )}
        <p>
          Automatic backups are off. To turn them on, share a Google Drive folder with a
          service account, then set <code>GOOGLE_DRIVE_CREDENTIALS</code> to the path of its
          key file and <code>GOOGLE_DRIVE_FOLDER_ID</code> to the folder id, and restart
          Mangia.
        </p>
        <p>
          Until then, the download button above is the way to keep a copy of everything.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <dl className="space-y-1 text-[13px] text-(--color-ink-2)">
        <div className="flex gap-2">
          <dt className="text-(--color-ink)">Account</dt>
          <dd className="min-w-0 truncate">{status.clientEmail}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="text-(--color-ink)">Every</dt>
          <dd>{status.intervalHours === 1 ? 'hour' : `${status.intervalHours} hours`}</dd>
        </div>
        {status.folderId === null && (
          <p role="alert" className="pt-1 text-(--color-alert)">
            No folder is set, so uploads will fail. Set <code>GOOGLE_DRIVE_FOLDER_ID</code> to
            a folder shared with that account.
          </p>
        )}
      </dl>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={busy}
          onClick={() => void backUpNow()}
          className={cn(button({ variant: 'secondary' }))}
        >
          <CloudUpload size={16} aria-hidden />
          {busy ? 'Backing up…' : 'Back up now'}
        </button>

        <p role="status" className="text-[13px] text-(--color-ink-2)">
          {run === null
            ? 'No backup has run since Mangia started.'
            : run.ok
              ? `Last backup ${when(run.at)} — ${run.detail}`
              : `Last attempt ${when(run.at)} failed: ${run.detail}`}
        </p>
      </div>

      {error !== null && (
        <p role="alert" className="text-[13px] text-(--color-alert)">
          {error}
        </p>
      )}

      {/* Stated plainly because it is the one thing that will surprise someone
          who assumes this behaves like a cloud backup service. */}
      <p className="text-[13px] text-(--color-ink-2)">
        Backups run only while Mangia is running. If the machine is off at the scheduled
        time, the next backup happens after it starts up again.
      </p>
    </div>
  )
}
