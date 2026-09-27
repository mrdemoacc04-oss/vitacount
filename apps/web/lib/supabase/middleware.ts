import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/lib/supabase/database.types";

const PUBLIC_PATHS = ["/login", "/signup", "/reset-password", "/auth/callback"];

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}

export async function updateSession(request: NextRequest) {
  // When an email link's redirect isn't accepted, Supabase sends the user to the bare
  // Site URL instead (…/?code=…). Hand that one-time code to the callback so it's
  // exchanged for a session, rather than dropping it on the login redirect below.
  const { searchParams } = request.nextUrl;
  if (request.nextUrl.pathname !== "/auth/callback" && (searchParams.has("code") || searchParams.has("token_hash"))) {
    const callback = new URL("/auth/callback", request.url);
    for (const key of ["code", "token_hash", "type"]) {
      const value = searchParams.get(key);
      if (value) callback.searchParams.set(key, value);
    }
    const next =
      searchParams.get("type") === "recovery"
        ? "/reset-password/confirm"
        : request.nextUrl.pathname === "/"
          ? "/dashboard"
          : request.nextUrl.pathname;
    callback.searchParams.set("next", next);
    return NextResponse.redirect(callback);
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname, search } = request.nextUrl;

  if (!user && !isPublicPath(pathname)) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(loginUrl);
  }

  if (user && (pathname === "/login" || pathname === "/signup")) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return response;
}
