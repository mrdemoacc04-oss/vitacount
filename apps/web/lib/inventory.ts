import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isMissingSchema } from "@/lib/db-errors";
import { isItemType, stockState, type ItemType, type StockState } from "@/components/inventory/item-meta";

/**
 * Read side of the Inventory module: the item catalog, stock on hand (the
 * item_stock view sums the open FIFO layers), movements and layers.
 *
 * The tables come from 20261008120000_workspace_profile_projects_inventory.sql.
 * Until that migration is applied every loader reports `missingSchema` instead
 * of throwing, so pages can show <SchemaNotice /> and widgets can stay empty.
 */

export type { ItemType, StockState } from "@/components/inventory/item-meta";
export { ITEM_TYPES, ITEM_TYPE_META, isItemType, stockState, formatQty, formatUnitCost } from "@/components/inventory/item-meta";

export type Loaded<T> = { missingSchema: true; data: null } | { missingSchema: false; data: T };

const MISSING = { missingSchema: true, data: null } as const;
const loaded = <T>(data: T): Loaded<T> => ({ missingSchema: false, data });

export interface InventoryItem {
  id: string;
  type: ItemType;
  name: string;
  sku: string | null;
  description: string | null;
  unit: string | null;
  salesPrice: number | null;
  purchaseCost: number | null;
  incomeAccountId: string | null;
  expenseAccountId: string | null;
  assetAccountId: string | null;
  reorderPoint: number | null;
  reorderQty: number | null;
  isActive: boolean;
  createdAt: string;
  /** Stock items only; 0 for everything else. */
  onHand: number;
  stockValue: number;
  /** stock value / quantity on hand; null when nothing is on hand. */
  avgCost: number | null;
  /** "ok" for services and non-stock items. */
  stockState: StockState;
}

const ITEM_COLUMNS =
  "id, type, name, sku, description, unit, sales_price, purchase_cost, income_account_id, expense_account_id, asset_account_id, reorder_point, reorder_qty, is_active, created_at";

type ItemRow = {
  id: string;
  type: string;
  name: string;
  sku: string | null;
  description: string | null;
  unit: string | null;
  sales_price: number | null;
  purchase_cost: number | null;
  income_account_id: string | null;
  expense_account_id: string | null;
  asset_account_id: string | null;
  reorder_point: number | null;
  reorder_qty: number | null;
  is_active: boolean;
  created_at: string;
};

type StockRow = { item_id: string | null; quantity_on_hand: number | null; stock_value: number | null };

const num = (value: number | string | null | undefined) => (value === null || value === undefined ? null : Number(value));

function toItem(row: ItemRow, stock: StockRow | undefined): InventoryItem {
  const type: ItemType = isItemType(row.type) ? row.type : "non_inventory";
  const isStock = type === "inventory";
  const onHand = isStock ? Number(stock?.quantity_on_hand ?? 0) : 0;
  const stockValue = isStock ? Number(stock?.stock_value ?? 0) : 0;
  const reorderPoint = num(row.reorder_point);
  return {
    id: row.id,
    type,
    name: row.name,
    sku: row.sku,
    description: row.description,
    unit: row.unit,
    salesPrice: num(row.sales_price),
    purchaseCost: num(row.purchase_cost),
    incomeAccountId: row.income_account_id,
    expenseAccountId: row.expense_account_id,
    assetAccountId: row.asset_account_id,
    reorderPoint,
    reorderQty: num(row.reorder_qty),
    isActive: row.is_active,
    createdAt: row.created_at,
    onHand,
    stockValue,
    avgCost: isStock && onHand > 0 ? stockValue / onHand : null,
    stockState: isStock ? stockState(onHand, reorderPoint) : "ok",
  };
}

/** Every item in the workspace (active and archived) with its stock position. */
export async function listItems(tenantId: string): Promise<Loaded<InventoryItem[]>> {
  const supabase = await createClient();
  const [itemsRes, stockRes] = await Promise.all([
    supabase.from("items").select(ITEM_COLUMNS).eq("tenant_id", tenantId).order("name"),
    supabase.from("item_stock").select("item_id, quantity_on_hand, stock_value").eq("tenant_id", tenantId),
  ]);
  if (isMissingSchema(itemsRes.error) || isMissingSchema(stockRes.error)) return MISSING;
  if (itemsRes.error) throw itemsRes.error;
  if (stockRes.error) throw stockRes.error;

  const stockById = new Map((stockRes.data ?? []).map((s) => [s.item_id, s]));
  return loaded((itemsRes.data ?? []).map((row) => toItem(row, stockById.get(row.id))));
}

