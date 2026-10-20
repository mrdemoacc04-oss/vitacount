"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Field, FormSection } from "@/components/ui/field";
import { initials } from "@/components/settings/options";
import { SettingsFormShell, useSettingsAction } from "@/components/settings/settings-form";
import { changeEmailAction, updateProfileAction } from "@/lib/actions/settings";

export function ProfileNameForm({ fullName, email }: { fullName: string; email: string }) {
  const form = useSettingsAction(updateProfileAction);
  const [name, setName] = useState(fullName);

  return (
    <SettingsFormShell form={form}>
      <FormSection title="Profile" description="How you appear to teammates, in comments and on activity.">
        <div className="flex items-center gap-4">
          <span
            aria-hidden="true"
            className="flex size-14 shrink-0 items-center justify-center rounded-full bg-primary/10 font-heading text-lg font-semibold text-primary ring-1 ring-primary/15"
          >
            {initials(name, email)}
          </span>
          <div className="min-w-0">
            <p className="truncate text-[13px] font-medium text-foreground">{name.trim() || "Your name"}</p>
            <p className="truncate text-xs text-muted-foreground">{email}</p>
          </div>
        </div>
        <Field label="Full name" htmlFor="fullName" required error={form.errors.fullName}>
          <Input
            id="fullName"
            name="fullName"
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={120}
            className="h-9 px-3"
            aria-invalid={form.errors.fullName ? true : undefined}
          />
        </Field>
      </FormSection>
    </SettingsFormShell>
  );
}

export function ChangeEmailForm({ email, pendingEmail }: { email: string; pendingEmail: string | null }) {
  const form = useSettingsAction(changeEmailAction, { resetOnSuccess: true });

  return (
    <SettingsFormShell form={form} submitLabel="Send confirmation link" pendingLabel="Sending…">
      <FormSection title="Email address" description="The address you sign in with and where VitaCount sends account email.">
        <div>
          <p className="text-[13px] text-muted-foreground">Current email</p>
          <p className="mt-0.5 text-[13px] font-medium text-foreground">{email}</p>
          {pendingEmail && (
            <p className="mt-2 inline-flex rounded-md bg-warning/12 px-1.5 py-0.5 text-[11px] font-medium text-warning">
              Waiting for you to confirm {pendingEmail}
            </p>
          )}
        </div>
        <Field
          label="New email"
          htmlFor="email"
          error={form.errors.email}
          hint="We'll email a confirmation link to the new address. Nothing changes until you open it — you may be asked to confirm from your current address too."
        >
          <Input
            id="email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="you@yourcompany.com"
            className="h-9 px-3"
            aria-invalid={form.errors.email ? true : undefined}
          />
        </Field>
      </FormSection>
    </SettingsFormShell>
  );
}
