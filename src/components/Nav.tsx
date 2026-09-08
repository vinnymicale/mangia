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
      className="sticky bottom-0 z-10 border-t border-(--color-border-subtle) bg-(--color-surface-raised) sm:static sm:border-t-0 sm:border-b"
    >
      <ul className="mx-auto flex max-w-4xl items-center justify-around gap-1 px-4 py-2 sm:justify-start sm:gap-6">
        {LINKS.map(({ href, label, icon: Icon }) => {
          const active = href === '/' ? pathname === '/' : pathname.startsWith(href)
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex flex-col items-center gap-1 rounded-lg px-3 py-2 text-xs font-medium transition-colors sm:flex-row sm:text-sm',
                  active
                    ? 'text-(--color-accent)'
                    : 'text-(--color-ink-muted) hover:text-(--color-ink)',
                )}
              >
                <Icon className="size-5" aria-hidden />
                {label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
