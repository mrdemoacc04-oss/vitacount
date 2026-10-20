"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signIn, type AuthActionState } from "@/lib/actions/auth";
import { FormMessage, SubmitButton } from "@/components/ui/field";
import { PasswordInput, authInputClass } from "@/components/auth/password-input";

const initialState: AuthActionState = { error: null };

export function LoginForm({ next, linkError }: { next?: string; linkError?: boolean }) {
  const [state, formAction, pending] = useActionState(signIn, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-5" noValidate>
      {next && <input type="hidden" name="next" value={next} />}

      {linkError && !state.error && (
        <FormMessage>
          That email link didn&apos;t work. It may have expired, been used already, or been opened in a different browser.
          Log in with your password, or request a new link.
        </FormMessage>
      )}
      {state.error && <FormMessage>{state.error}</FormMessage>}

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
          autoFocus
          placeholder="you@company.com"
          defaultValue={state.email}
          key={state.email ?? "email"}
          className={authInputClass}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-baseline justify-between">
          <label htmlFor="password" className="text-[13px] font-medium text-foreground">
            Password
          </label>
          <Link href="/reset-password" className="text-[13px] font-medium text-primary hover:underline">
            Forgot password?
          </Link>
        </div>
        <PasswordInput id="password" autoComplete="current-password" />
      </div>

      <SubmitButton pending={pending} pendingLabel="Logging in…" className="mt-1 h-11 w-full text-[15px]">
        Log in
      </SubmitButton>
    </form>
  );
}
