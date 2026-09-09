import { listStaples } from '@/lib/db/staples'
import { StaplesEditor } from '@/components/StaplesEditor'
import { PageTitle } from '@/components/ui'

export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
  const staples = await listStaples()

  return (
    <>
      <PageTitle lede="Things you always have. New shopping lists leave them off by default.">
        Staples
      </PageTitle>
      <StaplesEditor initial={staples.map(({ id, name }) => ({ id, name }))} />
    </>
  )
}
