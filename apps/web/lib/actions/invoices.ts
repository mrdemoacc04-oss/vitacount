"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { friendlyDbError } from "@/lib/db-errors";
import { isISODate } from "@/lib/dates";
import { SALES_DOCUMENTS, isSalesDocumentType } from "@/lib/documents";
import { normalizeAmount, percentTextToFraction, toScaled } from "@/lib/money";
import { lineErrorFromDb } from "@/components/forms/form-errors";

export type CreateSalesDocumentState = { error: string | null; fieldErrors?: Record<string, string> };

type RawLine = { itemId?: unknown; description?: unknown; quantity?: unknown; unitPrice?: unknown; taxRate?: unknown };
type SalesLine = { itemId?: string; description: string; quantity: string; unitPrice: string; taxRate: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Creates an invoice, sales receipt, refund, or debit note through
 * create_sales_document, which writes the header + lines atomically and recomputes
 * every total server-side. Invoices and debit notes start as drafts (posted when
 * issued); sales receipts and refunds settle — and post — immediately.
 *
 * `itemId` (per line) and the project are only sent when the user picked one, so
 * the call still matches the function's older signature before the
 * projects/inventory migration is applied.
 */
export async function createSalesDocumentAction(
  tenantId: string,
  documentType: string,
  _prevState: CreateSalesDocumentState,
  formData: FormData,
): Promise<CreateSalesDocumentState> {
  if (!isSalesDocumentType(documentType)) {
    return { error: "Unknown document type." };
  }
  const config = SALES_DOCUMENTS[documentType];

  const contactId = String(formData.get("contactId") ?? "");
  const projectId = String(formData.get("projectId") ?? "").trim();
  const issueDate = String(formData.get("issueDate") ?? "");
  const dueDate = String(formData.get("dueDate") ?? "").trim();
  const paymentMethod = String(formData.get("paymentMethod") ?? "").trim();
  const paymentReference = String(formData.get("paymentReference") ?? "").trim();

  const fieldErrors: Record<string, string> = {};
  if (!contactId) fieldErrors.contactId = "Choose a customer.";
  if (!isISODate(issueDate)) fieldErrors.issueDate = `Pick the ${config.dateLabel.toLowerCase()}.`;
  if (!config.settlesImmediately && dueDate) {
    if (!isISODate(dueDate)) fieldErrors.dueDate = "Enter a valid date.";
    else if (isISODate(issueDate) && dueDate < issueDate) fieldErrors.dueDate = `Can't be before the ${config.dateLabel.toLowerCase()}.`;
  }
  if (config.settlesImmediately && !paymentMethod) {
    fieldErrors.paymentMethod = documentType === "refund_receipt" ? "Choose how the refund was paid." : "Choose how the customer paid.";
  }
  if (projectId && !UUID.test(projectId)) fieldErrors.projectId = "Choose a project from the list.";

  let rawLines: RawLine[];
  try {
    rawLines = JSON.parse(String(formData.get("lines") ?? "[]"));
    if (!Array.isArray(rawLines)) throw new Error();
  } catch {
    return { error: "Malformed line data." };
  }

  const lines: SalesLine[] = [];
  const sentToRow: number[] = [];
  for (const [i, raw] of rawLines.entries()) {
    const itemId = typeof raw.itemId === "string" && UUID.test(raw.itemId) ? raw.itemId : "";
    const description = String(raw.description ?? "").trim();
    const quantityText = String(raw.quantity ?? "").trim();
    const priceText = String(raw.unitPrice ?? "").trim();
    if (!itemId && !description && !priceText) continue; // an untouched blank row

    const quantity = normalizeAmount(quantityText);
    const unitPrice = normalizeAmount(priceText);
    const taxRate = percentTextToFraction(String(raw.taxRate ?? "0"));
    // an item line may leave the description blank — the item's name is used
    if (!description && !itemId) fieldErrors[`lines.${i}.description`] = "Describe what you're charging for.";
    if (quantity === null || toScaled(quantityText, 2) === BigInt(0)) fieldErrors[`lines.${i}.quantity`] = "Enter a quantity above zero.";
    if (unitPrice === null) fieldErrors[`lines.${i}.unitPrice`] = "Enter a price.";
    if (taxRate === null) fieldErrors[`lines.${i}.taxRate`] = "Use a rate between 0% and 100%.";
    if (quantity === null || unitPrice === null || taxRate === null) continue;

    lines.push({ ...(itemId ? { itemId } : {}), description, quantity, unitPrice, taxRate });
    sentToRow.push(i);
  }
  if (Object.keys(fieldErrors).length > 0) return { error: null, fieldErrors };
  if (lines.length === 0) return { error: null, fieldErrors: { "lines.0.description": "Add at least one line item." } };

  const supabase = await createClient();
  const { data: documentId, error } = await supabase.rpc("create_sales_document", {
    p_tenant_id: tenantId,
    p_contact_id: contactId,
    p_document_type: documentType,
    p_issue_date: issueDate,
    // the generated RPC arg types are non-nullable `string`, but the underlying
    // Postgres params are nullable — same gap as post_manual_journal_entry.
    p_due_date: (config.settlesImmediately || !dueDate ? null : dueDate) as string,
    p_payment_method: (config.settlesImmediately ? paymentMethod : null) as string,
    p_payment_reference: (config.settlesImmediately && paymentReference ? paymentReference : null) as string,
    p_lines: lines,
    ...(projectId ? { p_project_id: projectId } : {}),
  });

  if (error) {
    const message = friendlyDbError(error);
    const lineError = lineErrorFromDb(message, sentToRow);
    if (lineError) return { error: null, fieldErrors: { [lineError.key]: lineError.message } };
    return { error: message };
  }

  revalidatePath("/sales");
  revalidatePath("/dashboard");
  if (projectId) revalidatePath("/projects");
  if (lines.some((l) => l.itemId)) revalidatePath("/inventory");
  redirect(`/sales/${documentId}`);
}

export async function issueInvoiceAction(invoiceId: string): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("post_invoice_issued", { p_invoice_id: invoiceId });
  if (error) {
    return { error: friendlyDbError(error) };
  }
  revalidatePath("/sales");
  revalidatePath(`/sales/${invoiceId}`);
  revalidatePath("/dashboard");
  return { error: null };
}

