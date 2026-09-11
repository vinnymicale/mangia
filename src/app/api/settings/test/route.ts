import { NextResponse } from 'next/server'
import { z } from 'zod'
import { resolveConfig } from '@/lib/config'
import { buildProvider } from '@/lib/llm'
import { checkAccess } from '@/lib/backup/drive'

const PostSchema = z.object({ target: z.enum(['llm', 'drive']) })

/**
 * Tests the live configuration by using it, not by inspecting it. A key that
 * parses and a key that works are different things, and only the round trip
 * tells them apart.
 *
 * A failed test is a 200 with `ok: false` and the upstream message, matching
 * how api/backup/drive already reports a failed run: the request succeeded, and
 * the message is the answer the page asked for.
 */
export async function POST(request: Request) {
  const parsed = PostSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Expected a "target" of "llm" or "drive".' }, { status: 400 })
  }

  const config = await resolveConfig()

  try {
    if (parsed.data.target === 'llm') {
      const provider = buildProvider(config.llm)
      // The smallest real call the interface offers. One trivial line is enough
      // to prove the key, the model name, and the endpoint all resolve.
      await provider.parseIngredientLines(['1 cup flour'])
      return NextResponse.json({ ok: true, detail: `${provider.name} answered.` })
    }

    if (config.drive.key === null) {
      return NextResponse.json({
        ok: false,
        detail: config.drive.problem ?? 'No Google service account key is set.',
      })
    }
    const name = await checkAccess(config.drive.key, config.drive.folderId)
    return NextResponse.json({ ok: true, detail: `Connected to "${name}".` })
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'The test failed.'
    return NextResponse.json({ ok: false, detail })
  }
}
