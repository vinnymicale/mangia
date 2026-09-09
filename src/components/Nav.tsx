'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { BookOpen, Plus, Search, Settings, ShoppingCart } from 'lucide-react'
import { cn } from '@/lib/utils'

const LINKS = [
  { href: '/', label: 'Recipes', icon: BookOpen },
  { href: '/search', label: 'Search', icon: Search },
  { href: '/lists', label: 'Lists', icon: ShoppingCart },
  { href: '/recipes/new', label: 'Add', icon: Plus },
  { href: '/settings', label: 'Staples', icon: Settings },
]

export function Nav() {
  const pathname = usePathname()

  return (
    <nav
      aria-label="Main"
      className={cn(
        'sticky bottom-0 z-20 border-t border-(--color-border-subtle)',
        'bg-(--color-surface-raised)/85 backdrop-blur-md',
        'sm:static sm:border-t-0 sm:border-b',
      )}
    >
      <div className="mx-auto flex max-w-6xl items-center gap-6 px-5 sm:px-6">
        {/* The wordmark is desktop-only; on a phone the bar is pure thumb reach. */}
        <Link
          href="/"
          className="hidden shrink-0 py-3.5 font-serif text-xl font-semibold tracking-tight text-(--color-accent) sm:block"
        >
          mangia
        </Link>

        <ul className="flex flex-1 items-center justify-around gap-1 py-1.5 sm:justify-end sm:gap-1 sm:py-0">
          {LINKS.map(({ href, label, icon: Icon }) => {
            const active = href === '/' ? pathname === '/' : pathname.startsWith(href)
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'relative flex flex-col items-center gap-1 rounded-lg px-3 py-2 text-xs font-medium transition-colors',
                    'sm:flex-row sm:gap-2 sm:py-4 sm:text-sm',
                    active
                      ? 'text-(--color-accent)'
                      : 'text-(--color-ink-muted) hover:text-(--color-ink)',
                  )}
                >
                  <Icon className="size-5 sm:size-4" aria-hidden />
                  {label}
                  {/* Underline on desktop, dot on mobile — the bar sits at the
                      bottom there, so a rule would collide with the edge. */}
                  {active && (
                    <span
                      aria-hidden
                      className={cn(
                        'absolute size-1 rounded-full bg-(--color-accent) bottom-0.5',
                        'sm:inset-x-3 sm:bottom-0 sm:size-auto sm:h-0.5 sm:rounded-none',
                      )}
                    />
                  )}
                </Link>
              </li>
            )
          })}
        </ul>
      </div>
    </nav>
  )
}
