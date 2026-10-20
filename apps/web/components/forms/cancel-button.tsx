"use client";

import { useRouter } from "next/navigation";
import { secondaryButtonClass } from "@/components/ui/field";
import { cn } from "@/lib/utils";

/**
 * Leaves the form. When there are unsaved edits it asks first, so a stray click
 * doesn't throw away a half-entered invoice.
 */
export function CancelButton({
  href,
  dirty,
  label = "Cancel",
  className,
}: {
  href: string;
  dirty: boolean;
  label?: string;
  className?: string;
}) {
  const router = useRouter();
  return (
    <button
      type="button"
      className={cn(secondaryButtonClass, "cursor-pointer", className)}
      onClick={() => {
        if (dirty && !window.confirm("Discard your changes? Anything you've entered on this form will be lost.")) return;
        router.push(href);
      }}
    >
      {label}
    </button>
  );
}
