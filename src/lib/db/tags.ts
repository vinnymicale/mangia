import { db } from './client'
import { isTagKind, type TagKind } from '../tagKinds'

export interface TagWithCount {
  id: string
  name: string
  count: number
  /** The taxonomy slot. Anything unrecognised reads as freeform. */
  kind: TagKind
}

/**
 * Every tag with the number of recipes carrying it, busiest first. The count is
 * what makes the list actionable: a tag on one recipe is usually the typo, and
 * the one on thirty is the real category.
 */
export async function listTagsWithCounts(): Promise<TagWithCount[]> {
  const tags = await db.tag.findMany({
    include: { _count: { select: { recipes: true } } },
    orderBy: { name: 'asc' },
  })
  return tags
    .map((tag) => ({
      id: tag.id,
      name: tag.name,
      count: tag._count.recipes,
      // Falls back rather than vanishing: the column predates this taxonomy,
      // and a tag the user cannot see is a tag they cannot fix.
      kind: isTagKind(tag.kind) ? tag.kind : ('freeform' as const),
    }))
    // Sorted here rather than in SQL: Prisma cannot order by a relation count
    // and the tag list is small enough that it does not matter. Ties fall back
    // to the name so the order is stable between renders.
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
}

export type RenameOutcome = 'renamed' | 'merged' | 'missing' | 'invalid'

/**
 * Renames a tag, absorbing it into the existing one when the target name is
 * already taken -- which is how two spellings of the same idea get merged.
 * Reports which of the two happened so the caller can say so, since a merge
 * silently loses a tag the user may not have realised existed.
 */
export async function renameTag(
  id: string,
  rawName: string,
): Promise<RenameOutcome> {
  const name = rawName.trim()
  if (name === '') return 'invalid'

  return db.$transaction(async (tx) => {
    const tag = await tx.tag.findUnique({ where: { id } })
    if (tag === null) return 'missing'
    if (tag.name === name) return 'renamed'

    const target = await tx.tag.findUnique({ where: { name } })
    if (target === null) {
      await tx.tag.update({ where: { id }, data: { name } })
      return 'renamed'
    }

    // Move only the links the target does not already have: a recipe carrying
    // both tags would otherwise collide on the composite primary key.
    const moving = await tx.recipeTag.findMany({ where: { tagId: id } })
    const alreadyThere = new Set(
      (await tx.recipeTag.findMany({ where: { tagId: target.id } })).map(
        (row) => row.recipeId,
      ),
    )
    await tx.recipeTag.createMany({
      data: moving
        .filter((row) => !alreadyThere.has(row.recipeId))
        .map((row) => ({ recipeId: row.recipeId, tagId: target.id })),
    })
    // The old tag's own links go with it by cascade.
    await tx.tag.delete({ where: { id } })
    return 'merged'
  })
}

/**
 * Removes a tag. The RecipeTag rows cascade, so the recipes themselves are
 * untouched -- they simply lose the label. Returns false for an unknown id so
 * the route can answer 404.
 */
export async function deleteTag(id: string): Promise<boolean> {
  const { count } = await db.tag.deleteMany({ where: { id } })
  return count > 0
}
