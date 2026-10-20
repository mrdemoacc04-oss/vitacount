"use client";

import { useActionState } from "react";
import { signUp, type AuthActionState } from "@/lib/actions/auth";
import { FormMessage, SubmitButton } from "@/components/ui/field";
import { PasswordInput, authInputClass } from "@/components/auth/password-input";

const initialState: AuthActionState = { error: null };

export function SignupForm() {
  const [state, formAction, pending] = useActionState(signUp, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-5" noValidate>
      {state.error && <FormMessage>{state.error}</FormMessage>}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="fullName" className="text-[13px] font-medium text-foreground">
          Full name
        </label>
        <input id="fullName" name="fullName" type="text" required autoComplete="name" autoFocus placeholder="Alex Morgan" className={authInputClass} />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className="text-[13px] font-medium text-foreground">
          Work email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@company.com"
          defaultValue={state.email}
          key={state.email ?? "email"}
          className={authInputClass}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className="text-[13px] font-medium text-foreground">
          Password
        </label>
        <PasswordInput id="password" autoComplete="new-password" minLength={8} showStrength />
      </div>

      <SubmitButton pending={pending} pendingLabel="Creating account…" className="mt-1 h-11 w-full text-[15px]">
        Create account
      </SubmitButton>

      <p className="text-center text-xs leading-relaxed text-muted-foreground">
        You&apos;ll confirm your email next, then set up your workspace. Your data stays private to your workspace.
      </p>
    </form>
  );
}
