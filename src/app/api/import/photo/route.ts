import { NextResponse } from 'next/server'
import { importFromPhoto } from '@/lib/import/photoImporter'
import { PHOTO_MIME_TYPES } from '@/lib/db/photos'

/**
 * Formats browsers can reliably canvas-decode and every vision model accepts.
 * HEIC is deliberately absent: it would need a server-side converter.
 *
 * Shared with storage rather than restated, so what may be uploaded and what
 * may be stored and served cannot drift apart.
 */
const ACCEPTED = new Set<string>(PHOTO_MIME_TYPES)

/** Generous for a downscaled photo, and a hard stop on an original off a phone. */
const MAX_BYTES = 10 * 1024 * 1024

/**
 * A `photo` entry that carries bytes, a type, and a size.
 *
 * Deliberately structural rather than `instanceof File`: the runtime that
 * parses the body and the one that defines the global `File` are not always
 * the same realm, and a cross-realm check fails on a perfectly good upload.
 * What the route needs from the entry is exactly these three members.
 */
interface UploadedFile {
  type: string
  size: number
  arrayBuffer(): Promise<ArrayBuffer>
}

function isUploadedFile(value: unknown): value is UploadedFile {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as UploadedFile).type === 'string' &&
    typeof (value as UploadedFile).size === 'number' &&
    typeof (value as UploadedFile).arrayBuffer === 'function'
  )
}

export async function POST(request: Request) {
  const form = await request.formData().catch(() => null)
  const file = form?.get('photo')

  if (!isUploadedFile(file)) {
    return NextResponse.json(
      { error: 'Expected a "photo" file upload.' },
      { status: 400 },
    )
  }
  if (!ACCEPTED.has(file.type)) {
    return NextResponse.json(
      { error: 'That file type is not supported. Use a JPEG, PNG, or WebP.' },
      { status: 400 },
    )
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: 'That photo is larger than 10MB. Try a smaller one.' },
      { status: 400 },
    )
  }

  const image = Buffer.from(await file.arrayBuffer())

  try {
    return NextResponse.json(await importFromPhoto(image, file.type))
  } catch (error) {
    // Anything reaching here is an engine or network failure, not bad input:
    // the importer has already fallen back as far as it can.
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
