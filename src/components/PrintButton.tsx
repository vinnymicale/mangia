'use client'

import { Printer } from 'lucide-react'
import { button } from '@/components/ui'

/**
 * Client-side because printing is a browser action with no server equivalent.
 * The page is already the printable layout, so this only opens the dialog.
 */
export function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()} className={button({ variant: 'secondary' })}>
      <Printer size={16} aria-hidden />
      Print
    </button>
  )
}
