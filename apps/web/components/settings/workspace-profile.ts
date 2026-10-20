import "server-only";
import type { createClient } from "@/lib/supabase/server";
import { friendlyDbError, isMissingSchema } from "@/lib/db-errors";
import { DEFAULT_COUNTRY } from "@/components/settings/options";

type ServerSupabase = Awaited<ReturnType<typeof createClient>>;

export type WorkspaceAddress = {
  line1: string;
  line2: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
};

export type WorkspaceProfile = {
  name: string;
  legalName: string;
  taxId: string;
  email: string;
  phone: string;
  website: string;
  address: WorkspaceAddress;
  fiscalYearStartMonth: number;
  timezone: string;
  defaultPaymentTerms: string;
  /** fraction: 0.0825 = 8.25% */
  defaultTaxRate: number;
  invoiceNotes: string;
  invoiceFooter: string;
};

export type WorkspaceProfileResult =
  | { status: "ok"; profile: WorkspaceProfile }
  | { status: "missing-schema" }
  | { status: "error"; error: string };

const COLUMNS =
  "name, legal_name, tax_id, email, phone, website, address, fiscal_year_start_month, timezone, default_payment_terms, default_tax_rate, invoice_notes, invoice_footer";

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export function parseAddress(value: unknown): WorkspaceAddress {
  const a = value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  return {
    line1: text(a.line1),
    line2: text(a.line2),
    city: text(a.city),
    state: text(a.state),
    postalCode: text(a.postalCode),
    country: text(a.country) || DEFAULT_COUNTRY,
  };
}

/**
 * Reads the workspace profile columns added by the 20261008120000 migration.
 * Reports "missing-schema" (rather than throwing) while that migration isn't applied.
 */
export async function loadWorkspaceProfile(
  supabase: ServerSupabase,
  tenantId: string,
): Promise<WorkspaceProfileResult> {
  const { data, error } = await supabase.from("tenants").select(COLUMNS).eq("id", tenantId).single();
  if (error) {
    if (isMissingSchema(error)) return { status: "missing-schema" };
    return { status: "error", error: friendlyDbError(error) };
  }
  return {
    status: "ok",
    profile: {
      name: data.name,
      legalName: data.legal_name ?? "",
      taxId: data.tax_id ?? "",
      email: data.email ?? "",
      phone: data.phone ?? "",
      website: data.website ?? "",
      address: parseAddress(data.address),
      fiscalYearStartMonth: data.fiscal_year_start_month ?? 1,
      timezone: data.timezone ?? "America/New_York",
      defaultPaymentTerms: data.default_payment_terms ?? "net_30",
      defaultTaxRate: Number(data.default_tax_rate ?? 0),
      invoiceNotes: data.invoice_notes ?? "",
      invoiceFooter: data.invoice_footer ?? "",
    },
  };
}
