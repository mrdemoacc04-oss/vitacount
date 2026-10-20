import { addDays, diffDays, isISODate, type ISODate } from "@/lib/dates";

// ---------------------------------------------------------------------------
// Customer-side documents (all live in the `invoices` table, keyed by document_type)
// ---------------------------------------------------------------------------

export const SALES_DOCUMENT_TYPES = ["invoice", "sales_receipt", "refund_receipt", "debit_note"] as const;
export type SalesDocumentType = (typeof SALES_DOCUMENT_TYPES)[number];

interface SalesDocumentConfig {
  /** "Invoice" — used in headings and lists. */
  label: string;
  /** Printed title, e.g. "INVOICE". */
  title: string;
  /** Plain-English one-liner for menus and page intros. */
  description: string;
  dateLabel: string;
  /** Sales receipts and refunds settle on the spot: no due date, posted on save. */
  settlesImmediately: boolean;
  /** Money out of the business (shown negative in lists). */
  isMoneyOut: boolean;
  submitLabel: string;
}

export const SALES_DOCUMENTS: Record<SalesDocumentType, SalesDocumentConfig> = {
  invoice: {
    label: "Invoice",
    title: "Invoice",
    description: "Bill a customer now and get paid later.",
    dateLabel: "Invoice date",
    settlesImmediately: false,
    isMoneyOut: false,
    submitLabel: "Save draft",
  },
  sales_receipt: {
    label: "Sales receipt",
    title: "Sales receipt",
    description: "Record a sale the customer paid for on the spot.",
    dateLabel: "Sale date",
    settlesImmediately: true,
    isMoneyOut: false,
    submitLabel: "Save sales receipt",
  },
  refund_receipt: {
    label: "Refund",
    title: "Refund receipt",
    description: "Give money back to a customer for returned items or services.",
    dateLabel: "Refund date",
    settlesImmediately: true,
    isMoneyOut: true,
    submitLabel: "Save refund",
  },
  debit_note: {
    label: "Debit note",
    title: "Debit note",
    description: "Add a charge to what a customer already owes — an undercharge, a late fee, extra work.",
    dateLabel: "Date",
    settlesImmediately: false,
    isMoneyOut: false,
    submitLabel: "Save draft",
  },
};

export function isSalesDocumentType(value: unknown): value is SalesDocumentType {
  return typeof value === "string" && (SALES_DOCUMENT_TYPES as readonly string[]).includes(value);
}

export function salesDocumentConfig(type: string | null | undefined): SalesDocumentConfig {
  return SALES_DOCUMENTS[isSalesDocumentType(type) ? type : "invoice"];
}

/** Status wording depends on the document: a "paid" refund reads as "Refunded". */
export function salesStatusLabel(type: string | null | undefined, status: string): string {
  if (type === "refund_receipt") return status === "paid" ? "Refunded" : "Draft";
  if (type === "sales_receipt") return status === "paid" ? "Paid" : "Draft";
  switch (status) {
    case "draft":
      return "Draft";
    case "sent":
      return "Awaiting payment";
    case "partial":
      return "Partly paid";
    case "paid":
      return "Paid";
    case "overdue":
      return "Overdue";
    case "void":
      return "Void";
    default:
      return status;
  }
}

export const SALES_STATUS_STYLE: Record<string, string> = {
  draft: "bg-secondary text-secondary-foreground",
  sent: "bg-chart-2/15 text-chart-2",
  partial: "bg-warning/15 text-warning",
  paid: "bg-positive/15 text-positive",
  overdue: "bg-destructive/15 text-destructive",
  void: "bg-muted text-muted-foreground",
};

// ---------------------------------------------------------------------------
// Supplier-side documents (the `bills` table)
// ---------------------------------------------------------------------------

export const PURCHASE_DOCUMENT_TYPES = ["bill", "vendor_credit"] as const;
export type PurchaseDocumentType = (typeof PURCHASE_DOCUMENT_TYPES)[number];

export const PURCHASE_DOCUMENTS: Record<PurchaseDocumentType, { label: string; description: string; referenceLabel: string; submitLabel: string }> = {
  bill: {
    label: "Bill",
    description: "A supplier's invoice you'll pay later.",
    referenceLabel: "Bill #",
    submitLabel: "Record bill",
  },
  vendor_credit: {
    label: "Supplier credit",
    description:
      "A credit (debit note) from a supplier for returned goods or an overcharge. It lowers what you owe them and can be applied to their open bills.",
    referenceLabel: "Credit note #",
    submitLabel: "Record supplier credit",
  },
};

