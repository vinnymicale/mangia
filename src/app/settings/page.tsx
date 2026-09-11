import { describeConfig } from '@/lib/config'
import { lastBackupRun } from '@/lib/backup/scheduler'
import { AiSettingsPanel } from '@/components/settings/AiSettingsPanel'
import { BackupSettingsPanel } from '@/components/settings/BackupSettingsPanel'
import { PageTitle } from '@/components/ui'

export const dynamic = 'force-dynamic'

/**
 * Application configuration only. Anything about food -- staples, tags -- lives
 * at /staples; the two used to share this route, and the split is by subject.
 *
 * Every value here takes effect without a restart. Configuration is read fresh
 * on each use rather than cached at startup, and saving anything about backups
 * re-registers the timer, so nothing on this page is waiting on a bounce.
 */
export default async function SettingsPage() {
  const config = await describeConfig()

  return (
    <>
      <PageTitle lede="How Mangia is wired up. Values saved here take effect immediately.">
        Settings
      </PageTitle>

      <div className="mt-8 space-y-8">
        <AiSettingsPanel initial={config.llm} />
        <BackupSettingsPanel initial={config.drive} initialRun={lastBackupRun()} />
      </div>
    </>
  )
}
