import { NextResponse } from 'next/server'
import { describeConfig } from '@/lib/config'
import { runBackup, lastBackupRun } from '@/lib/backup/scheduler'

export async function GET() {
  const { drive } = await describeConfig()
  return NextResponse.json({ config: drive, lastRun: lastBackupRun() })
}

/** "Back up now". The only way to trigger a run without waiting for the timer. */
export async function POST() {
  const { drive } = await describeConfig()
  if (!drive.configured) {
    return NextResponse.json(
      { error: drive.problem ?? 'Google Drive backups are not configured.' },
      { status: 400 },
    )
  }

  const run = await runBackup()
  // A failed upload is reported as a result, not a 500: the request itself
  // succeeded, and the page needs the message to show the user what broke.
  return NextResponse.json({ lastRun: run })
}
