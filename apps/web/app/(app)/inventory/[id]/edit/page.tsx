import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { loadTenantContext } from "@/lib/tenant/data";
import { getItem, itemHasStockHistory, itemUsedOnDocuments, listItemAccounts } from "@/lib/inventory";
import { Icons } from "@/components/icons";
import { SchemaNotice } from "@/components/schema-notice";
import { ItemForm } from "@/components/inventory/item-form";
import type { ItemType } from "@/components/inventory/item-meta";

const str = (value: number | null) => (value === null ? "" : String(value));

export default async function EditItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { activeTenantId } = await loadTenantContext();
  if (!activeTenantId) redirect("/onboarding");

  const result = await getItem(activeTenantId, id);
  if (result.missingSchema) {
    return (
      <div className="mx-auto max-w-4xl">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Edit item</h1>
        <div className="mt-8">
          <SchemaNotice feature="Inventory" />
        </div>
      </div>
    );
  }
  const item = result.data;
  if (!item) notFound();

  const [accounts, hasStockHistory, usedOnDocuments] = await Promise.all([
    listItemAccounts(activeTenantId),
    item.type === "inventory" ? itemHasStockHistory(item.id) : Promise.resolve(false),
    item.type !== "inventory" ? itemUsedOnDocuments(item.id) : Promise.resolve(false),
  ]);

  // Mirrors the checks in items_before_write, so the form explains them up front.
  let lockedTypes: ItemType[] = [];
  let typeLockReason: string | undefined;
  if (hasStockHistory) {
    lockedTypes = ["service", "non_inventory"];
    typeLockReason = "This item has stock history, so it stays a stock item. Archive it if you no longer sell it.";
  } else if (usedOnDocuments) {
    lockedTypes = ["inventory"];
    typeLockReason = "This item is already on invoices or bills, so it can't become a stock item. Create a new stock item instead.";
  }

  return (
    <div className="mx-auto max-w-4xl">
      <Link
        href={`/inventory/${item.id}`}
        className="inline-flex items-center gap-1 text-[13px] text-muted-foreground transition-colors hover:text-foreground"
      >
        <Icons.chevronRight className="size-3.5 rotate-180" />
        {item.name}
      </Link>
      <h1 className="mt-2 font-heading text-2xl font-semibold tracking-tight">Edit item</h1>
      <p className="mt-1 text-sm text-muted-foreground">Changes apply to new documents. Anything already issued keeps its own lines.</p>

      <div className="mt-8">
        <ItemForm
          tenantId={activeTenantId}
          itemId={item.id}
          initial={{
            type: item.type,
            name: item.name,
            sku: item.sku ?? "",
            unit: item.unit ?? "",
            description: item.description ?? "",
            salesPrice: item.salesPrice === null ? "" : item.salesPrice.toFixed(2),
            purchaseCost: item.purchaseCost === null ? "" : item.purchaseCost.toFixed(2),
            incomeAccountId: item.incomeAccountId ?? "",
            expenseAccountId: item.expenseAccountId ?? "",
            reorderPoint: str(item.reorderPoint),
            reorderQty: str(item.reorderQty),
          }}
          incomeAccounts={accounts.income}
          expenseAccounts={accounts.expense}
          lockedTypes={lockedTypes}
          typeLockReason={typeLockReason}
        />
      </div>
    </div>
  );
}
