import { NextResponse } from 'next/server'
import { exportRecipe } from '@/lib/db/transfer'

/** Lowercased, punctuation-free title so the saved file is recognisable. */
function fileName(title: string): string {
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  return `${slug === '' ? 'recipe' : slug}.json`
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const document = await exportRecipe(id)
  if (document === null) {
    return NextResponse.json({ error: 'No such recipe.' }, { status: 404 })
  }

  return new NextResponse(JSON.stringify(document, null, 2), {
    headers: {
      'content-type': 'application/json',
      'content-disposition': `attachment; filename="${fileName(document.recipe.title)}"`,
    },
  })
}
