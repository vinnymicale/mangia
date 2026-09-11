import { exportAll } from '@/lib/db/transfer'
import { uploadBackup, pruneBackups } from './drive'
import { resolveConfig } from '@/lib/config'

export interface BackupRun {
  at: string
  ok: boolean
  /** File name on success, error message on failure. */
  detail: string
}

/**
 * The last run, in memory only. Deliberately not a database row: the point of a
 * backup is to survive the database, so making the app's schema depend on it
 * would be the wrong direction. It is status, not data -- losing it on restart
 * costs nothing, and the Drive folder is the real record of what exists.
 */
let lastRun: BackupRun | null = null
let timer: ReturnType<typeof setInterval> | null = null
/**
 * The pending first-run timeout is tracked alongside the interval because a
 * restart has to cancel it too. Otherwise saving new credentials during the
 * five-minute window after boot leaves a backup queued against the old ones.
 */
let firstRun: ReturnType<typeof setTimeout> | null = null
let running = false

export function lastBackupRun(): BackupRun | null {
  return lastRun
}

function archiveName(): string {
  // Full timestamp, colons stripped: several backups can land on one day, and
  // Drive will happily hold two files with the same name.
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  return `mangia-backup-${stamp}.json`
}

/**
 * Exports the corpus and uploads it. Never throws: it runs on a timer with no
 * caller to catch it, and an unhandled rejection there would take the server
 * down over a failed backup.
 */
export async function runBackup(): Promise<BackupRun> {
  // A slow upload must not overlap the next tick and upload the same data twice.
  if (running) {
    return { at: new Date().toISOString(), ok: false, detail: 'A backup is already running.' }
  }
  running = true
  try {
    // Resolved per run, not captured when the timer was registered: a key
    // replaced between two ticks is used by the next one.
    const { drive } = await resolveConfig()
    if (drive.key === null) {
      throw new Error(drive.problem ?? 'Google Drive backups are not configured.')
    }

    const document = await exportAll()
    const result = await uploadBackup(
      drive.key,
      drive.folderId,
      JSON.stringify(document, null, 2),
      archiveName(),
    )
    // Pruning failing must not fail the backup.
    await pruneBackups(drive.key, drive.folderId, drive.keepCount).catch(() => 0)
    lastRun = { at: new Date().toISOString(), ok: true, detail: result.name }
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'The backup failed.'
    lastRun = { at: new Date().toISOString(), ok: false, detail }
  } finally {
    running = false
  }
  return lastRun
}

/** Cancels the interval and any queued first run. Safe to call when idle. */
function clearTimers(): void {
  if (timer !== null) clearInterval(timer)
  if (firstRun !== null) clearTimeout(firstRun)
  timer = null
  firstRun = null
}

/** What is currently scheduled. Exported so a test can assert on it. */
export function scheduledIntervalHours(): number | null {
  return scheduled
}
let scheduled: number | null = null

/**
 * Registers the backup timer from freshly resolved configuration, replacing
 * whatever was scheduled before.
 *
 * The old `startBackupScheduler` returned early whenever a timer already
 * existed, which made calling it after a settings change do nothing at all --
 * the old interval kept firing with the old credentials while the UI reported
 * the save had succeeded. Restarting unconditionally is what makes a changed
 * interval or a swapped key take effect without a restart, and unconfiguring
 * Drive tears the timer down rather than leaving it running.
 *
 * This is an in-process timer, which means backups happen only while the server
 * is running. That is the honest limit of a self-hosted app with no scheduler:
 * a machine that is off overnight takes its backup when it next comes up.
 */
export async function restartBackupScheduler(): Promise<void> {
  clearTimers()
  scheduled = null

  const { drive } = await resolveConfig()
  if (drive.key === null) return

  const period = drive.intervalHours * 60 * 60 * 1000
  timer = setInterval(() => void runBackup(), period)
  // Never hold the process open on the backup timer alone.
  timer.unref?.()
  scheduled = drive.intervalHours

  // A first run shortly after boot, not immediately: startup is busy, and a
  // server that is restarted repeatedly should not upload on every bounce.
  firstRun = setTimeout(() => void runBackup(), 5 * 60 * 1000)
  firstRun.unref?.()
}

/**
 * Called from instrumentation.ts, which blocks server readiness until it
 * returns -- so this only ever schedules work and never awaits a backup.
 */
export function startBackupScheduler(): void {
  void restartBackupScheduler()
}
