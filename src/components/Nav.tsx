"use client";

import Link from "next/link";
import { Suspense } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

/**
 * Text tabs, as in the mockup. Pantry search and title search are different
 * questions -- "what can I cook?" versus "where is that recipe?" -- so the
 * nav input answers the second and Pantry gets its own tab for the first.
 */
const LINKS = [
  { href: "/", label: "Recipes" },
  { href: "/pantry", label: "Pantry" },
  { href: "/lists", label: "Lists" },
  { href: "/diary", label: "Diary" },
  { href: "/settings", label: "Staples" },
];

export function Nav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Main"
      className={cn(
        "sticky top-0 z-50 border-b border-(--color-border) bg-(--color-surface)",
        "sm:h-(--nav-h)",
      )}
    >
      {/* Wraps to a second line on a phone rather than scrolling sideways;
          the mockup only ever shows this bar at desktop width. */}
      <div className="mx-auto flex max-w-[1120px] flex-wrap items-center gap-x-5 gap-y-2 px-5 py-2.5 sm:h-full sm:flex-nowrap sm:px-7 sm:py-0">
        <Link
          href="/"
          className="shrink-0 font-serif text-[22px] leading-none font-bold tracking-[-0.015em] text-(--color-accent) italic"
        >
          Mangia
        </Link>

        <ul className="flex items-center gap-0.5">
          {LINKS.map(({ href, label }) => {
            const active =
              href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "block rounded-[7px] px-3.5 py-[7px] text-sm font-medium transition-colors",
                    active
                      ? "bg-(--color-accent-soft) font-semibold text-(--color-accent)"
                      : "text-(--color-ink-2) hover:bg-(--color-accent-soft) hover:text-(--color-ink)",
                  )}
                >
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>

        <div className="ml-auto flex items-center gap-2.5">
          <NavSearch />

          <Link
            href="/recipes/new"
            className="shrink-0 rounded-[7px] bg-(--color-accent) px-4.5 py-2 text-[13px] font-semibold tracking-[0.01em] whitespace-nowrap text-(--color-accent-ink) transition-colors hover:bg-(--color-accent-h)"
          >
            + Add Recipe
          </Link>
        </div>
      </div>
    </nav>
  );
}

/**
 * Only the prefill reads the URL query, so it lives behind its own Suspense
 * boundary -- otherwise `useSearchParams` opts the whole nav, and with it
 * every prerendered page, out of static rendering.
 */
function NavSearchInput() {
  const router = useRouter();
  const params = useSearchParams();
  const pathname = usePathname();

  return (
    <>
      {/* Navigating rather than submitting keeps the field usable as a
          client component without a full page reload. */}
      <form
        role="search"
        onSubmit={(event) => {
          event.preventDefault();
          const value = new FormData(event.currentTarget).get("q");
          const query = typeof value === "string" ? value.trim() : "";
          if (query !== "")
            router.push(`/search?q=${encodeURIComponent(query)}`);
        }}
      >
        <input
          type="search"
          name="q"
          aria-label="Search recipes"
          placeholder="Search recipes…"
          defaultValue={pathname === "/search" ? (params.get("q") ?? "") : ""}
          className={cn(
            "w-[9.5rem] rounded-[7px] border border-(--color-border) bg-(--color-bg) px-3.5 py-[7px] text-sm sm:w-[13.125rem]",
            "text-(--color-ink) placeholder:text-(--color-ink-2)",
            "transition-[border-color,box-shadow] outline-none",
            "focus:border-(--color-accent) focus:ring-[3px] focus:ring-(--color-accent-soft)",
          )}
        />
      </form>
    </>
  );
}

function NavSearch() {
  return (
    <Suspense
      fallback={<div className="h-[35px] w-[9.5rem] sm:w-[13.125rem]" />}
    >
      <NavSearchInput />
    </Suspense>
  );
}
