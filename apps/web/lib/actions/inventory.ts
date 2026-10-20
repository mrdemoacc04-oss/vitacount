"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { friendlyDbError } from "@/lib/db-errors";
import { isISODate } from "@/lib/dates";
import { scaledToString, toScaled } from "@/lib/money";
import { ADJUST_REASONS, isItemType } from "@/components/inventory/item-meta";

export type ItemFormField =
  | "type"
  | "name"
  | "sku"
  | "unit"
  | "description"
  | "salesPrice"
  | "purchaseCost"
  | "incomeAccountId"
  | "expenseAccountId"
  | "reorderPoint"
  | "reorderQty"
  | "openingQty"
  | "openingCost"
  | "openingDate";

export type SaveItemState = {
  error: string | null;
  fieldErrors?: Partial<Record<ItemFormField, string>>;
};

const text = (formData: FormData, name: string) => String(formData.get(name) ?? "").trim();

/** Optional money/quantity field: blank -> null, invalid -> undefined. */
function optionalNumber(value: string, scale: number): string | null | undefined {
  if (value === "") return null;
  const scaled = toScaled(value.replace(/[$,\s]/g, ""), scale);
  return scaled === null ? undefined : scaledToString(scaled, scale);
}

function revalidateInventory(itemId?: string) {
  revalidatePath("/inventory");
  if (itemId) revalidatePath(`/inventory/${itemId}`);
  revalidatePath("/dashboard");
}

/**
 * Creates (itemId null) or updates an item. On create, a stock item can carry
 * opening stock: the item is inserted first, then adjust_inventory books the
 * opening quantity (Dr Inventory Asset / Cr Opening Balance Equity).
 */
export async function saveItemAction(
  tenantId: string,
  itemId: string | null,
  _prevState: SaveItemState,
  formData: FormData,
): Promise<SaveItemState> {
  const fieldErrors: SaveItemState["fieldErrors"] = {};

  const type = text(formData, "type");
  const name = text(formData, "name");
  const sku = text(formData, "sku");
  const unit = text(formData, "unit");
  const description = text(formData, "description");
  const incomeAccountId = text(formData, "incomeAccountId");
  const expenseAccountId = text(formData, "expenseAccountId");

  if (!isItemType(type)) fieldErrors.type = "Choose what kind of item this is.";
  if (!name) fieldErrors.name = "Give the item a name.";
  else if (name.length > 200) fieldErrors.name = "Keep the name under 200 characters.";
  if (sku.length > 64) fieldErrors.sku = "Keep the SKU under 64 characters.";
  if (unit.length > 32) fieldErrors.unit = "Keep the unit short, like each or hour.";

  const salesPrice = optionalNumber(text(formData, "salesPrice"), 2);
  if (salesPrice === undefined) fieldErrors.salesPrice = "Enter a price like 49.99, or leave it blank.";
  const purchaseCost = optionalNumber(text(formData, "purchaseCost"), 2);
  if (purchaseCost === undefined) fieldErrors.purchaseCost = "Enter a cost like 12.50, or leave it blank.";

  const isStock = type === "inventory";
  let reorderPoint: string | null | undefined = null;
  let reorderQty: string | null | undefined = null;
  if (isStock) {
    reorderPoint = optionalNumber(text(formData, "reorderPoint"), 2);
    if (reorderPoint === undefined) fieldErrors.reorderPoint = "Enter a quantity, or leave it blank.";
    reorderQty = optionalNumber(text(formData, "reorderQty"), 2);
    if (reorderQty === undefined) fieldErrors.reorderQty = "Enter a quantity, or leave it blank.";
    else if (reorderQty !== null && Number(reorderQty) <= 0) fieldErrors.reorderQty = "Reorder quantity has to be above zero.";
  }

  // Opening stock (new stock items only).
  let opening: { qty: string; unitCost: string; date: string } | null = null;
  if (isStock && !itemId) {
    const qtyText = text(formData, "openingQty");
    const costText = text(formData, "openingCost");
    const date = text(formData, "openingDate");
    if (qtyText !== "") {
      const qty = optionalNumber(qtyText, 2);
      const cost = optionalNumber(costText, 4);
      if (qty === undefined || qty === null) fieldErrors.openingQty = "Enter a quantity like 25.";
      else if (Number(qty) <= 0) fieldErrors.openingQty = "Opening stock has to be above zero.";
      if (cost === null) fieldErrors.openingCost = "Enter what each unit cost you.";
      else if (cost === undefined) fieldErrors.openingCost = "Enter a cost like 12.50.";
      if (!isISODate(date)) fieldErrors.openingDate = "Pick the date you counted it.";
      if (qty && cost && isISODate(date) && Number(qty) > 0) opening = { qty, unitCost: cost, date };
    } else if (costText !== "") {
      fieldErrors.openingQty = "Enter how many you have, or clear the cost.";
    }
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { error: "Check the highlighted fields.", fieldErrors };
  }

  const values = {
    type: type as string,
    name,
    sku: sku || null,
    unit: unit || null,
    description: description || null,
    sales_price: salesPrice === null || salesPrice === undefined ? null : Number(salesPrice),
    purchase_cost: purchaseCost === null || purchaseCost === undefined ? null : Number(purchaseCost),
    income_account_id: incomeAccountId || null,
    expense_account_id: expenseAccountId || null,
    reorder_point: reorderPoint ? Number(reorderPoint) : null,
    reorder_qty: reorderQty ? Number(reorderQty) : null,
  };

  const supabase = await createClient();

  if (itemId) {
    const { error } = await supabase.from("items").update(values).eq("id", itemId).eq("tenant_id", tenantId);
    if (error) return itemError(error);
    revalidateInventory(itemId);
    redirect(`/inventory/${itemId}`);
  }

  const { data: auth } = await supabase.auth.getUser();
  const { data: created, error } = await supabase
    .from("items")
    .insert({ ...values, tenant_id: tenantId, created_by: auth.user?.id ?? null })
    .select("id")
    .single();
  if (error || !created) return error ? itemError(error) : { error: "The item couldn't be saved. Try again." };

  let openingFailed = false;
  if (opening) {
    const { error: openingError } = await supabase.rpc("adjust_inventory", {
      p_tenant_id: tenantId,
      p_item_id: created.id,
      p_date: opening.date,
      p_quantity: Number(opening.qty),
      p_unit_cost: Number(opening.unitCost),
      p_reason: "Opening stock",
      p_kind: "opening",
    });
    openingFailed = !!openingError;
  }

  revalidateInventory(created.id);
  redirect(`/inventory/${created.id}${openingFailed ? "?opening=failed" : ""}`);
}

