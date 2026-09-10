'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'
import { button } from '@/components/ui'
import { cn } from '@/lib/utils'

/**
 * Deletes a recipe or a list, then sends the browser somewhere that still
 * exists. Deletion is the one destructive action in the app, so it asks first
 * and says so plainly rather than relying on an undo that does not exist.
 *
 * The confirmation is a two-step swap of this button rather than
 * window.confirm: the native dialog is blocked in some embedded browsers, and
 * an inline control is reachable in a test without dismissing a modal.
 */
export function DeleteButton({
  endpoint,
  redirectTo,
  label,
  confirmLabel,
  name,
  size = 'sm',
  className,
}: {
  endpoint: string
  redirectTo: string
  /** Visible text. Empty renders an icon-only button, which then needs `name`. */
  label?: string
  confirmLabel: string
  /** Accessible name. Required when `label` is empty, since the icon carries none. */
  name?: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
}) {
  const router = useRouter()
  const [armed, setArmed] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // useTransition, not a boolean: the row stays disabled until the refreshed
  // server component has actually rendered, so the deleted item cannot be
  // clicked again in the gap after the response lands.
  const [pending, startTransition] = useTransition()

  async function remove() {
    setError(null)
    try {
      const response = await fetch(endpoint, { method: 'DELETE' })
      if (!response.ok) throw new Error()
      startTransition(() => {
        router.push(redirectTo)
        // Without this the destination can come from the client cache and
        // still list what was just deleted.
        router.refresh()
      })
    } catch {
      setArmed(false)
      setError('Could not delete that.')
    }
  }

  if (error !== null) {
    return (
      <span role="alert" className="text-[13px] font-medium text-(--color-alert)">
        {error}
      </span>
    )
  }

  if (!armed) {
    return (
      <button
        type="button"
        onClick={() => setArmed(true)}
        aria-label={label ? undefined : (name ?? 'Delete')}
        className={cn(button({ variant: 'ghost', size }), className)}
      >
        <Trash2 aria-hidden className="size-4" strokeWidth={1.75} />
        {label}
      </button>
    )
  }

  return (
    <span className="inline-flex items-center gap-1">
      <button
        type="button"
        onClick={() => void remove()}
        disabled={pending}
        className={cn(
          button({ size }),
          'bg-(--color-alert) text-white hover:bg-(--color-alert)',
        )}
      >
        {pending ? 'Deleting…' : confirmLabel}
      </button>
      <button
        type="button"
        onClick={() => setArmed(false)}
        disabled={pending}
        className={button({ variant: 'ghost', size })}
      >
        Cancel
      </button>
    </span>
  )
}