/** False until the inventory migration has been applied to this database. */
export async function inventorySchemaReady(tenantId: string): Promise<boolean> {
  const supabase = await createClient();
  const { error } = await supabase.from("items").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId);
  return !isMissingSchema(error);
}

/** One item, or `data: null` when it doesn't exist in this workspace. */
export async function getItem(tenantId: string, itemId: string): Promise<Loaded<InventoryItem | null>> {
  const supabase = await createClient();
  const [itemRes, stockRes] = await Promise.all([
    supabase.from("items").select(ITEM_COLUMNS).eq("tenant_id", tenantId).eq("id", itemId).maybeSingle(),
    supabase.from("item_stock").select("item_id, quantity_on_hand, stock_value").eq("item_id", itemId).maybeSingle(),
  ]);
  if (isMissingSchema(itemRes.error) || isMissingSchema(stockRes.error)) return MISSING;
  // 22P02: the id in the URL isn't a uuid — treat it as not found.
  if (itemRes.error?.code === "22P02") return loaded(null);
  if (itemRes.error) throw itemRes.error;
  if (stockRes.error && stockRes.error.code !== "22P02") throw stockRes.error;
  if (!itemRes.data) return loaded(null);
  return loaded(toItem(itemRes.data, stockRes.data ?? undefined));
}

/** True once any stock has moved for the item — its type is locked from then on. */
export async function itemHasStockHistory(itemId: string): Promise<boolean> {
  const supabase = await createClient();
  const { count, error } = await supabase.from("inventory_movements").select("id", { count: "exact", head: true }).eq("item_id", itemId);
  if (error) return false;
  return (count ?? 0) > 0;
}

/** True once the item appears on any invoice or bill line (it can't become a stock item then). */
export async function itemUsedOnDocuments(itemId: string): Promise<boolean> {
  const supabase = await createClient();
  const [sales, purchases] = await Promise.all([
    supabase.from("invoice_lines").select("id", { count: "exact", head: true }).eq("item_id", itemId),
    supabase.from("bill_lines").select("id", { count: "exact", head: true }).eq("item_id", itemId),
  ]);
  return (sales.count ?? 0) + (purchases.count ?? 0) > 0;
}

export interface ItemAccountOption {
  id: string;
  code: string;
  name: string;
  subtype: string | null;
}

/** Account choices for the item form: revenue accounts for income, expense accounts for COGS / purchases. */
export async function listItemAccounts(tenantId: string): Promise<{ income: ItemAccountOption[]; expense: ItemAccountOption[] }> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("accounts")
    .select("id, code, name, subtype, type, is_active")
    .eq("tenant_id", tenantId)
    .in("type", ["revenue", "expense"])
    .order("code");
  const rows = data ?? [];
  const pick = (type: string) =>
    rows.filter((a) => a.type === type && a.is_active).map(({ id, code, name, subtype }) => ({ id, code, name, subtype }));
  return { income: pick("revenue"), expense: pick("expense") };
}

/** Name lookup for showing an item's accounts. */
export async function getAccountNames(tenantId: string, ids: (string | null)[]): Promise<Map<string, string>> {
  const wanted = ids.filter((id): id is string => !!id);
  if (!wanted.length) return new Map();
  const supabase = await createClient();
  const { data } = await supabase.from("accounts").select("id, code, name").eq("tenant_id", tenantId).in("id", wanted);
  return new Map((data ?? []).map((a) => [a.id, `${a.code} · ${a.name}`]));
}

// ---------------------------------------------------------------------------
// Stock history
// ---------------------------------------------------------------------------

export interface StockMovement {
  key: string;
  date: string;
  type: string;
  /** Signed: + into stock, − out of stock. */
  quantity: number;
  /** Signed like quantity. */
  totalCost: number;
  /** Quantity on hand after this movement. */
  balance: number;
  memo: string | null;
  sourceType: string;
  sourceId: string | null;
  /** Link to the bill / supplier credit / sales document, when there is one. */
  document: { href: string; label: string } | null;
}

const PURCHASE_SOURCES = new Set(["bill", "vendor_credit"]);
const SALES_SOURCES = new Set(["invoice", "sales_receipt", "refund_receipt"]);
const SOURCE_LABEL: Record<string, string> = {
  bill: "Bill",
  vendor_credit: "Supplier credit",
  invoice: "Invoice",
  sales_receipt: "Sales receipt",
  refund_receipt: "Refund",
};

const MOVEMENT_LIMIT = 300;