function itemError(error: { code?: string; message: string }): SaveItemState {
  if (error.code === "23505") {
    return { error: "Another item already uses that SKU.", fieldErrors: { sku: "Another item already uses that SKU" } };
  }
  return { error: friendlyDbError(error) };
}

export type AdjustStockField = "direction" | "quantity" | "unitCost" | "date" | "reason";

export type AdjustStockState = {
  error: string | null;
  fieldErrors?: Partial<Record<AdjustStockField, string>>;
  /** Bumped on every successful adjustment so the form can reset itself. */
  savedAt?: number;
  message?: string;
};

/** Manual stock change. Adding books Dr Inventory / Cr Inventory Adjustments at the given cost; removing writes off FIFO cost. */
export async function adjustStockAction(
  tenantId: string,
  itemId: string,
  _prevState: AdjustStockState,
  formData: FormData,
): Promise<AdjustStockState> {
  const fieldErrors: AdjustStockState["fieldErrors"] = {};
  const direction = text(formData, "direction");
  const qtyText = text(formData, "quantity");
  const costText = text(formData, "unitCost");
  const date = text(formData, "date");
  const reason = text(formData, "reason");
  const note = text(formData, "note");

  if (direction !== "add" && direction !== "remove") fieldErrors.direction = "Choose whether you're adding or removing stock.";
  const qty = optionalNumber(qtyText, 2);
  if (qty === null || qty === undefined || Number(qty) <= 0) fieldErrors.quantity = "Enter a quantity above zero.";
  let unitCost: string | null | undefined = null;
  if (direction === "add") {
    unitCost = optionalNumber(costText, 4);
    if (unitCost === null) fieldErrors.unitCost = "Enter what each unit cost.";
    else if (unitCost === undefined) fieldErrors.unitCost = "Enter a cost like 12.50.";
  }
  if (!isISODate(date)) fieldErrors.date = "Pick the date of the change.";
  if (!(ADJUST_REASONS as readonly string[]).includes(reason)) fieldErrors.reason = "Choose a reason.";

  if (Object.keys(fieldErrors).length > 0 || !qty) {
    return { error: null, fieldErrors };
  }

  const quantity = direction === "add" ? Number(qty) : -Number(qty);
  const reasonText = note ? `${reason}: ${note}` : reason;

  const supabase = await createClient();
  const { error } = await supabase.rpc("adjust_inventory", {
    p_tenant_id: tenantId,
    p_item_id: itemId,
    p_date: date,
    p_quantity: quantity,
    // the generated arg type is `number`, but Postgres takes null when removing stock
    p_unit_cost: (unitCost ? Number(unitCost) : null) as number,
    p_reason: reasonText,
    p_kind: "adjustment",
  });
  if (error) return { error: friendlyDbError(error) };

  revalidateInventory(itemId);
  return {
    error: null,
    savedAt: Date.now(),
    message: `${direction === "add" ? "Added" : "Removed"} ${Number(qty).toLocaleString("en-US")} ${direction === "add" ? "to" : "from"} stock.`,
  };
}

/** Archive (hide from pickers, keep history) or restore an item. Items are never deleted. */
export async function setItemActiveAction(tenantId: string, itemId: string, active: boolean): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { error } = await supabase.from("items").update({ is_active: active }).eq("id", itemId).eq("tenant_id", tenantId);
  if (error) return { error: friendlyDbError(error) };
  revalidateInventory(itemId);
  return { error: null };
}
