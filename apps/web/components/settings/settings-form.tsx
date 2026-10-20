"use client";

import * as React from "react";
import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import { FormMessage, SubmitButton } from "@/components/ui/field";
import { Icons } from "@/components/icons";
import { ROLE_LABEL, isRole } from "@/components/settings/options";
import type { SettingsFormState } from "@/lib/actions/settings";

export const initialSettingsState: SettingsFormState = { error: null, success: null };

/**
 * useActionState driven from onSubmit instead of <form action>, so React doesn't
 * reset the fields after each submit: on a validation error the user's input stays
 * put. The success banner hides again as soon as anything is edited.
 */
export function useSettingsAction(
  action: (state: SettingsFormState, formData: FormData) => Promise<SettingsFormState>,
  options: { resetOnSuccess?: boolean } = {},
) {
  const [state, dispatch, pending] = useActionState(action, initialSettingsState);
  const [dirty, setDirty] = useState(false);
  const submittedForm = useRef<HTMLFormElement | null>(null);
  const resetOnSuccess = options.resetOnSuccess ?? false;

  // e.g. clear password fields once the change went through
  useEffect(() => {
    if (resetOnSuccess && state.success) submittedForm.current?.reset();
  }, [state, resetOnSuccess]);

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    submittedForm.current = event.currentTarget;
    const formData = new FormData(event.currentTarget);
    setDirty(false);
    startTransition(() => dispatch(formData));
  }

  return {
    state,
    pending,
    onSubmit,
    markDirty: () => setDirty(true),
    showSuccess: Boolean(state.success) && !dirty && !pending,
    errors: state.fieldErrors ?? {},
  };
}

/** A card-shaped form: banners on top, sections in the middle, a sticky save bar at the bottom. */
export function SettingsFormShell({
  form,
  children,
  submitLabel = "Save changes",
  pendingLabel = "Saving…",
  footerNote,
}: {
  form: ReturnType<typeof useSettingsAction>;
  children: React.ReactNode;
  submitLabel?: string;
  pendingLabel?: string;
  footerNote?: React.ReactNode;
}) {
  return (
    <form onSubmit={form.onSubmit} onChange={form.markDirty} noValidate className="rounded-xl border border-border bg-card shadow-soft-sm">
      {(form.state.error || form.showSuccess) && (
        <div className="px-5 pt-5 md:px-7">
          {form.state.error ? (
            <FormMessage>{form.state.error}</FormMessage>
          ) : (
            <FormMessage tone="success">{form.state.success}</FormMessage>
          )}
        </div>
      )}
      <div className="px-5 py-6 md:px-7">{children}</div>
      <div className="sticky bottom-0 z-10 flex flex-wrap items-center justify-end gap-3 rounded-b-xl border-t border-border bg-card/90 px-5 py-3 backdrop-blur md:px-7">
        {footerNote && <p className="mr-auto text-xs text-muted-foreground">{footerNote}</p>}
        <SubmitButton pending={form.pending} pendingLabel={pendingLabel}>
          {submitLabel}
        </SubmitButton>
      </div>
    </form>
  );
}

/** Section heading inside the settings column (the page-level h1 lives in the layout). */
export function SettingsHeading({ title, description }: { title: string; description: React.ReactNode }) {
  return (
    <div className="mb-5">
      <h2 className="font-heading text-lg font-semibold tracking-tight">{title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

/** Shown above read-only settings for members who can't edit them. */
export function ReadOnlyNotice({ role }: { role: string | null }) {
  const label = isRole(role) ? ROLE_LABEL[role].toLowerCase() : "member";
  return (
    <div className="mb-5 flex items-start gap-2.5 rounded-lg border border-border bg-surface px-3.5 py-2.5 text-[13px] text-muted-foreground">
      <Icons.shield className="mt-px size-4 shrink-0" />
      <p>
        Only owners and admins can change these settings. You&apos;re {/^[aeiou]/.test(label) ? "an" : "a"}{" "}
        {label} in this workspace — ask an owner or admin if something needs updating.
      </p>
    </div>
  );
}

/** Label/value rows for the read-only view. */
export function ReadOnlyRows({ rows }: { rows: [label: string, value: React.ReactNode][] }) {
  return (
    <dl className="grid gap-3.5">
      {rows.map(([label, value]) => (
        <div key={label} className="grid gap-0.5 sm:grid-cols-[160px_minmax(0,1fr)] sm:gap-4">
          <dt className="text-[13px] text-muted-foreground">{label}</dt>
          <dd className="whitespace-pre-line break-words text-[13px] text-foreground">
            {value || <span className="text-muted-foreground">Not set</span>}
          </dd>
        </div>
      ))}
    </dl>
  );
}
