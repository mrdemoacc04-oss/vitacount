import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loadTenantContext } from "@/lib/tenant/data";
import { isMissingSchema } from "@/lib/db-errors";
import { getProjectCustomers } from "@/lib/projects";
import { Icons } from "@/components/icons";
import { SchemaNotice } from "@/components/schema-notice";
import { ProjectForm } from "@/components/projects/project-form";
import { PageHeader } from "@/components/projects/ui";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

export default async function NewProjectPage({ searchParams }: { searchParams: SearchParams }) {
  const { activeTenantId } = await loadTenantContext();
  if (!activeTenantId) redirect("/onboarding");
  const params = await searchParams;

  const supabase = await createClient();
  const [{ error: schemaError }, customers] = await Promise.all([
    supabase.from("projects").select("id", { head: true, count: "exact" }).eq("tenant_id", activeTenantId),
    getProjectCustomers(activeTenantId),
  ]);

  const customerParam = first(params.customer);

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/projects" className="inline-flex items-center gap-1 text-[13px] text-muted-foreground transition-colors hover:text-foreground">
        <Icons.chevronRight className="size-3.5 rotate-180" />
        Projects
      </Link>
      <div className="mt-2">
        <PageHeader title="New project" description="Set up a job, then tag its invoices, bills and expenses to see what it earns." />
      </div>
      {isMissingSchema(schemaError) ? (
        <div className="mt-6">
          <SchemaNotice feature="Projects" />
        </div>
      ) : (
        <ProjectForm
          tenantId={activeTenantId}
          projectId={null}
          customers={customers}
          defaults={{ status: "active", customerId: customers.some((c) => c.id === customerParam) ? customerParam : "" }}
          cancelHref="/projects"
        />
      )}
    </div>
  );
}
