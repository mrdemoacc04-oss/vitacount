"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { LATEST_MIGRATION, friendlyDbError } from "@/lib/db-errors";
import { getSiteUrl } from "@/lib/site-url";
import { percentTextToFraction } from "@/lib/money";
import {
  DEFAULT_COUNTRY,
  DEFAULT_TERMS_OPTIONS,
  US_STATES,
  US_TIME_ZONES,
  isUnitedStates,
} from "@/components/settings/options";
import { loadWorkspaceProfile, type WorkspaceProfile } from "@/components/settings/workspace-profile";

export type SettingsFormState = {
  error: string | null;
  success: string | null;
  fieldErrors?: Record<string, string>;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const US_ZIP_RE = /^\d{5}(-\d{4})?$/;

function field(formData: FormData, name: string, max = 200): string {
  return String(formData.get(name) ?? "")
    .trim()
    .slice(0, max);
}

/** "acme.com" -> "https://acme.com"; null when it can't be a web address. */
function normalizeWebsite(raw: string): string | null {
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const url = new URL(withScheme);
    if (!url.hostname.includes(".") || /\s/.test(raw)) return null;
    return withScheme.replace(/\/$/, "");
  } catch {
    return null;
  }
}

/** Nine digits typed without the dash become the usual EIN shape (12-3456789). */
function normalizeTaxId(raw: string): string {
  const compact = raw.replace(/[\s-]/g, "");
  return /^\d{9}$/.test(compact) ? `${compact.slice(0, 2)}-${compact.slice(2)}` : raw;
}

type Guard = { ok: true; supabase: Awaited<ReturnType<typeof createClient>> } | { ok: false; state: SettingsFormState };

async function requireWorkspaceAdmin(tenantId: string): Promise<Guard> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, state: { error: "Your session has ended. Sign in again.", success: null } };

  const { data: membership } = await supabase
    .from("memberships")
    .select("role")
    .eq("tenant_id", tenantId)
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();
  if (!membership || !["owner", "admin"].includes(membership.role)) {
    return { ok: false, state: { error: "Only owners and admins can change workspace settings.", success: null } };
  }
  return { ok: true, supabase };
}

/**
 * update_workspace_profile replaces every field at once, so each form loads the
 * current row, overlays only the fields it owns, and sends the full set back.
 */
async function saveWorkspaceProfile(
  tenantId: string,
  patch: (current: WorkspaceProfile) => WorkspaceProfile,
  successMessage: string,
): Promise<SettingsFormState> {
  const guard = await requireWorkspaceAdmin(tenantId);
  if (!guard.ok) return guard.state;
  const { supabase } = guard;

  const loaded = await loadWorkspaceProfile(supabase, tenantId);
  if (loaded.status === "missing-schema") {
    return {
      error: `Workspace settings need a database update first. Apply ${LATEST_MIGRATION} in Supabase, then try again.`,
      success: null,
    };
  }
  if (loaded.status === "error") return { error: loaded.error, success: null };

  const next = patch(loaded.profile);
  const { error } = await supabase.rpc("update_workspace_profile", {
    p_tenant_id: tenantId,
    p_name: next.name,
    p_legal_name: next.legalName,
    p_tax_id: next.taxId,
    p_email: next.email,
    p_phone: next.phone,
    p_website: next.website,
    p_address: next.address,
    p_fiscal_year_start_month: next.fiscalYearStartMonth,
    p_timezone: next.timezone,
    p_default_payment_terms: next.defaultPaymentTerms,
    p_default_tax_rate: next.defaultTaxRate,
    p_invoice_notes: next.invoiceNotes,
    p_invoice_footer: next.invoiceFooter,
  });
  if (error) return { error: friendlyDbError(error), success: null };

  // The workspace name shows in the sidebar, switcher and on every document.
  revalidatePath("/", "layout");
  return { error: null, success: successMessage };
}

export async function updateWorkspaceAction(
  tenantId: string,
  _prevState: SettingsFormState,
  formData: FormData,
): Promise<SettingsFormState> {
  const fieldErrors: Record<string, string> = {};

  const name = field(formData, "name", 120);
  const legalName = field(formData, "legalName", 160);
  const taxId = normalizeTaxId(field(formData, "taxId", 40));
  const email = field(formData, "email", 254).toLowerCase();
  const phone = field(formData, "phone", 40);
  const websiteRaw = field(formData, "website", 200);
  const country = field(formData, "country", 80) || DEFAULT_COUNTRY;
  const us = isUnitedStates(country);
  const address = {
    line1: field(formData, "line1", 160),
    line2: field(formData, "line2", 160),
    city: field(formData, "city", 80),
    state: field(formData, "state", 80),
    postalCode: field(formData, "postalCode", 16).toUpperCase(),
    country,
  };
  const fiscalMonth = Number(field(formData, "fiscalYearStartMonth"));
  const timezone = field(formData, "timezone", 64);

  if (!name) fieldErrors.name = "Give the workspace a name.";
  if (email && !EMAIL_RE.test(email)) fieldErrors.email = "Enter an email like billing@yourcompany.com.";
  let website = "";
  if (websiteRaw) {
    const normalized = normalizeWebsite(websiteRaw);
    if (!normalized) fieldErrors.website = "Enter a web address like yourcompany.com.";
    else website = normalized;
  }
  if (phone) {
    const digits = phone.replace(/\D/g, "");
    if (!/^[\d\s()+.\-x]+$/i.test(phone) || digits.length < 7 || digits.length > 15) {
      fieldErrors.phone = "Enter a phone number like (555) 123-4567.";
    }
  }
  if (us) {
    if (address.state && !US_STATES.some(([code]) => code === address.state)) fieldErrors.state = "Pick a state from the list.";
    if (address.postalCode && !US_ZIP_RE.test(address.postalCode)) fieldErrors.postalCode = "Use a 5-digit ZIP, or ZIP+4 like 94107-1234.";
  }
  if (!Number.isInteger(fiscalMonth) || fiscalMonth < 1 || fiscalMonth > 12) fieldErrors.fiscalYearStartMonth = "Pick a month.";

  if (Object.keys(fieldErrors).length > 0) {
    return { error: "Check the highlighted fields.", success: null, fieldErrors };
  }

  return saveWorkspaceProfile(
    tenantId,
    (current) => ({
      ...current,
      name,
      legalName,
      taxId,
      email,
      phone,
      website,
      address,
      fiscalYearStartMonth: fiscalMonth,
      // keep a zone set elsewhere if this form only offered the US list
      timezone: US_TIME_ZONES.some(([tz]) => tz === timezone) || timezone === current.timezone ? timezone : current.timezone,
    }),
    "Workspace details saved.",
  );
}

