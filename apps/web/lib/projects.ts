import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isMissingSchema } from "@/lib/db-errors";
import { budgetUsedOf, isProjectStatus, marginOf, type ProjectStatus } from "@/components/projects/shared";

/**
 * Projects (job costing): reads for the projects pages and the dashboard.
 *
 * The tables come from 20261008120000_workspace_profile_projects_inventory.sql.
 * Until that migration is applied every reader reports `missingSchema: true`
 * instead of throwing, so pages can show <SchemaNotice /> rather than crash.
 */

export type { ProjectStatus } from "@/components/projects/shared";

type MissingSchema = { missingSchema: true };

export interface ProjectFinancials {
  revenue: number;
  costs: number;
  profit: number;
  /** Unpaid balance on the project's invoices and debit notes. */
  receivable: number;
  /** profit ÷ revenue; null when there is no revenue yet. */
  margin: number | null;
  /** costs ÷ budget, unclamped (1.2 = 20% over budget); null without a budget. */
  budgetUsed: number | null;
}

export interface ProjectListItem extends ProjectFinancials {
  id: string;
  name: string;
  code: string | null;
  status: ProjectStatus;
  budget: number | null;
  startDate: string | null;
  endDate: string | null;
  customerId: string | null;
  customerName: string | null;
  createdAt: string;
}

export interface ProjectRecord extends ProjectListItem {
  description: string | null;
}

export interface ProjectSalesDocument {
  id: string;
  number: string;
  documentType: string;
  issueDate: string;
  status: string;
  /** Pre-tax amount, negative for refunds — the figure that feeds project revenue. */
  amount: number;
  balanceDue: number;
  customerName: string | null;
  /** Drafts and voided documents are listed but don't count toward revenue. */
  counts: boolean;
}

export interface ProjectPurchaseDocument {
  id: string;
  number: string | null;
  documentType: string;
  issueDate: string;
  status: string;
  /** Negative for supplier credits. */
  amount: number;
  vendorName: string | null;
  counts: boolean;
}

export interface ProjectExpense {
  id: string;
  date: string;
  memo: string | null;
  accountName: string | null;
  vendorName: string | null;
  status: string;
  amount: number;
  counts: boolean;
}

export interface ProjectStockLine {
  itemId: string;
  itemName: string;
  unit: string | null;
  /** Net quantity sold (sales minus refunds). */
  quantity: number;
  /** Net FIFO cost of the stock sold. */
  cost: number;
}

export interface ProjectActivity {
  sales: ProjectSalesDocument[];
  purchases: ProjectPurchaseDocument[];
  expenses: ProjectExpense[];
  stock: ProjectStockLine[];
}

export interface TaggableDocument {
  id: string;
  label: string;
  detail: string | null;
  party: string | null;
  partyId: string | null;
  date: string;
  amount: number;
}

export interface TaggableDocuments {
  sales: TaggableDocument[];
  purchases: TaggableDocument[];
  expenses: TaggableDocument[];
}

export interface ProjectSummary {
  id: string;
  name: string;
  code: string | null;
  budget: number | null;
  revenue: number;
  costs: number;
  profit: number;
  margin: number | null;
  /** costs ÷ budget clamped to 0..1; null without a budget. */
  progress: number | null;
  overBudget: boolean;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TAGGABLE_LIMIT = 40;

const num = (value: number | string | null | undefined) => {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
};

type ProjectRow = {
  id: string;
  name: string;
  code: string | null;
  description: string | null;
  status: string;
  budget: number | null;
  start_date: string | null;
  end_date: string | null;
  customer_id: string | null;
  created_at: string;
};

type FinancialRow = {
  project_id: string | null;
  revenue: number | null;
  costs: number | null;
  profit: number | null;
  receivable: number | null;
};

const PROJECT_COLUMNS = "id, name, code, description, status, budget, start_date, end_date, customer_id, created_at";

function toRecord(row: ProjectRow, fin: FinancialRow | undefined, customerName: string | null): ProjectRecord {
  const revenue = num(fin?.revenue);
  const costs = num(fin?.costs);
  const profit = fin ? num(fin.profit) : revenue - costs;
  const budget = row.budget === null ? null : num(row.budget);
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    description: row.description,
    status: isProjectStatus(row.status) ? row.status : "active",
    budget,
    startDate: row.start_date,
    endDate: row.end_date,
    customerId: row.customer_id,
    customerName,
    createdAt: row.created_at,
    revenue,
    costs,
    profit,
    receivable: num(fin?.receivable),
    margin: marginOf(revenue, profit),
    budgetUsed: budgetUsedOf(budget, costs),
  };
}

