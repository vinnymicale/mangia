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
    </>
  )
}
