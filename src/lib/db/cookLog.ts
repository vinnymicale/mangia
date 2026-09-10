import { db } from './client'

export interface CookLogEntry {
  id: string
  cookedAt: Date
  note: string | null
}

export interface RecentCook extends CookLogEntry {
  recipeId: string
  title: string
}

export interface CookStat {
  recipeId: string
  title: string
  count: number
  lastCookedAt: Date
}

/**
 * Recomputes Recipe.lastCookedAt from the log. The column is denormalised --
 * it backs the "cooked" sort and the cooking view's badge -- so anything that
 * changes the log has to put it back in agreement, including downwards when
 * the most recent cook is deleted.
 */
async function syncLastCooked(tx: typeof db, recipeId: string): Promise<void> {
  const latest = await tx.cookLog.findFirst({
    where: { recipeId },
    orderBy: { cookedAt: 'desc' },
  })
  await tx.recipe.update({
    where: { id: recipeId },
    data: { lastCookedAt: latest?.cookedAt ?? null },
  })
}

/**
 * Records one cook. Returns null for an unknown recipe so the route can answer
 * 404 rather than letting the foreign key become a 500.
 *
 * `cookedAt` is settable so a cook can be written down after the fact, which is
 * when people actually reach for a log.
 */
export async function logCook(
  recipeId: string,
  { cookedAt, note }: { cookedAt?: Date; note?: string | null },
): Promise<CookLogEntry | null> {
  return db.$transaction(async (tx) => {
    const recipe = await tx.recipe.findUnique({ where: { id: recipeId } })
    if (recipe === null) return null

    const entry = await tx.cookLog.create({
      data: { recipeId, cookedAt: cookedAt ?? new Date(), note: note ?? null },
    })
    await syncLastCooked(tx as typeof db, recipeId)
    return { id: entry.id, cookedAt: entry.cookedAt, note: entry.note }
  })
}

/** One recipe's history, newest first. */
export async function listCookLog(recipeId: string): Promise<CookLogEntry[]> {
  const rows = await db.cookLog.findMany({
    where: { recipeId },
    orderBy: { cookedAt: 'desc' },
  })
  return rows.map((row) => ({ id: row.id, cookedAt: row.cookedAt, note: row.note }))
}

/** Removes one entry. Returns false for an unknown id so the route can 404. */
export async function deleteCookLogEntry(id: string): Promise<boolean> {
  return db.$transaction(async (tx) => {
    const entry = await tx.cookLog.findUnique({ where: { id } })
    if (entry === null) return false

    await tx.cookLog.delete({ where: { id } })
    await syncLastCooked(tx as typeof db, entry.recipeId)
    return true
  })
}

/** The kitchen diary: every recipe's cooks interleaved, newest first. */
export async function recentCooks(limit = 50): Promise<RecentCook[]> {
  const rows = await db.cookLog.findMany({
    orderBy: { cookedAt: 'desc' },
    take: limit,
    include: { recipe: { select: { id: true, title: true } } },
  })
  return rows.map((row) => ({
    id: row.id,
    cookedAt: row.cookedAt,
    note: row.note,
    recipeId: row.recipe.id,
    title: row.recipe.title,
  }))
}

/**
 * How often each recipe has been made, busiest first. This is the question
 * lastCookedAt could never answer: a single timestamp cannot distinguish the
 * dish cooked thirty times from the one cooked once, last Tuesday.
 */
export async function cookStats(): Promise<CookStat[]> {
  const grouped = await db.cookLog.groupBy({
    by: ['recipeId'],
    _count: { _all: true },
    _max: { cookedAt: true },
  })
  if (grouped.length === 0) return []

  const titles = new Map(
    (
      await db.recipe.findMany({
        where: { id: { in: grouped.map((row) => row.recipeId) } },
        select: { id: true, title: true },
      })
    ).map((row) => [row.id, row.title]),
  )

  return grouped
    .map((row) => ({
      recipeId: row.recipeId,
      title: titles.get(row.recipeId) ?? '(deleted)',
      count: row._count._all,
      lastCookedAt: row._max.cookedAt!,
    }))
    // Sorted here rather than in SQL: Prisma cannot order a groupBy by its own
    // count, and the number of distinct recipes cooked is small. Ties fall back
    // to most-recent so the order is stable and useful.
    .sort((a, b) => b.count - a.count || b.lastCookedAt.getTime() - a.lastCookedAt.getTime())
}

/**
 * Recipes that have not been made in a while, longest-neglected first. Recipes
 * never cooked at all are excluded: they are a different question ("have I ever
 * made this?") and would otherwise swamp the list.
 */
export async function staleRecipes(limit = 20): Promise<CookStat[]> {
  const stats = await cookStats()
  return stats
    .slice()
    .sort((a, b) => a.lastCookedAt.getTime() - b.lastCookedAt.getTime())
    .slice(0, limit)
}
