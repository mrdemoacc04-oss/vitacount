import Link from "next/link";
import { redirect } from "next/navigation";
import { loadTenantContext } from "@/lib/tenant/data";
import { listProjects, type ProjectListItem } from "@/lib/projects";
import { formatDate } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { Icons } from "@/components/icons";
import { SchemaNotice } from "@/components/schema-notice";
import { ProjectSearch } from "@/components/projects/project-search";
import { RowLink } from "@/components/projects/row-link";
import { BudgetBar, KpiStrip, PageHeader, ProjectStatusBadge, primaryButtonClass } from "@/components/projects/ui";
import { PROJECT_STATUSES, PROJECT_STATUS_LABEL, currency, currencyWhole, isProjectStatus, marginOf, percent, type ProjectStatus } from "@/components/projects/shared";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

const DESCRIPTION = "Profit per job: revenue, costs and budget for the work you do for customers.";

function NewProjectButton() {
  return (
    <Link href="/projects/new" className={primaryButtonClass}>
      <Icons.plus className="size-4" />
      New project
    </Link>
  );
}

function matches(project: ProjectListItem, query: string) {
  const q = query.toLowerCase();
  return [project.name, project.code, project.customerName].some((field) => field?.toLowerCase().includes(q));
}

export default async function ProjectsPage({ searchParams }: { searchParams: SearchParams }) {
  const { activeTenantId } = await loadTenantContext();
  if (!activeTenantId) redirect("/onboarding");

  const params = await searchParams;
  const statusParam = first(params.status);
  const status: ProjectStatus | "all" = isProjectStatus(statusParam) ? statusParam : "all";
  const query = (first(params.q) ?? "").trim();

  const result = await listProjects(activeTenantId);
  if (result.missingSchema) {
    return (
      <div className="mx-auto flex max-w-[1280px] flex-col gap-6">
        <PageHeader title="Projects" description={DESCRIPTION} />
        <SchemaNotice feature="Projects" />
      </div>
    );
  }

  const { projects } = result;

  if (projects.length === 0) {
    return (
      <div className="mx-auto flex max-w-[1280px] flex-col gap-6">
        <PageHeader title="Projects" description={DESCRIPTION} action={<NewProjectButton />} />
        <section className="flex flex-col items-center rounded-xl border border-border bg-card px-6 py-14 text-center">
          <span className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Icons.projects className="size-[22px]" />
          </span>
          <h2 className="mt-4 text-[15px] font-semibold text-foreground">Track profit per job</h2>
          <p className="mt-1.5 max-w-md text-[13px] leading-relaxed text-muted-foreground">
            Create a project for each job, then tag its invoices, bills and expenses to it. You&apos;ll see revenue, costs and margin
            per project, and how much of its budget is already spent.
          </p>
          <div className="mt-5">
            <NewProjectButton />
          </div>
        </section>
      </div>
    );
  }

  // KPIs describe the whole workspace, independent of the filters below.
  const active = projects.filter((p) => p.status === "active");
  const activeBudget = active.reduce((sum, p) => sum + (p.budget ?? 0), 0);
  const activeBudgetedCosts = active.reduce((sum, p) => sum + (p.budget ? p.costs : 0), 0);
  const revenue = projects.reduce((sum, p) => sum + p.revenue, 0);
  const profit = projects.reduce((sum, p) => sum + p.profit, 0);
  const receivable = projects.reduce((sum, p) => sum + p.receivable, 0);
  const blendedMargin = marginOf(revenue, profit);
  const onHold = projects.filter((p) => p.status === "on_hold").length;
  const completed = projects.filter((p) => p.status === "completed").length;

  const kpis = [
    {
      label: "Active projects",
      value: String(active.length),
      note: [onHold && `${onHold} on hold`, completed && `${completed} completed`].filter(Boolean).join(" · ") || `${projects.length} in total`,
    },
    {
      label: "Total budget (active)",
      value: currencyWhole(activeBudget),
      note: activeBudget > 0 ? `${percent(activeBudgetedCosts / activeBudget)} spent so far` : "No budgets set on active projects",
    },
    {
      label: "Revenue to date",
      value: currencyWhole(revenue),
      note: receivable > 0 ? `${currencyWhole(receivable)} still to collect` : "All project invoices collected",
    },
    {
      label: "Profit to date",
      value: currencyWhole(profit),
      tone: profit < 0 ? ("destructive" as const) : ("default" as const),
      note: blendedMargin === null ? "No revenue yet" : `${percent(blendedMargin)} blended margin`,
    },
  ];

  const counts: Record<ProjectStatus | "all", number> = {
    all: projects.length,
    active: active.length,
    on_hold: onHold,
    completed,
    cancelled: projects.filter((p) => p.status === "cancelled").length,
  };

  const visible = projects.filter((p) => (status === "all" || p.status === status) && (!query || matches(p, query)));

  const tabHref = (value: ProjectStatus | "all", q = query) => {
    const next = new URLSearchParams();
    if (value !== "all") next.set("status", value);
    if (q) next.set("q", q);
    const qs = next.toString();
    return qs ? `/projects?${qs}` : "/projects";
  };

  return (
    <div className="mx-auto flex max-w-[1280px] flex-col gap-6">
      <PageHeader title="Projects" description={DESCRIPTION} action={<NewProjectButton />} />

      <KpiStrip label="Project totals" items={kpis} />

      <section className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
          <nav aria-label="Filter by status" className="-mx-1 flex flex-wrap gap-1">
            {(["all", ...PROJECT_STATUSES] as const).map((value) => {
              const selected = status === value;
              return (
                <Link
                  key={value}
                  href={tabHref(value)}
                  scroll={false}
                  aria-current={selected ? "page" : undefined}
                  className={cn(
                    "inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[13px] font-medium transition-colors",
                    selected ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  {value === "all" ? "All" : PROJECT_STATUS_LABEL[value]}
                  <span className={cn("text-xs tabular-nums", selected ? "text-primary/80" : "text-muted-foreground/80")}>{counts[value]}</span>
                </Link>
              );
            })}
          </nav>
          <ProjectSearch initialQuery={query} status={status === "all" ? null : status} />
        </div>

        {visible.length === 0 ? (
          <div className="px-4 py-12 text-center">
            <p className="text-[13px] text-muted-foreground">
              {query
                ? `No ${status === "all" ? "" : `${PROJECT_STATUS_LABEL[status].toLowerCase()} `}projects match “${query}”.`
                : `No ${PROJECT_STATUS_LABEL[status as ProjectStatus].toLowerCase()} projects.`}
            </p>
            <Link href={query ? tabHref(status, "") : "/projects"} className="mt-2 inline-block text-[13px] font-medium text-primary underline-offset-4 hover:underline">
              {query ? "Clear search" : "Show all projects"}
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-[13px]">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="px-4 py-2.5 font-medium">Project</th>
                  <th className="px-3 py-2.5 font-medium">Status</th>
                  <th className="px-3 py-2.5 text-right font-medium">Budget</th>
                  <th className="px-3 py-2.5 text-right font-medium">Revenue</th>
                  <th className="px-3 py-2.5 text-right font-medium">Costs</th>
                  <th className="px-3 py-2.5 text-right font-medium">Profit</th>
                  <th className="w-40 px-3 py-2.5 font-medium">Budget used</th>
                  <th className="px-4 py-2.5 text-right font-medium">Ends</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {visible.map((p) => (
                  <RowLink key={p.id} href={`/projects/${p.id}`}>
                    <td className="max-w-72 px-4 py-3">
                      <Link href={`/projects/${p.id}`} className="block truncate font-medium text-foreground hover:text-primary">
                        {p.name}
                      </Link>
                      <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                        {[p.code, p.customerName].filter(Boolean).join(" · ") || "No customer"}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <ProjectStatusBadge status={p.status} />
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums text-muted-foreground">{p.budget === null ? "—" : currency(p.budget)}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{currency(p.revenue)}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{currency(p.costs)}</td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      <span className={cn("block", p.profit < 0 ? "text-destructive" : "text-foreground")}>{currency(p.profit)}</span>
                      {p.margin !== null && (
                        <span className={cn("block text-xs", p.margin < 0 ? "text-destructive" : "text-muted-foreground")}>{percent(p.margin)} margin</span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      {p.budgetUsed === null ? (
                        <span className="text-xs text-muted-foreground">No budget</span>
                      ) : (
                        <div className="flex items-center gap-2">
                          <BudgetBar used={p.budgetUsed} className="flex-1" />
                          <span
                            className={cn(
                              "w-10 shrink-0 text-right text-xs tabular-nums",
                              p.budgetUsed > 1 ? "text-destructive" : p.budgetUsed > 0.8 ? "text-warning" : "text-muted-foreground",
                            )}
                          >
                            {Math.round(p.budgetUsed * 100)}%
                          </span>
                        </div>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right text-muted-foreground">{p.endDate ? formatDate(p.endDate) : "—"}</td>
                  </RowLink>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
