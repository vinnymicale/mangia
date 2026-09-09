import type { Metadata } from 'next'
import { Fraunces, Inter_Tight } from 'next/font/google'
import { Nav } from '@/components/Nav'
import './globals.css'

// Fraunces carries the cookbook voice; Inter Tight keeps the chrome quiet.
const display = Fraunces({
  subsets: ['latin'],
  variable: '--font-display',
  axes: ['SOFT', 'WONK'],
})

const ui = Inter_Tight({
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
        <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-8 sm:px-6 sm:py-12">
          {children}
        </main>
      </body>
    </html>
  )
}
