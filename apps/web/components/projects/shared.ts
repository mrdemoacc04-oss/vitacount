/**
 * Project constants and formatting shared by the server pages, the client
 * controls and the server actions. Kept free of server-only imports so client
 * components can use it.
 */

export const PROJECT_STATUSES = ["active", "on_hold", "completed", "cancelled"] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export function isProjectStatus(value: unknown): value is ProjectStatus {
  return typeof value === "string" && (PROJECT_STATUSES as readonly string[]).includes(value);
}

export const PROJECT_STATUS_LABEL: Record<ProjectStatus, string> = {
  active: "Active",
  on_hold: "On hold",
  completed: "Completed",
  cancelled: "Cancelled",
};

export const PROJECT_STATUS_STYLE: Record<ProjectStatus, string> = {
  active: "bg-primary/10 text-primary",
  on_hold: "bg-warning/12 text-warning",
  completed: "bg-positive/12 text-positive",
  cancelled: "bg-muted text-muted-foreground",
};

export function projectStatusLabel(status: string): string {
  return isProjectStatus(status) ? PROJECT_STATUS_LABEL[status] : status;
}

export type DocumentKind = "sales" | "purchase" | "expense";

export const currency = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD" });

export const currencyWhole = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

/** 0.234 -> "23.4%" */
export const percent = (ratio: number) => `${(ratio * 100).toFixed(Math.abs(ratio) >= 1 ? 0 : 1)}%`;

/** Profit as a share of revenue; null when there is no revenue to measure against. */
export function marginOf(revenue: number, profit: number): number | null {
  return revenue > 0 ? profit / revenue : null;
}

/** Costs as a share of budget (unclamped, can exceed 1); null without a budget. */
export function budgetUsedOf(budget: number | null, costs: number): number | null {
  return budget !== null && budget > 0 ? Math.max(costs, 0) / budget : null;
}

/** Bar color for a budget-used ratio: warning past 80%, destructive past 100%. */
export function budgetBarClass(used: number): string {
  if (used > 1) return "bg-destructive";
  if (used > 0.8) return "bg-warning";
  return "bg-primary";
}
