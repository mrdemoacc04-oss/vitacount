"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Field, FormMessage, Select, SubmitButton, secondaryButtonClass } from "@/components/ui/field";
import { Icons } from "@/components/icons";
import { ROLE_LABEL, ROLE_SUMMARY } from "@/components/settings/options";

/** Roles POST /api/team/invite accepts — owners are made from the team list, not invited. */
const INVITE_ROLES = ["admin", "accountant", "staff", "viewer"] as const;
type InviteRole = (typeof INVITE_ROLES)[number];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function InviteForm({ tenantId }: { tenantId: string }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<InviteRole>("staff");
  const [error, setError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<{ email: string; role: InviteRole } | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const address = email.trim();
    if (!EMAIL_RE.test(address)) {
      setEmailError("Enter an email address like name@company.com.");
      return;
    }
    setEmailError(null);

    startTransition(async () => {
      try {
        const res = await fetch("/api/team/invite", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: address, role, tenantId }),
        });
        const json = (await res.json().catch(() => ({}))) as { error?: string };
        if (!res.ok) {
          setError(json.error ?? "The invitation couldn't be sent. Try again.");
          return;
        }
        setSentTo({ email: address, role });
        setEmail("");
        router.refresh();
      } catch {
        setError("You appear to be offline. Check your connection and try again.");
      }
    });
  }

  if (sentTo) {
    return (
      <div className="flex flex-col items-start gap-4" role="status">
        <div className="flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-positive/10 text-positive">
            <Icons.check className="size-[18px]" />
          </span>
          <div>
            <p className="text-[13px] font-medium text-foreground">Invitation sent to {sentTo.email}</p>
            <p className="mt-0.5 text-[13px] text-muted-foreground">
              They&apos;ll join as {/^[aeiou]/i.test(ROLE_LABEL[sentTo.role]) ? "an" : "a"} {ROLE_LABEL[sentTo.role].toLowerCase()} and show as
              Invited in the list above until they open the link in their email.
            </p>
          </div>
        </div>
        <button type="button" onClick={() => setSentTo(null)} className={secondaryButtonClass}>
          <Icons.userPlus className="size-4" />
          Invite someone else
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
      {error && <FormMessage>{error}</FormMessage>}
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_180px]">
        <Field label="Email" htmlFor="invite-email" error={emailError}>
          <Input
            id="invite-email"
            type="email"
            inputMode="email"
            autoComplete="off"
            placeholder="name@company.com"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (emailError) setEmailError(null);
            }}
            aria-invalid={emailError ? true : undefined}
            className="h-9 px-3"
          />
        </Field>
        <Field label="Role" htmlFor="invite-role">
          <Select id="invite-role" value={role} onChange={(e) => setRole(e.target.value as InviteRole)}>
            {INVITE_ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABEL[r]}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <p className="-mt-1 text-xs text-muted-foreground">{ROLE_SUMMARY[role]}</p>
      <div>
        <SubmitButton pending={pending} pendingLabel="Sending…">
          Send invite
        </SubmitButton>
      </div>
    </form>
  );
}
