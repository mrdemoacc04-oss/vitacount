"use client";

import { useState, useTransition } from "react";
import { secondaryButtonClass } from "@/components/ui/field";
import { setItemActiveAction } from "@/lib/actions/inventory";
import { cn } from "@/lib/utils";

/** Archive hides the item from pickers but keeps its history; restore brings it back. */
export function ArchiveItemButton({ tenantId, itemId, isActive }: { tenantId: string; itemId: string; isActive: boolean }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const result = await setItemActiveAction(tenantId, itemId, !isActive);
            if (result.error) setError(result.error);
          })
        }
        className={cn(secondaryButtonClass, "disabled:pointer-events-none disabled:opacity-60")}
      >
        {pending ? (isActive ? "Archiving…" : "Restoring…") : isActive ? "Archive" : "Restore"}
      </button>
      {error && (
        <p role="alert" className="max-w-64 text-right text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
