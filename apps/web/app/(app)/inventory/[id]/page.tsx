import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { loadTenantContext } from "@/lib/tenant/data";
import {
  getAccountNames,
  getItem,
  getItemMovements,
  getItemRecentUse,
  getLastUnitCost,
  getOpenLayers,
  type InventoryItem,
  type StockLayer,
  type StockMovement,
} from "@/lib/inventory";
import { formatDate } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import { Icons } from "@/components/icons";
import { FormMessage, secondaryButtonClass } from "@/components/ui/field";
import { SchemaNotice } from "@/components/schema-notice";
import { AdjustStockForm } from "@/components/inventory/adjust-stock-form";
import { ArchiveItemButton } from "@/components/inventory/archive-item-button";
import { ItemTypeIcon } from "@/components/inventory/item-type-icon";
import { ITEM_TYPE_META, MOVEMENT_LABEL, STOCK_STATE_BADGE, badgeClass, formatQty, formatUnitCost } from "@/components/inventory/item-meta";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const LAYER_SOURCE: Record<string, string> = {
  bill: "Bill",
  inventory_adjustment: "Added by hand",
  refund_receipt: "Customer return",
};

export default async function ItemDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SearchParams }) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const { activeTenantId } = await loadTenantContext();
  if (!activeTenantId) redirect("/onboarding");

  const result = await getItem(activeTenantId, id);
  if (result.missingSchema) {
    return (
      <div className="mx-auto flex max-w-[1280px] flex-col gap-6">
        <BackLink />
        <SchemaNotice feature="Inventory" />
      </div>
    );
  }
  const item = result.data;
  if (!item) notFound();

  const isStock = item.type === "inventory";
  const meta = ITEM_TYPE_META[item.type];
  const openingFailed = query.opening === "failed";

  const accountNames = await getAccountNames(activeTenantId, [item.incomeAccountId, item.expenseAccountId, item.assetAccountId]);

  return (
    <div className="mx-auto flex max-w-[1280px] flex-col gap-6">
      <div className="flex flex-col gap-2">
        <BackLink />
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="font-heading text-2xl font-semibold tracking-tight">{item.name}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-[13px] text-muted-foreground">
              <span className={cn(badgeClass, "gap-1", meta.badgeClass)}>
                <ItemTypeIcon type={item.type} className="size-3" />
                {meta.label}
              </span>
              {!item.isActive && <span className={cn(badgeClass, "bg-muted text-muted-foreground")}>Archived</span>}
              {item.sku && <span className="font-mono text-xs">SKU {item.sku}</span>}
              {item.unit && <span>Sold per {item.unit}</span>}
            </div>
          </div>
          <div className="flex items-start gap-2">
            <ArchiveItemButton tenantId={activeTenantId} itemId={item.id} isActive={item.isActive} />
            <Link href={`/inventory/${item.id}/edit`} className={secondaryButtonClass}>
              Edit
            </Link>
          </div>
        </div>
      </div>

      {openingFailed && (
        <FormMessage>The item was saved, but its opening stock couldn&apos;t be recorded. Add it with Adjust stock below.</FormMessage>
      )}
      {!item.isActive && (
        <p className="rounded-lg border border-border bg-muted/50 px-3.5 py-2.5 text-[13px] text-muted-foreground">
          This item is archived. It&apos;s hidden from new invoices and bills, and its history stays in your books. Restore it to use it
          again.
        </p>
      )}

      {isStock ? (
        <StockItemDetail tenantId={activeTenantId} item={item} accountNames={accountNames} />
      ) : (
        <CatalogItemDetail item={item} accountNames={accountNames} />
      )}
    </div>
  );
}

