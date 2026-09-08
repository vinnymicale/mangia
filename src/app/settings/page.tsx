import { listStaples } from '@/lib/db/staples'
import { StaplesEditor } from '@/components/StaplesEditor'

export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
  const staples = await listStaples()

  return (
    <>
      <h1 className="mb-2 text-2xl font-semibold">Staples</h1>
      <p className="mb-6 text-(--color-ink-muted)">
        Things you always have. New shopping lists leave them off by default.
      </p>
      <StaplesEditor initial={staples.map(({ id, name }) => ({ id, name }))} />
    </>
  )
}
