import type { Metadata } from 'next'
import { DM_Sans, Fraunces } from 'next/font/google'
import { Nav } from '@/components/Nav'
import './globals.css'

// Fraunces carries the cookbook voice; DM Sans keeps the chrome quiet.
const display = Fraunces({
  subsets: ['latin'],
  variable: '--font-display',
  axes: ['SOFT', 'WONK'],
})

const ui = DM_Sans({
  subsets: ['latin'],
  variable: '--font-ui',
})

export const metadata: Metadata = {
  title: 'mangia',
  description: 'A self-hosted recipe manager',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${display.variable} ${ui.variable}`}>
      <body className="flex min-h-dvh flex-col">
        <Nav />
        <main className="mx-auto w-full max-w-[1120px] flex-1 px-5 pt-8 pb-16 sm:px-7 sm:pt-9 sm:pb-18">
          {children}
        </main>
      </body>
    </html>
  )
}
