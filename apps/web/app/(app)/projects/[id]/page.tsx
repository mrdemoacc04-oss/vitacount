import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { loadTenantContext } from "@/lib/tenant/data";
import { getProject, getProjectActivity, getTaggableDocuments } from "@/lib/projects";
import { formatDate, formatDateRange, todayISO } from "@/lib/dates";
import { PURCHASE_STATUS_STYLE, SALES_STATUS_STYLE, purchaseStatusLabel, salesDocumentConfig, salesStatusLabel } from "@/lib/documents";
import { cn } from "@/lib/utils";
import { Icons } from "@/components/icons";
import { BezelCard } from "@/components/bezel-card";
import { secondaryButtonClass } from "@/components/ui/field";
import { SchemaNotice } from "@/components/schema-notice";
import { RowLink } from "@/components/projects/row-link";
import { DeleteProjectButton, ProjectStatusControl } from "@/components/projects/project-actions";
import { AddExistingDocuments, RemoveTagButton } from "@/components/projects/tag-controls";
import { BudgetBar, EmptyNote, KpiStrip, PageHeader, PanelHeader, badgeClass, type Kpi } from "@/components/projects/ui";
import { currency, percent } from "@/components/projects/shared";

const signed = (n: number) => (n < 0 ? `−${currency(-n)}` : currency(n));

function scheduleLabel(start: string | null, end: string | null): string | null {
  if (start && end) return formatDateRange(start, end);
  if (start) return `${start > todayISO() ? "Starts" : "Started"} ${formatDate(start)}`;
  if (end) return `Ends ${formatDate(end)}`;
  return null;
}

