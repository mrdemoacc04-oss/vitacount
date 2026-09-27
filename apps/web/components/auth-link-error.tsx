"use client";

import { useSearchParams } from "next/navigation";

/** Explains a failed email link (/auth/callback redirects here with ?error=auth_callback_failed). */
export function AuthLinkError() {
  const searchParams = useSearchParams();
  if (searchParams.get("error") !== "auth_callback_failed") return null;

  return (
    <p className="mb-4 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
      That email link didn&apos;t work — it may have expired, been used already, or been opened in a different browser.
      Log in with your password, or request a new link with “Forgot password?”.
    </p>
  );
}
