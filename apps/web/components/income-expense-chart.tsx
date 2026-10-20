"use client";

import { useEffect, useMemo, useState } from "react";
import { formatDateRange } from "@/lib/dates";
import { GRANULARITY_LABEL, type Granularity } from "@/lib/date-range";
import type { SeriesPoint } from "@/lib/dashboard-queries";

interface IncomeExpenseChartProps {
  series: SeriesPoint[];
  granularity: Granularity;
  granularityOptions: Granularity[];
  compare: boolean;
  onGranularityChange: (g: Granularity) => void;
  onCompareChange: (compare: boolean) => void;
}

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const compactMoney = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});

const PLOT_HEIGHT = 220;
const AXIS_BAND = 28; // x labels live inside the SVG height, never clipped
const MARGIN = { top: 12, right: 8, left: 52 };
const MAX_BAR = 24;
const BAR_GAP = 2;
const RADIUS = 4;

function niceStep(raw: number) {
  const exp = Math.floor(Math.log10(raw));
  const base = 10 ** exp;
  const f = raw / base;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * base;
}

/** Column with a 4px rounded data-end and a square baseline. */
function columnPath(x: number, y: number, w: number, h: number) {
  if (h <= 0) return "";
  const r = Math.min(RADIUS, w / 2, h);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}

