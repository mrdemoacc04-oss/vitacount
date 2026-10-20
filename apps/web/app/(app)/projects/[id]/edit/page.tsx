import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { loadTenantContext } from "@/lib/tenant/data";
import { getProject, getProjectCustomers } from "@/lib/projects";
import { Icons } from "@/components/icons";
import { SchemaNotice } from "@/components/schema-notice";
import { ProjectForm } from "@/components/projects/project-form";
import { PageHeader } from "@/components/projects/ui";

export default async function EditProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { activeTenantId } = await loadTenantContext();
  if (!activeTenantId) redirect("/onboarding");

  const [result, customers] = await Promise.all([getProject(activeTenantId, id), getProjectCustomers(activeTenantId)]);

  if (result.missingSchema) {
    return (
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        <PageHeader title="Edit project" description="Update the project's details, budget and schedule." />
        <SchemaNotice feature="Projects" />
      </div>
    );
  }
  const { project } = result;
  if (!project) notFound();

  // A customer that has since become supplier-only still shows as the current choice.
  const options =
    project.customerId && !customers.some((c) => c.id === project.customerId)
      ? [{ id: project.customerId, name: project.customerName ?? "Current customer" }, ...customers]
      : customers;

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href={`/projects/${project.id}`}
        className="inline-flex max-w-full items-center gap-1 text-[13px] text-muted-foreground transition-colors hover:text-foreground"
      >
        <Icons.chevronRight className="size-3.5 shrink-0 rotate-180" />
        <span className="truncate">{project.name}</span>
      </Link>
      <div className="mt-2">
        <PageHeader title="Edit project" description="Update the project's details, budget and schedule." />
      </div>
      <ProjectForm
        tenantId={activeTenantId}
        projectId={project.id}
        customers={options}
        cancelHref={`/projects/${project.id}`}
        defaults={{
          name: project.name,
          code: project.code ?? "",
          customerId: project.customerId ?? "",
          status: project.status,
          budget: project.budget === null ? "" : project.budget.toFixed(2),
          startDate: project.startDate ?? "",
          endDate: project.endDate ?? "",
          description: project.description ?? "",
        }}
      />
    </div>
  );
}
