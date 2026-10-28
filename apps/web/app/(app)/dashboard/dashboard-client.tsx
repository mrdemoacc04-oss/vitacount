"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useId, useTransition } from "react";
import { BezelCard } from "@/components/bezel-card";
import { Icons, type Icon } from "@/components/icons";
import { DashboardRangeFilter } from "@/components/dashboard-range-filter";
import { AgentPromptBar } from "@/components/agent-prompt-bar";
import { IncomeExpenseChart } from "@/components/income-expense-chart";
import type { DashboardRange } from "@/lib/date-range";
import type { ForecastPoint, SeriesPoint } from "@/lib/dashboard-queries";
import type { ProjectSummary } from "@/lib/projects";

interface BankAccountRow {
  id: string;
  name: string;
  account_type: string | null;
  current_balance: number | string | null;
}

interface RecentTransactionRow {
  id: string | null;
  transaction_type: string | null;
  description: string | null;
  party_name: string | null;
  transaction_date: string | null;
  amount: number | string | null;
}

export interface LowStockItem {
  id: string;
  name: string;
  sku: string | null;
  onHand: number;
  reorderPoint: number | null;
}

interface DashboardClientProps {
  firstName: string;
  role: string | null;
  range: DashboardRange;
  /** e.g. "Aug 1 – Aug 24, 2026" — the like-for-like window the KPI deltas compare against */
  comparisonLabel: string;
  series: SeriesPoint[];
  kpis: {
    totalIncome: number;
    totalExpenses: number;
    netProfit: number;
    netCashFlow: number;
    trends: {
      totalIncome: number | null;
      totalExpenses: number | null;
      netProfit: number | null;
      netCashFlow: number | null;
    };
  };
  bankAccounts: BankAccountRow[];
  reconciliationSummary: {
    autoMatched: number;
    needsReview: number;
    unmatched: number;
    exceptions: number;
  };
  expenseCategories: Array<{ name: string; amount: number }>;
  expenseSpikes: Array<{ name: string; amount: number; previous: number; change: number | null }>;
  overdueAlerts: {
    count: number;
    totalAmount: number;
    items: unknown[];
  };
  recentTransactions: RecentTransactionRow[];
  forecast: {
    opening: number;
    closing: number;
    expectedIn: number;
    expectedOut: number;
    lowest: ForecastPoint;
    points: ForecastPoint[];
  };
  projects: ProjectSummary[];
  lowStock: LowStockItem[];
}

const currency = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const currencyExact = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD" });
const compact = (n: number) =>
  Math.abs(n) >= 10000 ? n.toLocaleString("en-US", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 1 }) : currency(n);

