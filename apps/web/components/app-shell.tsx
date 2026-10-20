"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { CommandMenu } from "@/components/command-menu";
import { Header } from "@/components/header";
import { Icons } from "@/components/icons";
import { Sidebar, SidebarContent, SidebarIconButton } from "@/components/sidebar";

/**
 * The frame every signed-in page sits in: a quiet sidebar on the app background,
 * and the page itself on a raised panel. Owns the mobile drawer and ⌘K menu state.
 */
export function AppShell({
  fullName,
  email,
  children,
}: {
  fullName: string | null;
  email: string | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [navOpen, setNavOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const closeNav = useCallback(() => setNavOpen(false), []);

  useEffect(() => {
    if (!navOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setNavOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [navOpen]);

  return (
    <div className="flex min-h-dvh flex-1 bg-background">
      <a
        href="#main"
        className="sr-only z-[80] rounded-lg bg-foreground px-3 py-2 text-sm text-background focus:not-sr-only focus:fixed focus:left-3 focus:top-3"
      >
        Skip to content
      </a>

      <Sidebar fullName={fullName} email={email} />

      {navOpen && (
        <div className="fixed inset-0 z-[60] md:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
          <div className="animate-in fade-in absolute inset-0 bg-foreground/20 duration-200 dark:bg-black/60" onClick={closeNav} />
          <div className="animate-in slide-in-from-left absolute inset-y-0 left-0 flex w-[280px] max-w-[85vw] flex-col bg-sidebar px-3 py-3 shadow-soft duration-300 ease-out">
            <SidebarContent
              fullName={fullName}
              email={email}
              onNavigate={closeNav}
              headerAction={<SidebarIconButton onClick={closeNav} label="Close navigation" icon={<Icons.close className="size-4" />} />}
            />
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col md:py-2 md:pr-2">
        <div className="flex flex-1 flex-col bg-surface md:rounded-xl md:border md:border-border md:shadow-soft-sm">
          <Header onOpenNav={() => setNavOpen(true)} onOpenSearch={() => setSearchOpen(true)} />
          <main id="main" key={pathname} className="animate-rise-in flex-1 px-4 py-6 md:px-8 md:py-8">
            {children}
          </main>
        </div>
      </div>

      <CommandMenu open={searchOpen} onOpenChange={setSearchOpen} />
    </div>
  );
}
