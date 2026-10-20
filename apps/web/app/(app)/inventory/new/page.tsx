import Link from "next/link";
import { redirect } from "next/navigation";
import { loadTenantContext } from "@/lib/tenant/data";
import { inventorySchemaReady, listItemAccounts } from "@/lib/inventory";
import { Icons } from "@/components/icons";
import { SchemaNotice } from "@/components/schema-notice";
import { ItemForm } from "@/components/inventory/item-form";
import { isItemType } from "@/components/inventory/item-meta";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function NewItemPage({ searchParams }: { searchParams: SearchParams }) {
  const { activeTenantId } = await loadTenantContext();
  if (!activeTenantId) redirect("/onboarding");

  const params = await searchParams;
  const typeParam = Array.isArray(params.type) ? params.type[0] : params.type;

  const [ready, accounts] = await Promise.all([inventorySchemaReady(activeTenantId), listItemAccounts(activeTenantId)]);

  return (
    <div className="mx-auto max-w-4xl">
      <Link
        href="/inventory"
        className="inline-flex items-center gap-1 text-[13px] text-muted-foreground transition-colors hover:text-foreground"
      >
        <Icons.chevronRight className="size-3.5 rotate-180" />
        Inventory
      </Link>
      <h1 className="mt-2 font-heading text-2xl font-semibold tracking-tight">New item</h1>
      <p className="mt-1 text-sm text-muted-foreground">A product or service you can add to invoices, receipts and bills.</p>

      <div className="mt-8">
        {ready ? (
          <ItemForm
            tenantId={activeTenantId}
            itemId={null}
            initial={isItemType(typeParam) ? { type: typeParam } : undefined}
            incomeAccounts={accounts.income}
            expenseAccounts={accounts.expense}
          />
        ) : (
          <SchemaNotice feature="Inventory" />
        )}
      </div>
    </div>
  );
}
