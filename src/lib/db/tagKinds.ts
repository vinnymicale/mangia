import { db } from './client'
import type { TagWithCount } from './tags'
import { TAG_KINDS, isTagKind, type TagKind } from '../tagKinds'

// Re-exported so server-side callers have one import for the taxonomy and the
// queries that use it; the browser reaches for '@/lib/tagKinds' directly.
export { TAG_KINDS, isTagKind }
export type { TagKind }

export interface TagKindGroup {
  kind: TagKind
  tags: TagWithCount[]
}

/**
 * Files a tag under a kind. Returns false for an unknown tag so a route can
 * answer 404 rather than reporting a silent success.
 *
 * Tags are addressed by name, not id: the name is what the user typed, what
 * the browse page filters on, and what a settings row is labelled with.
 */
export async function setTagKind(name: string, kind: TagKind): Promise<boolean> {
  if (!isTagKind(kind)) {
    throw new Error(`Unknown tag kind: ${kind}`)
  }
  const result = await db.tag.updateMany({ where: { name }, data: { kind } })
  return result.count > 0
}

/**
 * Every tag grouped under its kind, with recipe counts carried through so a
 * category can be judged by weight rather than by length.
 *
 * Empty kinds are omitted -- a settings page listing four headings with
 * nothing under them tells the user nothing -- and freeform sorts last,
 * because the unsorted pile should not compete with curated categories.
 */
export async function listTagsByKind(): Promise<TagKindGroup[]> {
  const tags = await db.tag.findMany({
    include: { _count: { select: { recipes: true } } },
    orderBy: { name: 'asc' },
  })

  const groups = new Map<TagKind, TagWithCount[]>()
  for (const tag of tags) {
    // An unrecognised kind in the database falls back to freeform rather than
    // vanishing from the page: a tag the user cannot see is a tag they cannot
    // fix, and the column predates this taxonomy.
    const kind = isTagKind(tag.kind) ? tag.kind : 'freeform'
    const row = { id: tag.id, name: tag.name, count: tag._count.recipes, kind }
    groups.set(kind, [...(groups.get(kind) ?? []), row])
  }

  return TAG_KINDS.filter((kind) => groups.has(kind)).map((kind) => ({
    kind,
    tags: groups.get(kind)!,
  }))
}
