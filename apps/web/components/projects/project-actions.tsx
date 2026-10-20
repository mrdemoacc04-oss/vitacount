"use client";

import { useRef, useState, useTransition } from "react";
import { Icons } from "@/components/icons";
import { useDismiss } from "@/lib/use-dismiss";
import { cn } from "@/lib/utils";
import { deleteProjectAction, setProjectStatusAction } from "@/lib/actions/projects";
import { PROJECT_STATUSES, PROJECT_STATUS_LABEL, PROJECT_STATUS_STYLE, type ProjectStatus } from "@/components/projects/shared";

/** The status badge doubles as a menu to move the project to another status. */
export function ProjectStatusControl({ tenantId, projectId, status }: { tenantId: string; projectId: string; status: ProjectStatus }) {
  const [open, setOpen] = useState(false);
  const [optimistic, setOptimistic] = useState<ProjectStatus>(status);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement>(null);
  useDismiss(ref, open, () => setOpen(false));

  // A server refresh after the action brings the new status in as a prop.
  const [lastStatus, setLastStatus] = useState(status);
  if (status !== lastStatus) {
    setLastStatus(status);
    setOptimistic(status);
  }

  function choose(next: ProjectStatus) {
    setOpen(false);
    if (next === optimistic) return;
    const previous = optimistic;
    setOptimistic(next);
    setError(null);
    startTransition(async () => {
      const result = await setProjectStatusAction(tenantId, projectId, next);
      if (result.error) {
        setOptimistic(previous);
        setError(result.error);
      }
    });
  }

  return (
    <div ref={ref} className="relative inline-flex flex-col items-start">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={pending}
        className={cn(
          "inline-flex items-center gap-1 rounded-md py-0.5 pl-1.5 pr-1 text-[11px] font-medium transition-opacity hover:opacity-80 disabled:opacity-60",
          PROJECT_STATUS_STYLE[optimistic],
        )}
      >
        {PROJECT_STATUS_LABEL[optimistic]}
        <Icons.chevronDown className="size-3" />
        <span className="sr-only">Change status</span>
      </button>
      {open && (
        <div role="menu" className="absolute left-0 top-full z-20 mt-1.5 w-44 rounded-lg border border-border bg-popover p-1 shadow-soft">
          {PROJECT_STATUSES.map((s) => (
            <button
              key={s}
              type="button"
              role="menuitemradio"
              aria-checked={s === optimistic}
              onClick={() => choose(s)}
              className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-[13px] text-foreground hover:bg-accent"
            >
              {PROJECT_STATUS_LABEL[s]}
              {s === optimistic && <Icons.check className="size-3.5 text-primary" />}
            </button>
          ))}
        </div>
      )}
      {error && (
        <p className="mt-1 text-xs text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

/** Two-step delete: the first click explains what happens to tagged documents. */
export function DeleteProjectButton({ tenantId, projectId, projectName }: { tenantId: string; projectId: string; projectName: string }) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="inline-flex h-9 items-center justify-center rounded-lg border border-border bg-card px-3.5 text-[13px] font-medium text-destructive shadow-soft-sm transition-colors hover:bg-destructive/[0.06]"
      >
        Delete
      </button>
    );
  }

  return (
    <div
      role="alertdialog"
      aria-labelledby="delete-project-title"
      className="w-full rounded-xl border border-destructive/25 bg-destructive/[0.04] p-4 sm:max-w-md"
    >
      <p id="delete-project-title" className="text-[13px] font-semibold text-foreground">
        Delete {projectName}?
      </p>
      <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
        Invoices, bills and expenses tagged to it stay in your books unchanged; they just lose the project tag. This can&apos;t be undone.
      </p>
      {error && (
        <p className="mt-2 text-xs text-destructive" role="alert">
          {error}
        </p>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              setError(null);
              const result = await deleteProjectAction(tenantId, projectId);
              if (result?.error) setError(result.error);
            })
          }
          className="inline-flex h-8 items-center rounded-lg bg-destructive px-3 text-[13px] font-medium text-white transition-opacity hover:bg-destructive/90 disabled:opacity-60"
        >
          {pending ? "Deleting…" : "Delete project"}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            setConfirming(false);
            setError(null);
          }}
          className="inline-flex h-8 items-center rounded-lg border border-border bg-card px-3 text-[13px] font-medium text-foreground hover:bg-muted"
        >
          Keep project
        </button>
      </div>
    </div>
  );
}
