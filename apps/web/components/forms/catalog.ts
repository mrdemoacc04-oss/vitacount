/**
 * Shapes the transaction forms share for the item catalog, projects and the
 * workspace's invoicing defaults. Each one is `null` when the database doesn't
 * have the matching tables/columns yet (the projects/inventory migration isn't
 * applied) — forms hide the related controls instead of failing.
 */

export type CatalogItemType = "inventory" | "service" | "non_inventory";

export type CatalogItem = {
  id: string;
  type: CatalogItemType;
  name: string;
  sku: string | null;
  description: string | null;
  unit: string | null;
  salesPrice: number | null;
  purchaseCost: number | null;
  /** purchase category for non-stock items (COGS for stock items) */
  expenseAccountId: string | null;
  /** stock items only */
  onHand: number | null;
};

export type ProjectOption = {
  id: string;
  name: string;
  code: string | null;
  customerId: string | null;
};

export type WorkspaceDefaults = {
  /** 'due_on_receipt' | 'net_7' | … | 'none' */
  paymentTerms: string | null;
  invoiceNotes: string | null;
};

export const ITEM_TYPE_LABEL: Record<CatalogItemType, string> = {
  inventory: "Stock item",
  service: "Service",
  non_inventory: "Non-stock item",
};

/** "12" / "12.5" — quantities read best without trailing zeros. */
export function formatQuantity(value: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value);
}