/**
 * Newest first. A sale that empties several FIFO layers is stored as one row per
 * layer; those rows share a transaction (same created_at and source) and are
 * merged back into one line here. The running balance is walked back from the
 * current quantity on hand, so it stays right even when older history is cut off.
 */
export async function getItemMovements(
  tenantId: string,
  itemId: string,
  onHand: number,
): Promise<{ movements: StockMovement[]; truncated: boolean }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("inventory_movements")
    .select("id, movement_date, movement_type, quantity, total_cost, source_type, source_id, memo, created_at")
    .eq("tenant_id", tenantId)
    .eq("item_id", itemId)
    .order("movement_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(MOVEMENT_LIMIT);
  if (error) {
    if (isMissingSchema(error)) return { movements: [], truncated: false };
    throw error;
  }

  const rows = data ?? [];
  const merged: Omit<StockMovement, "balance" | "document">[] = [];
  for (const row of rows) {
    const key = `${row.movement_type}|${row.source_type}|${row.source_id ?? ""}|${row.created_at}|${row.movement_date}`;
    const last = merged[merged.length - 1];
    if (last && last.key === key) {
      last.quantity += Number(row.quantity);
      last.totalCost += Number(row.total_cost);
      continue;
    }
    merged.push({
      key,
      date: row.movement_date,
      type: row.movement_type,
      quantity: Number(row.quantity),
      totalCost: Number(row.total_cost),
      memo: row.memo,
      sourceType: row.source_type,
      sourceId: row.source_id,
    });
  }

  // Document numbers for the linked bills and sales documents.
  const billIds = [...new Set(merged.filter((m) => m.sourceId && PURCHASE_SOURCES.has(m.sourceType)).map((m) => m.sourceId!))];
  const salesIds = [...new Set(merged.filter((m) => m.sourceId && SALES_SOURCES.has(m.sourceType)).map((m) => m.sourceId!))];
  const [bills, sales] = await Promise.all([
    billIds.length
      ? supabase.from("bills").select("id, bill_number").in("id", billIds)
      : Promise.resolve({ data: [] as { id: string; bill_number: string | null }[] }),
    salesIds.length
      ? supabase.from("invoices").select("id, invoice_number").in("id", salesIds)
      : Promise.resolve({ data: [] as { id: string; invoice_number: string }[] }),
  ]);
  const numbers = new Map<string, string | null>([
    ...(bills.data ?? []).map((b) => [b.id, b.bill_number] as const),
    ...(sales.data ?? []).map((s) => [s.id, s.invoice_number] as const),
  ]);

  let balance = Math.round(onHand * 100);
  const movements = merged.map((m) => {
    const after = balance / 100;
    balance -= Math.round(m.quantity * 100);
    let document: StockMovement["document"] = null;
    if (m.sourceId && (PURCHASE_SOURCES.has(m.sourceType) || SALES_SOURCES.has(m.sourceType))) {
      const base = PURCHASE_SOURCES.has(m.sourceType) ? "/expenses" : "/sales";
      const number = numbers.get(m.sourceId);
      document = {
        href: `${base}/${m.sourceId}`,
        label: number ? `${SOURCE_LABEL[m.sourceType]} ${number}` : SOURCE_LABEL[m.sourceType],
      };
    }
    return { ...m, quantity: round2(m.quantity), totalCost: round2(m.totalCost), balance: after, document };
  });

  return { movements, truncated: rows.length === MOVEMENT_LIMIT };
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export interface StockLayer {
  id: string;
  receivedDate: string;
  quantityReceived: number;
  quantityRemaining: number;
  unitCost: number;
  costRemaining: number;
  sourceType: string;
}

/** FIFO layers still holding stock, oldest (next to be used) first. */
export async function getOpenLayers(tenantId: string, itemId: string): Promise<StockLayer[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("inventory_layers")
    .select("id, received_date, quantity_received, quantity_remaining, unit_cost, cost_remaining, source_type, created_at")
    .eq("tenant_id", tenantId)
    .eq("item_id", itemId)
    .gt("quantity_remaining", 0)
    .order("received_date")
    .order("created_at");
  if (error) {
    if (isMissingSchema(error)) return [];
    throw error;
  }
  return (data ?? []).map((l) => ({
    id: l.id,
    receivedDate: l.received_date,
    quantityReceived: Number(l.quantity_received),
    quantityRemaining: Number(l.quantity_remaining),
    unitCost: Number(l.unit_cost),
    costRemaining: Number(l.cost_remaining),
    sourceType: l.source_type,
  }));
}

/** Unit cost of the most recently received stock — the default when adding stock by hand. */
export async function getLastUnitCost(tenantId: string, itemId: string): Promise<number | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("inventory_layers")
    .select("unit_cost")
    .eq("tenant_id", tenantId)
    .eq("item_id", itemId)
    .order("received_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return Number(data.unit_cost);
}

// ---------------------------------------------------------------------------
// Services and non-stock items: where they've been used
// ---------------------------------------------------------------------------

export interface ItemUse {
  key: string;
  side: "sale" | "purchase";
  href: string;
  documentLabel: string;
  party: string | null;
  date: string;
  quantity: number;
  unitAmount: number;
  amount: number;
}

/** The latest invoice/sales lines and bill lines that use this item, newest first. */
export async function getItemRecentUse(itemId: string, limit = 15): Promise<ItemUse[]> {
  const supabase = await createClient();
  const [sales, purchases] = await Promise.all([
    supabase
      .from("invoice_lines")
      .select(
        "id, quantity, unit_price, amount, invoice:invoices(id, invoice_number, document_type, issue_date, contact:contacts(display_name))",
      )
      .eq("item_id", itemId)
      .limit(100),
    supabase
      .from("bill_lines")
      .select("id, quantity, unit_cost, amount, bill:bills(id, bill_number, document_type, issue_date, vendor:contacts(display_name))")
      .eq("item_id", itemId)
      .limit(100),
  ]);

  const uses: ItemUse[] = [];
  for (const line of sales.data ?? []) {
    const doc = line.invoice;
    if (!doc) continue;
    uses.push({
      key: `s_${line.id}`,
      side: "sale",
      href: `/sales/${doc.id}`,
      documentLabel: `${SOURCE_LABEL[doc.document_type] ?? "Sale"} ${doc.invoice_number}`,
      party: doc.contact?.display_name ?? null,
      date: doc.issue_date,
      quantity: Number(line.quantity),
      unitAmount: Number(line.unit_price),
      amount: Number(line.amount),
    });
  }
  for (const line of purchases.data ?? []) {
    const doc = line.bill;
    if (!doc) continue;
    const label = SOURCE_LABEL[doc.document_type] ?? "Bill";
    uses.push({
      key: `p_${line.id}`,
      side: "purchase",
      href: `/expenses/${doc.id}`,
      documentLabel: doc.bill_number ? `${label} ${doc.bill_number}` : label,
      party: doc.vendor?.display_name ?? null,
      date: doc.issue_date,
      quantity: Number(line.quantity ?? 1),
      unitAmount: Number(line.unit_cost ?? line.amount),
      amount: Number(line.amount),
    });
  }
  return uses.sort((a, b) => b.date.localeCompare(a.date)).slice(0, limit);
}

// ---------------------------------------------------------------------------
// For other modules
// ---------------------------------------------------------------------------

export interface LowStockItem {
  id: string;
  name: string;
  sku: string | null;
  onHand: number;
  reorderPoint: number;
}

/** Active stock items at or below their reorder point, lowest cover first. [] when the schema is missing. */
export async function getLowStockItems(tenantId: string): Promise<LowStockItem[]> {
  const result = await listItems(tenantId);
  if (result.missingSchema) return [];
  return result.data
    .filter((i) => i.isActive && i.type === "inventory" && i.reorderPoint !== null && i.onHand <= i.reorderPoint)
    .map((i) => ({ id: i.id, name: i.name, sku: i.sku, onHand: i.onHand, reorderPoint: i.reorderPoint! }))
    .sort((a, b) => a.onHand - a.reorderPoint - (b.onHand - b.reorderPoint) || a.name.localeCompare(b.name));
}

export interface SellableItem {
  id: string;
  name: string;
  sku: string | null;
  type: ItemType;
  unit: string | null;
  salesPrice: number | null;
  purchaseCost: number | null;
  /** Stock items only; null for services and non-stock items. */
  onHand: number | null;
}

/** Active catalog items for line-item pickers on invoices, bills and receipts. [] when the schema is missing. */
export async function listSellableItems(tenantId: string): Promise<SellableItem[]> {
  const result = await listItems(tenantId);
  if (result.missingSchema) return [];
  return result.data
    .filter((i) => i.isActive)
    .map((i) => ({
      id: i.id,
      name: i.name,
      sku: i.sku,
      type: i.type,
      unit: i.unit,
      salesPrice: i.salesPrice,
      purchaseCost: i.purchaseCost,
      onHand: i.type === "inventory" ? i.onHand : null,
    }));
}
