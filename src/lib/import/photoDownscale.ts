/**
 * Shrinks a photo before it is uploaded or stored.
 *
 * A phone camera file is several megabytes at a resolution no vision model or
 * OCR engine benefits from. Two sizes are used: a larger one for parsing
 * accuracy and a smaller one for the copy kept with the recipe.
 *
 * Returns the original file untouched when the browser cannot decode or encode
 * it. That is a real case -- an exotic codec, a canvas the browser refuses to
 * export -- and it is also what makes this callable under jsdom, where there is
 * no canvas at all: the fallback is the tested path there, and the server
 * revalidates the type regardless.
 */
export async function downscale(
  file: File,
  maxEdge: number,
  quality: number,
): Promise<{ blob: Blob; mimeType: string }> {
  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)

    const context = canvas.getContext('2d')
    if (context === null) throw new Error('No 2d context.')
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    bitmap.close()

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', quality),
    )
    if (blob === null) throw new Error('Canvas would not encode.')
    return { blob, mimeType: 'image/jpeg' }
  } catch {
    return { blob: file, mimeType: file.type }
  }
}

/** The base64 body of a blob, without the `data:<type>;base64,` prefix. */
export async function toBase64(blob: Blob): Promise<string> {
  // FileReader rather than `blob.arrayBuffer()`: it is the one reader present
  // in every browser and in jsdom, and it emits the base64 directly, so the
  // bytes are never walked in JavaScript on the way through.
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(reader.error ?? new Error('Could not read the photo.'))
    reader.onload = () => resolve(String(reader.result))
    reader.readAsDataURL(blob)
  })
  return dataUrl.slice(dataUrl.indexOf(',') + 1)
}
