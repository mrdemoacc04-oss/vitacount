import { createClient } from "@/lib/supabase/server";
import { buildBuckets, bucketIndex, type DashboardRange } from "@/lib/date-range";
import { fetchAccountIndex, fetchLedgerLines, type LedgerAccount, type LedgerLine } from "@/lib/ledger";
import { addDays, todayISO } from "@/lib/dates";

export interface PeriodTotals {
  totalIncome: number;
  totalExpenses: number;
  netProfit: number;
  netCashFlow: number;
}

export interface SeriesPoint {
  label: string;
  start: string;
  end: string;
  /** null for buckets that are still in the future */
  income: number | null;
  expenses: number | null;
  /** net change in Cash (1000) during the bucket */
  cash: number | null;
  previous: { start: string; end: string; income: number; expenses: number } | null;
}

function summarize(lines: LedgerLine[], accounts: Map<string, LedgerAccount>): PeriodTotals {
  let totalIncome = 0;
  let totalExpenses = 0;
  let netCashFlow = 0;

  for (const line of lines) {
    const acc = accounts.get(line.accountId);
    if (!acc) continue;
    if (acc.type === "revenue") totalIncome += line.credit - line.debit;
    else if (acc.type === "expense") totalExpenses += line.debit - line.credit;
    if (acc.code === "1000") netCashFlow += line.debit - line.credit; // Cash
  }

  return { totalIncome, totalExpenses, netProfit: totalIncome - totalExpenses, netCashFlow };
}

/** % change vs the comparison period — real, not fabricated. null when there's no baseline. */
function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

function bucketize(lines: LedgerLine[], accounts: Map<string, LedgerAccount>, buckets: ReturnType<typeof buildBuckets>) {
  const income = buckets.map(() => 0);
  const expenses = buckets.map(() => 0);
  const cash = buckets.map(() => 0);
  for (const line of lines) {
    const acc = accounts.get(line.accountId);
    if (!acc) continue;
    const isCash = acc.code === "1000";
    if (!isCash && acc.type !== "revenue" && acc.type !== "expense") continue;
    const i = bucketIndex(buckets, line.entryDate);
    if (i < 0) continue;
    if (isCash) cash[i] += line.debit - line.credit;
    else if (acc.type === "revenue") income[i] += line.credit - line.debit;
    else expenses[i] += line.debit - line.credit;
  }
  return { income, expenses, cash };
}

/**
 * KPI totals, the income/expense series, and top expense categories for one range —
 * all computed from the same ledger pull so every widget agrees.
 */
export async function getDashboardFinancials(tenantId: string, range: DashboardRange) {
  const supabase = await createClient();

  const [accounts, currentLines, previousLines] = await Promise.all([
    fetchAccountIndex(supabase, tenantId),
    fetchLedgerLines(supabase, tenantId, range.from, range.dataTo),
    fetchLedgerLines(supabase, tenantId, range.compareFrom, range.compareTo),
  ]);

  const current = summarize(currentLines, accounts);
  const previous = summarize(
    previousLines.filter((l) => l.entryDate <= range.compareDataTo),
    accounts,
  );

  const buckets = buildBuckets(range.from, range.to, range.granularity);
  const previousBuckets = buildBuckets(range.compareFrom, range.compareTo, range.granularity);
  const cur = bucketize(currentLines, accounts, buckets);
  const prev = bucketize(previousLines, accounts, previousBuckets);

  const series: SeriesPoint[] = buckets.map((b, i) => {
    const future = b.start > range.dataTo;
    const pb = previousBuckets[i];
    return {
      label: b.label,
      start: b.start,
      end: b.end,
      income: future ? null : cur.income[i],
      expenses: future ? null : cur.expenses[i],
      cash: future ? null : cur.cash[i],
      previous: pb ? { start: pb.start, end: pb.end, income: prev.income[i], expenses: prev.expenses[i] } : null,
    };
  });

  const categoryTotals = new Map<string, number>();
  for (const line of currentLines) {
    const acc = accounts.get(line.accountId);
    if (acc?.type !== "expense") continue;
    categoryTotals.set(acc.name, (categoryTotals.get(acc.name) ?? 0) + line.debit - line.credit);
  }
  const topExpenseCategories = [...categoryTotals.entries()]
    .map(([name, amount]) => ({ name, amount }))
    .filter((c) => c.amount > 0)
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5);

  // Spending spikes: a category at least 30% (and $250) above the same-length
  // window before, measured like-for-like up to the same point in the period.
  const previousCategoryTotals = new Map<string, number>();
  for (const line of previousLines) {
    if (line.entryDate > range.compareDataTo) continue;
    const acc = accounts.get(line.accountId);
    if (acc?.type !== "expense") continue;
    previousCategoryTotals.set(acc.name, (previousCategoryTotals.get(acc.name) ?? 0) + line.debit - line.credit);
  }
  const expenseSpikes = [...categoryTotals.entries()]
    .map(([name, amount]) => {
      const before = previousCategoryTotals.get(name) ?? 0;
      return { name, amount, previous: before, change: before > 0 ? ((amount - before) / before) * 100 : null };
    })
    .filter((c) => c.previous > 0 && c.change !== null && c.change >= 30 && c.amount - c.previous >= 250)
    .sort((a, b) => b.amount - b.previous - (a.amount - a.previous))
    .slice(0, 3);

  return {
    kpis: {
      ...current,
      previous,
      trends: {
        totalIncome: pctChange(current.totalIncome, previous.totalIncome),
        totalExpenses: pctChange(current.totalExpenses, previous.totalExpenses),
        netProfit: pctChange(current.netProfit, previous.netProfit),
        netCashFlow: pctChange(current.netCashFlow, previous.netCashFlow),
      },
    },
    series,
    topExpenseCategories,
    expenseSpikes,
  };
}

