import Link from 'next/link'
import { PantrySearch } from '@/components/PantrySearch'
import { PageTitle } from '@/components/ui'

/**
 * Deliberately its own route rather than a second box on /search: "what can I
 * cook tonight?" is a different question from "where is that recipe?", and the
 * two answer sets rank on different things.
 */
export default function PantryPage() {
  return (
    <>
      <PageTitle lede="List what's in the kitchen and see which recipes you can cover — closest matches first, with anything still missing called out.">
        Cook from the pantry
      </PageTitle>
      <PantrySearch />

      {/* The mirror-image question. A cook standing at the fridge has one or
          the other, never both: a full kitchen to cook from, or one thing
          that needs eating tonight. */}
      <p className="mt-12 text-sm text-(--color-ink-2)">
        Just one thing going off?{' '}
        <Link href="/leftovers" className="font-medium text-(--color-accent) hover:underline">
          Find what uses it up
        </Link>
        .
      </p>
    </>
  )
}
