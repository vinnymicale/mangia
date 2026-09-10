import { exportAll } from '@/lib/db/transfer'
import { readDriveConfig, uploadBackup, pruneBackups, backupIntervalHours } from './drive'

/** How many archives to keep in the folder before the oldest are swept. */
const KEEP = 14

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
    const document = await exportAll()
    const result = await uploadBackup(JSON.stringify(document, null, 2), archiveName())
    await pruneBackups(KEEP).catch(() => 0) // Pruning failing must not fail the backup.
    lastRun = { at: new Date().toISOString(), ok: true, detail: result.name }
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'The backup failed.'
    lastRun = { at: new Date().toISOString(), ok: false, detail }
  } finally {
    running = false
  }
  return lastRun
}

/**
 * Starts the interval if Drive is configured. Called from instrumentation.ts,
 * which blocks server readiness until it returns -- so this only ever schedules
 * work and never awaits a backup.
 *
 * This is an in-process timer, which means backups happen only while the server
 * is running. That is the honest limit of a self-hosted app with no scheduler:
 * a machine that is off overnight takes its backup when it next comes up.
 */
export function startBackupScheduler(): void {
  if (timer !== null) return

  void readDriveConfig().then((config) => {
    if (!config.configured) return

    const period = backupIntervalHours() * 60 * 60 * 1000
    timer = setInterval(() => void runBackup(), period)
    // Never hold the process open on the backup timer alone.
    timer.unref?.()

    // A first run shortly after boot, not immediately: startup is busy, and a
    // server that is restarted repeatedly should not upload on every bounce.
    const first = setTimeout(() => void runBackup(), 5 * 60 * 1000)
    first.unref?.()
  })
}