export type RecordPaymentState = { error: string | null; fieldErrors?: Record<string, string> };

export async function recordInvoicePaymentAction(
  tenantId: string,
  contactId: string,
  invoiceId: string,
  _prevState: RecordPaymentState,
  formData: FormData,
): Promise<RecordPaymentState> {
  const paymentDate = String(formData.get("paymentDate") ?? "");
  const amount = Number(normalizeAmount(String(formData.get("amount") ?? "")) ?? 0);
  const method = String(formData.get("method") ?? "").trim();
  const reference = String(formData.get("reference") ?? "").trim();

  const fieldErrors: Record<string, string> = {};
  if (!isISODate(paymentDate)) fieldErrors.paymentDate = "Pick the payment date.";
  if (!(amount > 0)) fieldErrors.amount = "Enter an amount greater than zero.";
  if (Object.keys(fieldErrors).length > 0) return { error: null, fieldErrors };

  const supabase = await createClient();
  const { error } = await supabase.rpc("post_payment_received", {
    p_tenant_id: tenantId,
    p_contact_id: contactId,
    p_payment_date: paymentDate,
    p_amount: amount,
    // the generated RPC arg types are non-nullable `string`, but the underlying
    // Postgres params are nullable `text` — same gap as post_manual_journal_entry.
    p_method: (method || null) as string,
    p_reference: (reference || null) as string,
    p_stripe_payment_intent_id: null as unknown as string,
    p_applications: [{ invoiceId, amount }],
  });

  if (error) {
    return { error: friendlyDbError(error) };
  }

  revalidatePath("/sales");
  revalidatePath(`/sales/${invoiceId}`);
  revalidatePath("/dashboard");
  redirect(`/sales/${invoiceId}`);
}

export type ReceivePaymentState = { error: string | null; fieldErrors?: Record<string, string> };

/**
 * One payment (a check, a transfer) spread across a customer's open invoices and
 * debit notes. Anything not applied is kept as customer credit by
 * post_payment_received — the form shows that split before submitting.
 */
