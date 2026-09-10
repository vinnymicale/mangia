'use client'

import { useRef, useState } from 'react'
import { Download, Upload } from 'lucide-react'
import { button } from '@/components/ui'
import { cn } from '@/lib/utils'

interface ImportOutcome {
  imported: number
  skipped: number
}

export function BackupEditor() {
  const fileInput = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [outcome, setOutcome] = useState<ImportOutcome | null>(null)

  async function restore(file: File) {
    setBusy(true)
    setError(null)
    setOutcome(null)
    try {
      // Sent as text rather than parsed here: the server has to validate the
      // envelope anyway, and a malformed file should fail in one place.
      const response = await fetch('/api/backup', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: await file.text(),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body?.error ?? 'Could not read that file.')
      setOutcome({ imported: body.imported, skipped: body.skipped })
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not read that file.')
    } finally {
      setBusy(false)
      // Cleared so picking the same file again re-fires the change event.
      if (fileInput.current) fileInput.current.value = ''
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2.5">
        {/* A plain link, not fetch: the browser's own download handling is what
            turns the response into a saved file, and it needs no JavaScript. */}
        <a href="/api/backup" className={cn(button({ variant: 'secondary' }))} download>
          <Download size={16} aria-hidden />
          Download a backup
        </a>

        <button
          type="button"
          disabled={busy}
          onClick={() => fileInput.current?.click()}
          className={cn(button({ variant: 'secondary' }))}
        >
          <Upload size={16} aria-hidden />
          {busy ? 'Restoring…' : 'Restore from a file'}
        </button>

        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          className="sr-only"
          aria-label="Backup file"
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) void restore(file)
          }}
        />
      </div>

      {error !== null && (
        <p role="alert" className="text-[13px] text-(--color-alert)">
          {error}
        </p>
      )}

      {outcome !== null && (
        <p role="status" className="text-[13px] text-(--color-ink-2)">
          Added {outcome.imported === 1 ? '1 recipe' : `${outcome.imported} recipes`}
          {outcome.skipped > 0 && `, skipped ${outcome.skipped} without a title`}.{' '}
          Restoring adds recipes rather than replacing them, so anything already
          here is untouched.
        </p>
      )}
    </div>
  )
}