async function customerNames(supabase: Awaited<ReturnType<typeof createClient>>, tenantId: string, ids: (string | null)[]) {
  const unique = [...new Set(ids.filter((id): id is string => !!id))];
  if (unique.length === 0) return new Map<string, string>();
  const { data, error } = await supabase.from("contacts").select("id, display_name").eq("tenant_id", tenantId).in("id", unique);
  if (error) throw error;
  return new Map((data ?? []).map((c) => [c.id, c.display_name]));
}

/** Every project in the workspace with its roll-up, newest first. */
export async function listProjects(tenantId: string): Promise<MissingSchema | { missingSchema: false; projects: ProjectListItem[] }> {
  const supabase = await createClient();
  const [projectsRes, financialsRes] = await Promise.all([
    supabase.from("projects").select(PROJECT_COLUMNS).eq("tenant_id", tenantId).order("created_at", { ascending: false }),
    supabase.from("project_financials").select("project_id, revenue, costs, profit, receivable").eq("tenant_id", tenantId),
  ]);
  if (isMissingSchema(projectsRes.error) || isMissingSchema(financialsRes.error)) return { missingSchema: true };
  if (projectsRes.error) throw projectsRes.error;
  if (financialsRes.error) throw financialsRes.error;

  const rows = projectsRes.data ?? [];
  const financials = new Map((financialsRes.data ?? []).map((f) => [f.project_id, f]));
  const names = await customerNames(supabase, tenantId, rows.map((r) => r.customer_id));

  return {
    missingSchema: false,
    projects: rows.map((row) => toRecord(row, financials.get(row.id), row.customer_id ? (names.get(row.customer_id) ?? null) : null)),
  };
}

/** One project with its roll-up; `project` is null when it doesn't exist in this workspace. */
export async function getProject(tenantId: string, projectId: string): Promise<MissingSchema | { missingSchema: false; project: ProjectRecord | null }> {
  if (!UUID.test(projectId)) return { missingSchema: false, project: null };
  const supabase = await createClient();
  const [projectRes, financialsRes] = await Promise.all([
    supabase.from("projects").select(PROJECT_COLUMNS).eq("tenant_id", tenantId).eq("id", projectId).maybeSingle(),
    supabase.from("project_financials").select("project_id, revenue, costs, profit, receivable").eq("project_id", projectId).maybeSingle(),
  ]);
  if (isMissingSchema(projectRes.error) || isMissingSchema(financialsRes.error)) return { missingSchema: true };
  if (projectRes.error) throw projectRes.error;
  if (financialsRes.error) throw financialsRes.error;
  if (!projectRes.data) return { missingSchema: false, project: null };

  const row = projectRes.data;
  const names = await customerNames(supabase, tenantId, [row.customer_id]);
  return {
    missingSchema: false,
    project: toRecord(row, financialsRes.data ?? undefined, row.customer_id ? (names.get(row.customer_id) ?? null) : null),
  };
}