export async function updateInvoicingAction(
  tenantId: string,
  _prevState: SettingsFormState,
  formData: FormData,
): Promise<SettingsFormState> {
  const fieldErrors: Record<string, string> = {};

  const terms = field(formData, "defaultPaymentTerms", 32);
  const taxText = field(formData, "defaultTaxRate", 20);
  const invoiceNotes = field(formData, "invoiceNotes", 2000);
  const invoiceFooter = field(formData, "invoiceFooter", 2000);

  if (!DEFAULT_TERMS_OPTIONS.some(([value]) => value === terms)) fieldErrors.defaultPaymentTerms = "Pick payment terms.";
  const fraction = percentTextToFraction(taxText);
  if (fraction === null) fieldErrors.defaultTaxRate = "Enter a rate between 0 and 100, like 8.25.";

  if (Object.keys(fieldErrors).length > 0) {
    return { error: "Check the highlighted fields.", success: null, fieldErrors };
  }

  return saveWorkspaceProfile(
    tenantId,
    (current) => ({
      ...current,
      defaultPaymentTerms: terms,
      defaultTaxRate: Number(fraction),
      invoiceNotes,
      invoiceFooter,
    }),
    "Invoicing defaults saved.",
  );
}

export async function updateProfileAction(_prevState: SettingsFormState, formData: FormData): Promise<SettingsFormState> {
  const fullName = field(formData, "fullName", 120);
  if (!fullName) return { error: null, success: null, fieldErrors: { fullName: "Enter your name." } };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Your session has ended. Sign in again.", success: null };

  const { data, error } = await supabase.from("profiles").update({ full_name: fullName }).eq("id", user.id).select("id");
  if (error) return { error: friendlyDbError(error), success: null };
  if (!data || data.length === 0) return { error: "Your profile couldn't be found. Sign out and back in, then try again.", success: null };

  // Keep the auth metadata in step so new sessions greet you by the same name.
  await supabase.auth.updateUser({ data: { full_name: fullName } });

  revalidatePath("/", "layout");
  return { error: null, success: "Your name is updated." };
}

export async function changeEmailAction(_prevState: SettingsFormState, formData: FormData): Promise<SettingsFormState> {
  const email = field(formData, "email", 254).toLowerCase();
  if (!EMAIL_RE.test(email)) return { error: null, success: null, fieldErrors: { email: "Enter a valid email address." } };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Your session has ended. Sign in again.", success: null };
  if (user.email?.toLowerCase() === email) {
    return { error: null, success: null, fieldErrors: { email: "That's already your email address." } };
  }

  const { error } = await supabase.auth.updateUser(
    { email },
    { emailRedirectTo: `${await getSiteUrl()}/auth/callback?next=/settings/profile` },
  );
  if (error) return { error: error.message, success: null };

  revalidatePath("/settings/profile");
  return {
    error: null,
    success: `Check ${email} for a confirmation link. Your sign-in email changes once you open it.`,
  };
}

export async function changePasswordAction(_prevState: SettingsFormState, formData: FormData): Promise<SettingsFormState> {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirmPassword") ?? "");

  const fieldErrors: Record<string, string> = {};
  if (password.length < 8) fieldErrors.password = "Use at least 8 characters.";
  else if (password.length > 72) fieldErrors.password = "Use 72 characters or fewer.";
  if (!fieldErrors.password && confirm !== password) fieldErrors.confirmPassword = "The passwords don't match.";
  if (Object.keys(fieldErrors).length > 0) return { error: null, success: null, fieldErrors };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    if (error.code === "same_password") {
      return { error: null, success: null, fieldErrors: { password: "Choose a password you haven't used here before." } };
    }
    if (error.code === "weak_password") return { error: null, success: null, fieldErrors: { password: error.message } };
    if (error.code === "reauthentication_needed") {
      return { error: "For security, sign out and sign back in, then change your password right away.", success: null };
    }
    return { error: error.message, success: null };
  }
  return { error: null, success: "Password changed. Use it the next time you sign in." };
}

export async function signOutOtherDevicesAction(): Promise<SettingsFormState> {
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut({ scope: "others" });
  if (error) return { error: error.message, success: null };
  return { error: null, success: "Signed out everywhere else. This browser stays signed in." };
}
