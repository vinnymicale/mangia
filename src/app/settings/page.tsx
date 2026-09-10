import { listStaples } from '@/lib/db/staples'
import { listTagsWithCounts } from '@/lib/db/tags'
import { StaplesEditor } from '@/components/StaplesEditor'
import { TagsEditor } from '@/components/TagsEditor'
import { BackupEditor } from '@/components/BackupEditor'
import { DriveBackupPanel } from '@/components/DriveBackupPanel'
import { readDriveConfig } from '@/lib/backup/drive'
import { lastBackupRun } from '@/lib/backup/scheduler'
import { PageTitle } from '@/components/ui'

export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
  const [staples, tags, drive] = await Promise.all([
    listStaples(),
    listTagsWithCounts(),
    readDriveConfig(),
  ])

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

      {/* Everything in Mangia lives in one SQLite file with no copy anywhere
          else. This section is the only thing standing between a disk failure
          and the whole recipe box. */}
      <section className="mt-14">
        <PageTitle lede="Download everything as one JSON file, or restore recipes from a file you saved earlier.">
          Backup
        </PageTitle>
        <BackupEditor />
      </section>

      <section className="mt-10">
        <PageTitle lede="Keep an off-machine copy without remembering to make one.">
          Scheduled backups to Google Drive
        </PageTitle>
        <DriveBackupPanel status={drive} initialRun={lastBackupRun()} />
      </section>
    </>
  )
}
