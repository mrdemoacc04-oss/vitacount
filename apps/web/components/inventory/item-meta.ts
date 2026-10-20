/**
 * Labels, styles and small helpers for catalog items. Kept free of server
 * imports so both the pages and the client forms can use them.
 */

export const ITEM_TYPES = ["inventory", "service", "non_inventory"] as const;
export type ItemType = (typeof ITEM_TYPES)[number];

export function isItemType(value: unknown): value is ItemType {
  return typeof value === "string" && (ITEM_TYPES as readonly string[]).includes(value);
}

export const ITEM_TYPE_META: Record<ItemType, { label: string; plural: string; description: string; badgeClass: string }> = {
  inventory: {
    label: "Stock item",
    plural: "Stock items",
    description: "Tracked quantity, FIFO cost of goods",
    badgeClass: "bg-primary/10 text-primary",
  },
  service: {
    label: "Service",
    plural: "Services",
    description: "Hours, fees, labour",
    badgeClass: "bg-chart-2/15 text-chart-2",
  },
  non_inventory: {
    label: "Non-stock",
    plural: "Non-stock",
    description: "Things you buy or sell but don't count",
    badgeClass: "bg-secondary text-secondary-foreground",
  },
};

export type StockState = "out" | "low" | "ok";

/** Out at zero (or below), low at or under the reorder point, otherwise fine. */
export function stockState(onHand: number, reorderPoint: number | null): StockState {
  if (onHand <= 0) return "out";
  if (reorderPoint !== null && onHand <= reorderPoint) return "low";
  return "ok";
}

export const STOCK_STATE_BADGE: Record<Exclude<StockState, "ok">, { label: string; className: string }> = {
  out: { label: "Out", className: "bg-destructive/10 text-destructive" },
  low: { label: "Low", className: "bg-warning/15 text-warning" },
};

export const ADJUST_REASONS = ["Count correction", "Damaged", "Lost or stolen", "Returned to shelf", "Other"] as const;

export const MOVEMENT_LABEL: Record<string, string> = {
  opening: "Opening stock",
  receipt: "Received",
  sale: "Sold",
  sale_return: "Customer return",
  purchase_return: "Returned to supplier",
  adjustment: "Adjustment",
};

/** Keeps what a decimal field can hold while typing: digits and one point ("$1,200.5" -> "1200.5"). */
export function decimalOnly(raw: string): string {
  let seenPoint = false;
  let out = "";
  for (const ch of raw) {
    if (ch >= "0" && ch <= "9") out += ch;
    else if (ch === "." && !seenPoint) {
      seenPoint = true;
      out += ch;
    }
  }
  return out;
}

export const UNIT_SUGGESTIONS = ["each", "hour", "day", "kg", "g", "lb", "litre", "m", "box", "pack", "set"];

const qtyFormatter = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });

/** 12 -> "12", 2.5 -> "2.5", 1234.25 -> "1,234.25" */
export function formatQty(value: number | string | null | undefined): string {
  return qtyFormatter.format(Number(value ?? 0));
}

const unitCostFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 4,
});

/** Unit costs carry up to 4 decimals (FIFO layers store numeric(14,4)). */
export function formatUnitCost(value: number | string | null | undefined): string {
  return unitCostFormatter.format(Number(value ?? 0));
}

/** Base classes for every small status/type badge in the module. */
export const badgeClass = "inline-flex items-center whitespace-nowrap rounded-md px-1.5 py-0.5 text-[11px] font-medium";

/** Top-right page action (New item, Edit). */
export const primaryButtonClass =
  "inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3.5 text-[13px] font-medium text-primary-foreground shadow-soft-sm transition-colors duration-150 hover:bg-primary/90";
