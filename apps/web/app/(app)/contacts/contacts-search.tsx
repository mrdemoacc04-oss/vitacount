"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Icons } from "@/components/icons";
import { cn } from "@/lib/utils";

/** Search box that keeps `?q=` in the URL (debounced), so results survive a reload and can be shared. */
export function ContactsSearch({ initialQuery }: { initialQuery: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(initialQuery);
  const [pending, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // follow the URL when it changes from outside (a "Clear the search" link, back/forward)
  const [seenInitial, setSeenInitial] = useState(initialQuery);
  if (seenInitial !== initialQuery) {
    setSeenInitial(initialQuery);
    if (initialQuery !== query.trim()) setQuery(initialQuery);
  }

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  function push(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value.trim()) params.set("q", value.trim());
    else params.delete("q");
    params.delete("added");
    const qs = params.toString();
    startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  }

  return (
    <div className="relative w-full sm:w-72">
      <Icons.search
        className={cn("pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground", pending && "animate-pulse")}
      />
      <input
        type="search"
        value={query}
        onChange={(e) => {
          const value = e.target.value;
          setQuery(value);
          if (timer.current) clearTimeout(timer.current);
          timer.current = setTimeout(() => push(value), 250);
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape" && query) {
            setQuery("");
            push("");
          }
        }}
        placeholder="Search name, email, phone"
        aria-label="Search contacts"
        className="h-9 w-full rounded-lg border border-input bg-card pl-9 pr-3 text-sm shadow-soft-sm outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground/70 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40"
      />
    </div>
  );
}
