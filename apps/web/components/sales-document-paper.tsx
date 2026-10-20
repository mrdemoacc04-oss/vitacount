import { formatDate } from "@/lib/dates";
import { formatMoney, formatPercent } from "@/lib/money";
import { SALES_DOCUMENTS, paymentMethodLabel, termsLabel, type SalesDocumentType } from "@/lib/documents";

export interface PrintableSalesDocument {
  documentType: SalesDocumentType;
  /** null while previewing an unsaved draft */
  number: string | null;
  issueDate: string | null;
  dueDate: string | null;
  customer: { name: string; email?: string | null; addressLines?: string[] };
  lines: { description: string; quantity: number; unitPrice: number; taxRate: number; amount: number }[];
  subtotal: number;
  taxTotal: number;
  total: number;
  /** Invoices / debit notes once issued */
  balanceDue?: number | null;
  paymentMethod?: string | null;
  paymentReference?: string | null;
  refundSource?: string | null;
}

/** The seller's details printed in the header and footer. Everything but the name is optional. */
export interface PrintableBusiness {
  legalName?: string | null;
  addressLines?: string[];
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  taxId?: string | null;
  invoiceNotes?: string | null;
  invoiceFooter?: string | null;
}

/**
 * The customer-facing document — used for the on-screen preview and for printing /
 * "Save as PDF". Deliberately theme-independent (it's paper): fixed ink on white in
 * both light and dark mode.
 */
