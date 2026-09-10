import { NextResponse } from 'next/server'
import { exportAll, importRecipeDocument } from '@/lib/db/transfer'

/** Filenames sort chronologically, which matters once a folder has many. */
function archiveName(): string {
  const stamp = new Date().toISOString().slice(0, 10)
  return `mangia-backup-${stamp}.json`
}

export async function GET() {
  const document = await exportAll()
  return new NextResponse(JSON.stringify(document, null, 2), {
    headers: {
      'content-type': 'application/json',
      // Attachment rather than inline: the browser should save this, not
      // render a megabyte of JSON in a tab.
      'content-disposition': `attachment; filename="${archiveName()}"`,
    },
  })
}

export async function POST(request: Request) {
  const document = await request.json().catch(() => null)
  if (document === null) {
    return NextResponse.json({ error: 'That file is not valid JSON.' }, { status: 400 })
  }

  try {
    const result = await importRecipeDocument(document)
    return NextResponse.json(result)
  } catch (error) {
    // A rejected document is the user picking the wrong file, not a server
    // fault, so the message goes back verbatim for them to act on.
    const message = error instanceof Error ? error.message : 'Could not read that file.'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
