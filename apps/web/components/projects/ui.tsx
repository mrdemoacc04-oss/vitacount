import Link from "next/link";
import { cn } from "@/lib/utils";
import { Icons } from "@/components/icons";
import { PROJECT_STATUS_LABEL, PROJECT_STATUS_STYLE, budgetBarClass, isProjectStatus } from "@/components/projects/shared";

export const badgeClass = "inline-flex whitespace-nowrap rounded-md px-1.5 py-0.5 text-[11px] font-medium";

export function ProjectStatusBadge({ status }: { status: string }) {
  if (!isProjectStatus(status)) return <span className={cn(badgeClass, "bg-muted text-muted-foreground")}>{status}</span>;
  return <span className={cn(badgeClass, PROJECT_STATUS_STYLE[status])}>{PROJECT_STATUS_LABEL[status]}</span>;
}

export const primaryButtonClass =
  "inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-primary px-3.5 text-[13px] font-medium text-primary-foreground shadow-soft-sm transition-colors hover:bg-primary/90";

export function PageHeader({ title, description, action }: { title: React.ReactNode; description: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      {action}
    </div>
  );
}

export interface Kpi {
  label: string;
  value: string;
  tone?: "default" | "positive" | "destructive" | "warning";
  note?: React.ReactNode;
}

/** One surface, several readings, separated by hairlines (the dashboard's KPI strip). */
export function KpiStrip({ items, label }: { items: Kpi[]; label: string }) {
  const cols = items.length === 5 ? "lg:grid-cols-5" : "lg:grid-cols-4";
  return (
    <section
      aria-label={label}
      className={cn(
        "grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border",
        cols,
      )}
    >
      {items.map((k, i) => (
        <div key={k.label} className={cn("flex flex-col gap-2.5 bg-card p-5", items.length % 2 === 1 && i === items.length - 1 && "col-span-2 lg:col-span-1")}>
          <span className="text-[13px] text-muted-foreground">{k.label}</span>
          <span
            className={cn(
              "font-heading text-[22px] font-semibold leading-none tracking-tight tabular-nums md:text-[26px]",
              k.tone === "positive" && "text-positive",
              k.tone === "destructive" && "text-destructive",
              k.tone === "warning" && "text-warning",
              (!k.tone || k.tone === "default") && "text-foreground",
            )}
          >
            {k.value}
          </span>
          {k.note && <span className="text-xs text-muted-foreground">{k.note}</span>}
        </div>
      ))}
    </section>
  );
}

/** Thin progress bar for costs ÷ budget: primary, warning past 80%, destructive past 100%. */
export function BudgetBar({ used, className }: { used: number; className?: string }) {
  const width = Math.min(Math.max(used, 0), 1) * 100;
  return (
    <div
      className={cn("h-1.5 overflow-hidden rounded-full bg-muted", className)}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(used * 100)}
      aria-label="Budget used"
    >
      <div className={cn("h-full rounded-full", budgetBarClass(used))} style={{ width: `${width}%` }} />
    </div>
  );
}

export function PanelHeader({ title, count, description, action }: { title: string; count?: number; description?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 className="flex items-center gap-2 text-[15px] font-semibold text-foreground">
          {title}
          {count !== undefined && count > 0 && <span className="rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground tabular-nums">{count}</span>}
        </h2>
        {description && <p className="mt-0.5 text-[13px] text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function EmptyNote({ children, action }: { children: React.ReactNode; action?: { href: string; label: string } }) {
  return (
    <div className="flex flex-col items-start gap-2 rounded-lg border border-dashed border-border px-4 py-5">
      <p className="text-[13px] text-muted-foreground">{children}</p>
      {action && (
        <Link href={action.href} className="group inline-flex items-center gap-1 text-[13px] font-medium text-primary underline-offset-4 hover:underline">
          {action.label}
          <Icons.arrowRight className="size-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
        </Link>
      )}
    </div>
  );
}
