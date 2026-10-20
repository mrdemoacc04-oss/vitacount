"use client";

import { useActionState } from "react";
import { requestPasswordReset, type AuthActionState } from "@/lib/actions/auth";
import { FormMessage, SubmitButton } from "@/components/ui/field";
import { authInputClass } from "@/components/auth/password-input";

const initialState: AuthActionState = { error: null };

export function ResetRequestForm() {
  const [state, formAction, pending] = useActionState(requestPasswordReset, initialState);
  return (
    <form action={formAction} className="flex flex-col gap-5" noValidate>
      {state.error && <FormMessage>{state.error}</FormMessage>}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className="text-[13px] font-medium text-foreground">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          autoFocus
          placeholder="you@company.com"
          defaultValue={state.email}
          key={state.email ?? "email"}
          className={authInputClass}
        />
      </div>
      <SubmitButton pending={pending} pendingLabel="Sending…" className="h-11 w-full text-[15px]">
        Send reset link
      </SubmitButton>
    </form>
  );
}
