"use client";

import { Icons } from "@/components/icons";
import { cn } from "@/lib/utils";

export function RemoveLineButton({ onClick, label, disabled }: { onClick: () => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="inline-flex size-8 cursor-pointer items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-destructive focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-30"
    >
      <Icons.close className="size-4" />
    </button>
  );
}

export function AddLineButton({ onClick, label = "Add line", className }: { onClick: () => void; label?: string; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg px-2.5 text-[13px] font-medium text-primary transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/40",
        className,
      )}
    >
      <Icons.plus className="size-4" />
      {label}
    </button>
  );
}

/** Small label shown above a line control on narrow screens, where the column header is hidden. */
export function MobileLabel({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-1 block text-xs font-medium text-muted-foreground md:hidden">
      {children}
    </label>
  );
}

/** Inline line-level message under a row. */
export function LineMessage({ tone, children }: { tone: "error" | "warning" | "muted"; children: React.ReactNode }) {
  return (
    <p
      role={tone === "error" ? "alert" : undefined}
      className={cn(
        "mt-1 text-xs",
        tone === "error" && "text-destructive",
        tone === "warning" && "text-warning",
        tone === "muted" && "text-muted-foreground",
      )}
    >
      {children}
    </p>
  );
}
