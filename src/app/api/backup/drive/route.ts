import { NextResponse } from 'next/server'
import { readDriveConfig } from '@/lib/backup/drive'
import { runBackup, lastBackupRun } from '@/lib/backup/scheduler'

export async function GET() {
  const config = await readDriveConfig()
  return NextResponse.json({ config, lastRun: lastBackupRun() })
}

/** "Back up now". The only way to trigger a run without waiting for the timer. */
export async function POST() {
  const config = await readDriveConfig()
  if (!config.configured) {
    return NextResponse.json(
      { error: config.problem ?? 'Google Drive backups are not configured.' },
      { status: 400 },
    )
  }

  const run = await runBackup()
  // A failed upload is reported as a result, not a 500: the request itself
  // succeeded, and the page needs the message to show the user what broke.
  return NextResponse.json({ lastRun: run })
}
