"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * A table row that opens its detail page when clicked anywhere. The row's main
 * cell should still hold a real <Link> so keyboard and middle-click work.
 */
export function ClickableRow({ href, className, children }: { href: string; className?: string; children: ReactNode }) {
  const router = useRouter();
  return (
    <tr
      onClick={(event) => {
        // let real links, buttons and text selection behave normally
        if ((event.target as HTMLElement).closest("a, button") || window.getSelection()?.toString()) return;
        router.push(href);
      }}
      className={cn("cursor-pointer transition-colors duration-150 hover:bg-accent", className)}
    >
      {children}
    </tr>
  );
}