/** The documents tagged to a project, plus the stock sold on its sales documents. */
export async function getProjectActivity(tenantId: string, projectId: string): Promise<ProjectActivity> {
  const supabase = await createClient();
  const [salesRes, billsRes, expensesRes] = await Promise.all([
    supabase
      .from("invoices")
      .select("id, invoice_number, document_type, issue_date, status, subtotal, balance_due, contact:contacts(display_name)")
      .eq("tenant_id", tenantId)
      .eq("project_id", projectId)
      .order("issue_date", { ascending: false }),
    supabase
      .from("bills")
      .select("id, bill_number, document_type, issue_date, status, total, vendor:contacts(display_name)")
      .eq("tenant_id", tenantId)
      .eq("project_id", projectId)
      .order("issue_date", { ascending: false }),
    supabase
      .from("expenses")
      .select("id, expense_date, memo, amount, status, account:accounts(name), contact:contacts(display_name)")
      .eq("tenant_id", tenantId)
      .eq("project_id", projectId)
      .order("expense_date", { ascending: false }),
  ]);
  if (salesRes.error) throw salesRes.error;
  if (billsRes.error) throw billsRes.error;
  if (expensesRes.error) throw expensesRes.error;

  const sales: ProjectSalesDocument[] = (salesRes.data ?? []).map((i) => ({
    id: i.id,
    number: i.invoice_number,
    documentType: i.document_type ?? "invoice",
    issueDate: i.issue_date,
    status: i.status,
    amount: i.document_type === "refund_receipt" ? -num(i.subtotal) : num(i.subtotal),
    balanceDue: num(i.balance_due),
    customerName: i.contact?.display_name ?? null,
    counts: i.status !== "draft" && i.status !== "void",
  }));

  const purchases: ProjectPurchaseDocument[] = (billsRes.data ?? []).map((b) => ({
    id: b.id,
    number: b.bill_number,
    documentType: b.document_type ?? "bill",
    issueDate: b.issue_date,
    status: b.status,
    amount: b.document_type === "vendor_credit" ? -num(b.total) : num(b.total),
    vendorName: b.vendor?.display_name ?? null,
    counts: b.status !== "void",
  }));

  const expenses: ProjectExpense[] = (expensesRes.data ?? []).map((e) => ({
    id: e.id,
    date: e.expense_date,
    memo: e.memo,
    accountName: e.account?.name ?? null,
    vendorName: e.contact?.display_name ?? null,
    status: e.status,
    amount: num(e.amount),
    counts: e.status === "posted",
  }));

  return { sales, purchases, expenses, stock: await stockSold(supabase, tenantId, sales.map((s) => s.id)) };
}

/** FIFO cost of stock moved by these sales documents, grouped per item. Empty if inventory isn't set up. */
async function stockSold(supabase: Awaited<ReturnType<typeof createClient>>, tenantId: string, salesIds: string[]): Promise<ProjectStockLine[]> {
  if (salesIds.length === 0) return [];
  const { data: movements, error } = await supabase
    .from("inventory_movements")
    .select("item_id, quantity, total_cost")
    .eq("tenant_id", tenantId)
    .in("source_id", salesIds)
    .in("movement_type", ["sale", "sale_return"]);
  if (isMissingSchema(error)) return [];
  if (error) throw error;
  if (!movements?.length) return [];

  const byItem = new Map<string, { quantity: number; cost: number }>();
  for (const m of movements) {
    const entry = byItem.get(m.item_id) ?? { quantity: 0, cost: 0 };
    // movements are signed like stock: a sale takes quantity and cost out (negative)
    entry.quantity -= num(m.quantity);
    entry.cost -= num(m.total_cost);
    byItem.set(m.item_id, entry);
  }

  const { data: items, error: itemsError } = await supabase.from("items").select("id, name, unit").eq("tenant_id", tenantId).in("id", [...byItem.keys()]);
  if (itemsError && !isMissingSchema(itemsError)) throw itemsError;
  const itemInfo = new Map((items ?? []).map((i) => [i.id, i]));

  return [...byItem.entries()]
    .map(([itemId, { quantity, cost }]) => ({
      itemId,
      itemName: itemInfo.get(itemId)?.name ?? "Unknown item",
      unit: itemInfo.get(itemId)?.unit ?? null,
      quantity: Math.round(quantity * 100) / 100,
      cost: Math.round(cost * 100) / 100,
    }))
    .filter((line) => line.quantity !== 0 || line.cost !== 0)
    .sort((a, b) => b.cost - a.cost);
}

/**
 * Recent documents not yet tagged to any project, for the "Add existing" pickers.
 * Sales documents of the project's customer are always included, even when
 * they're older than the most recent ones across all customers.
 */
