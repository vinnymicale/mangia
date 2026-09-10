/**
 * Runs once per server instance, before the server accepts requests. Anything
 * awaited here delays startup, so the scheduler only registers a timer -- it
 * does not take a backup.
 */
export async function register() {
  // Guarded: instrumentation also runs in the edge runtime, which has neither
  // the filesystem nor the database this depends on.
  if (process.env.NEXT_RUNTIME !== 'nodejs') return

  const { startBackupScheduler } = await import('@/lib/backup/scheduler')
  startBackupScheduler()
}
