"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { friendlyDbError } from "@/lib/db-errors";
import { isISODate } from "@/lib/dates";
import { isPurchaseDocumentType } from "@/lib/documents";
import { normalizeAmount, toScaled } from "@/lib/money";
import { lineErrorFromDb } from "@/components/forms/form-errors";

export type CreateBillState = { error: string | null; fieldErrors?: Record<string, string> };

type RawLine = { itemId?: unknown; accountId?: unknown; description?: unknown; quantity?: unknown; unitCost?: unknown };
type PurchaseLine = { itemId?: string; accountId?: string; description: string | null; quantity: number; unitCost: number; amount: number };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Bills post immediately (no draft state in their schema) — create_bill_received
 * creates the bill, its lines, and the GL entry atomically. Supplier credits go
 * through create_vendor_credit, the mirror-image posting (Dr AP / Cr expense).
 *
 * A line may carry an `itemId`: stock items post to Inventory Asset (so their
 * category is optional) and other items fall back to their own purchase account.
 * `itemId` and the project are only sent when chosen, so the calls still match
 * the functions' older signatures before the projects/inventory migration.
 */
export async function createPurchaseDocumentAction(
  tenantId: string,
  documentType: string,
  _prevState: CreateBillState,
  formData: FormData,
): Promise<CreateBillState> {
  if (!isPurchaseDocumentType(documentType)) {
    return { error: "Unknown document type." };
  }

  const vendorId = String(formData.get("vendorId") ?? "");
  const projectId = String(formData.get("projectId") ?? "").trim();
  const reference = String(formData.get("reference") ?? "").trim();
  const issueDate = String(formData.get("issueDate") ?? "");
  const dueDate = String(formData.get("dueDate") ?? "").trim();

  const fieldErrors: Record<string, string> = {};
  if (!vendorId) fieldErrors.vendorId = "Choose a supplier.";
  if (!isISODate(issueDate)) fieldErrors.issueDate = "Pick the date.";
  if (documentType === "bill" && dueDate) {
    if (!isISODate(dueDate)) fieldErrors.dueDate = "Enter a valid date.";
    else if (isISODate(issueDate) && dueDate < issueDate) fieldErrors.dueDate = "Can't be before the bill date.";
  }
  if (projectId && !UUID.test(projectId)) fieldErrors.projectId = "Choose a project from the list.";

  let rawLines: RawLine[];
  try {
    rawLines = JSON.parse(String(formData.get("lines") ?? "[]"));
    if (!Array.isArray(rawLines)) throw new Error();
  } catch {
    return { error: "Malformed line data." };
  }

  const lines: PurchaseLine[] = [];
  const sentToRow: number[] = [];
  for (const [i, raw] of rawLines.entries()) {
    const itemId = typeof raw.itemId === "string" && UUID.test(raw.itemId) ? raw.itemId : "";
    const accountId = String(raw.accountId ?? "");
    const costText = String(raw.unitCost ?? "").trim();
    if (!itemId && !accountId && !costText) continue; // an untouched blank row
    const quantity = toScaled(String(raw.quantity ?? ""), 2);
    const unitCost = toScaled(costText, 2);
    // item lines can leave the category to the item (stock items always use Inventory Asset)
    if (!accountId && !itemId) fieldErrors[`lines.${i}.accountId`] = "Choose a category.";
    if (quantity === null || quantity === BigInt(0)) fieldErrors[`lines.${i}.quantity`] = "Enter a quantity above zero.";
    if (unitCost === null) fieldErrors[`lines.${i}.unitCost`] = "Enter an amount.";
    if (quantity === null || unitCost === null) continue;
    const amountCents = (quantity * unitCost + BigInt(50)) / BigInt(100);
    lines.push({
      ...(itemId ? { itemId } : {}),
      ...(accountId ? { accountId } : {}),
      description: String(raw.description ?? "").trim() || null,
      quantity: Number(quantity) / 100,
      unitCost: Number(unitCost) / 100,
      amount: Number(amountCents) / 100,
    });
    sentToRow.push(i);
  }
  if (Object.keys(fieldErrors).length > 0) return { error: null, fieldErrors };
  if (lines.length === 0) return { error: null, fieldErrors: { "lines.0.accountId": "Add at least one line with a category." } };

  const project = projectId ? { p_project_id: projectId } : {};
  const supabase = await createClient();
  const { data: documentId, error } =
    documentType === "bill"
      ? await supabase.rpc("create_bill_received", {
          p_tenant_id: tenantId,
          p_vendor_id: vendorId,
          p_bill_number: (reference || null) as string,
          p_issue_date: issueDate,
          // nullable in Postgres since 20260926063242 — blank means "no due date"
          p_due_date: (dueDate || null) as string,
          p_lines: lines,
          ...project,
        })
      : await supabase.rpc("create_vendor_credit", {
          p_tenant_id: tenantId,
          p_vendor_id: vendorId,
          p_credit_number: (reference || null) as string,
          p_issue_date: issueDate,
          p_lines: lines.map((l) => ({
            ...(l.itemId ? { itemId: l.itemId } : {}),
            ...(l.accountId ? { accountId: l.accountId } : {}),
            description: l.description,
            quantity: l.quantity,
            unitCost: l.unitCost,
          })),
          ...project,
        });

  if (error) {
    const message = friendlyDbError(error);
    const lineError = lineErrorFromDb(message, sentToRow);
    if (lineError) return { error: null, fieldErrors: { [lineError.key]: lineError.message } };
    return { error: message };
  }

  revalidatePath("/expenses");
  revalidatePath("/dashboard");
  if (projectId) revalidatePath("/projects");
  if (lines.some((l) => l.itemId)) revalidatePath("/inventory");
  redirect(`/expenses/${documentId}`);
}

