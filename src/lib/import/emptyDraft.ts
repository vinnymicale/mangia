/**
 * Whether a draft is one nobody can cook from.
 *
 * No ingredients and no method means the extraction found a source, read it,
 * and got nothing out of it -- a failure wearing a success's clothes, which is
 * how a misclassified TikTok link once imported as a blank form without ever
 * reporting an error. Either half alone is enough to keep the draft: a page
 * that yielded steps but no parsable ingredient list is still worth handing
 * over. A title is not, since every scraper produces one from `<title>`.
 *
 * The parameter is structural rather than a `RecipeDraft`/`OcrDraft` union so
 * one function serves both shapes with no cast at the call site.
 */
export function isEmptyDraft(draft: {
  instructions?: string
  ingredients?: readonly unknown[]
  notes?: string | null
}): boolean {
  if ((draft.ingredients?.length ?? 0) > 0) return false
  if ((draft.instructions ?? '').trim() !== '') return false
  // Photo imports park text they could not place here rather than discarding
  // it, so a draft with notes has something for the user to sort out after all.
  return (draft.notes ?? '').trim() === ''
}
