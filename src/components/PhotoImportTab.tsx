'use client'

import { useEffect, useRef, useState } from 'react'
import { downscale, toBase64 } from '@/lib/import/photoDownscale'
import { button, field, label as labelClass } from '@/components/ui'
import { cn } from '@/lib/utils'
import { EMPTY_RECIPE, type RecipeFormValue } from './RecipeForm'
import type { OcrDraft } from '@/lib/import/ocrStructure'

/**
 * Large enough that a vision model and the OCR engine can both still read a
 * handwritten card, small enough that a phone photo does not spend ten seconds
 * on the wire.
 */
const PARSE_EDGE = 1600
const PARSE_QUALITY = 0.9

/** The kept copy is only ever looked at by a person, so it can be smaller. */
const STORE_EDGE = 1200
const STORE_QUALITY = 0.8

const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp']
const MAX_BYTES = 10 * 1024 * 1024

export interface PhotoImportOutcome {
  value: RecipeFormValue
  method: 'vision' | 'ocr'
  /** What OCR actually read, so the cook can check the parse against it. */
  rawText?: string
  /** An object URL for the chosen file, shown above the form. */
  previewUrl: string
}

/**
 * The server already returns fully-formed ingredient rows; the fallbacks here
 * are only for a draft that came back thinner than expected, never the norm.
 */
export function toFormValue(
  draft: OcrDraft,
  photo: { data: string; mimeType: string } | null,
): RecipeFormValue {
  return {
    ...EMPTY_RECIPE,
    title: draft.title ?? '',
    description: draft.description ?? null,
    instructions: draft.instructions ?? '',
    notes: draft.notes ?? null,
    servings: draft.servings ?? null,
    prepMinutes: draft.prepMinutes ?? null,
    cookMinutes: draft.cookMinutes ?? null,
    tags: draft.tags ?? [],
    ingredients: (draft.ingredients ?? []).map((row) => ({
      ...row,
      rawText: row.rawText || row.ingredient,
      // Everything off a photo is worth a second look, so an unmarked row is
      // treated as uncertain rather than trusted.
      confidence: row.confidence ?? 'low',
    })),
    photo,
  }
}

export function PhotoImportTab({
  onParsed,
}: {
  onParsed: (outcome: PhotoImportOutcome) => void
}) {
  const [file, setFile] = useState<File | null>(null)
  const [keepPhoto, setKeepPhoto] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // The preview URL outlives this component -- the page shows it above the
  // form -- so only an abandoned one is revoked.
  const handedOff = useRef(false)
  const previewUrl = useRef<string | null>(null)
  useEffect(
    () => () => {
      if (!handedOff.current && previewUrl.current) URL.revokeObjectURL(previewUrl.current)
    },
    [],
  )

  function choose(chosen: File | null) {
    setError(null)
    if (chosen === null) return setFile(null)

    if (!ACCEPTED.includes(chosen.type)) {
      setFile(null)
      return setError('That file type is not supported. Use a JPEG, PNG, or WebP.')
    }
    if (chosen.size > MAX_BYTES) {
      setFile(null)
      return setError('That photo is larger than 10MB. Try a smaller one.')
    }
    setFile(chosen)
  }

  async function read() {
    if (file === null) return
    setBusy(true)
    setError(null)
    try {
      const parseCopy = await downscale(file, PARSE_EDGE, PARSE_QUALITY)

      const form = new FormData()
      // The field name the route reads. Anything else is a 400.
      form.set('photo', parseCopy.blob, 'photo')

      const response = await fetch('/api/import/photo', { method: 'POST', body: form })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error ?? 'That photo could not be read.')

      // Downscaled separately from the parse copy: the stored one trades a
      // little detail for a much smaller row in the database.
      const kept = keepPhoto ? await downscale(file, STORE_EDGE, STORE_QUALITY) : null

      previewUrl.current = URL.createObjectURL(file)
      handedOff.current = true
      onParsed({
        value: toFormValue(
          body.draft,
          kept && { data: await toBase64(kept.blob), mimeType: kept.mimeType },
        ),
        method: body.method,
        rawText: body.rawText,
        previewUrl: previewUrl.current,
      })
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-5">
      <p className="max-w-xl text-sm text-(--color-ink-2)">
        Photograph the whole card, straight on and well lit. Mangia reads it with
        the configured AI model when there is one, and falls back to on-device
        text recognition otherwise. You will see the result before anything is
        saved.
      </p>

      <label className="block max-w-xl">
        <span className={labelClass}>Photo</span>
        <input
          type="file"
          aria-label="Recipe photo"
          accept={ACCEPTED.join(',')}
          className={cn(field, 'mt-1.5 file:mr-3 file:rounded-md file:border-0 file:bg-(--color-surface-2) file:px-3 file:py-1.5 file:text-sm')}
          onChange={(event) => choose(event.target.files?.[0] ?? null)}
        />
      </label>

      <label className="flex max-w-xl items-start gap-2.5 text-sm text-(--color-ink-2)">
        <input
          type="checkbox"
          className="mt-0.5"
          checked={keepPhoto}
          onChange={(event) => setKeepPhoto(event.target.checked)}
        />
        <span>
          Keep the original photo with the recipe
          <span className="block text-(--color-ink-3)">
            Handy for a handwritten card in a familiar hand. It is stored shrunk
            down, and off by default.
          </span>
        </span>
      </label>

      {error && (
        <p
          role="alert"
          className="max-w-xl rounded-lg bg-(--color-alert-soft) px-4 py-3 text-sm text-(--color-alert)"
        >
          {error}
        </p>
      )}

      <button
        type="button"
        disabled={file === null || busy}
        onClick={() => void read()}
        className={button()}
      >
        {busy ? 'Reading…' : 'Read photo'}
      </button>
    </div>
  )
}
