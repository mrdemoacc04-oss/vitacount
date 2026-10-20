import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loadTenantContext } from "@/lib/tenant/data";
import { Icons } from "@/components/icons";
import { PayBillsForm, type OpenBill, type PayableVendor } from "@/components/pay-bills-form";
import { formatMoney } from "@/lib/money";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

export default async function PayBillsPage({ searchParams }: { searchParams: SearchParams }) {
  const { activeTenantId } = await loadTenantContext();
  if (!activeTenantId) redirect("/onboarding");

  const params = await searchParams;
  const vendorParam = first(params.vendor);
  const billParam = first(params.bill);
  const paidParam = first(params.paid);

  const supabase = await createClient();
  const [{ data: contacts }, { data: bills }, { data: credits }, paid] = await Promise.all([
    supabase.from("contacts").select("id, display_name").eq("tenant_id", activeTenantId).in("type", ["vendor", "both"]).order("display_name"),
    supabase
      .from("bills")
      .select("id, bill_number, vendor_id, issue_date, due_date, total, balance_due")
      .eq("tenant_id", activeTenantId)
      .eq("document_type", "bill")
      .in("status", ["open", "partial"])
      .gt("balance_due", 0),
    supabase
      .from("bills")
      .select("vendor_id, balance_due")
      .eq("tenant_id", activeTenantId)
      .eq("document_type", "vendor_credit")
      .gt("balance_due", 0),
    paidParam
      ? supabase
          .from("payments_made")
          .select("id, amount, vendor:contacts(display_name)")
          .eq("id", paidParam)
          .eq("tenant_id", activeTenantId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const openBills: OpenBill[] = (bills ?? []).map((b) => ({
    id: b.id,
    number: b.bill_number,
    vendorId: b.vendor_id,
    issueDate: b.issue_date,
    dueDate: b.due_date,
    total: Number(b.total),
    balanceDue: Number(b.balance_due),
  }));

  const owed = new Map<string, number>();
  for (const b of openBills) owed.set(b.vendorId, (owed.get(b.vendorId) ?? 0) + b.balanceDue);
  const credit = new Map<string, number>();
  for (const c of credits ?? []) credit.set(c.vendor_id, (credit.get(c.vendor_id) ?? 0) + Number(c.balance_due));

  const vendors: PayableVendor[] = (contacts ?? []).map((v) => ({
    id: v.id,
    name: v.display_name,
    openBalance: Math.round((owed.get(v.id) ?? 0) * 100) / 100,
    credit: Math.round((credit.get(v.id) ?? 0) * 100) / 100,
  }));

  const paidPayment = paid.data;

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <div>
        <Link href="/expenses" className="inline-flex items-center gap-1 text-[13px] text-muted-foreground transition-colors hover:text-foreground">
          <Icons.chevronRight className="size-3.5 rotate-180" />
          Expenses
        </Link>
        <h1 className="mt-2 font-heading text-2xl font-semibold tracking-tight">Pay bills</h1>
        <p className="mt-1 text-sm text-muted-foreground">One payment — a check or a transfer — across a supplier&apos;s open bills.</p>
      </div>

      {paidPayment && (
        <div className="rounded-xl bg-positive/10 px-4 py-3 text-sm text-foreground" role="status">
          <span className="font-semibold">Payment recorded.</span> {formatMoney(paidPayment.amount)} to{" "}
          {paidPayment.vendor?.display_name ?? "the supplier"}.
        </div>
      )}

      {vendors.length ? (
        <div>
          <PayBillsForm
            key={paidParam ?? "new"}
            tenantId={activeTenantId}
            vendors={vendors}
            openBills={openBills}
            defaultVendorId={vendors.some((v) => v.id === vendorParam) ? vendorParam : undefined}
            focusBillId={billParam}
          />
        </div>
      ) : (
        <div className="flex flex-col items-center rounded-xl border border-dashed border-border bg-card px-6 py-14 text-center">
          <span className="flex size-10 items-center justify-center rounded-full bg-accent text-primary">
            <Icons.userPlus className="size-5" />
          </span>
          <h2 className="mt-4 text-[15px] font-semibold text-foreground">Add a supplier first</h2>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">Payments are recorded against a supplier. Add one and you&apos;ll come straight back here.</p>
          <Link
            href="/contacts/new?type=vendor&returnTo=%2Fexpenses%2Fpay-bills"
            className="mt-5 inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-4 text-[13px] font-medium text-primary-foreground shadow-soft-sm hover:bg-primary/90"
          >
            <Icons.plus className="size-4" />
            New supplier
          </Link>
        </div>
      )}
    </div>
  );
}
