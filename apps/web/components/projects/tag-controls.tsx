"use client";

import { useRef, useState, useTransition } from "react";
import { Icons } from "@/components/icons";
import { useDismiss } from "@/lib/use-dismiss";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/dates";
import { tagDocumentAction, untagDocumentAction } from "@/lib/actions/projects";
import { currency, type DocumentKind } from "@/components/projects/shared";

export interface TagCandidate {
  id: string;
  label: string;
  detail: string | null;
  party: string | null;
  partyId: string | null;
  date: string;
  amount: number;
}

const NOUN: Record<DocumentKind, string> = {
  sales: "sales documents",
  purchase: "bills or supplier credits",
  expense: "expenses",
};

/**
 * "Add existing…" picker: recent documents not tagged to any project. For sales,
 * the project's customer can scope the list (on by default when there is one).
 */
export function AddExistingDocuments({
  tenantId,
  projectId,
  kind,
  candidates,
  customer,
}: {
  tenantId: string;
  projectId: string;
  kind: DocumentKind;
  candidates: TagCandidate[];
  customer?: { id: string; name: string } | null;
}) {
  const [open, setOpen] = useState(false);
  const [onlyCustomer, setOnlyCustomer] = useState(!!customer);
  const [added, setAdded] = useState<Set<string>>(new Set());
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement>(null);
  useDismiss(ref, open, () => setOpen(false));

  const scoped = customer && onlyCustomer ? candidates.filter((c) => c.partyId === customer.id) : candidates;
  const visible = scoped.filter((c) => !added.has(c.id));

  function add(id: string) {
    setBusyId(id);
    setError(null);
    startTransition(async () => {
      const result = await tagDocumentAction(tenantId, projectId, kind, id);
      setBusyId(null);
      if (result.error) setError(result.error);
      else setAdded((prev) => new Set(prev).add(id));
    });
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="dialog"
        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 text-[13px] font-medium text-foreground shadow-soft-sm transition-colors hover:bg-muted"
      >
        <Icons.plus className="size-3.5" />
        Add existing…
      </button>

      {open && (
        <div
          role="dialog"
          aria-label={`Add existing ${NOUN[kind]}`}
          className="absolute right-0 top-full z-20 mt-1.5 w-[min(380px,calc(100vw-2rem))] overflow-hidden rounded-xl border border-border bg-popover shadow-soft"
        >
          <div className="border-b border-border px-3.5 py-2.5">
            <p className="text-[13px] font-medium text-foreground">Tag {NOUN[kind]} to this project</p>
            <p className="mt-0.5 text-xs text-muted-foreground">Recent ones without a project.</p>
            {customer && (
              <div className="mt-2 inline-flex rounded-lg bg-muted p-0.5 text-xs" role="group" aria-label="Which customers">
                {[
                  { value: true, label: customer.name },
                  { value: false, label: "All customers" },
                ].map((opt) => (
                  <button
                    key={String(opt.value)}
                    type="button"
                    aria-pressed={onlyCustomer === opt.value}
                    onClick={() => setOnlyCustomer(opt.value)}
                    className={cn(
                      "max-w-40 truncate rounded-md px-2 py-1 font-medium transition-colors",
                      onlyCustomer === opt.value ? "bg-card text-foreground shadow-soft-sm" : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {error && (
            <p className="border-b border-border bg-destructive/[0.05] px-3.5 py-2 text-xs text-destructive" role="alert">
              {error}
            </p>
          )}

          {visible.length === 0 ? (
            <p className="px-3.5 py-5 text-[13px] text-muted-foreground">
              {customer && onlyCustomer
                ? `No untagged ${NOUN[kind]} for ${customer.name}.`
                : `No untagged ${NOUN[kind]} to add.`}
            </p>
          ) : (
            <ul className="max-h-80 divide-y divide-border overflow-y-auto">
              {visible.map((c) => (
                <li key={c.id} className="flex items-center gap-3 px-3.5 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium text-foreground">{c.label}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {[c.detail, c.party, formatDate(c.date)].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <span className="shrink-0 text-[13px] tabular-nums text-foreground">{c.amount < 0 ? `−${currency(-c.amount)}` : currency(c.amount)}</span>
                  <button
                    type="button"
                    disabled={busyId !== null}
                    onClick={() => add(c.id)}
                    className="inline-flex h-7 shrink-0 items-center rounded-md bg-primary/10 px-2.5 text-xs font-medium text-primary transition-colors hover:bg-primary/15 disabled:opacity-60"
                  >
                    {busyId === c.id ? "Adding…" : "Add"}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

/** Per-row "remove from project" action. Only the tag goes; the document stays. */
export function RemoveTagButton({ tenantId, projectId, kind, documentId, label }: { tenantId: string; projectId: string; kind: DocumentKind; documentId: string; label: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <span className="inline-flex items-center gap-2">
      {error && (
        <span className="text-xs text-destructive" role="alert">
          {error}
        </span>
      )}
      <button
        type="button"
        disabled={pending}
        title="Remove from project"
        aria-label={`Remove ${label} from this project`}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const result = await untagDocumentAction(tenantId, projectId, kind, documentId);
            if (result.error) setError(result.error);
          })
        }
        className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-destructive disabled:opacity-50"
      >
        <Icons.close className="size-3.5" />
      </button>
    </span>
  );
}
