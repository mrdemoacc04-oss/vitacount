"use client";

import { usePathname, useRouter } from "next/navigation";

/** Owner view (visual KPIs) vs CPA view (raw ledger, debits and credits). */
export function CPAModeToggle() {
  const router = useRouter();
  const pathname = usePathname();
  const isCPAMode = pathname.startsWith("/cpa");

  const options = [
    { value: false, label: "Owner", href: "/dashboard", title: "Owner mode: visual KPIs" },
    { value: true, label: "CPA", href: "/cpa/journal-entries", title: "CPA mode: raw ledger, debits and credits" },
  ];

  return (
    <div role="radiogroup" aria-label="View mode" className="hidden h-8 items-center rounded-lg bg-muted p-0.5 sm:flex">
      {options.map((o) => {
        const on = o.value === isCPAMode;
        return (
          <button
            key={o.label}
            type="button"
            role="radio"
            aria-checked={on}
            title={o.title}
            onClick={() => !on && router.push(o.href)}
            className={`h-7 rounded-md px-2.5 text-xs font-medium transition-all duration-150 ${
              on ? "bg-card text-foreground shadow-soft-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
