import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loadTenantContext } from "@/lib/tenant/data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { IssueInvoiceButton } from "@/components/issue-invoice-button";
import { RecordInvoicePaymentForm } from "@/components/record-invoice-payment-form";
import { CreateStripeLinkButton } from "@/components/create-stripe-link-button";
import { DocumentPrintActions } from "@/components/document-preview";
import { SalesDocumentPaper, type PrintableBusiness, type PrintableSalesDocument } from "@/components/sales-document-paper";
import { workspaceAddressLines } from "@/components/settings/options";
import { formatDate } from "@/lib/dates";
import {
  SALES_STATUS_STYLE,
  addressLines,
  isSalesDocumentType,
  paymentMethodLabel,
  salesDocumentConfig,
  salesStatusLabel,
  termsLabel,
} from "@/lib/documents";
import { formatMoney, formatPercent } from "@/lib/money";

export default async function SalesDocumentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { activeTenantId, activeTenant } = await loadTenantContext();
  if (!activeTenantId) redirect("/onboarding");

  const supabase = await createClient();
  const { data: invoice } = await supabase
    .from("invoices")
    .select(
      "id, invoice_number, document_type, issue_date, due_date, status, subtotal, tax_total, total, balance_due, payment_method, payment_reference, refund_source, contact:contacts(id, display_name, email, billing_address)",
    )
    .eq("id", id)
    .eq("tenant_id", activeTenantId)
    .single();

  if (!invoice) notFound();

  const [{ data: lines }, { data: payments }, { data: workspace }] = await Promise.all([
    supabase.from("invoice_lines").select("id, description, quantity, unit_price, tax_rate, amount").eq("invoice_id", id).order("sort_order"),
    supabase
      .from("payment_applications")
      .select("amount_applied, payment:payments_received(payment_date, method, reference)")
      .eq("invoice_id", id)
      .order("created_at"),
    // Workspace profile columns (20261008120000). If that migration isn't applied the
    // query errors, data is null, and the paper falls back to just the workspace name.
    supabase
      .from("tenants")
      .select("legal_name, tax_id, email, phone, website, address, invoice_notes, invoice_footer")
      .eq("id", activeTenantId)
      .maybeSingle(),
  ]);

  const business: PrintableBusiness | null = workspace
    ? {
        legalName: workspace.legal_name,
        addressLines: workspaceAddressLines(workspace.address),
        email: workspace.email,
        phone: workspace.phone,
        website: workspace.website,
        taxId: workspace.tax_id,
        invoiceNotes: workspace.invoice_notes,
        invoiceFooter: workspace.invoice_footer,
      }
    : null;

  const documentType = isSalesDocumentType(invoice.document_type) ? invoice.document_type : "invoice";
  const config = salesDocumentConfig(documentType);
  const isOpen = !config.settlesImmediately && invoice.status !== "draft" && invoice.status !== "void" && invoice.balance_due > 0;
  const terms = termsLabel(invoice.issue_date, invoice.due_date);
  const customerName = invoice.contact?.display_name ?? "Customer";

  const printable: PrintableSalesDocument = {
    documentType,
    number: invoice.invoice_number,
    issueDate: invoice.issue_date,
    dueDate: invoice.due_date,
    customer: {
      name: customerName,
      email: invoice.contact?.email,
      addressLines: addressLines(invoice.contact?.billing_address),
    },
    lines: (lines ?? []).map((l) => ({
      description: l.description ?? "",
      quantity: Number(l.quantity),
      unitPrice: Number(l.unit_price),
      taxRate: Number(l.tax_rate),
      amount: Number(l.amount),
    })),
    subtotal: Number(invoice.subtotal),
    taxTotal: Number(invoice.tax_total),
    total: Number(invoice.total),
    balanceDue: config.settlesImmediately ? null : invoice.status === "draft" ? Number(invoice.total) : Number(invoice.balance_due),
    paymentMethod: invoice.payment_method,
    paymentReference: invoice.payment_reference,
    refundSource: invoice.refund_source,
  };

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{config.label}</p>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">{invoice.invoice_number}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{customerName}</p>
        </div>
        <div className="flex flex-col items-end gap-3">
          <span className={`rounded-full px-3 py-1 text-xs font-medium ${SALES_STATUS_STYLE[invoice.status] ?? ""}`}>
            {salesStatusLabel(documentType, invoice.status)}
          </span>
          <DocumentPrintActions title={`${config.label} ${invoice.invoice_number}`} fileName={`${invoice.invoice_number} – ${customerName}`}>
            <SalesDocumentPaper doc={printable} businessName={activeTenant?.name ?? "Your business"} business={business} />
          </DocumentPrintActions>
        </div>
      </div>

      <Card>
        <CardContent>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-xs text-muted-foreground">{config.dateLabel}</dt>
              <dd className="mt-0.5 font-medium">{formatDate(invoice.issue_date)}</dd>
            </div>
            {config.settlesImmediately ? (
              <>
                <div>
                  <dt className="text-xs text-muted-foreground">{documentType === "refund_receipt" ? "Refunded by" : "Paid by"}</dt>
                  <dd className="mt-0.5 font-medium">{paymentMethodLabel(invoice.payment_method)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Reference</dt>
                  <dd className="mt-0.5 font-medium">{invoice.payment_reference ?? "—"}</dd>
                </div>
                {documentType === "refund_receipt" && (
                  <div>
                    <dt className="text-xs text-muted-foreground">Refund of</dt>
                    <dd className="mt-0.5 font-medium">{invoice.refund_source === "credit" ? "Unused credit" : "Returned items"}</dd>
                  </div>
                )}
              </>
            ) : (
              <>
                <div>
                  <dt className="text-xs text-muted-foreground">Due date</dt>
                  <dd className="mt-0.5 font-medium">{invoice.due_date ? formatDate(invoice.due_date) : "No due date"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Terms</dt>
                  <dd className="mt-0.5 font-medium">{terms ?? "—"}</dd>
                </div>
              </>
            )}
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Line items</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="py-2 pr-4 font-medium">Description</th>
                  <th className="py-2 pr-4 text-right font-medium">Qty</th>
                  <th className="py-2 pr-4 text-right font-medium">Unit price</th>
                  <th className="py-2 pr-4 text-right font-medium">Tax</th>
                  <th className="py-2 text-right font-medium">Amount</th>
                </tr>
              </thead>
              <tbody>
                {lines?.map((l) => (
                  <tr key={l.id} className="border-b border-border/60">
                    <td className="py-2 pr-4">{l.description}</td>
                    <td className="py-2 pr-4 text-right tabular-nums">{l.quantity}</td>
                    <td className="py-2 pr-4 text-right tabular-nums">{formatMoney(l.unit_price)}</td>
                    <td className="py-2 pr-4 text-right tabular-nums text-muted-foreground">{formatPercent(l.tax_rate)}</td>
                    <td className="py-2 text-right tabular-nums">{formatMoney(l.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex flex-col items-end gap-1 text-sm">
            <span className="text-muted-foreground">Subtotal {formatMoney(invoice.subtotal)}</span>
            <span className="text-muted-foreground">Tax {formatMoney(invoice.tax_total)}</span>
            <span className="font-heading text-base font-semibold">
              {documentType === "refund_receipt" ? "Total refunded" : "Total"} {formatMoney(invoice.total)}
            </span>
            {isOpen && <span className="text-destructive">Balance due {formatMoney(invoice.balance_due)}</span>}
          </div>
        </CardContent>
      </Card>

      {invoice.status === "draft" && !config.settlesImmediately && (
        <Card>
          <CardContent className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              This {config.label.toLowerCase()} hasn&apos;t been sent yet — nothing has been posted to your books.
            </p>
            <IssueInvoiceButton invoiceId={invoice.id} label={documentType === "debit_note" ? "Send debit note" : "Send invoice"} />
          </CardContent>
        </Card>
      )}

      {isOpen && (
        <Card>
          <CardHeader>
            <CardTitle>Get paid online</CardTitle>
          </CardHeader>
          <CardContent>
            <CreateStripeLinkButton invoiceId={invoice.id} />
          </CardContent>
        </Card>
      )}

      {isOpen && invoice.contact && (
        <Card>
          <CardHeader>
            <CardTitle>Record a manual payment</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <RecordInvoicePaymentForm
              tenantId={activeTenantId}
              contactId={invoice.contact.id}
              invoiceId={invoice.id}
              balanceDue={invoice.balance_due}
            />
            <p className="text-xs text-muted-foreground">
              One payment covering several invoices?{" "}
              <Link
                href={`/sales/receive-payment?customer=${invoice.contact.id}&invoice=${invoice.id}`}
                className="font-medium text-primary hover:underline"
              >
                Receive a lump-sum payment →
              </Link>
            </p>
          </CardContent>
        </Card>
      )}

      {payments && payments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{documentType === "refund_receipt" ? "Paid from credit" : "Payment history"}</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-border/60 text-sm">
              {payments.map((p, i) => (
                <li key={i} className="flex items-center justify-between gap-4 py-2">
                  <span className="text-muted-foreground">
                    {formatDate(p.payment?.payment_date)} · {paymentMethodLabel(p.payment?.method)}
                    {p.payment?.reference ? ` · ${p.payment.reference}` : ""}
                  </span>
                  <span className="tabular-nums text-positive">{formatMoney(p.amount_applied)}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
