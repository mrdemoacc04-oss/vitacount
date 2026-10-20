"use client";

import { useActionState } from "react";
import { updatePassword, type AuthActionState } from "@/lib/actions/auth";
import { FormMessage, SubmitButton } from "@/components/ui/field";
import { PasswordInput } from "@/components/auth/password-input";

const initialState: AuthActionState = { error: null };

export function NewPasswordForm({ submitLabel }: { submitLabel: string }) {
  const [state, formAction, pending] = useActionState(updatePassword, initialState);
  return (
    <form action={formAction} className="flex flex-col gap-5" noValidate>
      {state.error && <FormMessage>{state.error}</FormMessage>}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className="text-[13px] font-medium text-foreground">
          New password
        </label>
        <PasswordInput id="password" autoComplete="new-password" minLength={8} showStrength />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="confirmPassword" className="text-[13px] font-medium text-foreground">
          Confirm password
        </label>
        <PasswordInput id="confirmPassword" name="confirmPassword" autoComplete="new-password" minLength={8} />
      </div>
      <SubmitButton pending={pending} pendingLabel="Saving…" className="mt-1 h-11 w-full text-[15px]">
        {submitLabel}
      </SubmitButton>
    </form>
  );
}
