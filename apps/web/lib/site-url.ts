import "server-only";
import { headers } from "next/headers";

/**
 * The origin the user is actually on (e.g. https://vitacount-web.vercel.app), for
 * links that come back to the app: email confirmation, password reset, invites,
 * Stripe return URLs.
 *
 * Derived from the request rather than NEXT_PUBLIC_SITE_URL on purpose. Email links
 * use the PKCE flow, whose code verifier is a cookie on the domain that started the
 * flow — the link must come back to that same domain. An env var that drifts (it
 * defaulted to http://localhost:3000 in production, which Supabase rejected and
 * replaced with the bare Site URL, so every confirmation/reset link dropped users on
 * a logged-out page) can't get that right; the request can. The env var is only a
 * fallback for contexts without a request.
 */
export async function getSiteUrl(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (host) {
    const proto =
      h.get("x-forwarded-proto")?.split(",")[0]?.trim() ??
      (host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https");
    return `${proto}://${host}`;
  }
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}
