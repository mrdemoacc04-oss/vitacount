"use client";

import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

/**
 * A table row that opens `href` when clicked anywhere. Keep a real <Link> in
 * one of its cells for keyboard and screen-reader users; clicks on links,
 * buttons and form controls inside the row are left to those controls.
 */
export function RowLink({ href, className, children }: { href: string; className?: string; children: React.ReactNode }) {
  const router = useRouter();
  return (
    <tr
      onClick={(e) => {
        if ((e.target as HTMLElement).closest("a, button, input, select, textarea, label")) return;
        if (e.metaKey || e.ctrlKey) {
          window.open(href, "_blank", "noopener");
          return;
        }
        router.push(href);
      }}
      className={cn("cursor-pointer transition-colors hover:bg-accent", className)}
    >
      {children}
    </tr>
  );
}
