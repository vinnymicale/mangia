import { db } from './client'

export interface RecipePhoto {
  data: Uint8Array<ArrayBuffer>
  mimeType: string
}

/**
 * Stores or replaces the photo a recipe was read from.
 *
 * An upsert rather than a create: re-importing over a recipe should leave one
 * photo, not a second row the unique index would reject anyway.
 *
 * The buffer is typed as backing a plain `ArrayBuffer` because Prisma's `Bytes`
 * will not take one that might be shared -- a `SharedArrayBuffer` cannot be
 * handed to the driver safely. A `Buffer` from a request or a base64 decode
 * already satisfies this.
 */
export async function setRecipePhoto(
  recipeId: string,
  data: Uint8Array<ArrayBuffer>,
  mimeType: string,
): Promise<void> {
  await db.recipePhoto.upsert({
    where: { recipeId },
    create: { recipeId, data, mimeType },
    update: { data, mimeType },
  })
}

/**
 * The stored photo, or null when there is none -- which is the common case,
 * since keeping the original is a toggle that defaults to off. An unknown
 * recipe answers null too, so the route can 404 without a try/catch.
 */
export async function getRecipePhoto(recipeId: string): Promise<RecipePhoto | null> {
  const row = await db.recipePhoto.findUnique({ where: { recipeId } })
  return row === null ? null : { data: row.data, mimeType: row.mimeType }
}

/** Whether a recipe has a photo, without pulling its bytes out of the database. */
export async function hasRecipePhoto(recipeId: string): Promise<boolean> {
  const row = await db.recipePhoto.findUnique({
    where: { recipeId },
    select: { id: true },
  })
  return row !== null
}
