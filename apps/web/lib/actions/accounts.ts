"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { friendlyDbError } from "@/lib/db-errors";

export type CreateAccountState = { error: string | null; fieldErrors?: Record<string, string>; created?: string };

const ACCOUNT_TYPES = ["asset", "liability", "equity", "revenue", "expense"] as const;
const CODE = /^[0-9A-Za-z][0-9A-Za-z.-]{0,19}$/;

export async function createAccountAction(
  tenantId: string,
  _prevState: CreateAccountState,
  formData: FormData,
): Promise<CreateAccountState> {
  const code = String(formData.get("code") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const type = String(formData.get("type") ?? "");

  const fieldErrors: Record<string, string> = {};
  if (!code) fieldErrors.code = "Enter an account code.";
  else if (!CODE.test(code)) fieldErrors.code = "Use letters, numbers, dots or dashes (e.g. 6150).";
  if (!name) fieldErrors.name = "Enter an account name.";
  if (!ACCOUNT_TYPES.includes(type as (typeof ACCOUNT_TYPES)[number])) fieldErrors.type = "Choose an account type.";
  if (Object.keys(fieldErrors).length > 0) return { error: null, fieldErrors };

  const supabase = await createClient();
  const { error } = await supabase.from("accounts").insert({
    tenant_id: tenantId,
    code,
    name,
    type,
  });

  if (error) {
    if (error.code === "23505") return { error: null, fieldErrors: { code: `Code ${code} is already used by another account.` } };
    return { error: friendlyDbError(error) };
  }

  revalidatePath("/cpa/accounts");
  return { error: null, created: `${code} · ${name}` };
}