export function SalesDocumentPaper({
  doc,
  businessName,
  business,
}: {
  doc: PrintableSalesDocument;
  businessName: string;
  business?: PrintableBusiness | null;
}) {
  const config = SALES_DOCUMENTS[doc.documentType];
  const terms = termsLabel(doc.issueDate, doc.dueDate);
  const showTax = doc.lines.some((l) => l.taxRate > 0) || doc.taxTotal > 0;
  const isReceipt = config.settlesImmediately;
  const amountPaid = doc.balanceDue != null ? doc.total - doc.balanceDue : null;
  const sellerName = business?.legalName?.trim() || businessName;
  const contactLine = [business?.email, business?.phone].filter((v): v is string => Boolean(v?.trim())).join(" · ");
  const website = business?.website?.replace(/^https?:\/\//i, "");
  const taxId = business?.taxId?.trim();
  const notes = business?.invoiceNotes?.trim();
  const footer = business?.invoiceFooter?.trim();

  return (
    <article className="mx-auto w-full max-w-[210mm] bg-white p-8 text-[13px] leading-relaxed text-zinc-900 sm:p-10">
      {doc.number === null && (
        <p className="mb-6 rounded-md bg-amber-50 px-3 py-1.5 text-center text-[11px] font-medium text-amber-800">
          Draft preview — the number is assigned when you save
        </p>
      )}

      <header className="flex flex-wrap items-start justify-between gap-6">
        <div className="min-w-0 max-w-[60%]">
          <p className="text-lg font-semibold tracking-tight">{sellerName}</p>
          {business && (
            <div className="mt-1 text-[12px] leading-snug text-zinc-600">
              {business.addressLines?.map((line) => (
                <p key={line}>{line}</p>
              ))}
              {contactLine && <p className="mt-1">{contactLine}</p>}
              {website && <p>{website}</p>}
              {taxId && <p className="mt-1 tabular-nums">{/^\d{2}-\d{7}$/.test(taxId) ? "EIN" : "Tax ID"} {taxId}</p>}
            </div>
          )}
        </div>
        <div className="text-right">
          <h1 className="text-2xl font-semibold uppercase tracking-[0.12em] text-zinc-900">{config.title}</h1>
          <p className="mt-1 font-medium tabular-nums text-zinc-600">{doc.number ?? "Draft"}</p>
        </div>
      </header>

      <section className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div>
          <p className="text-[10.5px] font-semibold uppercase tracking-wider text-zinc-500">
            {doc.documentType === "refund_receipt" ? "Refunded to" : isReceipt ? "Sold to" : "Bill to"}
          </p>
          <p className="mt-1 font-medium">{doc.customer.name}</p>
          {doc.customer.addressLines?.map((line) => (
            <p key={line} className="text-zinc-600">
              {line}
            </p>
          ))}
          {doc.customer.email && <p className="text-zinc-600">{doc.customer.email}</p>}
        </div>
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 self-start sm:justify-self-end">
          <dt className="text-zinc-500">{config.dateLabel}</dt>
          <dd className="text-right tabular-nums">{formatDate(doc.issueDate)}</dd>
          {!isReceipt && (
            <>
              <dt className="text-zinc-500">Due date</dt>
              <dd className="text-right tabular-nums">{doc.dueDate ? formatDate(doc.dueDate) : "—"}</dd>
              {terms && (
                <>
                  <dt className="text-zinc-500">Terms</dt>
                  <dd className="text-right">{terms}</dd>
                </>
              )}
            </>
          )}
          {isReceipt && (
            <>
              <dt className="text-zinc-500">{doc.documentType === "refund_receipt" ? "Refunded by" : "Paid by"}</dt>
              <dd className="text-right">{paymentMethodLabel(doc.paymentMethod)}</dd>
              {doc.paymentReference && (
                <>
                  <dt className="text-zinc-500">Reference</dt>
                  <dd className="text-right tabular-nums">{doc.paymentReference}</dd>
                </>
              )}
            </>
          )}
        </dl>
      </section>

      <table className="mt-8 w-full border-collapse">
        <thead>
          <tr className="bg-zinc-100 text-left text-[10.5px] font-semibold uppercase tracking-wider text-zinc-600">
            <th className="px-3 py-2 font-semibold">Description</th>
            <th className="px-3 py-2 text-right font-semibold">Qty</th>
            <th className="px-3 py-2 text-right font-semibold">Unit price</th>
            {showTax && <th className="px-3 py-2 text-right font-semibold">Tax</th>}
            <th className="px-3 py-2 text-right font-semibold">Amount</th>
          </tr>
        </thead>
        <tbody>
          {doc.lines.map((line, i) => (
            <tr key={i} className="border-b border-zinc-200 align-top">
              <td className="px-3 py-2.5">{line.description || "—"}</td>
              <td className="px-3 py-2.5 text-right tabular-nums">{line.quantity}</td>
              <td className="px-3 py-2.5 text-right tabular-nums">{formatMoney(line.unitPrice)}</td>
              {showTax && <td className="px-3 py-2.5 text-right tabular-nums">{formatPercent(line.taxRate)}</td>}
              <td className="px-3 py-2.5 text-right tabular-nums">{formatMoney(line.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <section className="mt-6 flex justify-end">
        <dl className="grid w-full max-w-72 grid-cols-[1fr_auto] gap-x-6 gap-y-1.5 tabular-nums">
          <dt className="text-zinc-500">Subtotal</dt>
          <dd className="text-right">{formatMoney(doc.subtotal)}</dd>
          {showTax && (
            <>
              <dt className="text-zinc-500">Sales tax</dt>
              <dd className="text-right">{formatMoney(doc.taxTotal)}</dd>
            </>
          )}
          {/* full-width rows so the rule and the highlight aren't split by the column gap */}
          <div className="col-span-2 grid grid-cols-[1fr_auto] gap-x-6 border-t border-zinc-300 pt-2 font-semibold">
            <dt>{doc.documentType === "refund_receipt" ? "Total refunded" : isReceipt ? "Total paid" : "Total"}</dt>
            <dd className="text-right">{formatMoney(doc.total)}</dd>
          </div>
          {!isReceipt && amountPaid !== null && amountPaid > 0 && (
            <>
              <dt className="text-zinc-500">Paid</dt>
              <dd className="text-right">−{formatMoney(amountPaid)}</dd>
            </>
          )}
          {!isReceipt && doc.balanceDue != null && (
            <div className="col-span-2 grid grid-cols-[1fr_auto] gap-x-6 rounded-md bg-zinc-100 px-2 py-1.5 font-semibold">
              <dt>Balance due</dt>
              <dd className="text-right">{formatMoney(doc.balanceDue)}</dd>
            </div>
          )}
        </dl>
      </section>

      {doc.refundSource === "credit" && (
        <p className="mt-8 text-[11px] text-zinc-500">This refund pays back credit left on the account from an earlier overpayment.</p>
      )}

      {notes && (
        <section className="mt-10 break-inside-avoid">
          <p className="text-[10.5px] font-semibold uppercase tracking-wider text-zinc-500">Notes</p>
          <p className="mt-1 whitespace-pre-line break-words text-zinc-700">{notes}</p>
        </section>
      )}
      {footer && (
        <footer className={`${notes ? "mt-6" : "mt-10"} break-inside-avoid whitespace-pre-line break-words border-t border-zinc-200 pt-4 text-center text-[11px] text-zinc-500`}>
          {footer}
        </footer>
      )}
    </article>
  );
}
