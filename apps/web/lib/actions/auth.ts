"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSiteUrl } from "@/lib/site-url";

export type AuthActionState = {
  error: string | null;
  /** echoes the email back so a failed attempt doesn't wipe what was typed */
  email?: string;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Only same-site relative paths, so `?next=` can't bounce people to another domain. */
function safeNext(value: FormDataEntryValue | null): string {
  const next = String(value ?? "");
  return next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : "/dashboard";
}

/** Supabase auth messages, rewritten for the people reading them. */
function friendlyAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) return "That email and password don't match. Check them and try again, or reset your password.";
  if (m.includes("email not confirmed")) return "Confirm your email first — we sent a link when you signed up. Check your inbox and spam folder.";
  if (m.includes("user already registered")) return "An account with that email already exists. Log in instead, or reset your password.";
  if (m.includes("rate limit") || m.includes("too many")) return "Too many attempts. Wait a minute, then try again.";
  if (m.includes("weak password") || m.includes("password should be")) return "Choose a stronger password: at least 8 characters, mixing letters and numbers.";
  if (m.includes("same password") || m.includes("should be different")) return "Your new password must be different from the current one.";
  if (m.includes("fetch failed") || m.includes("network")) return "We couldn't reach the server. Check your connection and try again.";
  return message.charAt(0).toUpperCase() + message.slice(1);
}

export async function signUp(_prevState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const fullName = String(formData.get("fullName") ?? "").trim();

  if (!fullName) return { error: "Enter your name.", email };
  if (!EMAIL_RE.test(email)) return { error: "Enter a valid email address.", email };
  if (password.length < 8) return { error: "Use at least 8 characters for your password.", email };

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
      emailRedirectTo: `${await getSiteUrl()}/auth/callback?next=/onboarding`,
    },
  });

  if (error) {
    return { error: friendlyAuthError(error.message), email };
  }

  redirect(`/signup/check-email?email=${encodeURIComponent(email)}`);
}

export async function signIn(_prevState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!EMAIL_RE.test(email)) return { error: "Enter a valid email address.", email };
  if (!password) return { error: "Enter your password.", email };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: friendlyAuthError(error.message), email };
  }

  redirect(safeNext(formData.get("next")));
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function requestPasswordReset(_prevState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!EMAIL_RE.test(email)) return { error: "Enter a valid email address.", email };

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${await getSiteUrl()}/auth/callback?next=/reset-password/confirm`,
  });

  if (error) {
    return { error: friendlyAuthError(error.message), email };
  }

  redirect(`/reset-password/check-email?email=${encodeURIComponent(email)}`);
}

export async function updatePassword(_prevState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const password = String(formData.get("password") ?? "");
  const confirm = formData.get("confirmPassword");

  if (password.length < 8) return { error: "Use at least 8 characters for your password." };
  if (confirm !== null && String(confirm) !== password) return { error: "The two passwords don't match." };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    return { error: friendlyAuthError(error.message) };
  }

  redirect("/dashboard");
}
