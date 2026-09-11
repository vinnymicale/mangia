import { listStaples } from '@/lib/db/staples'
import { listTagsWithCounts } from '@/lib/db/tags'
import { StaplesEditor } from '@/components/StaplesEditor'
import { TagsEditor } from '@/components/TagsEditor'
import { PageTitle } from '@/components/ui'

export const dynamic = 'force-dynamic'

/**
 * Food-domain curation. Application configuration lives at /settings; the two
 * were one page until settings grew real controls, and the split is by subject
 * rather than by storage: nothing here is about how Mangia is wired up.
 */
export default async function StaplesPage() {
  const [staples, tags] = await Promise.all([listStaples(), listTagsWithCounts()])

  return (
    <>
      <PageTitle lede="Things you always have. New shopping lists leave them off by default.">
        Staples
      </PageTitle>
      <StaplesEditor initial={staples.map(({ id, name }) => ({ id, name }))} />

      {/* Tags accumulate typos and near-duplicates because they are created
          implicitly by saving a recipe. This is the only place to tidy them. */}
      <section className="mt-14">
        <PageTitle lede="Rename a tag to fix a typo, or rename it onto an existing tag to merge the two.">
          Tags
        </PageTitle>
        <TagsEditor initial={tags} />
      </section>
    </>
  )
}
