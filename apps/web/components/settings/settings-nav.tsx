"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Icons } from "@/components/icons";

type NavItem = { href: string; label: string };

const GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: "Workspace",
    items: [
      { href: "/settings/workspace", label: "Workspace" },
      { href: "/settings/invoicing", label: "Invoicing" },
    ],
  },
  {
    label: "Account",
    items: [
      { href: "/settings/profile", label: "Your profile" },
      { href: "/settings/security", label: "Security" },
    ],
  },
];

export function SettingsNav() {
  const pathname = usePathname();
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <nav aria-label="Settings">
      {/* Mobile: one horizontally scrolling row of tabs */}
      <div className="-mx-4 overflow-x-auto border-b border-border px-4 md:hidden">
        <ul className="flex min-w-max gap-5">
          {GROUPS.flatMap((g) => g.items).map((item) => {
            const active = isActive(item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "-mb-px inline-flex h-10 items-center border-b-2 text-[13px] font-medium transition-colors",
                    active ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
                  )}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
          <li>
            <Link
              href="/team"
              className="-mb-px inline-flex h-10 items-center gap-1 border-b-2 border-transparent text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Team
              <Icons.arrowUpRight className="size-3.5" />
            </Link>
          </li>
        </ul>
      </div>

      {/* Desktop: grouped vertical list */}
      <div className="hidden flex-col gap-6 md:flex">
        {GROUPS.map((group) => (
          <div key={group.label}>
            <p className="px-2.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{group.label}</p>
            <ul className="mt-1.5 flex flex-col gap-0.5">
              {group.items.map((item) => {
                const active = isActive(item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex h-8 items-center rounded-lg px-2.5 text-[13px] transition-colors",
                        active
                          ? "bg-card font-medium text-foreground shadow-soft-sm ring-1 ring-border"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground",
                      )}
                    >
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
        <div className="border-t border-border pt-4">
          <Link
            href="/team"
            className="group flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[13px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            Team &amp; members
            <Icons.arrowRight className="size-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
          </Link>
        </div>
      </div>
    </nav>
  );
}
