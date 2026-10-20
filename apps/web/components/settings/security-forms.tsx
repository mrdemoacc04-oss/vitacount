"use client";

import { useSyncExternalStore } from "react";
import { Input } from "@/components/ui/input";
import { Field, FormMessage, FormSection, SubmitButton } from "@/components/ui/field";
import { SettingsFormShell, useSettingsAction } from "@/components/settings/settings-form";
import { changePasswordAction, signOutOtherDevicesAction } from "@/lib/actions/settings";

export function ChangePasswordForm() {
  const form = useSettingsAction(changePasswordAction, { resetOnSuccess: true });
  const { errors } = form;

  return (
    <SettingsFormShell form={form} submitLabel="Change password" pendingLabel="Changing…">
      <FormSection title="Password" description="Use at least 8 characters. A longer passphrase is stronger than a short, complex one.">
        <Field label="New password" htmlFor="password" error={errors.password} hint="At least 8 characters.">
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            className="h-9 px-3"
            aria-invalid={errors.password ? true : undefined}
          />
        </Field>
        <Field label="Confirm new password" htmlFor="confirmPassword" error={errors.confirmPassword}>
          <Input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            className="h-9 px-3"
            aria-invalid={errors.confirmPassword ? true : undefined}
          />
        </Field>
      </FormSection>
    </SettingsFormShell>
  );
}

export function SessionsCard({ lastSignInAt, createdAt }: { lastSignInAt: string | null; createdAt: string | null }) {
  const form = useSettingsAction(signOutOtherDevicesAction);

  return (
    <section className="rounded-xl border border-border bg-card px-5 py-6 shadow-soft-sm md:px-7">
      <FormSection
        title="Sessions"
        description="If you signed in on a shared or lost device, sign it out here. You'll stay signed in on this browser."
      >
        <dl className="grid gap-3.5">
          <div className="grid gap-0.5 sm:grid-cols-[160px_minmax(0,1fr)] sm:gap-4">
            <dt className="text-[13px] text-muted-foreground">Last sign-in</dt>
            <dd className="text-[13px] text-foreground">
              <LocalDateTime iso={lastSignInAt} />
            </dd>
          </div>
          <div className="grid gap-0.5 sm:grid-cols-[160px_minmax(0,1fr)] sm:gap-4">
            <dt className="text-[13px] text-muted-foreground">Account created</dt>
            <dd className="text-[13px] text-foreground">
              <LocalDateTime iso={createdAt} dateOnly />
            </dd>
          </div>
        </dl>

        <form onSubmit={form.onSubmit} className="flex flex-col items-start gap-3">
          {form.state.error && <FormMessage>{form.state.error}</FormMessage>}
          {form.showSuccess && <FormMessage tone="success">{form.state.success}</FormMessage>}
          <SubmitButton variant="secondary" pending={form.pending} pendingLabel="Signing out…">
            Sign out of other devices
          </SubmitButton>
        </form>
      </FormSection>
    </section>
  );
}

const noopSubscribe = () => () => {};

/** Formats in the viewer's own time zone; renders nothing on the server to avoid a mismatch. */
function LocalDateTime({ iso, dateOnly = false }: { iso: string | null; dateOnly?: boolean }) {
  const text = useSyncExternalStore(
    noopSubscribe,
    () => {
      if (!iso) return "Never";
      const date = new Date(iso);
      if (Number.isNaN(date.getTime())) return "Unknown";
      return new Intl.DateTimeFormat(undefined, dateOnly ? { dateStyle: "medium" } : { dateStyle: "medium", timeStyle: "short" }).format(date);
    },
    () => null,
  );
  if (text === null) return <span className="text-muted-foreground">…</span>;
  return iso ? <time dateTime={iso}>{text}</time> : <span>{text}</span>;
}
