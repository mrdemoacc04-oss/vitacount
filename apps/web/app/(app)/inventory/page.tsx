import Link from "next/link";
import Form from "next/form";
import { redirect } from "next/navigation";
import { loadTenantContext } from "@/lib/tenant/data";
import { listItems, type InventoryItem } from "@/lib/inventory";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import { Icons } from "@/components/icons";
import { SchemaNotice } from "@/components/schema-notice";
import { ClickableRow } from "@/components/inventory/clickable-row";
import { ItemTypeIcon } from "@/components/inventory/item-type-icon";
import {
  ITEM_TYPES,
  ITEM_TYPE_META,
  STOCK_STATE_BADGE,
  badgeClass,
  formatQty,
  primaryButtonClass,
  type ItemType,
} from "@/components/inventory/item-meta";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

type Tab = "all" | ItemType;

const TABS: { value: Tab; label: string }[] = [
  { value: "all", label: "All" },
  ...ITEM_TYPES.map((type) => ({ value: type, label: ITEM_TYPE_META[type].plural })),
];

function hrefFor(params: { type: Tab; q: string; archived: boolean }) {
  const search = new URLSearchParams();
  if (params.type !== "all") search.set("type", params.type);
  if (params.q) search.set("q", params.q);
  if (params.archived) search.set("archived", "1");
  const qs = search.toString();
  return qs ? `/inventory?${qs}` : "/inventory";
}

