"use server";

import { cookies } from "next/headers";
import { ACTIVE_TENANT_COOKIE } from "@/lib/tenant/data";

export async function switchTenantAction(tenantId: string) {
  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_TENANT_COOKIE, tenantId, {
    path: "/",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
  });
}