export async function getTaggableDocuments(tenantId: string, customerId: string | null): Promise<TaggableDocuments> {
  const supabase = await createClient();
  const salesQuery = () =>
    supabase
      .from("invoices")
      .select("id, invoice_number, document_type, issue_date, subtotal, contact_id, contact:contacts(display_name)")
      .eq("tenant_id", tenantId)
      .is("project_id", null)
      .neq("status", "void")
      .order("issue_date", { ascending: false })
      .limit(TAGGABLE_LIMIT);

  const [allSales, customerSales, bills, expenses] = await Promise.all([
    salesQuery(),
    customerId ? salesQuery().eq("contact_id", customerId) : Promise.resolve({ data: [], error: null }),
    supabase
      .from("bills")
      .select("id, bill_number, document_type, issue_date, total, vendor_id, vendor:contacts(display_name)")
      .eq("tenant_id", tenantId)
      .is("project_id", null)
      .neq("status", "void")
      .order("issue_date", { ascending: false })
      .limit(TAGGABLE_LIMIT),
    supabase
      .from("expenses")
      .select("id, expense_date, memo, amount, contact_id, account:accounts(name), contact:contacts(display_name)")
      .eq("tenant_id", tenantId)
      .is("project_id", null)
      .order("expense_date", { ascending: false })
      .limit(TAGGABLE_LIMIT),
  ]);
  for (const res of [allSales, customerSales, bills, expenses]) {
    if (isMissingSchema(res.error)) return { sales: [], purchases: [], expenses: [] };
    if (res.error) throw res.error;
  }

  const seen = new Set<string>();
  const sales: TaggableDocument[] = [];
  for (const i of [...(customerSales.data ?? []), ...(allSales.data ?? [])]) {
    if (seen.has(i.id)) continue;
    seen.add(i.id);
    const isRefund = i.document_type === "refund_receipt";
    sales.push({
      id: i.id,
      label: i.invoice_number,
      detail: salesTypeLabel(i.document_type),
      party: i.contact?.display_name ?? null,
      partyId: i.contact_id,
      date: i.issue_date,
      amount: isRefund ? -num(i.subtotal) : num(i.subtotal),
    });
  }
  sales.sort((a, b) => b.date.localeCompare(a.date));

  return {
    sales,
    purchases: (bills.data ?? []).map((b) => ({
      id: b.id,
      label: b.bill_number ?? (b.document_type === "vendor_credit" ? "Supplier credit" : "Bill"),
      detail: b.document_type === "vendor_credit" ? "Supplier credit" : "Bill",
      party: b.vendor?.display_name ?? null,
      partyId: b.vendor_id,
      date: b.issue_date,
      amount: b.document_type === "vendor_credit" ? -num(b.total) : num(b.total),
    })),
    expenses: (expenses.data ?? []).map((e) => ({
      id: e.id,
      label: e.memo || e.account?.name || "Expense",
      detail: e.memo ? (e.account?.name ?? null) : null,
      party: e.contact?.display_name ?? null,
      partyId: e.contact_id,
      date: e.expense_date,
      amount: num(e.amount),
    })),
  };
}

function salesTypeLabel(type: string | null) {
  switch (type) {
    case "sales_receipt":
      return "Sales receipt";
    case "refund_receipt":
      return "Refund";
    case "debit_note":
      return "Debit note";
    default:
      return "Invoice";
  }
}

/** Contacts that can own a project (customers and customer-suppliers). */
export async function getProjectCustomers(tenantId: string): Promise<{ id: string; name: string }[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("contacts")
    .select("id, display_name")
    .eq("tenant_id", tenantId)
    .in("type", ["customer", "both"])
    .order("display_name");
  if (error) throw error;
  return (data ?? []).map((c) => ({ id: c.id, name: c.display_name }));
}

/**
 * Active projects for the dashboard panel, busiest first (revenue + costs).
 * Returns [] when the projects schema isn't installed, so the dashboard never breaks on it.
 */
export async function getProjectSummaries(tenantId: string, limit = 3): Promise<ProjectSummary[]> {
  let result: Awaited<ReturnType<typeof listProjects>>;
  try {
    result = await listProjects(tenantId);
  } catch (error) {
    console.error("getProjectSummaries failed", error);
    return [];
  }
  if (result.missingSchema) return [];

  return result.projects
    .filter((p) => p.status === "active")
    .sort((a, b) => b.revenue + b.costs - (a.revenue + a.costs) || b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit)
    .map((p) => ({
      id: p.id,
      name: p.name,
      code: p.code,
      budget: p.budget,
      revenue: p.revenue,
      costs: p.costs,
      profit: p.profit,
      margin: p.margin,
      progress: p.budgetUsed === null ? null : Math.min(Math.max(p.budgetUsed, 0), 1),
      overBudget: p.budgetUsed !== null && p.budgetUsed > 1,
    }));
}