export default async function InventoryPage({ searchParams }: { searchParams: SearchParams }) {
  const { activeTenantId } = await loadTenantContext();
  if (!activeTenantId) redirect("/onboarding");

  const params = await searchParams;
  const typeParam = first(params.type);
  const tab: Tab = typeParam && (ITEM_TYPES as readonly string[]).includes(typeParam) ? (typeParam as ItemType) : "all";
  const q = (first(params.q) ?? "").trim();
  const showArchived = first(params.archived) === "1";

  const result = await listItems(activeTenantId);

  const header = (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Inventory</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your products and services, with stock on hand and FIFO cost for the things you count.
        </p>
      </div>
      {!result.missingSchema && (
        <Link href="/inventory/new" className={primaryButtonClass}>
          <Icons.plus className="size-4" />
          New item
        </Link>
      )}
    </div>
  );

  if (result.missingSchema) {
    return (
      <div className="mx-auto flex max-w-[1280px] flex-col gap-6">
        {header}
        <SchemaNotice feature="Inventory" />
      </div>
    );
  }

  const items = result.data;
  const active = items.filter((i) => i.isActive);
  const activeStock = active.filter((i) => i.type === "inventory");
  const stockValue = items.reduce((sum, i) => sum + i.stockValue, 0);
  const lowCount = activeStock.filter((i) => i.stockState === "low").length;
  const outCount = activeStock.filter((i) => i.stockState === "out").length;
  const archivedCount = items.length - active.length;

  if (items.length === 0) {
    return (
      <div className="mx-auto flex max-w-[1280px] flex-col gap-6">
        {header}
        <EmptyCatalog />
      </div>
    );
  }

  const needle = q.toLowerCase();
  const visibleByArchive = showArchived ? items : active;
  const countFor = (t: Tab) => visibleByArchive.filter((i) => t === "all" || i.type === t).length;
  const rows = visibleByArchive.filter(
    (i) =>
      (tab === "all" || i.type === tab) &&
      (!needle || i.name.toLowerCase().includes(needle) || (i.sku ?? "").toLowerCase().includes(needle)),
  );

  const kpis = [
    {
      label: "Stock value",
      value: formatMoney(stockValue),
      note: `${activeStock.length} stock ${activeStock.length === 1 ? "item" : "items"} at FIFO cost`,
      tone: "",
    },
    {
      label: "Low on stock",
      value: String(lowCount),
      note: lowCount ? "At or under the reorder point" : "Nothing at its reorder point",
      tone: lowCount ? "text-warning" : "",
    },
    {
      label: "Out of stock",
      value: String(outCount),
      note: outCount ? "Can't be sold until restocked" : "Everything is in stock",
      tone: outCount ? "text-destructive" : "",
    },
    {
      label: "Active items",
      value: String(active.length),
      note: archivedCount ? `${archivedCount} archived` : "Products and services",
      tone: "",
    },
  ];

  return (
    <div className="mx-auto flex max-w-[1280px] flex-col gap-6">
      {header}

      <section
        aria-label="Inventory summary"
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
            <span
              className={cn("font-heading text-[26px] font-semibold leading-none tracking-tight tabular-nums text-foreground", kpi.tone)}
            >
              {kpi.value}
            </span>
            <span className="text-xs text-muted-foreground">{kpi.note}</span>
          </div>
        ))}
      </section>

      <section className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
          <nav aria-label="Item type" className="flex flex-wrap items-center gap-1">
            {TABS.map((t) => {
              const selected = t.value === tab;
              return (
                <Link
                  key={t.value}
                  href={hrefFor({ type: t.value, q, archived: showArchived })}
                  aria-current={selected ? "page" : undefined}
                  className={cn(
                    "inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-[13px] font-medium transition-colors duration-150",
                    selected ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  {t.label}
                  <span className={cn("text-xs tabular-nums", selected ? "text-accent-foreground/70" : "text-muted-foreground/70")}>
                    {countFor(t.value)}
                  </span>
                </Link>
              );
            })}
          </nav>

          <div className="flex flex-wrap items-center gap-2">
            <Form action="/inventory" className="relative">
              {tab !== "all" && <input type="hidden" name="type" value={tab} />}
              {showArchived && <input type="hidden" name="archived" value="1" />}
              <Icons.search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="search"
                name="q"
                defaultValue={q}
                placeholder="Search name or SKU"
                aria-label="Search items by name or SKU"
                className="h-8 w-56 rounded-lg border border-input bg-card pl-8 pr-2.5 text-[13px] text-foreground shadow-soft-sm outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground/70 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40"
              />
            </Form>
            <Link
              href={hrefFor({ type: tab, q, archived: !showArchived })}
              role="switch"
              aria-checked={showArchived}
              className="inline-flex h-8 items-center gap-2 rounded-lg px-2.5 text-[13px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <span
                aria-hidden="true"
                className={cn(
                  "relative inline-flex h-4 w-7 items-center rounded-full transition-colors duration-150",
                  showArchived ? "bg-primary" : "bg-input",
                )}
              >
                <span
                  className={cn(
                    "absolute size-3 rounded-full bg-card shadow-soft-sm transition-transform duration-150",
                    showArchived ? "translate-x-3.5" : "translate-x-0.5",
                  )}
                />
              </span>
              Show archived
            </Link>
          </div>
        </div>

        {rows.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="px-4 py-2.5 font-medium">Item</th>
                  <th className="px-4 py-2.5 font-medium">Type</th>
                  <th className="px-4 py-2.5 text-right font-medium">On hand</th>
                  <th className="px-4 py-2.5 text-right font-medium">Avg cost</th>
                  <th className="px-4 py-2.5 text-right font-medium">Stock value</th>
                  <th className="px-4 py-2.5 text-right font-medium">Sales price</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((item) => (
                  <ItemRow key={item.id} item={item} />
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 px-6 py-14 text-center">
            <p className="text-sm font-medium text-foreground">No items match</p>
            <p className="max-w-sm text-[13px] text-muted-foreground">
              {q ? `Nothing matches “${q}”` : "There's nothing of this type yet"}
              {!showArchived && archivedCount > 0 ? ", archived items are hidden." : "."}
            </p>
            <div className="mt-2 flex items-center gap-2">
              {(q || tab !== "all") && (
                <Link
                  href={hrefFor({ type: "all", q: "", archived: showArchived })}
                  className="text-[13px] font-medium text-primary underline-offset-4 hover:underline"
                >
                  Clear filters
                </Link>
              )}
              {!q && tab !== "all" && (
                <Link href="/inventory/new" className="text-[13px] font-medium text-primary underline-offset-4 hover:underline">
                  New item
                </Link>
              )}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function ItemRow({ item }: { item: InventoryItem }) {
  const meta = ITEM_TYPE_META[item.type];
  const isStock = item.type === "inventory";
  const badge = isStock && item.isActive && item.stockState !== "ok" ? STOCK_STATE_BADGE[item.stockState] : null;
  const dash = <span className="text-muted-foreground/60">—</span>;

  return (
    <ClickableRow
      href={`/inventory/${item.id}`}
      className={cn("border-b border-border/60 last:border-0", !item.isActive && "text-muted-foreground")}
    >
      <td className="max-w-[22rem] px-4 py-2.5">
        <Link href={`/inventory/${item.id}`} className="flex items-center gap-2 font-medium text-foreground hover:text-primary">
          <span className="truncate">{item.name}</span>
          {!item.isActive && <span className={cn(badgeClass, "bg-muted text-muted-foreground")}>Archived</span>}
        </Link>
        {(item.sku || item.unit) && (
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {item.sku && <span className="font-mono">{item.sku}</span>}
            {item.sku && item.unit && <span aria-hidden="true"> · </span>}
            {item.unit && <span>per {item.unit}</span>}
          </p>
        )}
      </td>
      <td className="px-4 py-2.5">
        <span className={cn(badgeClass, "gap-1", meta.badgeClass)}>
          <ItemTypeIcon type={item.type} className="size-3" />
          {meta.label}
        </span>
      </td>
      <td className="whitespace-nowrap px-4 py-2.5 text-right tabular-nums">
        {isStock ? (
          <span className="inline-flex items-center justify-end gap-2">
            {badge && <span className={cn(badgeClass, badge.className)}>{badge.label}</span>}
            <span className={cn(item.stockState === "out" && item.isActive ? "text-destructive" : "text-foreground")}>
              {formatQty(item.onHand)}
            </span>
          </span>
        ) : (
          dash
        )}
      </td>
      <td className="whitespace-nowrap px-4 py-2.5 text-right tabular-nums">{item.avgCost !== null ? formatMoney(item.avgCost) : dash}</td>
      <td className="whitespace-nowrap px-4 py-2.5 text-right tabular-nums">{isStock ? formatMoney(item.stockValue) : dash}</td>
      <td className="whitespace-nowrap px-4 py-2.5 text-right tabular-nums">
        {item.salesPrice !== null ? formatMoney(item.salesPrice) : dash}
      </td>
    </ClickableRow>
  );
}

function EmptyCatalog() {
  return (
    <section className="rounded-xl border border-border bg-card px-6 py-10 md:px-10">
      <div className="mx-auto max-w-2xl text-center">
        <span className="mx-auto flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icons.inventory className="size-5" />
        </span>
        <h2 className="mt-4 text-[17px] font-semibold text-foreground">Add the things you sell and buy</h2>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Items fill in descriptions, prices and accounts on invoices and bills. Pick the kind that matches how you track it.
        </p>
      </div>

      <div className="mx-auto mt-8 grid max-w-3xl gap-3 sm:grid-cols-3">
        {(
          [
            ["inventory", "Counted on the shelf. Bills add stock, sales take it out oldest first, and cost of goods posts automatically."],
            ["service", "Time and fees you bill for. No quantity to track, just a rate and an income account."],
            ["non_inventory", "Products you buy or resell without counting, like drop-shipped goods or supplies."],
          ] as const
        ).map(([type, copy]) => (
          <div key={type} className="rounded-xl border border-border p-4">
            <span className="flex size-8 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <ItemTypeIcon type={type} className="size-[18px]" />
            </span>
            <p className="mt-3 text-[13px] font-semibold text-foreground">{ITEM_TYPE_META[type].label}</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{copy}</p>
          </div>
        ))}
      </div>

      <div className="mt-8 flex justify-center">
        <Link href="/inventory/new" className={primaryButtonClass}>
          <Icons.plus className="size-4" />
          New item
        </Link>
      </div>
    </section>
  );
}
