/**
 * Server-side data lookups for answering questions precisely ("what's my net
 * profit", "which invoices are overdue"). Read-only on purpose: anything that
 * creates or changes data goes through the real UI (lib/agent/ui-tools.ts), so
 * the user watches it happen and approves the final submit.
 *
 * Every query runs on a Supabase client bound to the caller's session cookies,
 * so RLS keeps the agent inside exactly what the signed-in user can see.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { friendlyDbError } from "@/lib/db-errors";

export interface AgentContext {
  supabase: SupabaseClient;
  tenantId: string;
}

export interface DataTool {
  name: string;
  description: string;
  parameters: Record<string, unknown>; // JSON schema
  /** Short spoken narration while the lookup runs. */
  say: string;
  execute: (ctx: AgentContext, args: Record<string, unknown>) => Promise<unknown>;
}

function str(s: unknown): string {
  return String(s ?? "").trim();
}
function num(n: unknown): number {
  const v = Number(n);
  return Number.isFinite(v) ? v : 0;
}
function rpcResult<T>(data: T, error: { message: string; code?: string } | null) {
  if (error) throw new Error(friendlyDbError(error));
  return data;
}

export const dataTools: DataTool[] = [
  {
    name: "list_accounts",
    description: "List the chart of accounts (categories) for the current workspace.",
    parameters: { type: "object", properties: { activeOnly: { type: "boolean" } } },
    say: "Checking your categories",
    execute: async ({ supabase, tenantId }, args) => {
      let q = supabase.from("accounts").select("id, code, name, type, subtype, is_active").eq("tenant_id", tenantId).order("code");
      if (args.activeOnly) q = q.eq("is_active", true);
      return rpcResult(...(await q.then((r) => [r.data, r.error] as const)));
    },
  },
  {
    name: "list_contacts",
    description: "List customers and/or suppliers.",
    parameters: {
      type: "object",
      properties: { type: { type: "string", enum: ["customer", "vendor", "both", "all"] }, search: { type: "string" } },
    },
    say: "Looking up your contacts",
    execute: async ({ supabase, tenantId }, args) => {
      let q = supabase
        .from("contacts")
        .select("id, type, display_name, email, phone, payment_terms")
        .eq("tenant_id", tenantId)
        .order("display_name");
      const type = str(args.type);
      if (type && type !== "all") q = q.in("type", type === "both" ? ["both"] : [type, "both"]);
      if (str(args.search)) q = q.ilike("display_name", `%${str(args.search)}%`);
      return rpcResult(...(await q.then((r) => [r.data, r.error] as const)));
    },
  },
  {
    name: "list_invoices",
    description: "List sales documents (invoices, sales receipts, refunds, debit notes), optionally filtered by status or customer.",
    parameters: {
      type: "object",
      properties: {
        status: { type: "string", enum: ["draft", "sent", "partial", "paid", "overdue", "void"] },
        contactId: { type: "string" },
        limit: { type: "number" },
      },
    },
    say: "Checking your invoices",
    execute: async ({ supabase, tenantId }, args) => {
      let q = supabase
        .from("invoices")
        .select("*, contact:contacts(display_name)")
        .eq("tenant_id", tenantId)
        .order("issue_date", { ascending: false })
        .limit(num(args.limit) || 50);
      if (str(args.status)) q = q.eq("status", str(args.status));
      if (str(args.contactId)) q = q.eq("contact_id", str(args.contactId));
      return rpcResult(...(await q.then((r) => [r.data, r.error] as const)));
    },
  },
  {
    name: "get_invoice",
    description: "Get one invoice/sales document with its lines.",
    parameters: { type: "object", properties: { invoiceId: { type: "string" } }, required: ["invoiceId"] },
    say: "Pulling up that invoice",
    execute: async ({ supabase, tenantId }, args) => {
      const { data, error } = await supabase
        .from("invoices")
        .select("*, contact:contacts(display_name), invoice_lines(*)")
        .eq("tenant_id", tenantId)
        .eq("id", str(args.invoiceId))
        .single();
      return rpcResult(data, error);
    },
  },
  {
    name: "list_bills",
    description: "List supplier bills (and supplier credits), optionally filtered by status or supplier.",
    parameters: {
      type: "object",
      properties: {
        status: { type: "string", enum: ["open", "scheduled", "partial", "paid", "void"] },
        vendorId: { type: "string" },
        limit: { type: "number" },
      },
    },
    say: "Checking your bills",
    execute: async ({ supabase, tenantId }, args) => {
      let q = supabase
        .from("bills")
        .select("*, vendor:contacts(display_name)")
        .eq("tenant_id", tenantId)
        .order("issue_date", { ascending: false })
        .limit(num(args.limit) || 50);
      if (str(args.status)) q = q.eq("status", str(args.status));
      if (str(args.vendorId)) q = q.eq("vendor_id", str(args.vendorId));
      return rpcResult(...(await q.then((r) => [r.data, r.error] as const)));
    },
  },
  {
    name: "get_bill",
    description: "Get one bill with its lines.",
    parameters: { type: "object", properties: { billId: { type: "string" } }, required: ["billId"] },
    say: "Pulling up that bill",
    execute: async ({ supabase, tenantId }, args) => {
      const { data, error } = await supabase
        .from("bills")
        .select("*, vendor:contacts(display_name), bill_lines(*)")
        .eq("tenant_id", tenantId)
        .eq("id", str(args.billId))
        .single();
      return rpcResult(data, error);
    },
  },
  {
    name: "list_journal_entries",
    description: "List general ledger journal entries (CPA Mode view).",
    parameters: { type: "object", properties: { limit: { type: "number" }, sourceType: { type: "string" } } },
    say: "Checking the ledger",
    execute: async ({ supabase, tenantId }, args) => {
      let q = supabase
        .from("journal_entries")
        .select("*, journal_entry_lines(*, account:accounts(code,name))")
        .eq("tenant_id", tenantId)
        .order("entry_date", { ascending: false })
        .limit(num(args.limit) || 50);
      if (str(args.sourceType)) q = q.eq("source_type", str(args.sourceType));
      return rpcResult(...(await q.then((r) => [r.data, r.error] as const)));
    },
  },
  {
    name: "list_bank_accounts",
    description: "List connected bank accounts and their balances.",
    parameters: { type: "object", properties: {} },
    say: "Checking your bank accounts",
    execute: async ({ supabase, tenantId }) => {
      const { data, error } = await supabase.from("bank_accounts").select("*").eq("tenant_id", tenantId);
      return rpcResult(data, error);
    },
  },
  {
    name: "list_bank_transactions",
    description: "List bank feed transactions, optionally filtered by match status.",
    parameters: {
      type: "object",
      properties: { status: { type: "string", enum: ["unmatched", "matched", "excluded"] }, limit: { type: "number" } },
    },
    say: "Checking the bank feed",
    execute: async ({ supabase, tenantId }, args) => {
      let q = supabase
        .from("bank_transactions")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("posted_date", { ascending: false })
        .limit(num(args.limit) || 50);
      if (str(args.status)) q = q.eq("status", str(args.status));
      return rpcResult(...(await q.then((r) => [r.data, r.error] as const)));
    },
  },
  {
    name: "list_payments_received",
    description: "List customer payments received.",
    parameters: { type: "object", properties: { contactId: { type: "string" }, limit: { type: "number" } } },
    say: "Checking payments received",
    execute: async ({ supabase, tenantId }, args) => {
      let q = supabase
        .from("payments_received")
        .select("*, payment_applications(*)")
        .eq("tenant_id", tenantId)
        .order("payment_date", { ascending: false })
        .limit(num(args.limit) || 50);
      if (str(args.contactId)) q = q.eq("contact_id", str(args.contactId));
      return rpcResult(...(await q.then((r) => [r.data, r.error] as const)));
    },
  },
  {
    name: "list_payments_made",
    description: "List supplier payments made.",
    parameters: { type: "object", properties: { vendorId: { type: "string" }, limit: { type: "number" } } },
    say: "Checking payments made",
    execute: async ({ supabase, tenantId }, args) => {
      let q = supabase
        .from("payments_made")
        .select("*, bill_payment_applications(*)")
        .eq("tenant_id", tenantId)
        .order("payment_date", { ascending: false })
        .limit(num(args.limit) || 50);
      if (str(args.vendorId)) q = q.eq("vendor_id", str(args.vendorId));
      return rpcResult(...(await q.then((r) => [r.data, r.error] as const)));
    },
  },
  {
    name: "list_documents",
    description: "List uploaded receipts/bills and their OCR extraction status.",
    parameters: { type: "object", properties: { status: { type: "string" }, limit: { type: "number" } } },
    say: "Checking your documents",
    execute: async ({ supabase, tenantId }, args) => {
      let q = supabase
        .from("documents")
        .select("id, doc_type, status, ocr_confidence, extracted_data, created_at")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false })
        .limit(num(args.limit) || 50);
      if (str(args.status)) q = q.eq("status", str(args.status));
      return rpcResult(...(await q.then((r) => [r.data, r.error] as const)));
    },
  },
  {
    name: "list_agent_actions",
    description: "List the audit log of automated/agent actions (the review inbox), optionally filtered by status.",
    parameters: {
      type: "object",
      properties: { status: { type: "string", enum: ["proposed", "auto_executed", "approved", "rejected", "reversed"] } },
    },
    say: "Checking the review inbox",
    execute: async ({ supabase, tenantId }, args) => {
      let q = supabase.from("agent_actions").select("*").eq("tenant_id", tenantId).order("created_at", { ascending: false }).limit(50);
      if (str(args.status)) q = q.eq("status", str(args.status));
      return rpcResult(...(await q.then((r) => [r.data, r.error] as const)));
    },
  },
  {
    name: "get_financial_summary",
    description: "Income, expenses and net profit between two dates (inclusive), broken down by category. Use for 'how much did I make/spend' questions.",
    parameters: {
      type: "object",
      properties: { fromDate: { type: "string", description: "YYYY-MM-DD" }, toDate: { type: "string", description: "YYYY-MM-DD" } },
      required: ["fromDate", "toDate"],
    },
    say: "Crunching the numbers",
    execute: async ({ supabase, tenantId }, args) => {
      const { data, error } = await supabase
        .from("journal_entry_lines")
        .select("debit, credit, account:accounts!inner(type, name, code), journal_entry:journal_entries!inner(entry_date, tenant_id, status)")
        .eq("journal_entry.tenant_id", tenantId)
        .eq("journal_entry.status", "posted")
        .gte("journal_entry.entry_date", str(args.fromDate))
        .lte("journal_entry.entry_date", str(args.toDate));
      if (error) throw new Error(friendlyDbError(error));
      let income = 0;
      let expenses = 0;
      const byAccount = new Map<string, number>();
      for (const row of data as unknown as { debit: number; credit: number; account: { type: string; name: string } }[]) {
        const acc = row.account;
        if (!acc) continue;
        if (acc.type === "revenue") {
          const v = row.credit - row.debit;
          income += v;
          byAccount.set(acc.name, (byAccount.get(acc.name) ?? 0) + v);
        } else if (acc.type === "expense") {
          const v = row.debit - row.credit;
          expenses += v;
          byAccount.set(acc.name, (byAccount.get(acc.name) ?? 0) + v);
        }
      }
      return {
        totalIncome: income,
        totalExpenses: expenses,
        netProfit: income - expenses,
        byAccount: Object.fromEntries(byAccount),
      };
    },
  },
];

export function dataToolSchemas() {
  return dataTools.map((t) => ({
    type: "function" as const,
    function: { name: t.name, description: t.description, parameters: t.parameters },
  }));
}

export function getDataTool(name: string): DataTool | undefined {
  return dataTools.find((t) => t.name === name);
}
