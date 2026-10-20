import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loadTenantContext } from "@/lib/tenant/data";
import { Icons } from "@/components/icons";
import { SalesDocumentForm } from "@/components/sales-document-form";
import { RefundCreditForm, RefundModeSwitch, type CustomerCredit } from "@/components/refund-credit-form";
import { loadFormCatalog } from "@/components/forms/load-catalog";
import { workspaceAddressLines } from "@/components/settings/options";
import type { PrintableBusiness } from "@/components/sales-document-paper";
import { SALES_DOCUMENTS, addressLines, isSalesDocumentType, type SalesDocumentType } from "@/lib/documents";
import { fractionToPercentText } from "@/lib/money";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

export default async function NewSalesDocumentPage({ searchParams }: { searchParams: SearchParams }) {
  const { activeTenantId, activeTenant } = await loadTenantContext();
  if (!activeTenantId) redirect("/onboarding");

  const params = await searchParams;
  const typeParam = first(params.type);
  const documentType: SalesDocumentType = isSalesDocumentType(typeParam) ? typeParam : "invoice";
  const config = SALES_DOCUMENTS[documentType];
  const customerParam = first(params.customer);
  const projectParam = first(params.project);

  const supabase = await createClient();
  const [{ data: contacts }, { data: tenant }, { data: credits }, catalog, { data: profile }] = await Promise.all([
    supabase
      .from("contacts")
      .select("id, display_name, email, billing_address, payment_terms")
      .eq("tenant_id", activeTenantId)
      .in("type", ["customer", "both"])
      .order("display_name"),
    supabase.from("tenants").select("name, default_tax_rate").eq("id", activeTenantId).single(),
    documentType === "refund_receipt"
      ? supabase.from("payments_received").select("contact_id, unapplied_amount").eq("tenant_id", activeTenantId).gt("unapplied_amount", 0)
      : Promise.resolve({ data: [] as { contact_id: string; unapplied_amount: number }[] }),
    loadFormCatalog(supabase, activeTenantId, { items: true, projects: true, defaults: true }),
    // workspace profile for the printed header/footer; errors (columns not migrated yet) leave it null
    supabase
      .from("tenants")
      .select("legal_name, tax_id, email, phone, website, address, invoice_notes, invoice_footer")
      .eq("id", activeTenantId)
      .single(),
  ]);

  const business: PrintableBusiness | null = profile
    ? {
        legalName: profile.legal_name,
        addressLines: workspaceAddressLines(profile.address),
        email: profile.email,
        phone: profile.phone,
        website: profile.website,
        taxId: profile.tax_id,
        invoiceNotes: profile.invoice_notes,
        invoiceFooter: profile.invoice_footer,
      }
    : null;

  const customers = (contacts ?? []).map((c) => ({
    id: c.id,
    display_name: c.display_name,
    email: c.email,
    addressLines: addressLines(c.billing_address),
    paymentTerms: c.payment_terms,
  }));

  const creditByCustomer = new Map<string, number>();
  for (const row of credits ?? []) {
    creditByCustomer.set(row.contact_id, (creditByCustomer.get(row.contact_id) ?? 0) + Number(row.unapplied_amount));
  }
  const customersWithCredit: CustomerCredit[] = customers
    .filter((c) => (creditByCustomer.get(c.id) ?? 0) > 0)
    .map((c) => ({ id: c.id, name: c.display_name, credit: Math.round(creditByCustomer.get(c.id)! * 100) / 100 }));

  // ?project=<id> (from a project page) preselects it — and its customer when none was given
  const project = catalog.projects?.find((p) => p.id === projectParam);
  const defaultCustomerId = customers.some((c) => c.id === customerParam)
    ? customerParam
    : project?.customerId && customers.some((c) => c.id === project.customerId)
      ? project.customerId
      : undefined;

  const selfHref = `/sales/new?type=${documentType}${project ? `&project=${project.id}` : ""}`;
  const newCustomerHref = `/contacts/new?type=customer&returnTo=${encodeURIComponent(selfHref)}`;

  const form = (
    <SalesDocumentForm
      key={documentType}
      tenantId={activeTenantId}
      documentType={documentType}
      customers={customers}
      defaultTaxRate={fractionToPercentText(tenant?.default_tax_rate ?? 0)}
      businessName={tenant?.name ?? activeTenant?.name ?? "Your business"}
      business={business}
      defaultCustomerId={defaultCustomerId}
      defaultProjectId={project?.id}
      items={catalog.items}
      projects={catalog.projects}
      defaultTerms={catalog.defaults?.paymentTerms ?? null}
      newCustomerHref={newCustomerHref}
    />
  );

  return (
    <div className="mx-auto max-w-5xl">
      <Link href="/sales" className="inline-flex items-center gap-1 text-[13px] text-muted-foreground transition-colors hover:text-foreground">
        <Icons.chevronRight className="size-3.5 rotate-180" />
        Sales
      </Link>
      <h1 className="mt-2 font-heading text-2xl font-semibold tracking-tight">New {config.label.toLowerCase()}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{config.description}</p>

      <div className="mt-6">
        {customers.length ? (
          documentType === "refund_receipt" && customersWithCredit.length > 0 ? (
            <RefundModeSwitch
              defaultMode={first(params.source) === "credit" ? "credit" : "sale"}
              saleForm={form}
              creditForm={<RefundCreditForm tenantId={activeTenantId} customers={customersWithCredit} defaultCustomerId={customerParam} />}
            />
          ) : (
            form
          )
        ) : (
          <div className="flex flex-col items-center rounded-xl border border-dashed border-border bg-card px-6 py-14 text-center">
            <span className="flex size-10 items-center justify-center rounded-full bg-accent text-primary">
              <Icons.userPlus className="size-5" />
            </span>
            <h2 className="mt-4 text-[15px] font-semibold text-foreground">Add your first customer</h2>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              Every {config.label.toLowerCase()} is made out to a customer. Add one and you&apos;ll come straight back here.
            </p>
            <Link
              href={newCustomerHref}
              className="mt-5 inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-4 text-[13px] font-medium text-primary-foreground shadow-soft-sm hover:bg-primary/90"
            >
              <Icons.plus className="size-4" />
              New customer
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