export type CreateExpenseState = { error: string | null; fieldErrors?: Record<string, string> };

/** Something already paid for — one category, posted straight to the ledger (Dr expense / Cr Cash). */
export async function createExpenseAction(
  tenantId: string,
  _prevState: CreateExpenseState,
  formData: FormData,
): Promise<CreateExpenseState> {
  const vendorId = String(formData.get("vendorId") ?? "");
  const projectId = String(formData.get("projectId") ?? "").trim();
  const expenseDate = String(formData.get("expenseDate") ?? "");
  const accountId = String(formData.get("accountId") ?? "");
  const amountText = normalizeAmount(String(formData.get("amount") ?? ""));
  const method = String(formData.get("method") ?? "").trim();
  const memo = String(formData.get("memo") ?? "").trim();

  const fieldErrors: Record<string, string> = {};
  if (!isISODate(expenseDate)) fieldErrors.expenseDate = "Pick the date you paid.";
  if (!accountId) fieldErrors.accountId = "Choose a category.";
  if (amountText === null || Number(amountText) <= 0) fieldErrors.amount = "Enter the amount paid.";
  if (!method) fieldErrors.method = "Choose how you paid.";
  if (projectId && !UUID.test(projectId)) fieldErrors.projectId = "Choose a project from the list.";
  if (Object.keys(fieldErrors).length > 0) return { error: null, fieldErrors };

  const supabase = await createClient();
  const { error } = await supabase.rpc("post_expense_created", {
    p_tenant_id: tenantId,
    // the generated RPC arg type is non-nullable `string`, but the underlying
    // Postgres param is a nullable `uuid` — same gap as post_manual_journal_entry.
    p_contact_id: (vendorId || null) as string,
    p_expense_date: expenseDate,
    p_amount: Number(amountText),
    p_account_id: accountId,
    p_payment_method: method,
    p_memo: (memo || null) as string,
    ...(projectId ? { p_project_id: projectId } : {}),
  });

  if (error) {
    return { error: friendlyDbError(error) };
  }

  revalidatePath("/expenses");
  revalidatePath("/dashboard");
  if (projectId) revalidatePath("/projects");
  redirect("/expenses?recorded=expense");
}

export type PayBillsState = { error: string | null; fieldErrors?: Record<string, string> };

/** One payment (check, transfer) across several of a supplier's open bills, dated on the payment date. */
export async function payBillsAction(tenantId: string, _prevState: PayBillsState, formData: FormData): Promise<PayBillsState> {
  const vendorId = String(formData.get("vendorId") ?? "");
  const paymentDate = String(formData.get("paymentDate") ?? "");
  const method = String(formData.get("method") ?? "").trim();
  const reference = String(formData.get("reference") ?? "").trim();

  const fieldErrors: Record<string, string> = {};
  if (!vendorId) fieldErrors.vendorId = "Choose the supplier you're paying.";
  if (!isISODate(paymentDate)) fieldErrors.paymentDate = "Pick the payment date.";
  if (!method) fieldErrors.method = "Choose how you paid.";
  if (Object.keys(fieldErrors).length > 0) return { error: null, fieldErrors };

  let raw: { billId?: unknown; amount?: unknown }[];
  try {
    raw = JSON.parse(String(formData.get("applications") ?? "[]"));
    if (!Array.isArray(raw)) throw new Error();
  } catch {
    return { error: "Malformed payment allocation." };
  }

  let totalCents = BigInt(0);
  const applications: { billId: string; amount: number }[] = [];
  for (const app of raw) {
    const cents = toScaled(String(app.amount ?? ""), 2);
    if (cents === null) return { error: "One of the bill amounts isn't a valid number." };
    if (cents === BigInt(0)) continue;
    totalCents += cents;
    applications.push({ billId: String(app.billId), amount: Number(cents) / 100 });
  }
  if (applications.length === 0) return { error: "Choose at least one bill to pay." };

  const supabase = await createClient();
  const { data: paymentId, error } = await supabase.rpc("pay_vendor_bills", {
    p_tenant_id: tenantId,
    p_vendor_id: vendorId,
    p_payment_date: paymentDate,
    p_amount: Number(totalCents) / 100,
    p_method: method,
    p_reference: (reference || null) as string,
    p_applications: applications,
  });

  if (error) {
    return { error: friendlyDbError(error) };
  }

  revalidatePath("/expenses");
  revalidatePath("/dashboard");
  redirect(`/expenses/pay-bills?vendor=${vendorId}&paid=${paymentId}`);
}

/** Applies a supplier's unused credits to their open bills, oldest due first. */
export async function applyVendorCreditsAction(
  tenantId: string,
  vendorId: string,
): Promise<{ error: string | null; applied: number }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("apply_vendor_credits", {
    p_tenant_id: tenantId,
    p_vendor_id: vendorId,
  });
  if (error) {
    return { error: friendlyDbError(error), applied: 0 };
  }
  revalidatePath("/expenses");
  revalidatePath("/expenses/pay-bills");
  return { error: null, applied: Number(data ?? 0) };
}
