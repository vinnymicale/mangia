import { NextResponse } from 'next/server'
import { z } from 'zod'
import { describeConfig, applySettings, SETTING_KEYS, type SettingKey } from '@/lib/config'
import { restartBackupScheduler } from '@/lib/backup/scheduler'

export async function GET() {
  return NextResponse.json(await describeConfig())
}

/**
 * A partial update. Only the keys present are touched, which is what lets the
 * page submit a form containing a masked secret field the user never opened --
 * that field is simply absent from the body. An explicit null clears a key,
 * falling back to the environment or the built-in default.
 */
const PutSchema = z.object({
  // partialRecord, not record: in zod 4 a record keyed by an enum is
  // exhaustive, and would demand all eight keys on every save -- which is
  // exactly backwards for an update whose purpose is to carry only what
  // changed, and would make every save from the page a 400.
  settings: z.partialRecord(z.enum(SETTING_KEYS), z.string().nullable()),
})

export async function PUT(request: Request) {
  const parsed = PutSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Expected a "settings" object of known keys.' },
      { status: 400 },
    )
  }

  try {
    await applySettings(parsed.data.settings)
  } catch (error) {
    // Validation failures name the field that was wrong, so the message is the
    // useful part of the response and a 400 is the honest status.
    const message = error instanceof Error ? error.message : 'That setting could not be saved.'
    return NextResponse.json({ error: message }, { status: 400 })
  }

  // Any drive.* write changes what the timer should be doing. Re-register from
  // the values just saved rather than leaving the old interval firing with the
  // old credentials -- without this the save would appear to succeed and change
  // nothing until the next restart, which is the whole point of the feature.
  const touchedDrive = Object.keys(parsed.data.settings).some((key) =>
    (key as SettingKey).startsWith('drive.'),
  )
  if (touchedDrive) await restartBackupScheduler()

  return NextResponse.json(await describeConfig())
}
