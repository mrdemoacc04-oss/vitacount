import "server-only";

import type { createClient } from "@/lib/supabase/server";
import type { CatalogItem, CatalogItemType, ProjectOption, WorkspaceDefaults } from "@/components/forms/catalog";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/**
 * Loads what the transaction forms need from the projects/inventory migration.
 * Every part is optional: a missing table or column (migration not applied yet),
 * or any other read failure, comes back as `null` so the form simply hides that
 * control and keeps working the way it did before.
 */
export async function loadFormCatalog(
  supabase: Supabase,
  tenantId: string,
  want: { items?: boolean; projects?: boolean; defaults?: boolean },
): Promise<{ items: CatalogItem[] | null; projects: ProjectOption[] | null; defaults: WorkspaceDefaults | null }> {
  const [items, projects, defaults] = await Promise.all([
    want.items ? loadItems(supabase, tenantId) : Promise.resolve(null),
    want.projects ? loadProjects(supabase, tenantId) : Promise.resolve(null),
    want.defaults ? loadDefaults(supabase, tenantId) : Promise.resolve(null),
  ]);
  return { items, projects, defaults };
}

async function loadItems(supabase: Supabase, tenantId: string): Promise<CatalogItem[] | null> {
  const [{ data: rows, error }, { data: stock, error: stockError }] = await Promise.all([
    supabase
      .from("items")
      .select("id, type, name, sku, description, unit, sales_price, purchase_cost, expense_account_id")
      .eq("tenant_id", tenantId)
      .eq("is_active", true)
      .order("name"),
    supabase.from("item_stock").select("item_id, quantity_on_hand").eq("tenant_id", tenantId),
  ]);
  if (error || !rows) return null;

  const onHand = new Map<string, number>();
  if (!stockError) for (const s of stock ?? []) if (s.item_id) onHand.set(s.item_id, Number(s.quantity_on_hand ?? 0));

  return rows.map((r) => ({
    id: r.id,
    type: r.type as CatalogItemType,
    name: r.name,
    sku: r.sku,
    description: r.description,
    unit: r.unit,
    salesPrice: r.sales_price === null ? null : Number(r.sales_price),
    purchaseCost: r.purchase_cost === null ? null : Number(r.purchase_cost),
    expenseAccountId: r.expense_account_id,
    onHand: r.type === "inventory" ? (onHand.get(r.id) ?? 0) : null,
  }));
}

async function loadProjects(supabase: Supabase, tenantId: string): Promise<ProjectOption[] | null> {
  const { data, error } = await supabase
    .from("projects")
    .select("id, name, code, customer_id")
    .eq("tenant_id", tenantId)
    .eq("status", "active")
    .order("name");
  if (error || !data) return null;
  return data.map((p) => ({ id: p.id, name: p.name, code: p.code, customerId: p.customer_id }));
}

async function loadDefaults(supabase: Supabase, tenantId: string): Promise<WorkspaceDefaults | null> {
  const { data, error } = await supabase.from("tenants").select("default_payment_terms, invoice_notes").eq("id", tenantId).single();
  if (error || !data) return null;
  return { paymentTerms: data.default_payment_terms, invoiceNotes: data.invoice_notes };
}
