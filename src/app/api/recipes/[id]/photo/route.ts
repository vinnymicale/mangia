import { getRecipePhoto } from '@/lib/db/photos'

/**
 * Serves the photo a recipe was read from.
 *
 * `private` because a photo of someone's recipe card is theirs, and `immutable`
 * because the photo is written once at save time and never edited afterwards --
 * re-importing writes a new recipe, not a new photo under the same id.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const photo = await getRecipePhoto(id)
  if (photo === null) {
    return new Response('Not found.', { status: 404 })
  }

  return new Response(new Uint8Array(photo.data), {
    headers: {
      'content-type': photo.mimeType,
      'content-length': String(photo.data.byteLength),
      'cache-control': 'private, max-age=31536000, immutable',
    },
  })
}