export async function receivePaymentAction(
  tenantId: string,
  _prevState: ReceivePaymentState,
  formData: FormData,
): Promise<ReceivePaymentState> {
  const contactId = String(formData.get("contactId") ?? "");
  const paymentDate = String(formData.get("paymentDate") ?? "");
  const amountText = normalizeAmount(String(formData.get("amount") ?? ""));
  const method = String(formData.get("method") ?? "").trim();
  const reference = String(formData.get("reference") ?? "").trim();

  const fieldErrors: Record<string, string> = {};
  if (!contactId) fieldErrors.contactId = "Choose the customer who paid.";
  if (!isISODate(paymentDate)) fieldErrors.paymentDate = "Pick the payment date.";
  if (amountText === null || Number(amountText) <= 0) fieldErrors.amount = "Enter the amount received.";
  if (!method) fieldErrors.method = "Choose how the customer paid.";
  if (Object.keys(fieldErrors).length > 0 || amountText === null) return { error: null, fieldErrors };

  let raw: { invoiceId?: unknown; amount?: unknown }[];
  try {
    raw = JSON.parse(String(formData.get("applications") ?? "[]"));
    if (!Array.isArray(raw)) throw new Error();
  } catch {
    return { error: "Malformed payment allocation." };
  }

  const applications: { invoiceId: string; amount: number }[] = [];
  let appliedCents = BigInt(0);
  for (const app of raw) {
    const cents = toScaled(String(app.amount ?? ""), 2);
    if (cents === null) return { error: "One of the invoice amounts isn't a valid number." };
    if (cents === BigInt(0)) continue;
    appliedCents += cents;
    applications.push({ invoiceId: String(app.invoiceId), amount: Number(cents) / 100 });
  }
  if (appliedCents > (toScaled(amountText, 2) ?? BigInt(0))) {
    return { error: null, fieldErrors: { amount: "You've applied more to invoices than this amount." } };
  }

  const supabase = await createClient();
  const { data: paymentId, error } = await supabase.rpc("post_payment_received", {
    p_tenant_id: tenantId,
    p_contact_id: contactId,
    p_payment_date: paymentDate,
    p_amount: Number(amountText),
    p_method: method,
    p_reference: (reference || null) as string,
    p_stripe_payment_intent_id: null as unknown as string,
    p_applications: applications,
  });

  if (error) {
    return { error: friendlyDbError(error) };
  }

  revalidatePath("/sales");
  revalidatePath("/dashboard");
  redirect(`/sales/receive-payment?customer=${contactId}&recorded=${paymentId}`);
}

/** Applies a customer's unused credit to their open invoices, oldest due first. */
export async function applyCustomerCreditAction(
  tenantId: string,
  contactId: string,
): Promise<{ error: string | null; applied: number }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("apply_customer_credit", {
    p_tenant_id: tenantId,
    p_contact_id: contactId,
  });
  if (error) {
    return { error: friendlyDbError(error), applied: 0 };
  }
  revalidatePath("/sales");
  revalidatePath("/sales/receive-payment");
  return { error: null, applied: Number(data ?? 0) };
}

export type RefundCreditState = { error: string | null; fieldErrors?: Record<string, string> };

/** Pays a customer's unused credit (from an overpayment) back to them. */
export async function refundCustomerCreditAction(
  tenantId: string,
  _prevState: RefundCreditState,
  formData: FormData,
): Promise<RefundCreditState> {
  const contactId = String(formData.get("contactId") ?? "");
  const refundDate = String(formData.get("refundDate") ?? "");
  const amountText = normalizeAmount(String(formData.get("amount") ?? ""));
  const method = String(formData.get("method") ?? "").trim();
  const reference = String(formData.get("reference") ?? "").trim();

  const fieldErrors: Record<string, string> = {};
  if (!contactId) fieldErrors.contactId = "Choose a customer.";
  if (!isISODate(refundDate)) fieldErrors.refundDate = "Pick the refund date.";
  if (amountText === null || Number(amountText) <= 0) fieldErrors.amount = "Enter the amount to refund.";
  if (!method) fieldErrors.method = "Choose how the refund was paid.";
  if (Object.keys(fieldErrors).length > 0 || amountText === null) return { error: null, fieldErrors };

  const supabase = await createClient();
  const { data: documentId, error } = await supabase.rpc("refund_customer_credit", {
    p_tenant_id: tenantId,
    p_contact_id: contactId,
    p_refund_date: refundDate,
    p_amount: Number(amountText),
    p_method: method,
    p_reference: (reference || null) as string,
  });

  if (error) {
    return { error: friendlyDbError(error) };
  }

  revalidatePath("/sales");
  revalidatePath("/dashboard");
  redirect(`/sales/${documentId}`);
}