const shortDate = (iso: string | null) =>
  iso ? new Date(`${iso.slice(0, 10)}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—";

/** A trend reads as good or bad depending on the metric — rising expenses are not "up and to the right". */
function Trend({ value, invert = false }: { value: number | null; invert?: boolean }) {
  if (value === null || !Number.isFinite(value)) return <span className="text-xs text-muted-foreground">No prior data</span>;
  const up = value >= 0;
  const good = invert ? !up : up;
  return (
    <span
      className={`inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[11.5px] font-medium tabular-nums ${
        good ? "bg-positive/10 text-positive" : "bg-destructive/10 text-destructive"
      }`}
    >
      <svg viewBox="0 0 12 12" className={`size-3 ${up ? "" : "rotate-180"}`} aria-hidden="true">
        <path d="M6 2.5v7M3 5.5l3-3 3 3" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {Math.abs(value).toFixed(1)}%
    </span>
  );
}

/** Small area chart for a KPI card. Draws nothing until there are two real points. */
function Sparkline({ values, color }: { values: number[]; color: string }) {
  const id = useId();
  if (values.length < 2) return <div className="h-10" />;
  const w = 120;
  const h = 40;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => [(i / (values.length - 1)) * w, h - 3 - ((v - min) / span) * (h - 8)] as const);
  const line = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="h-10 w-full" aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity="0.22" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${line} L${w} ${h} L0 ${h}Z`} fill={`url(#${id})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="1.75" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function PanelHeader({ title, href, linkLabel, badge }: { title: string; href?: string; linkLabel?: string; badge?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h2 className="flex items-center gap-2 text-[15px] font-semibold text-foreground">
        {title}
        {badge}
      </h2>
      {href && (
        <Link href={href} className="group inline-flex items-center gap-1 text-[13px] text-muted-foreground transition-colors hover:text-primary">
          {linkLabel ?? "View all"}
          <Icons.arrowRight className="size-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
        </Link>
      )}
    </div>
  );
}

function EmptyNote({ children, action }: { children: React.ReactNode; action?: { href: string; label: string } }) {
  return (
    <div className="flex flex-col items-start gap-2 rounded-lg border border-dashed border-border px-4 py-5">
      <p className="text-[13px] text-muted-foreground">{children}</p>
      {action && (
        <Link href={action.href} className="text-[13px] font-medium text-primary underline-offset-4 hover:underline">
          {action.label}
        </Link>
      )}
    </div>
  );
}

const QUICK_ACTIONS: { label: string; href: string; icon: Icon }[] = [
  { label: "New invoice", href: "/sales/new?type=invoice", icon: Icons.invoice },
  { label: "Record expense", href: "/expenses/new?type=expense", icon: Icons.receipt },
  { label: "Receive payment", href: "/sales/receive-payment", icon: Icons.coinIn },
  { label: "Enter a bill", href: "/expenses/new?type=bill", icon: Icons.coinOut },
  { label: "Upload receipt", href: "/documents", icon: Icons.documents },
];

const CHART_H = 160;

/** 30-day cash projection: balance line, a dashed line at zero if it dips below, dots on days money moves. */
function ForecastChart({ points, lowest }: { points: ForecastPoint[]; lowest: ForecastPoint }) {
  const id = useId();
  const w = 600;
  const pad = { top: 12, bottom: 22 };
  const balances = points.map((p) => p.balance);
  const lo = Math.min(...balances);
  const hi = Math.max(...balances);
  // Fit the data with some headroom; only pull zero into view when cash actually dips below it.
  const pad_ = Math.max((hi - lo) * 0.25, Math.abs(hi) * 0.05, 1);
  const min = lo < 0 ? Math.min(0, lo) - pad_ * 0.3 : lo - pad_;
  const max = hi + pad_ * 0.6;
  const span = max - min || 1;
  const x = (i: number) => (i / Math.max(points.length - 1, 1)) * w;
  const y = (v: number) => pad.top + (1 - (v - min) / span) * (CHART_H - pad.top - pad.bottom);
  const line = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(p.balance).toFixed(1)}`).join(" ");
  const lowIndex = points.indexOf(lowest);
  const ticks = [0, Math.round((points.length - 1) / 2), points.length - 1];

  return (
    <div className="mt-5">
      <div className="relative" style={{ height: CHART_H }}>
        <svg viewBox={`0 0 ${w} ${CHART_H}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible" role="img" aria-label="Projected cash balance for the next 30 days">
          <defs>
            <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="var(--primary)" stopOpacity="0.2" />
              <stop offset="1" stopColor="var(--primary)" stopOpacity="0" />
            </linearGradient>
          </defs>
          {min < 0 && (
            <line x1="0" x2={w} y1={y(0)} y2={y(0)} stroke="var(--destructive)" strokeOpacity="0.5" strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />
          )}
          <path d={`${line} L${w} ${CHART_H - pad.bottom} L0 ${CHART_H - pad.bottom}Z`} fill={`url(#${id})`} />
          <path d={line} fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          <line x1="0" x2={w} y1={CHART_H - pad.bottom} y2={CHART_H - pad.bottom} stroke="var(--border)" vectorEffect="non-scaling-stroke" />
        </svg>
        {/* event dots and the low-point label as HTML so they stay round and crisp at any width */}
        {points.map((p, i) =>
          p.inflow > 0 || p.outflow > 0 ? (
            <span
              key={p.date}
              title={`${shortDate(p.date)}: ${p.inflow ? `+${currency(p.inflow)} in` : ""}${p.inflow && p.outflow ? ", " : ""}${p.outflow ? `−${currency(p.outflow)} out` : ""}`}
              className={`absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-card ${p.outflow > p.inflow ? "bg-series-expense" : "bg-positive"}`}
              style={{ left: `${(x(i) / w) * 100}%`, top: y(p.balance) }}
            />
          ) : null,
        )}
        {lowIndex > 0 && (
          <span
            className="absolute -translate-x-1/2 rounded-md bg-foreground px-1.5 py-0.5 text-[10.5px] font-medium tabular-nums text-background shadow-soft-sm"
            style={{ left: `${Math.min(Math.max((x(lowIndex) / w) * 100, 8), 92)}%`, top: Math.min(y(lowest.balance) + 10, CHART_H - pad.bottom - 18) }}
          >
            Low {compact(lowest.balance)}
          </span>
        )}
      </div>
      <div className="mt-1 flex justify-between text-[11px] text-muted-foreground">
        {ticks.map((i) => (
          <span key={i}>{i === 0 ? "Today" : shortDate(points[i]?.date ?? null)}</span>
        ))}
      </div>
    </div>
  );
}

export function DashboardClient({
  firstName,
  role,
  range,
  comparisonLabel,
  series,
  kpis,
  bankAccounts,
  reconciliationSummary,
  expenseCategories,
  expenseSpikes,
  overdueAlerts,
  recentTransactions,
  forecast,
  projects,
  lowStock,
}: DashboardClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();

  // The range lives in the URL (shareable, survives refresh) and every widget
  // re-renders server-side against the same slice.
  function updateParams(changes: Record<string, string | null>) {
    const current: Record<string, string | null> = {
      range: range.preset,
      from: range.preset === "custom" ? range.from : null,
      to: range.preset === "custom" ? range.to : null,
      group: range.granularity !== range.autoGranularity ? range.granularity : null,
      compare: range.compare ? "1" : null,
    };
    const next = new URLSearchParams();
    for (const [key, value] of Object.entries({ ...current, ...changes })) {
      if (value) next.set(key, value);
    }
    startTransition(() => router.push(`${pathname}?${next.toString()}`, { scroll: false }));
  }

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const today = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  const totalExpenseSum = expenseCategories.reduce((sum, c) => sum + c.amount, 0);
  const topCategory = expenseCategories[0]?.amount ?? 0;

  const reconTotal =
    reconciliationSummary.autoMatched + reconciliationSummary.needsReview + reconciliationSummary.exceptions + reconciliationSummary.unmatched;
  const matchedPct = reconTotal > 0 ? Math.round((reconciliationSummary.autoMatched / reconTotal) * 100) : 0;
  const reconSegments = [
    { label: "Auto-matched", value: reconciliationSummary.autoMatched, className: "bg-primary" },
    { label: "Needs review", value: reconciliationSummary.needsReview, className: "bg-warning" },
    { label: "Exceptions", value: reconciliationSummary.exceptions, className: "bg-destructive" },
    { label: "Unmatched", value: reconciliationSummary.unmatched, className: "bg-primary/25" },
  ];

  const past = series.filter((p) => p.income !== null);
  const kpiCards = [
    { label: "Total income", value: kpis.totalIncome, trend: kpis.trends.totalIncome, invert: false, spark: past.map((p) => p.income ?? 0), color: "var(--series-income)", href: "/sales" },
    { label: "Total expenses", value: kpis.totalExpenses, trend: kpis.trends.totalExpenses, invert: true, spark: past.map((p) => p.expenses ?? 0), color: "var(--series-expense)", href: "/expenses" },
    {
      label: "Net profit",
      value: kpis.netProfit,
      trend: kpis.trends.netProfit,
      invert: false,
      spark: past.map((p) => (p.income ?? 0) - (p.expenses ?? 0)),
      color: kpis.netProfit >= 0 ? "var(--positive)" : "var(--destructive)",
      href: "/reports",
    },
    {
      label: "Net cash flow",
      value: kpis.netCashFlow,
      trend: kpis.trends.netCashFlow,
      invert: false,
      // running cash position across the range
      spark: past.reduce<number[]>((acc, p) => [...acc, (acc.at(-1) ?? 0) + (p.cash ?? 0)], []),
      color: "var(--primary)",
      href: "/banking",
    },
  ];

  type Alert = { key: string; href: string; title: string; detail: string; amount?: string; tone: "destructive" | "warning" | "primary"; Icon: Icon };
  const alerts: Alert[] = [];
  if (overdueAlerts.count > 0) {
    alerts.push({
      key: "overdue",
      href: "/sales",
      title: "Overdue invoices",
      detail: `${overdueAlerts.count} ${overdueAlerts.count === 1 ? "invoice is" : "invoices are"} past due`,
      amount: currency(overdueAlerts.totalAmount),
      tone: "destructive",
      Icon: Icons.clock,
    });
  }
  for (const spike of expenseSpikes) {
    alerts.push({
      key: `spike-${spike.name}`,
      href: "/reports",
      title: "High expense detected",
      detail: `${spike.name} ${Math.round(spike.change ?? 0)}% above the previous period`,
      amount: currency(spike.amount),
      tone: "warning",
      Icon: Icons.alert,
    });
  }
  if (lowStock.length > 0) {
    alerts.push({
      key: "low-stock",
      href: "/inventory?type=inventory",
      title: "Low inventory",
      detail:
        lowStock.length === 1
          ? `${lowStock[0].name}: ${lowStock[0].onHand} left (reorder at ${lowStock[0].reorderPoint ?? 0})`
          : `${lowStock.length} items at or below their reorder point`,
      tone: "primary",
      Icon: Icons.inventory,
    });
  }
  if (reconciliationSummary.needsReview > 0) {
    alerts.push({
      key: "review",
      href: "/reconciliation",
      title: "Matches to review",
      detail: `${reconciliationSummary.needsReview} suggested ${reconciliationSummary.needsReview === 1 ? "match" : "matches"} waiting for you`,
      tone: "primary",
      Icon: Icons.reconciliation,
    });
  }
  if (forecast.lowest.balance < 0) {
    alerts.push({
      key: "cash",
      href: "/banking",
      title: "Cash could run short",
      detail: `Projected ${currency(forecast.lowest.balance)} on ${shortDate(forecast.lowest.date)}`,
      tone: "destructive",
      Icon: Icons.forecasting,
    });
  }

  const toneTile = {
    destructive: "bg-destructive/10 text-destructive",
    warning: "bg-warning/12 text-warning",
    primary: "bg-primary/10 text-primary",
  };
  const bankTotal = bankAccounts.reduce((sum, a) => sum + Number(a.current_balance || 0), 0);

  return (
    <div className="mx-auto max-w-[1280px] space-y-7">
      {/* Greeting + the one date filter that scopes everything below it */}
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div>
          <p className="text-[13px] text-muted-foreground">{today}</p>
          <h1 className="mt-1 text-[28px] font-semibold leading-tight text-foreground md:text-[32px]">
            {greeting}, <span className="font-serif text-[1.12em] font-normal italic tracking-normal">{firstName}</span>
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Here&apos;s what&apos;s happening with your business today
            {role && (
              <>
                {" "}
                · signed in as <span className="capitalize text-foreground">{role}</span>
              </>
            )}
          </p>
        </div>

        <DashboardRangeFilter range={range} pending={pending} onChange={updateParams} />
      </div>

      <AgentPromptBar />

      {/* Quick actions — the five things people open the app to do */}
      <nav aria-label="Quick actions" className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:flex-wrap md:px-0">
        {QUICK_ACTIONS.map(({ label, href, icon: ActionIcon }) => (
          <Link
            key={label}
            href={href}
            className="group flex shrink-0 items-center gap-2 rounded-lg border border-border bg-card py-1.5 pl-1.5 pr-3 text-[13px] font-medium text-foreground shadow-soft-sm transition-[border-color,transform] duration-150 hover:border-primary/35 active:scale-[0.98]"
          >
            <span className="flex size-6 items-center justify-center rounded-md bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
              <ActionIcon className="size-3.5" />
            </span>
            {label}
          </Link>
        ))}
      </nav>

      {/* While a new range loads, keep the previous render (dimmed) instead of flashing empty */}
      <div className={`space-y-6 transition-opacity duration-200 ${pending ? "opacity-60" : ""}`} aria-busy={pending}>
        {/* KPI cards, each with its own trend line over the selected range */}
        <section aria-label="Key figures" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {kpiCards.map((card) => (
            <Link
              key={card.label}
              href={card.href}
              className="group flex flex-col rounded-xl border border-border bg-card p-5 transition-[border-color,box-shadow] duration-200 hover:border-primary/30 hover:shadow-soft"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[13px] text-muted-foreground">{card.label}</span>
                <Icons.arrowUpRight className="size-3.5 text-transparent transition-colors group-hover:text-muted-foreground" />
              </div>
              <span
                className={`mt-2.5 font-heading text-[28px] font-semibold leading-none tracking-tight tabular-nums ${
                  card.value < 0 ? "text-destructive" : "text-foreground"
                }`}
              >
                {currency(card.value)}
              </span>
              <div className="-mx-1 mt-3">
                <Sparkline values={card.spark} color={card.color} />
              </div>
              <span className="mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                <Trend value={card.trend} invert={card.invert} />
                {card.trend !== null && <span className="text-xs text-muted-foreground">vs {comparisonLabel}</span>}
              </span>
            </Link>
          ))}
        </section>

        {/* Two independent columns: the main story on the left, the to-do rail on the right */}
        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="flex min-w-0 flex-col gap-6">
            <BezelCard>
              <IncomeExpenseChart
                series={series}
                granularity={range.granularity}
                granularityOptions={range.granularityOptions}
                compare={range.compare}
                onGranularityChange={(g) => updateParams({ group: g === range.autoGranularity ? null : g })}
                onCompareChange={(compare) => updateParams({ compare: compare ? "1" : null })}
              />
            </BezelCard>

            <BezelCard>
              <PanelHeader title="Cash flow forecast" href="/banking" linkLabel="Banking" />
              <p className="mt-1 text-[13px] text-muted-foreground">Next 30 days from open invoices and bills, starting at today&apos;s cash.</p>
              <dl className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
                {[
                  { label: "Cash today", value: forecast.opening, tone: "", sign: "" },
                  { label: "Expected in", value: forecast.expectedIn, tone: "text-positive", sign: "+" },
                  { label: "Expected out", value: forecast.expectedOut, tone: "text-series-expense", sign: "−" },
                  { label: "In 30 days", value: forecast.closing, tone: forecast.closing < 0 ? "text-destructive" : "", sign: "" },
                ].map((s) => (
                  <div key={s.label}>
                    <dt className="text-xs text-muted-foreground">{s.label}</dt>
                    <dd className={`mt-1 font-heading text-lg font-semibold tracking-tight tabular-nums ${s.tone || "text-foreground"}`}>
                      {s.sign && s.value > 0 ? s.sign : ""}
                      {compact(s.value)}
                    </dd>
                  </div>
                ))}
              </dl>
              {forecast.expectedIn === 0 && forecast.expectedOut === 0 ? (
                <div className="mt-5">
                  <EmptyNote action={{ href: "/sales/new?type=invoice", label: "Create an invoice" }}>
                    Nothing is due in or out in the next 30 days, so cash holds at {currency(forecast.opening)}.
                  </EmptyNote>
                </div>
              ) : (
                <>
                  <ForecastChart points={forecast.points} lowest={forecast.lowest} />
                  <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <span className="h-0.5 w-3.5 rounded-full bg-primary" aria-hidden="true" /> Projected balance
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="size-2 rounded-full bg-positive" aria-hidden="true" /> Money in
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="size-2 rounded-full bg-series-expense" aria-hidden="true" /> Money out
                    </span>
                  </div>
                </>
              )}
            </BezelCard>

            <BezelCard>
              <PanelHeader title="Recent transactions" href="/transactions" />
              {recentTransactions.length === 0 ? (
                <div className="mt-4">
                  <EmptyNote action={{ href: "/sales/new?type=invoice", label: "Create an invoice" }}>No transactions in this period.</EmptyNote>
                </div>
              ) : (
                <ul className="mt-3 divide-y divide-border">
                  {recentTransactions.slice(0, 6).map((tx) => {
                    const amount = Number(tx.amount || 0);
                    const isCredit = amount > 0;
                    return (
                      <li key={`${tx.transaction_type}_${tx.id}`} className="flex items-center gap-3 py-3">
                        <span
                          className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${
                            isCredit ? "bg-positive/10 text-positive" : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {isCredit ? <Icons.coinIn className="size-4" /> : <Icons.coinOut className="size-4" />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] font-medium text-foreground">{tx.description || "Transaction"}</span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {tx.party_name || "General"} · {shortDate(tx.transaction_date)}
                          </span>
                        </span>
                        <span className={`shrink-0 text-[13px] font-medium tabular-nums ${isCredit ? "text-positive" : "text-foreground"}`}>
                          {isCredit ? "+" : "−"}
                          {currencyExact(Math.abs(amount))}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </BezelCard>
          </div>

          <div className="flex flex-col gap-6">
            <BezelCard>
              <PanelHeader
                title="Needs attention"
                badge={
                  alerts.length > 0 ? (
                    <span className="rounded-md bg-destructive/10 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-destructive">{alerts.length}</span>
                  ) : null
                }
              />
              {alerts.length === 0 ? (
                <p className="mt-4 flex items-center gap-2 rounded-lg bg-positive/[0.07] px-3 py-2.5 text-[13px] text-muted-foreground">
                  <Icons.check className="size-4 text-positive" />
                  You&apos;re all caught up.
                </p>
              ) : (
                <ul className="-mx-2 mt-3">
                  {alerts.map((a) => (
                    <li key={a.key}>
                      <Link href={a.href} className="group flex items-center gap-3 rounded-lg px-2 py-2 transition-colors duration-150 hover:bg-accent">
                        <span className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${toneTile[a.tone]}`}>
                          <a.Icon className="size-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] font-medium text-foreground">{a.title}</span>
                          <span className="block truncate text-xs text-muted-foreground">{a.detail}</span>
                        </span>
                        {a.amount ? (
                          <span className={`shrink-0 text-[13px] font-semibold tabular-nums ${a.tone === "destructive" ? "text-destructive" : "text-foreground"}`}>
                            {a.amount}
                          </span>
                        ) : (
                          <Icons.chevronRight className="size-4 shrink-0 text-muted-foreground/50 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-primary" />
                        )}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </BezelCard>

            <BezelCard>
              <PanelHeader title="Bank accounts" href="/banking" />
              {bankAccounts.length === 0 ? (
                <p className="mt-4 text-[13px] text-muted-foreground">No accounts connected yet.</p>
              ) : (
                <>
                  <p className="mt-3 font-heading text-2xl font-semibold tracking-tight tabular-nums text-foreground">{currencyExact(bankTotal)}</p>
                  <p className="text-xs text-muted-foreground">
                    Across {bankAccounts.length} {bankAccounts.length === 1 ? "account" : "accounts"}
                  </p>
                  <ul className="mt-3 divide-y divide-border">
                    {bankAccounts.slice(0, 3).map((acct) => {
                      const balance = Number(acct.current_balance || 0);
                      return (
                        <li key={acct.id} className="flex items-center gap-3 py-2.5">
                          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                            <Icons.banking className="size-4" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[13px] font-medium text-foreground">{acct.name}</span>
                            <span className="block text-xs capitalize text-muted-foreground">{(acct.account_type || "checking").replace(/_/g, " ")}</span>
                          </span>
                          <span className={`text-[13px] font-medium tabular-nums ${balance < 0 ? "text-destructive" : "text-foreground"}`}>
                            {currencyExact(balance)}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </>
              )}
              <Link
                href="/banking"
                className="mt-3 flex h-9 items-center justify-center gap-1.5 rounded-lg border border-dashed border-border text-[13px] font-medium text-muted-foreground transition-colors duration-150 hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
              >
                <Icons.plus className="size-4" />
                Connect a bank
              </Link>
            </BezelCard>

            <BezelCard>
              <PanelHeader title="Project profitability" href="/projects" />
              {projects.length === 0 ? (
                <div className="mt-4">
                  <EmptyNote action={{ href: "/projects/new", label: "Create a project" }}>
                    Track profit per job: tag invoices, bills and expenses to a project.
                  </EmptyNote>
                </div>
              ) : (
                <ul className="mt-4 space-y-4">
                  {projects.map((p) => (
                    <li key={p.id}>
                      <Link href={`/projects/${p.id}`} className="group block">
                        <div className="flex items-baseline justify-between gap-3 text-[13px]">
                          <span className="truncate font-medium text-foreground group-hover:text-primary">{p.name}</span>
                          <span className={`shrink-0 text-xs font-medium tabular-nums ${p.profit >= 0 ? "text-positive" : "text-destructive"}`}>
                            {p.margin === null ? currency(p.profit) : `${Math.round(p.margin)}% margin`}
                          </span>
                        </div>
                        {p.progress !== null && (
                          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                            <div
                              className={`h-full rounded-full ${p.overBudget ? "bg-destructive" : p.progress > 0.8 ? "bg-warning" : "bg-primary"}`}
                              style={{ width: `${Math.max(2, p.progress * 100)}%` }}
                            />
                          </div>
                        )}
                        <div className="mt-1.5 text-xs tabular-nums text-muted-foreground">
                          {p.budget ? `${currency(p.costs)} of ${currency(p.budget)} budget spent` : `${currency(p.revenue)} revenue · ${currency(p.costs)} costs`}
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </BezelCard>

            <BezelCard>
              <PanelHeader title="Top expense categories" href="/reports" linkLabel="Report" />
              {expenseCategories.length === 0 ? (
                <p className="mt-4 text-[13px] text-muted-foreground">No posted expenses for this period.</p>
              ) : (
                <ul className="mt-4 space-y-3.5">
                  {expenseCategories.slice(0, 5).map((c) => (
                    <li key={c.name}>
                      <div className="flex items-baseline justify-between gap-3 text-[13px]">
                        <span className="truncate text-foreground">{c.name}</span>
                        <span className="shrink-0 tabular-nums text-muted-foreground">
                          {currency(c.amount)}
                          <span className="ml-1.5 text-foreground">{totalExpenseSum > 0 ? Math.round((c.amount / totalExpenseSum) * 100) : 0}%</span>
                        </span>
                      </div>
                      <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full bg-series-expense" style={{ width: `${topCategory > 0 ? Math.max(2, (c.amount / topCategory) * 100) : 0}%` }} />
                      </div>
                    </li>
                  ))}
                  <li className="flex items-center justify-between border-t border-border pt-3 text-[13px]">
                    <span className="text-muted-foreground">Total</span>
                    <span className="font-semibold tabular-nums text-foreground">{currency(totalExpenseSum)}</span>
                  </li>
                </ul>
              )}
            </BezelCard>

            <BezelCard>
              <PanelHeader
                title="Reconciliation"
                href="/reconciliation"
                linkLabel="Open"
                badge={<span className="rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-muted-foreground">{reconTotal.toLocaleString()}</span>}
              />
              {reconTotal === 0 ? (
                <p className="mt-4 text-[13px] text-muted-foreground">Nothing to reconcile yet.</p>
              ) : (
                <>
                  <p className="mt-4 flex items-baseline gap-2">
                    <span className="font-heading text-[26px] font-semibold leading-none tracking-tight tabular-nums">{matchedPct}%</span>
                    <span className="text-[13px] text-muted-foreground">auto-matched</span>
                  </p>
                  <div className="mt-3 flex h-1.5 gap-0.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                    {reconSegments
                      .filter((seg) => seg.value > 0)
                      .map((seg) => (
                        <div key={seg.label} className={seg.className} style={{ flexGrow: seg.value }} />
                      ))}
                  </div>
                  <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                    {reconSegments.map((seg) => (
                      <li key={seg.label} className="flex items-center gap-1.5">
                        <span className={`size-1.5 rounded-full ${seg.className}`} aria-hidden="true" />
                        <span className="text-muted-foreground">{seg.label}</span>
                        <span className="ml-auto tabular-nums text-foreground">{seg.value.toLocaleString()}</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </BezelCard>
          </div>
        </div>
      </div>
    </div>
  );
}
