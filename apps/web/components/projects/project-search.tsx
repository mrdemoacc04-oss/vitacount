"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Icons } from "@/components/icons";
import { cn } from "@/lib/utils";

/** Search box for the projects list; keeps the query in the URL (?q=) next to the status filter. */
export function ProjectSearch({ initialQuery, status }: { initialQuery: string; status: string | null }) {
  const router = useRouter();
  const pathname = usePathname();
  const [value, setValue] = useState(initialQuery);
  const [pending, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  function push(query: string) {
    const next = new URLSearchParams();
    if (status) next.set("status", status);
    if (query.trim()) next.set("q", query.trim());
    const qs = next.toString();
    startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  }

  function onChange(query: string) {
    setValue(query);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => push(query), 250);
  }

  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        if (timer.current) clearTimeout(timer.current);
        push(value);
      }}
      className="relative w-full sm:w-64"
    >
      <Icons.search
        className={cn("pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground", pending && "animate-pulse")}
      />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search name, code or customer"
        aria-label="Search projects"
        className="h-9 w-full rounded-lg border border-input bg-card pl-8 pr-3 text-[13px] text-foreground shadow-soft-sm outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground/70 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40"
      />
    </form>
  );
}
