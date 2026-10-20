import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loadTenantContext } from "@/lib/tenant/data";
import { Icons } from "@/components/icons";
import { ReceivePaymentForm, type OpenReceivable, type PayingCustomer } from "@/components/receive-payment-form";
import { formatMoney } from "@/lib/money";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

export default async function ReceivePaymentPage({ searchParams }: { searchParams: SearchParams }) {
  const { activeTenantId } = await loadTenantContext();
  if (!activeTenantId) redirect("/onboarding");

  const params = await searchParams;
  const customerParam = first(params.customer);
  const invoiceParam = first(params.invoice);
  const recordedParam = first(params.recorded);

  const supabase = await createClient();
  const [{ data: contacts }, { data: openDocs }, { data: credits }, recorded] = await Promise.all([
    supabase.from("contacts").select("id, display_name").eq("tenant_id", activeTenantId).in("type", ["customer", "both"]).order("display_name"),
    supabase
      .from("invoices")
      .select("id, invoice_number, document_type, contact_id, issue_date, due_date, total, balance_due")
      .eq("tenant_id", activeTenantId)
      .in("document_type", ["invoice", "debit_note"])
      .in("status", ["sent", "partial", "overdue"])
      .gt("balance_due", 0),
    supabase.from("payments_received").select("contact_id, unapplied_amount").eq("tenant_id", activeTenantId).gt("unapplied_amount", 0),
    recordedParam
      ? supabase
          .from("payments_received")
          .select("id, amount, unapplied_amount, contact:contacts(display_name)")
          .eq("id", recordedParam)
          .eq("tenant_id", activeTenantId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const openInvoices: OpenReceivable[] = (openDocs ?? []).map((d) => ({
    id: d.id,
    number: d.invoice_number,
    documentType: d.document_type,
    contactId: d.contact_id,
    issueDate: d.issue_date,
    dueDate: d.due_date,
    total: Number(d.total),
    balanceDue: Number(d.balance_due),
  }));

  const openByCustomer = new Map<string, number>();
  for (const inv of openInvoices) openByCustomer.set(inv.contactId, (openByCustomer.get(inv.contactId) ?? 0) + inv.balanceDue);
  const creditByCustomer = new Map<string, number>();
  for (const c of credits ?? []) creditByCustomer.set(c.contact_id, (creditByCustomer.get(c.contact_id) ?? 0) + Number(c.unapplied_amount));

  const customers: PayingCustomer[] = (contacts ?? []).map((c) => ({
    id: c.id,
    name: c.display_name,
    openBalance: Math.round((openByCustomer.get(c.id) ?? 0) * 100) / 100,
    credit: Math.round((creditByCustomer.get(c.id) ?? 0) * 100) / 100,
  }));

  const recordedPayment = recorded.data;

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <div>
        <Link href="/sales" className="inline-flex items-center gap-1 text-[13px] text-muted-foreground transition-colors hover:text-foreground">
          <Icons.chevronRight className="size-3.5 rotate-180" />
          Sales
        </Link>
        <h1 className="mt-2 font-heading text-2xl font-semibold tracking-tight">Receive payment</h1>
        <p className="mt-1 text-sm text-muted-foreground">
            Record one payment — a check or a transfer — and split it across a customer&apos;s open invoices.
          </p>
      </div>

      {recordedPayment && (
        <div className="rounded-xl bg-positive/10 px-4 py-3 text-sm text-foreground" role="status">
          <span className="font-semibold">Payment recorded.</span> {formatMoney(recordedPayment.amount)} from{" "}
          {recordedPayment.contact?.display_name ?? "the customer"}
          {Number(recordedPayment.unapplied_amount) > 0
            ? ` — ${formatMoney(Number(recordedPayment.amount) - Number(recordedPayment.unapplied_amount))} applied to invoices, ${formatMoney(recordedPayment.unapplied_amount)} kept as credit.`
            : " — fully applied to invoices."}
        </div>
      )}

      {customers.length ? (
        <div>
          <ReceivePaymentForm
            // remount with fresh state after each recorded payment
            key={recordedParam ?? "new"}
            tenantId={activeTenantId}
            customers={customers}
            openInvoices={openInvoices}
            defaultCustomerId={customers.some((c) => c.id === customerParam) ? customerParam : undefined}
            focusInvoiceId={invoiceParam}
          />
        </div>
      ) : (
        <div className="flex flex-col items-center rounded-xl border border-dashed border-border bg-card px-6 py-14 text-center">
          <span className="flex size-10 items-center justify-center rounded-full bg-accent text-primary">
            <Icons.userPlus className="size-5" />
          </span>
          <h2 className="mt-4 text-[15px] font-semibold text-foreground">Add a customer first</h2>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">Payments are recorded against a customer. Add one and you&apos;ll come straight back here.</p>
          <Link
            href="/contacts/new?type=customer&returnTo=%2Fsales%2Freceive-payment"
            className="mt-5 inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-4 text-[13px] font-medium text-primary-foreground shadow-soft-sm hover:bg-primary/90"
          >
            <Icons.plus className="size-4" />
            New customer
          </Link>
        </div>
      )}
    </div>
  );
}
