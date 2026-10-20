"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { friendlyDbError } from "@/lib/db-errors";
import { ACTIVE_TENANT_COOKIE } from "@/lib/tenant/data";
import { DEFAULT_COUNTRY, DEFAULT_TERMS_OPTIONS, US_STATES, US_TIME_ZONES } from "@/components/settings/options";

export type OnboardingState = { error: string | null; fieldErrors?: Record<string, string> };

const EIN = /^\d{2}-?\d{7}$/;

/**
 * Creates the workspace (create_tenant makes the caller its owner), then saves any
 * optional business details through update_workspace_profile. The details are a
 * convenience: if that call fails (for example the profile migration isn't applied
 * yet) the workspace still exists and they can be filled in from Settings.
 */
export async function createWorkspaceAction(_prev: OnboardingState, formData: FormData): Promise<OnboardingState> {
  const text = (key: string) => String(formData.get(key) ?? "").trim();
  const name = text("name");
  const legalName = text("legalName");
  const taxId = text("taxId");
  const phone = text("phone");
  const state = text("state").toUpperCase();
  const fiscalMonth = Number.parseInt(text("fiscalYearStartMonth") || "1", 10);
  const terms = text("defaultPaymentTerms") || "net_30";
  const timezone = text("timezone");

  const fieldErrors: Record<string, string> = {};
  if (!name) fieldErrors.name = "Give your workspace a name.";
  else if (name.length > 120) fieldErrors.name = "Keep the name under 120 characters.";
  if (taxId && !EIN.test(taxId)) fieldErrors.taxId = "Use the 9-digit EIN format, like 12-3456789.";
  if (phone && phone.replace(/\D/g, "").length < 10) fieldErrors.phone = "Enter a 10-digit phone number.";
  if (state && !US_STATES.some(([code]) => code === state)) fieldErrors.state = "Choose a state from the list.";
  if (!(fiscalMonth >= 1 && fiscalMonth <= 12)) fieldErrors.fiscalYearStartMonth = "Choose a month.";
  if (!DEFAULT_TERMS_OPTIONS.some(([value]) => value === terms)) fieldErrors.defaultPaymentTerms = "Choose payment terms from the list.";
  if (Object.keys(fieldErrors).length > 0) return { error: null, fieldErrors };

  const supabase = await createClient();
  const { data: tenantId, error } = await supabase.rpc("create_tenant", { tenant_name: name });
  if (error || !tenantId) {
    return { error: error ? friendlyDbError(error) : "Couldn't create the workspace. Try again." };
  }

  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_TENANT_COOKIE, tenantId as string, {
    path: "/",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
  });

  const knownTimezone = US_TIME_ZONES.some(([tz]) => tz === timezone);
  const hasDetails = legalName || taxId || phone || state || fiscalMonth !== 1 || terms !== "net_30" || knownTimezone;
  if (hasDetails) {
    const { error: profileError } = await supabase.rpc("update_workspace_profile", {
      p_tenant_id: tenantId as string,
      p_name: name,
      // nullable params; the generated types don't say so
      p_legal_name: (legalName || null) as string,
      p_tax_id: (taxId ? `${taxId.replace(/\D/g, "").slice(0, 2)}-${taxId.replace(/\D/g, "").slice(2)}` : null) as string,
      p_email: null as unknown as string,
      p_phone: (phone || null) as string,
      p_website: null as unknown as string,
      p_address: state ? { state, country: DEFAULT_COUNTRY } : {},
      p_fiscal_year_start_month: fiscalMonth,
      p_timezone: (knownTimezone ? timezone : null) as string,
      p_default_payment_terms: terms,
      p_default_tax_rate: null as unknown as number,
      p_invoice_notes: null as unknown as string,
      p_invoice_footer: null as unknown as string,
    });
    if (profileError) {
      // the workspace exists; the details can be added later in Settings
      console.warn("onboarding: business details not saved:", profileError.message);
    }
  }

  redirect("/dashboard");
}