export function isPurchaseDocumentType(value: unknown): value is PurchaseDocumentType {
  return typeof value === "string" && (PURCHASE_DOCUMENT_TYPES as readonly string[]).includes(value);
}

export function purchaseStatusLabel(type: string | null | undefined, status: string): string {
  if (type === "vendor_credit") {
    if (status === "paid") return "Used";
    if (status === "partial") return "Partly used";
    return "Available";
  }
  switch (status) {
    case "open":
      return "Unpaid";
    case "scheduled":
      return "Scheduled";
    case "partial":
      return "Partly paid";
    case "paid":
      return "Paid";
    case "void":
      return "Void";
    default:
      return status;
  }
}

export const PURCHASE_STATUS_STYLE: Record<string, string> = {
  open: "bg-chart-2/15 text-chart-2",
  scheduled: "bg-warning/15 text-warning",
  partial: "bg-warning/15 text-warning",
  paid: "bg-positive/15 text-positive",
  void: "bg-muted text-muted-foreground",
};

// ---------------------------------------------------------------------------
// Payment methods & terms
// ---------------------------------------------------------------------------

export const PAYMENT_METHODS = [
  { value: "bank_transfer", label: "Bank transfer" },
  { value: "direct_deposit", label: "Direct deposit (ACH)" },
  { value: "check", label: "Check" },
  { value: "cash", label: "Cash" },
  { value: "card", label: "Card" },
  { value: "other", label: "Other" },
] as const;

export function paymentMethodLabel(value: string | null | undefined): string {
  if (!value) return "—";
  if (value === "stripe") return "Card (Stripe)";
  return PAYMENT_METHODS.find((m) => m.value === value)?.label ?? value.replace(/_/g, " ");
}

/**
 * Terms are a shortcut for filling the due date — nothing forces one. The due date
 * stays optional and editable; picking a date by hand simply shows up as custom terms.
 */
export const PAYMENT_TERMS = [
  { value: "due_on_receipt", label: "Due on receipt", days: 0 },
  { value: "net_7", label: "Net 7", days: 7 },
  { value: "net_10", label: "Net 10", days: 10 },
  { value: "net_15", label: "Net 15", days: 15 },
  { value: "net_30", label: "Net 30", days: 30 },
  { value: "net_45", label: "Net 45", days: 45 },
  { value: "net_60", label: "Net 60", days: 60 },
  { value: "net_90", label: "Net 90", days: 90 },
] as const;

export type TermsChoice = "" | "custom" | (typeof PAYMENT_TERMS)[number]["value"];

export function dueDateForTerms(issueDate: ISODate, days: number): ISODate {
  return addDays(issueDate, days);
}

/** Which terms option matches an issue/due pair ("" when there's no due date). */
export function termsChoiceFromDates(issueDate: string, dueDate: string): { choice: TermsChoice; days: number | null } {
  if (!isISODate(issueDate) || !isISODate(dueDate)) return { choice: "", days: null };
  const days = diffDays(issueDate, dueDate);
  const preset = PAYMENT_TERMS.find((t) => t.days === days);
  return { choice: preset ? preset.value : "custom", days };
}

/** "Net 30", "Due on receipt", "Net 23" — derived from the dates, so it never disagrees with them. */
export function termsLabel(issueDate: string | null | undefined, dueDate: string | null | undefined): string | null {
  if (!issueDate || !dueDate || !isISODate(issueDate) || !isISODate(dueDate)) return null;
  const days = diffDays(issueDate, dueDate);
  if (days < 0) return null;
  if (days === 0) return "Due on receipt";
  return `Net ${days}`;
}

/** Formats contacts.billing_address (free-form jsonb) as display lines. */
export function addressLines(address: unknown): string[] {
  if (!address || typeof address !== "object") return [];
  const a = address as Record<string, unknown>;
  const pick = (...keys: string[]) =>
    keys.map((k) => a[k]).find((v): v is string => typeof v === "string" && v.trim() !== "")?.trim();
  const cityLine = [pick("city"), [pick("state", "region"), pick("postalCode", "postal_code", "zip", "postcode")].filter(Boolean).join(" ")]
    .filter(Boolean)
    .join(", ");
  return [pick("line1", "street", "address1"), pick("line2", "address2"), cityLine, pick("country")].filter(
    (line): line is string => Boolean(line),
  );
}
