"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { friendlyDbError } from "@/lib/db-errors";
import { PAYMENT_TERMS } from "@/lib/documents";
import { US_STATES, isEmail, phoneDigits } from "@/components/forms/form-errors";

export type CreateContactState = { error: string | null; fieldErrors?: Record<string, string> };

const CONTACT_TYPES = ["customer", "vendor", "both"] as const;
type ContactType = (typeof CONTACT_TYPES)[number];

const ZIP = /^\d{5}(-\d{4})?$/;
const EIN = /^\d{2}-?\d{7}$/;
const SSN = /^\d{3}-?\d{2}-?\d{4}$/;

/** Only same-site paths may be returned to after saving. */
function safeReturnTo(value: string): string | null {
  return value.startsWith("/") && !value.startsWith("//") && !value.startsWith("/\\") ? value : null;
}

export async function createContactAction(
  tenantId: string,
  _prevState: CreateContactState,
  formData: FormData,
): Promise<CreateContactState> {
  const text = (key: string) => String(formData.get(key) ?? "").trim();

  const type = text("type");
  const displayName = text("displayName");
  const company = text("company");
  const email = text("email").toLowerCase();
  const phone = text("phone");
  const paymentTerms = text("paymentTerms") || "net_30";
  const taxId = text("taxId");
  const is1099Vendor = formData.get("is1099Vendor") === "on";
  const address = {
    line1: text("line1"),
    line2: text("line2"),
    city: text("city"),
    state: text("state").toUpperCase(),
    postal_code: text("postalCode"),
  };
  const returnTo = safeReturnTo(text("returnTo"));

  const fieldErrors: Record<string, string> = {};
  if (!CONTACT_TYPES.includes(type as ContactType)) fieldErrors.type = "Choose customer, supplier, or both.";
  if (!displayName) fieldErrors.displayName = "Enter the name you'll see on documents.";
  else if (displayName.length > 200) fieldErrors.displayName = "Keep the name under 200 characters.";
  if (email && !isEmail(email)) fieldErrors.email = "Enter a valid email, like name@company.com.";
  if (phone) {
    const digits = phoneDigits(phone);
    if (digits.length < 10 || digits.length > 15) fieldErrors.phone = "Enter a 10-digit phone number.";
  }
  if (!PAYMENT_TERMS.some((t) => t.value === paymentTerms)) fieldErrors.paymentTerms = "Choose payment terms from the list.";
  if (address.state && !US_STATES.some((s) => s.code === address.state)) fieldErrors.state = "Choose a state from the list.";
  if (address.postal_code && !ZIP.test(address.postal_code)) fieldErrors.postalCode = "Use a 5-digit ZIP, like 94107 or 94107-1234.";
  const hasAddress = address.line1 || address.line2 || address.city || address.state || address.postal_code;
  if (hasAddress && !address.line1) fieldErrors.line1 = "Add the street address, or clear the other address fields.";
  if (taxId && !EIN.test(taxId) && !SSN.test(taxId)) fieldErrors.taxId = "Use an EIN (12-3456789) or SSN (123-45-6789).";
  if (Object.keys(fieldErrors).length > 0) return { error: null, fieldErrors };

  const isVendor = type === "vendor" || type === "both";
  // company is kept with the address (contacts has no column of its own for it)
  const billingAddress = Object.fromEntries(
    Object.entries({ company, ...address, country: hasAddress ? "US" : "" }).filter(([, v]) => v !== ""),
  );

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("contacts")
    .insert({
      tenant_id: tenantId,
      type,
      display_name: displayName,
      email: email || null,
      phone: phone || null,
      payment_terms: paymentTerms,
      tax_id: taxId || null,
      billing_address: Object.keys(billingAddress).length > 0 ? billingAddress : null,
      is_1099_vendor: isVendor && is1099Vendor,
    })
    .select("id")
    .single();

  if (error) {
    return { error: friendlyDbError(error) };
  }

  revalidatePath("/contacts");
  if (returnTo) {
    // hand the new contact back to the form that sent us here
    const param = returnTo.startsWith("/expenses") ? "vendor" : "customer";
    redirect(`${returnTo}${returnTo.includes("?") ? "&" : "?"}${param}=${data.id}`);
  }
  redirect(`/contacts?added=${data.id}`);
}
