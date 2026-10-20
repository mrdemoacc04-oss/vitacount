"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { friendlyDbError } from "@/lib/db-errors";
import { isISODate, todayISO } from "@/lib/dates";
import { normalizeAmount } from "@/lib/money";

export type RecordVendorPaymentState = { error: string | null; fieldErrors?: Record<string, string> };

export async function recordVendorPaymentAction(
  tenantId: string,
  vendorId: string,
  billId: string,
  _prevState: RecordVendorPaymentState,
  formData: FormData,
): Promise<RecordVendorPaymentState> {
  const paymentDate = String(formData.get("paymentDate") ?? "");
  const amount = Number(normalizeAmount(String(formData.get("amount") ?? "")) ?? 0);
  const method = String(formData.get("method") ?? "").trim();
  const reference = String(formData.get("reference") ?? "").trim();
  const scheduledFor = String(formData.get("scheduledFor") ?? "").trim();

  const fieldErrors: Record<string, string> = {};
  if (!isISODate(paymentDate)) fieldErrors.paymentDate = "Pick the payment date.";
  if (!(amount > 0)) fieldErrors.amount = "Enter an amount greater than zero.";
  if (scheduledFor && !isISODate(scheduledFor)) fieldErrors.scheduledFor = "Enter a valid date, or leave it blank to pay now.";
  if (Object.keys(fieldErrors).length > 0) return { error: null, fieldErrors };

  const supabase = await createClient();
  const isFutureScheduled = isISODate(scheduledFor) && scheduledFor > todayISO();

  // Scheduling keeps the original path (it records intent now and posts on the
  // scheduled date). Paying now goes through pay_vendor_bills, which dates the GL
  // entry on the payment date and keeps the check/transfer reference.
  const { error } = isFutureScheduled
    ? await supabase.rpc("post_vendor_payment_made", {
        p_tenant_id: tenantId,
        p_vendor_id: vendorId,
        p_payment_date: paymentDate,
        p_amount: amount,
        p_method: (method || null) as string,
        p_scheduled_for: scheduledFor,
        p_applications: [{ billId, amount }],
      })
    : await supabase.rpc("pay_vendor_bills", {
        p_tenant_id: tenantId,
        p_vendor_id: vendorId,
        p_payment_date: paymentDate,
        p_amount: amount,
        p_method: (method || null) as string,
        p_reference: (reference || null) as string,
        p_applications: [{ billId, amount }],
      });

  if (error) {
    return { error: friendlyDbError(error) };
  }

  revalidatePath("/expenses");
  revalidatePath(`/expenses/${billId}`);
  revalidatePath("/dashboard");
  redirect(`/expenses/${billId}`);
}