export interface ForecastPoint {
  date: string;
  balance: number;
  inflow: number;
  outflow: number;
}

/**
 * Cash over the next `days`: today's Cash balance from the ledger, plus open
 * invoices on their due dates, minus open bills on theirs. Anything already past
 * due is assumed to land within the first week (receivables) or today (payables) —
 * a conservative read, not a promise.
 */
export async function getCashForecast(tenantId: string, days = 30) {
  const supabase = await createClient();
  const today = todayISO();
  const horizon = addDays(today, days);

  const { data: cashAccount } = await supabase.from("accounts").select("id").eq("tenant_id", tenantId).eq("code", "1000").maybeSingle();

  let opening = 0;
  if (cashAccount) {
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await supabase
        .from("journal_entry_lines")
        .select("debit, credit, journal_entry:journal_entries!inner(status)")
        .eq("account_id", cashAccount.id)
        .eq("journal_entry.status", "posted")
        .order("id")
        .range(offset, offset + 999);
      if (error || !data) break;
      for (const l of data) opening += Number(l.debit) - Number(l.credit);
      if (data.length < 1000) break;
    }
  }

  const [{ data: receivables }, { data: payables }] = await Promise.all([
    supabase
      .from("invoices")
      .select("balance_due, due_date, issue_date")
      .eq("tenant_id", tenantId)
      .in("document_type", ["invoice", "debit_note"])
      .in("status", ["sent", "partial", "overdue"])
      .gt("balance_due", 0),
    supabase
      .from("bills")
      .select("balance_due, due_date, issue_date")
      .eq("tenant_id", tenantId)
      .eq("document_type", "bill")
      .in("status", ["open", "partial", "scheduled"])
      .gt("balance_due", 0),
  ]);

  const inflows = new Map<string, number>();
  const outflows = new Map<string, number>();
  const firstWeek = addDays(today, 7);
  for (const inv of receivables ?? []) {
    const due = inv.due_date ?? addDays(inv.issue_date, 30);
    const when = due < today ? firstWeek : due;
    if (when <= horizon) inflows.set(when, (inflows.get(when) ?? 0) + Number(inv.balance_due));
  }
  for (const bill of payables ?? []) {
    const due = bill.due_date ?? addDays(bill.issue_date, 30);
    const when = due < today ? today : due;
    if (when <= horizon) outflows.set(when, (outflows.get(when) ?? 0) + Number(bill.balance_due));
  }

  const points: ForecastPoint[] = [];
  let balance = opening;
  for (let i = 0; i <= days; i++) {
    const date = addDays(today, i);
    const inflow = inflows.get(date) ?? 0;
    const outflow = outflows.get(date) ?? 0;
    balance += inflow - outflow;
    points.push({ date, balance, inflow, outflow });
  }

  const lowest = points.reduce((min, p) => (p.balance < min.balance ? p : min), points[0]);
  return {
    opening,
    closing: balance,
    expectedIn: [...inflows.values()].reduce((a, b) => a + b, 0),
    expectedOut: [...outflows.values()].reduce((a, b) => a + b, 0),
    lowest,
    points,
  };
}

export async function getOverdueInvoicesAlert(tenantId: string) {
  const supabase = await createClient();

  const { data: overdueInvoices } = await supabase
    .from("invoices")
    .select("id, invoice_number, total, balance_due, due_date, customer:contacts(display_name)")
    .eq("tenant_id", tenantId)
    .in("document_type", ["invoice", "debit_note"])
    .in("status", ["sent", "partial", "overdue"])
    .lt("due_date", todayISO());

  const totalOverdueAmount = (overdueInvoices || []).reduce((sum, inv) => sum + Number(inv.balance_due || 0), 0);

  return {
    count: overdueInvoices?.length || 0,
    totalAmount: totalOverdueAmount,
    items: overdueInvoices || [],
  };
}
