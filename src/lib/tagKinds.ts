/**
 * The taxonomy. A closed set rather than a free string column: the point of
 * classifying tags is to impose structure on a list that grew organically, and
 * a column anyone can write anything into would drift straight back into the
 * free-for-all it exists to organise.
 *
 * freeform is the schema default and the pile everything starts in, so it is
 * always assignable -- a tag has to be able to go back to being uncategorised.
 *
 * This lives outside lib/db on purpose. The settings row that files a tag is a
 * client component, and anything it imports is bundled for the browser; a
 * module that also reached for the Prisma client would drag better-sqlite3 --
 * and its native bindings -- into that bundle and fail the build outright.
 */
export const TAG_KINDS = ['cuisine', 'course', 'season', 'method', 'diet', 'freeform'] as const

export type TagKind = (typeof TAG_KINDS)[number]

export function isTagKind(value: string): value is TagKind {
  return (TAG_KINDS as readonly string[]).includes(value)
}
