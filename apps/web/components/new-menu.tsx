"use client";

import Link from "next/link";
import { useCallback, useId, useRef, useState } from "react";
import { CREATE_SECTIONS } from "@/lib/navigation";
import { useDismiss } from "@/lib/use-dismiss";
import { Icons } from "@/components/icons";

export function NewMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const close = useCallback(() => {
    setOpen(false);
    buttonRef.current?.focus();
  }, []);
  useDismiss(ref, open, close);

  return (
    <div ref={ref} className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={panelId}
        className="flex h-8 items-center gap-1.5 rounded-lg bg-primary pl-2.5 pr-2 text-[13px] font-medium text-primary-foreground shadow-soft-sm transition-[transform,opacity] duration-150 hover:opacity-90 active:scale-[0.97]"
      >
        <Icons.plus className="size-4" strokeWidth={1.75} />
        New
        <Icons.chevronDown className={`size-3.5 opacity-70 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div
          id={panelId}
          className="animate-pop-in absolute right-0 top-full z-40 mt-2 w-[min(36rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border border-border bg-popover shadow-soft"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 sm:divide-x sm:divide-border">
            {CREATE_SECTIONS.map((section) => (
              <nav key={section.title} aria-label={`New ${section.title.toLowerCase()} transaction`} className="p-1.5">
                <div className="flex items-baseline justify-between px-2.5 pb-1 pt-1.5">
                  <h3 className="font-sans text-[11.5px] font-medium text-muted-foreground">{section.title}</h3>
                  <Link
                    href={section.viewAll.href}
                    onClick={() => setOpen(false)}
                    className="text-[11.5px] text-muted-foreground underline-offset-2 transition-colors hover:text-foreground hover:underline"
                  >
                    {section.viewAll.label}
                  </Link>
                </div>
                <ul>
                  {section.items.map((item) => {
                    const ItemIcon = item.icon;
                    return (
                      <li key={item.label}>
                        <Link
                          href={item.href}
                          onClick={() => setOpen(false)}
                          className="group flex items-start gap-3 rounded-xl px-2.5 py-2 transition-colors duration-150 hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
                        >
                          <span className="mt-px flex size-7 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition-colors group-hover:border-primary/30 group-hover:text-primary">
                            <ItemIcon className="size-4" />
                          </span>
                          <span className="min-w-0">
                            <span className="block text-[13px] font-medium text-foreground">{item.label}</span>
                            <span className="block text-xs leading-snug text-muted-foreground">{item.description}</span>
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </nav>
            ))}
          </div>
          <Link
            href="/contacts/new"
            onClick={() => setOpen(false)}
            className="flex items-center justify-between border-t border-border bg-muted/40 px-4 py-2.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            <span className="flex items-center gap-2">
              <Icons.userPlus className="size-4" />
              Add a customer or supplier
            </span>
            <Icons.arrowRight className="size-3.5" />
          </Link>
        </div>
      )}
    </div>
  );
}
