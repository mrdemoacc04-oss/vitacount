"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/cpa/journal-entries", label: "Journal entries" },
  { href: "/cpa/accounts", label: "Chart of accounts" },
];

export default function CpaLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Ledger</h1>
        <p className="mt-1 text-sm text-muted-foreground">The general ledger in debits and credits, for your accountant.</p>
        <nav aria-label="Ledger" className="mt-5 flex gap-5 border-b border-border text-[13px]">
          {TABS.map((tab) => {
            const active = pathname.startsWith(tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={`-mb-px border-b-2 pb-2.5 transition-colors duration-150 ${
                  active
                    ? "border-primary font-medium text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>
      </div>
      {children}
    </div>
  );
}
