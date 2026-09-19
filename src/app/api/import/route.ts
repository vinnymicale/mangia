import { NextResponse } from 'next/server'
import { z } from 'zod'
import { importFromUrl } from '@/lib/import/webImporter'
import { importFromVideo } from '@/lib/import/videoImporter'
import { classifyUrl } from '@/lib/import/videoUrl'

const BodySchema = z.object({ url: z.string().min(1) })

// Reading a video can mean a download plus a model watching it end to end,
// which runs well past the default limit an article read never approaches.
export const maxDuration = 300

export async function POST(request: Request) {
  const parsed = BodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Expected a "url" field.' }, { status: 400 })
  }

  const { url } = parsed.data

  try {
    // The kind is decided here rather than by the client: the UI has one URL
    // box, and anything not recognised as a video is read as a page.
    const result =
      classifyUrl(url).kind === 'video'
        ? await importFromVideo(url)
        : await importFromUrl(url)
    return NextResponse.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: `Import failed: ${message}` }, { status: 502 })
  }
}