const th = "px-3 py-2 font-medium first:pl-0 last:pr-0";
const td = "px-3 py-2.5 first:pl-0 last:pr-0";

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { activeTenantId, role } = await loadTenantContext();
  if (!activeTenantId) redirect("/onboarding");

  const result = await getProject(activeTenantId, id);
  if (result.missingSchema) {
    return (
      <div className="mx-auto flex max-w-[1280px] flex-col gap-6">
        <PageHeader title="Project" description="Revenue, costs and budget for one job." />
        <SchemaNotice feature="Projects" />
      </div>
    );
  }
  const { project } = result;
  if (!project) notFound();

  const [activity, taggable] = await Promise.all([
    getProjectActivity(activeTenantId, project.id),
    getTaggableDocuments(activeTenantId, project.customerId),
  ]);

  const isAdmin = role === "owner" || role === "admin";
  const customer = project.customerId ? { id: project.customerId, name: project.customerName ?? "This customer" } : null;
  const schedule = scheduleLabel(project.startDate, project.endDate);
  const meta = [project.code, project.customerName, schedule].filter(Boolean);

  const purchaseCosts = activity.purchases.filter((d) => d.counts).reduce((s, d) => s + d.amount, 0);
  const expenseCosts = activity.expenses.filter((d) => d.counts).reduce((s, d) => s + d.amount, 0);
  const stockCosts = activity.stock.reduce((s, l) => s + l.cost, 0);
  const openInvoices = activity.sales.filter((d) => d.counts && d.balanceDue > 0 && (d.documentType === "invoice" || d.documentType === "debit_note"));

  const remaining = project.budget === null ? null : project.budget - project.costs;
  const kpis: Kpi[] = [
    { label: "Revenue", value: currency(project.revenue), note: "Pre-tax, net of refunds" },
    { label: "Costs", value: currency(project.costs), note: "Bills, expenses and stock" },
    {
      label: "Profit",
      value: currency(project.profit),
      tone: project.profit < 0 ? "destructive" : "default",
      note: project.margin === null ? "No revenue yet" : `${percent(project.margin)} margin`,
    },
    remaining === null
      ? {
          label: "Budget remaining",
          value: "—",
          note: (
            <Link href={`/projects/${project.id}/edit`} className="text-primary underline-offset-4 hover:underline">
              Set a budget
            </Link>
          ),
        }
      : {
          label: "Budget remaining",
          value: signed(remaining),
          tone: remaining < 0 ? "destructive" : project.budgetUsed !== null && project.budgetUsed > 0.8 ? "warning" : "default",
          note: remaining < 0 ? `Over a ${currency(project.budget ?? 0)} budget` : `Of ${currency(project.budget ?? 0)}`,
        },
    {
      label: "Receivable",
      value: currency(project.receivable),
      note: openInvoices.length ? `${openInvoices.length} unpaid ${openInvoices.length === 1 ? "invoice" : "invoices"}` : "Nothing outstanding",
    },
  ];

  const uncountedSales = activity.sales.some((d) => !d.counts);

  return (
    <div className="mx-auto flex max-w-[1280px] flex-col gap-6">
      <div>
        <Link href="/projects" className="inline-flex items-center gap-1 text-[13px] text-muted-foreground transition-colors hover:text-foreground">
          <Icons.chevronRight className="size-3.5 rotate-180" />
          Projects
        </Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <h1 className="font-heading text-2xl font-semibold tracking-tight">{project.name}</h1>
              <ProjectStatusControl tenantId={activeTenantId} projectId={project.id} status={project.status} />
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{meta.length ? meta.join(" · ") : "No customer or schedule yet"}</p>
            {project.description && <p className="mt-2 max-w-2xl whitespace-pre-line text-[13px] leading-relaxed text-foreground/80">{project.description}</p>}
          </div>
          <div className="flex flex-wrap items-start justify-end gap-2">
            <Link href={`/projects/${project.id}/edit`} className={secondaryButtonClass}>
              Edit
            </Link>
            {isAdmin && <DeleteProjectButton tenantId={activeTenantId} projectId={project.id} projectName={project.name} />}
          </div>
        </div>
      </div>

      <KpiStrip label="Project figures" items={kpis} />

      <BezelCard>
        <PanelHeader
          title="Budget"
          description={
            project.budget === null
              ? "No budget set. Add one to see how much of it the costs have used."
              : project.budgetUsed !== null && project.budgetUsed > 1
                ? `Over budget by ${currency(project.costs - project.budget)}.`
                : `${currency(project.costs)} of ${currency(project.budget)} spent.`
          }
          action={
            project.budgetUsed !== null ? (
              <span
                className={cn(
                  "font-heading text-xl font-semibold tabular-nums",
                  project.budgetUsed > 1 ? "text-destructive" : project.budgetUsed > 0.8 ? "text-warning" : "text-foreground",
                )}
              >
                {Math.round(project.budgetUsed * 100)}%
              </span>
            ) : undefined
          }
        />
        {project.budgetUsed !== null && <BudgetBar used={project.budgetUsed} className="mt-4 h-2" />}
        <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-2 border-t border-border pt-4 text-[13px] sm:grid-cols-3">
          {[
            { label: "Bills and supplier credits", value: purchaseCosts },
            { label: "Expenses", value: expenseCosts },
            { label: "Stock used", value: stockCosts },
          ].map((row) => (
            <div key={row.label} className="flex items-baseline justify-between gap-3 sm:flex-col sm:items-start sm:gap-0.5">
              <dt className="text-muted-foreground">{row.label}</dt>
              <dd className="font-medium tabular-nums text-foreground">{signed(row.value)}</dd>
            </div>
          ))}
        </dl>
      </BezelCard>

      {/* Sales */}
      <BezelCard>
        <PanelHeader
          title="Sales"
          count={activity.sales.length}
          description="Invoices, sales receipts, refunds and debit notes tagged to this project."
          action={<AddExistingDocuments tenantId={activeTenantId} projectId={project.id} kind="sales" candidates={taggable.sales} customer={customer} />}
        />
        <div className="mt-4">
          {activity.sales.length === 0 ? (
            <EmptyNote action={{ href: `/sales/new?type=invoice&project=${project.id}`, label: "Create an invoice" }}>
              No sales yet. Choose this project when you create an invoice, or use Add existing to tag one you&apos;ve already sent.
            </EmptyNote>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] text-[13px]">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className={th}>Number</th>
                    <th className={th}>Type</th>
                    <th className={th}>Customer</th>
                    <th className={th}>Date</th>
                    <th className={th}>Status</th>
                    <th className={cn(th, "text-right")}>Amount</th>
                    <th className={cn(th, "w-10")}>
                      <span className="sr-only">Remove</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {activity.sales.map((d) => (
                    <RowLink key={d.id} href={`/sales/${d.id}`}>
                      <td className={td}>
                        <Link href={`/sales/${d.id}`} className="font-medium text-foreground hover:text-primary">
                          {d.number}
                        </Link>
                      </td>
                      <td className={cn(td, "text-muted-foreground")}>{salesDocumentConfig(d.documentType).label}</td>
                      <td className={cn(td, "max-w-48 truncate")}>{d.customerName ?? "—"}</td>
                      <td className={cn(td, "whitespace-nowrap text-muted-foreground")}>{formatDate(d.issueDate)}</td>
                      <td className={td}>
                        <span className={cn(badgeClass, SALES_STATUS_STYLE[d.status] ?? "bg-muted text-muted-foreground")}>
                          {salesStatusLabel(d.documentType, d.status)}
                        </span>
                      </td>
                      <td className={cn(td, "text-right tabular-nums", !d.counts && "text-muted-foreground line-through decoration-muted-foreground/50")}>
                        {signed(d.amount)}
                      </td>
                      <td className={cn(td, "text-right")}>
                        <RemoveTagButton tenantId={activeTenantId} projectId={project.id} kind="sales" documentId={d.id} label={d.number} />
                      </td>
                    </RowLink>
                  ))}
                </tbody>
              </table>
              <p className="mt-3 text-xs text-muted-foreground">
                Amounts are before tax.{uncountedSales ? " Drafts and voided documents are listed but don't count toward revenue." : ""}
              </p>
            </div>
          )}
        </div>
      </BezelCard>

      {/* Purchases */}
      <BezelCard>
        <PanelHeader
          title="Purchases"
          count={activity.purchases.length}
          description="Supplier bills and credits tagged to this project."
          action={<AddExistingDocuments tenantId={activeTenantId} projectId={project.id} kind="purchase" candidates={taggable.purchases} />}
        />
        <div className="mt-4">
          {activity.purchases.length === 0 ? (
            <EmptyNote action={{ href: `/expenses/new?type=bill&project=${project.id}`, label: "Record a bill" }}>
              No purchases yet. Choose this project when you record a supplier bill or credit, or use Add existing to tag one.
            </EmptyNote>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] text-[13px]">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className={th}>Number</th>
                    <th className={th}>Type</th>
                    <th className={th}>Supplier</th>
                    <th className={th}>Date</th>
                    <th className={th}>Status</th>
                    <th className={cn(th, "text-right")}>Amount</th>
                    <th className={cn(th, "w-10")}>
                      <span className="sr-only">Remove</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {activity.purchases.map((d) => {
                    const isCredit = d.documentType === "vendor_credit";
                    const label = d.number ?? (isCredit ? "Supplier credit" : "Bill");
                    return (
                      <RowLink key={d.id} href={`/expenses/${d.id}`}>
                        <td className={td}>
                          <Link href={`/expenses/${d.id}`} className="font-medium text-foreground hover:text-primary">
                            {label}
                          </Link>
                        </td>
                        <td className={cn(td, "text-muted-foreground")}>{isCredit ? "Supplier credit" : "Bill"}</td>
                        <td className={cn(td, "max-w-48 truncate")}>{d.vendorName ?? "—"}</td>
                        <td className={cn(td, "whitespace-nowrap text-muted-foreground")}>{formatDate(d.issueDate)}</td>
                        <td className={td}>
                          <span className={cn(badgeClass, PURCHASE_STATUS_STYLE[d.status] ?? "bg-muted text-muted-foreground")}>
                            {purchaseStatusLabel(d.documentType, d.status)}
                          </span>
                        </td>
                        <td className={cn(td, "text-right tabular-nums", !d.counts && "text-muted-foreground line-through decoration-muted-foreground/50")}>
                          {signed(d.amount)}
                        </td>
                        <td className={cn(td, "text-right")}>
                          <RemoveTagButton tenantId={activeTenantId} projectId={project.id} kind="purchase" documentId={d.id} label={label} />
                        </td>
                      </RowLink>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </BezelCard>

      {/* Expenses */}
      <BezelCard>
        <PanelHeader
          title="Expenses"
          count={activity.expenses.length}
          description="Paid expenses tagged to this project."
          action={<AddExistingDocuments tenantId={activeTenantId} projectId={project.id} kind="expense" candidates={taggable.expenses} />}
        />
        <div className="mt-4">
          {activity.expenses.length === 0 ? (
            <EmptyNote action={{ href: `/expenses/new?type=expense&project=${project.id}`, label: "Record an expense" }}>
              No expenses yet. Choose this project when you record an expense, or use Add existing to tag one.
            </EmptyNote>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px] text-[13px]">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className={th}>Date</th>
                    <th className={th}>Memo</th>
                    <th className={th}>Supplier</th>
                    <th className={cn(th, "text-right")}>Amount</th>
                    <th className={cn(th, "w-10")}>
                      <span className="sr-only">Remove</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {activity.expenses.map((e) => {
                    const label = e.memo || e.accountName || "Expense";
                    return (
                      <tr key={e.id} className="transition-colors hover:bg-accent">
                        <td className={cn(td, "whitespace-nowrap text-muted-foreground")}>{formatDate(e.date)}</td>
                        <td className={cn(td, "max-w-80")}>
                          <span className="block truncate text-foreground">{label}</span>
                          {e.memo && e.accountName && <span className="block truncate text-xs text-muted-foreground">{e.accountName}</span>}
                        </td>
                        <td className={cn(td, "max-w-48 truncate")}>{e.vendorName ?? "—"}</td>
                        <td className={cn(td, "text-right tabular-nums", !e.counts && "text-muted-foreground")}>
                          {currency(e.amount)}
                          {!e.counts && <span className="block text-xs">Not posted yet</span>}
                        </td>
                        <td className={cn(td, "text-right")}>
                          <RemoveTagButton tenantId={activeTenantId} projectId={project.id} kind="expense" documentId={e.id} label={label} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </BezelCard>

      {/* Stock used: derived from the project's own sales documents, so there's nothing to tag here. */}
      {activity.stock.length > 0 && (
        <BezelCard>
          <PanelHeader
            title="Stock used"
            count={activity.stock.length}
            description="Cost of inventory sold on this project's sales documents, at FIFO cost."
          />
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[420px] text-[13px]">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className={th}>Item</th>
                  <th className={cn(th, "text-right")}>Quantity</th>
                  <th className={cn(th, "text-right")}>Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {activity.stock.map((line) => (
                  <tr key={line.itemId} className="transition-colors hover:bg-accent">
                    <td className={cn(td, "text-foreground")}>{line.itemName}</td>
                    <td className={cn(td, "text-right tabular-nums text-muted-foreground")}>
                      {line.quantity.toLocaleString("en-US")}
                      {line.unit ? ` ${line.unit}` : ""}
                    </td>
                    <td className={cn(td, "text-right tabular-nums")}>{signed(line.cost)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-border font-medium">
                  <td className={td} colSpan={2}>
                    Total
                  </td>
                  <td className={cn(td, "text-right tabular-nums")}>{signed(stockCosts)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </BezelCard>
      )}
    </div>
  );
}
