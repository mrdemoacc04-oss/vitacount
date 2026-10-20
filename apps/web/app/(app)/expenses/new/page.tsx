import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loadTenantContext } from "@/lib/tenant/data";
import { Icons } from "@/components/icons";
import { PurchaseDocumentForm } from "@/components/purchase-document-form";
import { NewExpenseForm } from "@/components/new-expense-form";
import { loadFormCatalog } from "@/components/forms/load-catalog";
import { PURCHASE_DOCUMENTS, isPurchaseDocumentType } from "@/lib/documents";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

const EXPENSE_COPY = {
  label: "Expense",
  description: "Something you've already paid for — a card swipe, cash, a transfer. It goes straight into your books as paid.",
};

export default async function NewPurchasePage({ searchParams }: { searchParams: SearchParams }) {
  const { activeTenantId } = await loadTenantContext();
  if (!activeTenantId) redirect("/onboarding");

  const params = await searchParams;
  const typeParam = first(params.type);
  const kind = typeParam === "expense" ? "expense" : isPurchaseDocumentType(typeParam) ? typeParam : "bill";
  const copy = kind === "expense" ? EXPENSE_COPY : PURCHASE_DOCUMENTS[kind];
  const vendorParam = first(params.vendor);
  const projectParam = first(params.project);

  const supabase = await createClient();
  const [{ data: vendors }, { data: expenseAccounts }, catalog] = await Promise.all([
    supabase.from("contacts").select("id, display_name").eq("tenant_id", activeTenantId).in("type", ["vendor", "both"]).order("display_name"),
    supabase.from("accounts").select("id, code, name").eq("tenant_id", activeTenantId).eq("type", "expense").order("code"),
    loadFormCatalog(supabase, activeTenantId, { items: kind !== "expense", projects: true }),
  ]);

  const needsVendor = kind !== "expense";
  const defaultVendorId = vendors?.some((v) => v.id === vendorParam) ? vendorParam : undefined;
  const defaultProjectId = catalog.projects?.some((p) => p.id === projectParam) ? projectParam : undefined;
  const selfHref = `/expenses/new?type=${kind}${defaultProjectId ? `&project=${defaultProjectId}` : ""}`;
  const newVendorHref = `/contacts/new?type=vendor&returnTo=${encodeURIComponent(selfHref)}`;

  return (
    <div className={kind === "expense" ? "mx-auto max-w-4xl" : "mx-auto max-w-5xl"}>
      <Link href="/expenses" className="inline-flex items-center gap-1 text-[13px] text-muted-foreground transition-colors hover:text-foreground">
        <Icons.chevronRight className="size-3.5 rotate-180" />
        Expenses
      </Link>
      <h1 className="mt-2 font-heading text-2xl font-semibold tracking-tight">New {copy.label.toLowerCase()}</h1>
      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{copy.description}</p>

      <div className="mt-6">
        {!needsVendor || vendors?.length ? (
          kind === "expense" ? (
            <NewExpenseForm
              tenantId={activeTenantId}
              vendors={vendors ?? []}
              expenseAccounts={expenseAccounts ?? []}
              projects={catalog.projects}
              defaultProjectId={defaultProjectId}
              defaultVendorId={defaultVendorId}
            />
          ) : (
            <PurchaseDocumentForm
              key={kind}
              tenantId={activeTenantId}
              documentType={kind}
              vendors={vendors ?? []}
              expenseAccounts={expenseAccounts ?? []}
              defaultVendorId={defaultVendorId}
              defaultProjectId={defaultProjectId}
              items={catalog.items}
              projects={catalog.projects}
              newVendorHref={newVendorHref}
            />
          )
        ) : (
          <div className="flex flex-col items-center rounded-xl border border-dashed border-border bg-card px-6 py-14 text-center">
            <span className="flex size-10 items-center justify-center rounded-full bg-accent text-primary">
              <Icons.userPlus className="size-5" />
            </span>
            <h2 className="mt-4 text-[15px] font-semibold text-foreground">Add your first supplier</h2>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              A {copy.label.toLowerCase()} comes from a supplier. Add one and you&apos;ll come straight back here.
            </p>
            <Link
              href={newVendorHref}
              className="mt-5 inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-4 text-[13px] font-medium text-primary-foreground shadow-soft-sm hover:bg-primary/90"
            >
              <Icons.plus className="size-4" />
              New supplier
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