function pctChange(current: number, previous: number) {
  if (previous === 0) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

function Change({ current, previous }: { current: number; previous: number }) {
  const pct = pctChange(current, previous);
  if (pct === null) return null;
  return (
    <span className="text-[10.5px] tabular-nums text-muted-foreground">
      {pct >= 0 ? "+" : ""}
      {pct.toFixed(1)}%
    </span>
  );
}

export function IncomeExpenseChart({
  series,
  granularity,
  granularityOptions,
  compare,
  onGranularityChange,
  onCompareChange,
}: IncomeExpenseChartProps) {
  // Callback-ref state so the observer re-attaches when the chart view remounts after "View as table".
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(0);
  const [active, setActive] = useState<number | null>(null);
  const [view, setView] = useState<"chart" | "table">("chart");

  useEffect(() => {
    if (!container) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
    observer.observe(container);
    return () => observer.disconnect();
  }, [container]);

  const totals = useMemo(
    () =>
      series.reduce(
        (acc, p) => ({
          income: acc.income + (p.income ?? 0),
          expenses: acc.expenses + (p.expenses ?? 0),
        }),
        { income: 0, expenses: 0 },
      ),
    [series],
  );

  const hasData = series.some((p) => (p.income ?? 0) !== 0 || (p.expenses ?? 0) !== 0);
  const hasPreviousData = compare && series.some((p) => p.previous && (p.previous.income !== 0 || p.previous.expenses !== 0));

  const layout = useMemo(() => {
    if (width === 0 || series.length === 0) return null;
    const plotWidth = Math.max(40, width - MARGIN.left - MARGIN.right);
    const band = plotWidth / series.length;
    const barWidth = Math.max(2, Math.min(MAX_BAR, (band * 0.72 - BAR_GAP) / 2));

    let maxValue = 0;
    for (const p of series) {
      maxValue = Math.max(maxValue, p.income ?? 0, p.expenses ?? 0);
      if (compare && p.previous) maxValue = Math.max(maxValue, p.previous.income, p.previous.expenses);
    }
    const step = niceStep(Math.max(maxValue, 1) / 4);
    const top = Math.ceil(Math.max(maxValue, 1) / step) * step;
    const ticks: number[] = [];
    for (let v = 0; v <= top + step / 2; v += step) ticks.push(v);

    const y = (v: number) => MARGIN.top + PLOT_HEIGHT - (Math.max(0, v) / top) * PLOT_HEIGHT;
    const maxLabels = Math.max(2, Math.floor(plotWidth / 48));
    const labelEvery = Math.ceil(series.length / maxLabels);

    return { plotWidth, band, barWidth, ticks, y, labelEvery };
  }, [width, series, compare]);

  const lastWithData = useMemo(() => {
    for (let i = series.length - 1; i >= 0; i--) if (series[i].income !== null) return i;
    return 0;
  }, [series]);

  function onKeyDown(e: React.KeyboardEvent) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return;
    e.preventDefault();
    setActive((current) => {
      const at = current ?? lastWithData;
      if (e.key === "Home") return 0;
      if (e.key === "End") return series.length - 1;
      return Math.min(series.length - 1, Math.max(0, at + (e.key === "ArrowRight" ? 1 : -1)));
    });
  }

  const activePoint = active !== null ? series[active] : null;
  const height = MARGIN.top + PLOT_HEIGHT + AXIS_BAND;

  return (
    <div>
      {/* Header: title, legend (with period totals), view controls */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-semibold text-foreground">Income vs. expenses</h2>
          <ul className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs" aria-label="Legend">
            <li className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-[3px] bg-series-income" aria-hidden="true" />
              <span className="text-muted-foreground">Income</span>
              <span className="font-semibold text-foreground">{money.format(totals.income)}</span>
            </li>
            <li className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-[3px] bg-series-expense" aria-hidden="true" />
              <span className="text-muted-foreground">Expenses</span>
              <span className="font-semibold text-foreground">{money.format(totals.expenses)}</span>
            </li>
            {compare && (
              <li className="flex items-center gap-1.5">
                <span className="h-0.5 w-3.5 rounded-full bg-foreground/70" aria-hidden="true" />
                <span className="text-muted-foreground">Previous period</span>
              </li>
            )}
          </ul>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {granularityOptions.length > 1 && (
            <div role="group" aria-label="Group by" className="flex items-center rounded-full bg-muted p-0.5">
              {granularityOptions.map((g) => (
                <button
                  key={g}
                  type="button"
                  aria-pressed={g === granularity}
                  onClick={() => onGranularityChange(g)}
                  className={`cursor-pointer rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors duration-200 ${
                    g === granularity ? "bg-card text-foreground shadow-soft-sm" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {GRANULARITY_LABEL[g]}
                </button>
              ))}
            </div>
          )}
          <label className="flex cursor-pointer items-center gap-2 rounded-full border border-border px-3 py-1 text-[11px] font-medium text-foreground transition-colors duration-200 hover:bg-muted">
            <input
              type="checkbox"
              checked={compare}
              onChange={(e) => onCompareChange(e.target.checked)}
              className="size-3.5 accent-primary"
            />
            Compare to previous period
          </label>
          <button
            type="button"
            onClick={() => setView((v) => (v === "chart" ? "table" : "chart"))}
            className="cursor-pointer rounded-full border border-border px-3 py-1 text-[11px] font-medium text-foreground transition-colors duration-200 hover:bg-muted"
          >
            {view === "chart" ? "View as table" : "View as chart"}
          </button>
        </div>
      </div>

      {view === "table" ? (
        <div className="mt-4 max-h-[300px] overflow-auto rounded-xl border border-border/70">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-card">
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="px-3 py-2 font-medium">Period</th>
                <th className="px-3 py-2 text-right font-medium">Income</th>
                <th className="px-3 py-2 text-right font-medium">Expenses</th>
                <th className="px-3 py-2 text-right font-medium">Net</th>
                {compare && <th className="px-3 py-2 text-right font-medium">Prev. income</th>}
                {compare && <th className="px-3 py-2 text-right font-medium">Prev. expenses</th>}
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {series.map((p) => (
                <tr key={p.start} className="border-b border-border/50 last:border-0">
                  <td className="px-3 py-1.5 text-foreground">{formatDateRange(p.start, p.end)}</td>
                  <td className="px-3 py-1.5 text-right">{p.income === null ? "—" : money.format(p.income)}</td>
                  <td className="px-3 py-1.5 text-right">{p.expenses === null ? "—" : money.format(p.expenses)}</td>
                  <td className="px-3 py-1.5 text-right">
                    {p.income === null || p.expenses === null ? "—" : money.format(p.income - p.expenses)}
                  </td>
                  {compare && <td className="px-3 py-1.5 text-right text-muted-foreground">{p.previous ? money.format(p.previous.income) : "—"}</td>}
                  {compare && (
                    <td className="px-3 py-1.5 text-right text-muted-foreground">{p.previous ? money.format(p.previous.expenses) : "—"}</td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div ref={setContainer} className="relative mt-4" style={{ height }}>
          {!hasData && !hasPreviousData ? (
            <div className="flex h-full items-center justify-center rounded-xl bg-muted/30 text-xs text-muted-foreground">
              No income or expenses recorded in this period yet.
            </div>
          ) : layout ? (
            <>
              <div
                role="group"
                tabIndex={0}
                aria-label="Income and expenses by period. Use the left and right arrow keys to read each period."
                onKeyDown={onKeyDown}
                onFocus={() => setActive((a) => a ?? lastWithData)}
                onBlur={() => setActive(null)}
                className="rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <svg width={width} height={height} className="block overflow-visible" aria-hidden="true">
                  {/* recessive hairline grid + y ticks */}
                  {layout.ticks.map((t) => (
                    <g key={t}>
                      <line
                        x1={MARGIN.left}
                        x2={width - MARGIN.right}
                        y1={layout.y(t)}
                        y2={layout.y(t)}
                        stroke={t === 0 ? "var(--muted-foreground)" : "var(--border)"}
                        strokeOpacity={t === 0 ? 0.45 : 1}
                        strokeWidth={1}
                        shapeRendering="crispEdges"
                      />
                      <text
                        x={MARGIN.left - 8}
                        y={layout.y(t)}
                        dy="0.32em"
                        textAnchor="end"
                        className="fill-muted-foreground text-[10px] tabular-nums"
                      >
                        {compactMoney.format(t)}
                      </text>
                    </g>
                  ))}

                  {series.map((p, i) => {
                    const cx = MARGIN.left + layout.band * (i + 0.5);
                    const incomeX = cx - BAR_GAP / 2 - layout.barWidth;
                    const expenseX = cx + BAR_GAP / 2;
                    const baseline = layout.y(0);
                    const incomeY = layout.y(p.income ?? 0);
                    const expenseY = layout.y(p.expenses ?? 0);
                    const isActive = active === i;
                    return (
                      <g key={p.start}>
                        {isActive && (
                          <rect
                            x={MARGIN.left + layout.band * i}
                            y={MARGIN.top}
                            width={layout.band}
                            height={PLOT_HEIGHT}
                            rx={6}
                            className="fill-muted"
                            opacity={0.6}
                          />
                        )}
                        {p.income !== null && (
                          <path d={columnPath(incomeX, incomeY, layout.barWidth, baseline - incomeY)} fill="var(--series-income)" />
                        )}
                        {p.expenses !== null && (
                          <path d={columnPath(expenseX, expenseY, layout.barWidth, baseline - expenseY)} fill="var(--series-expense)" />
                        )}
                        {compare && p.previous && (
                          <>
                            {[
                              { x: incomeX, v: p.previous.income },
                              { x: expenseX, v: p.previous.expenses },
                            ].map((m, k) => (
                              <g key={k}>
                                {/* surface halo keeps the marker legible where it crosses a column */}
                                <line
                                  x1={m.x - 2}
                                  x2={m.x + layout.barWidth + 2}
                                  y1={layout.y(m.v)}
                                  y2={layout.y(m.v)}
                                  stroke="var(--card)"
                                  strokeWidth={5}
                                  strokeLinecap="round"
                                />
                                <line
                                  x1={m.x - 2}
                                  x2={m.x + layout.barWidth + 2}
                                  y1={layout.y(m.v)}
                                  y2={layout.y(m.v)}
                                  stroke="var(--foreground)"
                                  strokeOpacity={0.7}
                                  strokeWidth={2}
                                  strokeLinecap="round"
                                />
                              </g>
                            ))}
                          </>
                        )}
                        {i % layout.labelEvery === 0 && (
                          <text
                            x={cx}
                            y={MARGIN.top + PLOT_HEIGHT + 18}
                            textAnchor="middle"
                            className="fill-muted-foreground text-[10px]"
                          >
                            {p.label}
                          </text>
                        )}
                        {/* hit target: the whole band, bigger than the marks */}
                        <rect
                          x={MARGIN.left + layout.band * i}
                          y={MARGIN.top}
                          width={layout.band}
                          height={PLOT_HEIGHT + AXIS_BAND}
                          fill="transparent"
                          onPointerEnter={() => setActive(i)}
                          onPointerLeave={() => setActive((a) => (a === i ? null : a))}
                        />
                      </g>
                    );
                  })}
                </svg>
              </div>

              {activePoint && active !== null && (
                <div
                  className="pointer-events-none absolute top-1 z-10 w-52 rounded-xl border border-border bg-popover p-3 text-xs shadow-soft"
                  style={{
                    left: Math.min(
                      Math.max(0, MARGIN.left + layout.band * (active + 0.5) - 104),
                      Math.max(0, width - 208),
                    ),
                  }}
                  aria-live="polite"
                >
                  <p className="font-medium text-foreground">{formatDateRange(activePoint.start, activePoint.end)}</p>
                  {activePoint.income === null ? (
                    <p className="mt-1.5 text-muted-foreground">Still to come.</p>
                  ) : (
                    <ul className="mt-2 space-y-1.5">
                      {[
                        { key: "Income", value: activePoint.income, prev: activePoint.previous?.income, swatch: "bg-series-income" },
                        { key: "Expenses", value: activePoint.expenses ?? 0, prev: activePoint.previous?.expenses, swatch: "bg-series-expense" },
                      ].map((row) => (
                        <li key={row.key} className="flex items-center gap-2">
                          <span className={`h-0.5 w-3 rounded-full ${row.swatch}`} aria-hidden="true" />
                          <span className="text-muted-foreground">{row.key}</span>
                          <span className="ml-auto font-semibold tabular-nums text-foreground">{money.format(row.value)}</span>
                        </li>
                      ))}
                      <li className="flex items-center gap-2 border-t border-border/70 pt-1.5">
                        <span className="w-3" aria-hidden="true" />
                        <span className="text-muted-foreground">Net</span>
                        <span className="ml-auto font-semibold tabular-nums text-foreground">
                          {money.format(activePoint.income - (activePoint.expenses ?? 0))}
                        </span>
                      </li>
                    </ul>
                  )}
                  {compare && activePoint.previous && (
                    <div className="mt-2 border-t border-border/70 pt-2">
                      <p className="text-[10.5px] text-muted-foreground">
                        Previous: {formatDateRange(activePoint.previous.start, activePoint.previous.end)}
                      </p>
                      <ul className="mt-1 space-y-1">
                        <li className="flex items-center gap-2">
                          <span className="text-muted-foreground">Income</span>
                          <span className="ml-auto tabular-nums text-foreground">{money.format(activePoint.previous.income)}</span>
                          {activePoint.income !== null && <Change current={activePoint.income} previous={activePoint.previous.income} />}
                        </li>
                        <li className="flex items-center gap-2">
                          <span className="text-muted-foreground">Expenses</span>
                          <span className="ml-auto tabular-nums text-foreground">{money.format(activePoint.previous.expenses)}</span>
                          {activePoint.expenses !== null && (
                            <Change current={activePoint.expenses} previous={activePoint.previous.expenses} />
                          )}
                        </li>
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </>
          ) : null}
        </div>
      )}
    </div>
  );
}
