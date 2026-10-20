"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_GROUPS, activeNavHref } from "@/lib/navigation";
import { Icons } from "@/components/icons";
import { LogoMark } from "@/components/logo-mark";
import { NewMenu } from "@/components/new-menu";
import { CPAModeToggle } from "@/components/cpa-mode-toggle";
import { ThemeToggle } from "@/components/theme-toggle";

function useBreadcrumb(pathname: string) {
  const href = activeNavHref(pathname);
  if (!href) return null;
  for (const group of NAV_GROUPS) {
    const item = group.items.find((i) => i.href === href);
    if (item) return { group: group.label, item, deeper: pathname !== href };
  }
  return null;
}

export function Header({ onOpenNav, onOpenSearch }: { onOpenNav: () => void; onOpenSearch: () => void }) {
  const pathname = usePathname();
  const crumb = useBreadcrumb(pathname);

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b border-border bg-surface/85 px-3 backdrop-blur-xl backdrop-saturate-150 md:rounded-t-xl md:px-5">
      <button
        type="button"
        onClick={onOpenNav}
        aria-label="Open navigation"
        className="flex size-9 items-center justify-center rounded-lg text-foreground transition-colors duration-150 hover:bg-accent md:hidden"
      >
        <Icons.menu className="size-5" />
      </button>
      <Link href="/dashboard" aria-label="VitaCount home" className="md:hidden">
        <LogoMark className="size-6" />
      </Link>

      <nav aria-label="Breadcrumb" className="hidden min-w-0 flex-1 items-center gap-1.5 text-[13px] md:flex">
        {crumb?.group && (
          <>
            <span className="text-muted-foreground">{crumb.group}</span>
            <Icons.chevronRight className="size-3.5 text-muted-foreground/60" />
          </>
        )}
        {crumb &&
          (crumb.deeper ? (
            <Link href={crumb.item.href} className="truncate text-muted-foreground transition-colors hover:text-foreground">
              {crumb.item.label}
            </Link>
          ) : (
            <span className="truncate font-medium text-foreground">{crumb.item.label}</span>
          ))}
      </nav>

      <div className="ml-auto flex items-center gap-2">
        <button
          type="button"
          onClick={onOpenSearch}
          aria-label="Search and commands"
          className="group flex h-8 items-center gap-2 rounded-lg border border-border bg-card px-2.5 text-[13px] text-muted-foreground shadow-soft-sm transition-colors duration-150 hover:border-foreground/15 hover:text-foreground sm:w-56"
        >
          <Icons.search className="size-4 shrink-0" />
          <span className="hidden flex-1 text-left sm:block">Search or jump to…</span>
          <kbd className="hidden rounded border border-border px-1 font-mono text-[10.5px] text-muted-foreground/80 sm:block">
            ⌘K
          </kbd>
        </button>
        <CPAModeToggle />
        <NewMenu />
        <ThemeToggle />
      </div>
    </header>
  );
}