function BackLink() {
  return (
    <Link
      href="/inventory"
      className="inline-flex w-fit items-center gap-1 text-[13px] text-muted-foreground transition-colors hover:text-foreground"
    >
      <Icons.chevronRight className="size-3.5 rotate-180" />
      Inventory
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Stock items
// ---------------------------------------------------------------------------

async function StockItemDetail({
  tenantId,
  item,
  accountNames,
}: {
  tenantId: string;
  item: InventoryItem;
  accountNames: Map<string, string>;
}) {
  const [{ movements, truncated }, layers, lastCost] = await Promise.all([
    getItemMovements(tenantId, item.id, item.onHand),
    getOpenLayers(tenantId, item.id),
    getLastUnitCost(tenantId, item.id),
  ]);

  const unit = item.unit ? ` ${item.unit}` : "";
  const badge = item.stockState !== "ok" ? STOCK_STATE_BADGE[item.stockState] : null;

  const kpis = [
    {
      label: "On hand",
      value: (
        <span className="inline-flex items-baseline gap-2">
          <span className={cn(item.stockState === "out" && "text-destructive", item.stockState === "low" && "text-warning")}>
            {formatQty(item.onHand)}
          </span>
          {item.unit && <span className="text-sm font-normal text-muted-foreground">{item.unit}</span>}
        </span>
      ),
      note: badge ? (
        <span className="inline-flex items-center gap-1.5">
          <span className={cn(badgeClass, badge.className)}>{item.stockState === "out" ? "Out of stock" : "Low stock"}</span>
          {item.reorderQty !== null && (
            <span>
              Reorder {formatQty(item.reorderQty)}
              {unit}
            </span>
          )}
        </span>
      ) : (
        "In stock"
      ),
    },
    { label: "Stock value", value: formatMoney(item.stockValue), note: "At FIFO cost" },
    {
      label: "Average cost",
      value: item.avgCost !== null ? formatUnitCost(Math.round(item.avgCost * 10_000) / 10_000) : "—",
      note: item.avgCost !== null ? `Per unit${item.unit ? `, per ${item.unit}` : ""}` : "Nothing on hand",
    },
    {
      label: "Reorder point",
      value: item.reorderPoint !== null ? formatQty(item.reorderPoint) : "Not set",
      note:
        item.reorderPoint !== null ? (
          item.reorderQty !== null ? (
            `Order ${formatQty(item.reorderQty)}${unit} at a time`
          ) : (
            "Warns when stock reaches this"
          )
        ) : (
          <Link href={`/inventory/${item.id}/edit`} className="text-primary underline-offset-4 hover:underline">
            Set a reorder point
          </Link>
        ),
    },
  ];

  return (
    <>
      <section
        aria-label="Stock summary"
        className="grid grid-cols-2 overflow-hidden rounded-xl border border-border bg-card lg:grid-cols-4"
      >
        {kpis.map((kpi, i) => (
          <div
            key={kpi.label}
            className={cn(
              "flex flex-col gap-2.5 p-5",
              i % 2 === 1 && "border-l border-border",
              i >= 2 && "border-t border-border lg:border-t-0",
              i === 2 && "lg:border-l",
            )}
          >
            <span className="text-[13px] text-muted-foreground">{kpi.label}</span>
            <span className="font-heading text-[26px] font-semibold leading-none tracking-tight tabular-nums text-foreground">
              {kpi.value}
            </span>
            <span className="text-xs text-muted-foreground">{kpi.note}</span>
          </div>
        ))}
      </section>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-6">
          <MovementsTable movements={movements} truncated={truncated} />
          <LayersTable layers={layers} />
        </div>

        <div className="flex flex-col gap-6 lg:sticky lg:top-6">
          <section className="rounded-xl border border-border bg-card p-5">
            <h2 className="text-[15px] font-semibold text-foreground">Adjust stock</h2>
            <p className="mb-4 mt-1 text-[13px] text-muted-foreground">
              For counts, damage and losses. Stock you buy comes in through bills.
            </p>
            <AdjustStockForm
              tenantId={tenantId}
              itemId={item.id}
              onHand={item.onHand}
              unit={item.unit}
              defaultUnitCost={lastCost ?? item.purchaseCost}
            />
          </section>
          <ItemFacts item={item} accountNames={accountNames} />
        </div>
      </div>
    </>
  );
}

function MovementsTable({ movements, truncated }: { movements: StockMovement[]; truncated: boolean }) {
  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between gap-3 px-5 pb-3 pt-4">
        <h2 className="text-[15px] font-semibold text-foreground">Stock movements</h2>
        {truncated && <span className="text-xs text-muted-foreground">Showing the latest {movements.length}</span>}
      </div>
      {movements.length ? (
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-y border-border text-left text-xs text-muted-foreground">
                <th className="px-5 py-2.5 font-medium">Date</th>
                <th className="px-3 py-2.5 font-medium">Movement</th>
                <th className="px-3 py-2.5 font-medium">Document</th>
                <th className="px-3 py-2.5 text-right font-medium">Quantity</th>
                <th className="px-3 py-2.5 text-right font-medium">Cost</th>
                <th className="px-5 py-2.5 text-right font-medium">Balance</th>
              </tr>
            </thead>
            <tbody>
              {movements.map((m) => {
                const incoming = m.quantity > 0;
                return (
                  <tr key={m.key} className="border-b border-border/60 transition-colors duration-150 last:border-0 hover:bg-accent">
                    <td className="whitespace-nowrap px-5 py-2.5 text-muted-foreground">{formatDate(m.date)}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-foreground">{MOVEMENT_LABEL[m.type] ?? m.type}</td>
                    <td className="max-w-[16rem] truncate px-3 py-2.5">
                      {m.document ? (
                        <Link href={m.document.href} className="font-medium text-primary hover:underline">
                          {m.document.label}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground" title={m.memo ?? undefined}>
                          {adjustmentNote(m.memo)}
                        </span>
                      )}
                    </td>
                    <td
                      className={cn(
                        "whitespace-nowrap px-3 py-2.5 text-right font-medium tabular-nums",
                        incoming ? "text-positive" : "text-destructive",
                      )}
                    >
                      {incoming ? "+" : "−"}
                      {formatQty(Math.abs(m.quantity))}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums text-muted-foreground">
                      {m.totalCost < 0 ? "−" : ""}
                      {formatMoney(Math.abs(m.totalCost))}
                    </td>
                    <td className="whitespace-nowrap px-5 py-2.5 text-right tabular-nums text-foreground">{formatQty(m.balance)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="mx-5 mb-5 rounded-lg border border-dashed border-border px-4 py-5">
          <p className="text-[13px] text-muted-foreground">
            No stock has moved yet. Record a bill with this item to receive stock, or add what&apos;s on the shelf with Adjust stock.
          </p>
          <Link
            href="/expenses/new?type=bill"
            className="mt-2 inline-block text-[13px] font-medium text-primary underline-offset-4 hover:underline"
          >
            Record a bill
          </Link>
        </div>
      )}
    </section>
  );
}

/** adjust_inventory memos read "Stock adjustment, <item> (<reason>)" — show just the reason. */
function adjustmentNote(memo: string | null): string {
  if (!memo) return "—";
  const match = /\(([^()]*)\)\s*$/.exec(memo);
  if (match) return match[1];
  if (memo.startsWith("Opening stock")) return "Opening balance";
  return memo;
}

function LayersTable({ layers }: { layers: StockLayer[] }) {
  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="px-5 pb-3 pt-4">
        <h2 className="text-[15px] font-semibold text-foreground">Cost layers</h2>
        <p className="mt-0.5 text-[13px] text-muted-foreground">
          Stock still on hand, by the batch it came in with. Sales use the oldest first.
        </p>
      </div>
      {layers.length ? (
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-y border-border text-left text-xs text-muted-foreground">
                <th className="px-5 py-2.5 font-medium">Received</th>
                <th className="px-3 py-2.5 font-medium">From</th>
                <th className="px-3 py-2.5 text-right font-medium">Remaining</th>
                <th className="px-3 py-2.5 text-right font-medium">Unit cost</th>
                <th className="px-5 py-2.5 text-right font-medium">Value</th>
              </tr>
            </thead>
            <tbody>
              {layers.map((layer, i) => (
                <tr key={layer.id} className="border-b border-border/60 transition-colors duration-150 last:border-0 hover:bg-accent">
                  <td className="whitespace-nowrap px-5 py-2.5 text-foreground">
                    <span className="inline-flex items-center gap-2">
                      {formatDate(layer.receivedDate)}
                      {i === 0 && <span className={cn(badgeClass, "bg-primary/10 text-primary")}>Next out</span>}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-muted-foreground">{LAYER_SOURCE[layer.sourceType] ?? "Received"}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums">
                    {formatQty(layer.quantityRemaining)}
                    <span className="text-muted-foreground"> of {formatQty(layer.quantityReceived)}</span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums">{formatUnitCost(layer.unitCost)}</td>
                  <td className="whitespace-nowrap px-5 py-2.5 text-right tabular-nums">{formatMoney(layer.costRemaining)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="mx-5 mb-5 rounded-lg border border-dashed border-border px-4 py-5 text-[13px] text-muted-foreground">
          Nothing on hand, so there are no open cost layers.
        </p>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Shared: prices and accounts
// ---------------------------------------------------------------------------

function ItemFacts({ item, accountNames }: { item: InventoryItem; accountNames: Map<string, string> }) {
  const isStock = item.type === "inventory";
  const account = (id: string | null, fallback: string) => (id ? (accountNames.get(id) ?? fallback) : fallback);
  const facts: { label: string; value: string }[] = [
    { label: "Sales price", value: item.salesPrice !== null ? formatMoney(item.salesPrice) : "Not set" },
    { label: "Purchase cost", value: item.purchaseCost !== null ? formatMoney(item.purchaseCost) : "Not set" },
    { label: "Income account", value: account(item.incomeAccountId, "Not set") },
    {
      label: isStock ? "Cost of goods sold" : "Purchase category",
      value: account(item.expenseAccountId, isStock ? "Not set" : "Chosen on each bill"),
    },
    ...(isStock ? [{ label: "Inventory asset", value: account(item.assetAccountId, "Not set") }] : []),
  ];

  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <h2 className="text-[15px] font-semibold text-foreground">Pricing and accounts</h2>
      <dl className="mt-3 divide-y divide-border/60 text-[13px]">
        {facts.map((f) => (
          <div key={f.label} className="flex items-baseline justify-between gap-4 py-2">
            <dt className="shrink-0 text-muted-foreground">{f.label}</dt>
            <dd className="min-w-0 truncate text-right tabular-nums text-foreground" title={f.value}>
              {f.value}
            </dd>
          </div>
        ))}
      </dl>
      {item.description && (
        <div className="mt-3 border-t border-border pt-3">
          <p className="text-xs text-muted-foreground">Description on documents</p>
          <p className="mt-1 whitespace-pre-line text-[13px] text-foreground">{item.description}</p>
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Services and non-stock items
// ---------------------------------------------------------------------------

async function CatalogItemDetail({ item, accountNames }: { item: InventoryItem; accountNames: Map<string, string> }) {
  const uses = await getItemRecentUse(item.id);

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <section className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="px-5 pb-3 pt-4">
          <h2 className="text-[15px] font-semibold text-foreground">Recent use</h2>
          <p className="mt-0.5 text-[13px] text-muted-foreground">The latest invoices, receipts and bills this item appears on.</p>
        </div>
        {uses.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-y border-border text-left text-xs text-muted-foreground">
                  <th className="px-5 py-2.5 font-medium">Date</th>
                  <th className="px-3 py-2.5 font-medium">Document</th>
                  <th className="px-3 py-2.5 font-medium">Contact</th>
                  <th className="px-3 py-2.5 text-right font-medium">Qty</th>
                  <th className="px-3 py-2.5 text-right font-medium">Rate</th>
                  <th className="px-5 py-2.5 text-right font-medium">Amount</th>
                </tr>
              </thead>
              <tbody>
                {uses.map((use) => (
                  <tr key={use.key} className="border-b border-border/60 transition-colors duration-150 last:border-0 hover:bg-accent">
                    <td className="whitespace-nowrap px-5 py-2.5 text-muted-foreground">{formatDate(use.date)}</td>
                    <td className="whitespace-nowrap px-3 py-2.5">
                      <span className="inline-flex items-center gap-2">
                        <Link href={use.href} className="font-medium text-primary hover:underline">
                          {use.documentLabel}
                        </Link>
                        <span
                          className={cn(
                            badgeClass,
                            use.side === "sale" ? "bg-positive/10 text-positive" : "bg-secondary text-secondary-foreground",
                          )}
                        >
                          {use.side === "sale" ? "Sale" : "Purchase"}
                        </span>
                      </span>
                    </td>
                    <td className="max-w-[12rem] truncate px-3 py-2.5 text-foreground">{use.party ?? "—"}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums">{formatQty(use.quantity)}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums">{formatMoney(use.unitAmount)}</td>
                    <td className="whitespace-nowrap px-5 py-2.5 text-right tabular-nums text-foreground">{formatMoney(use.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="mx-5 mb-5 rounded-lg border border-dashed border-border px-4 py-5">
            <p className="text-[13px] text-muted-foreground">
              Not used on any documents yet. Pick it from the item list when you create an invoice or a bill.
            </p>
            <Link href="/sales/new" className="mt-2 inline-block text-[13px] font-medium text-primary underline-offset-4 hover:underline">
              Create an invoice
            </Link>
          </div>
        )}
      </section>

      <ItemFacts item={item} accountNames={accountNames} />
    </div>
  );
}
