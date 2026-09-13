import { getRecipePhoto, isPhotoMimeType } from '@/lib/db/photos'

/**
 * Serves the photo a recipe was read from.
 *
 * `private` because a photo of someone's recipe card is theirs, and `immutable`
 * because the photo is written once at save time and never edited afterwards --
 * re-importing writes a new recipe, not a new photo under the same id.
 *
 * The stored type is re-checked here rather than trusted. Storage already
 * rejects anything outside the allowlist, but this route hands bytes back under
 * a type on the app's own origin, so it does not rely on a single upstream
 * check to decide whether the browser will treat those bytes as a document.
 * `nosniff` and the sandbox policy close the same door from the other side.
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
      'content-type': isPhotoMimeType(photo.mimeType)
        ? photo.mimeType
        : 'application/octet-stream',
      'content-length': String(photo.data.byteLength),
      'content-disposition': 'inline; filename="photo"',
      'x-content-type-options': 'nosniff',
      'content-security-policy': "default-src 'none'; sandbox",
      'cache-control': 'private, max-age=31536000, immutable',
    },
  })
}
