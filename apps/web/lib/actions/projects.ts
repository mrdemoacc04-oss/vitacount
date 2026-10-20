"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { friendlyDbError } from "@/lib/db-errors";
import { isISODate } from "@/lib/dates";
import { normalizeAmount } from "@/lib/money";
import { isProjectStatus, type DocumentKind } from "@/components/projects/shared";

export type ProjectField = "name" | "code" | "customerId" | "status" | "budget" | "startDate" | "endDate" | "description";

export type ProjectFormValues = Record<ProjectField, string>;

export type ProjectFormState = {
  error: string | null;
  fieldErrors: Partial<Record<ProjectField, string>>;
  /** What was submitted, so the form can show it again after a validation error. */
  values: ProjectFormValues | null;
};

export type ProjectActionResult = { error: string | null };

const NAME_MAX = 120;
const CODE_MAX = 24;
const DESCRIPTION_MAX = 2000;
const BUDGET_MAX = 999_999_999_999.99; // numeric(14, 2)

function revalidateProjects(projectId?: string) {
  revalidatePath("/projects");
  if (projectId) revalidatePath(`/projects/${projectId}`);
  revalidatePath("/dashboard");
}

/** Create (projectId null) or update a project from the shared project form. */
export async function saveProjectAction(
  tenantId: string,
  projectId: string | null,
  _prevState: ProjectFormState,
  formData: FormData,
): Promise<ProjectFormState> {
  const values: ProjectFormValues = {
    name: String(formData.get("name") ?? "").trim(),
    code: String(formData.get("code") ?? "").trim(),
    customerId: String(formData.get("customerId") ?? ""),
    status: String(formData.get("status") ?? "active"),
    budget: String(formData.get("budget") ?? "").replace(/[$,\s]/g, ""),
    startDate: String(formData.get("startDate") ?? ""),
    endDate: String(formData.get("endDate") ?? ""),
    description: String(formData.get("description") ?? "").trim(),
  };

  const fieldErrors: ProjectFormState["fieldErrors"] = {};
  if (!values.name) fieldErrors.name = "Give the project a name.";
  else if (values.name.length > NAME_MAX) fieldErrors.name = `Keep the name under ${NAME_MAX} characters.`;

  if (values.code.length > CODE_MAX) fieldErrors.code = `Keep the code under ${CODE_MAX} characters.`;

  if (!isProjectStatus(values.status)) fieldErrors.status = "Choose a status.";

  let budget: string | null = null;
  if (values.budget) {
    budget = normalizeAmount(values.budget);
    if (budget === null) fieldErrors.budget = "Enter the budget as a number, like 25000.";
    else if (Number(budget) > BUDGET_MAX) fieldErrors.budget = "That budget is too large.";
  }

  if (values.startDate && !isISODate(values.startDate)) fieldErrors.startDate = "That isn't a valid date.";
  if (values.endDate && !isISODate(values.endDate)) fieldErrors.endDate = "That isn't a valid date.";
  if (!fieldErrors.startDate && !fieldErrors.endDate && values.startDate && values.endDate && values.endDate < values.startDate) {
    fieldErrors.endDate = "The end date can't be before the start date.";
  }

  if (values.description.length > DESCRIPTION_MAX) fieldErrors.description = `Keep the description under ${DESCRIPTION_MAX} characters.`;

  if (Object.keys(fieldErrors).length > 0) {
    return { error: "Check the highlighted fields.", fieldErrors, values };
  }

  const record = {
    name: values.name,
    code: values.code || null,
    customer_id: values.customerId || null,
    status: values.status,
    budget: budget === null ? null : Number(budget),
    start_date: values.startDate || null,
    end_date: values.endDate || null,
    description: values.description || null,
  };

  const supabase = await createClient();
  let savedId: string;

  if (projectId) {
    const { data, error } = await supabase.from("projects").update(record).eq("id", projectId).eq("tenant_id", tenantId).select("id");
    if (error) return saveError(error, values);
    if (!data?.length) return { error: "This project no longer exists.", fieldErrors: {}, values };
    savedId = projectId;
  } else {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from("projects")
      .insert({ ...record, tenant_id: tenantId, created_by: user?.id ?? null })
      .select("id")
      .single();
    if (error) return saveError(error, values);
    savedId = data.id;
  }

  revalidateProjects(savedId);
  redirect(`/projects/${savedId}`);
}

function saveError(error: { code?: string; message: string }, values: ProjectFormValues): ProjectFormState {
  if (error.code === "23505") {
    return { error: null, fieldErrors: { code: "That code is already used by another project." }, values };
  }
  if (/customer does not belong/i.test(error.message)) {
    return { error: null, fieldErrors: { customerId: "That customer isn't in this workspace." }, values };
  }
  return { error: friendlyDbError(error), fieldErrors: {}, values };
}

export async function setProjectStatusAction(tenantId: string, projectId: string, status: string): Promise<ProjectActionResult> {
  if (!isProjectStatus(status)) return { error: "Unknown status." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("projects").update({ status }).eq("id", projectId).eq("tenant_id", tenantId).select("id");
  if (error) return { error: friendlyDbError(error) };
  if (!data?.length) return { error: "This project no longer exists." };
  revalidateProjects(projectId);
  return { error: null };
}

/** Owners and admins only (RLS). Tagged documents keep existing; their project_id is cleared by the FK. */
export async function deleteProjectAction(tenantId: string, projectId: string): Promise<ProjectActionResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("projects").delete().eq("id", projectId).eq("tenant_id", tenantId).select("id");
  if (error) return { error: friendlyDbError(error) };
  if (!data?.length) return { error: "Only owners and admins can delete projects." };
  revalidateProjects();
  redirect("/projects");
}

const DOCUMENT_PATH: Record<DocumentKind, string> = {
  sales: "/sales",
  purchase: "/expenses",
  expense: "/expenses",
};

function isDocumentKind(value: unknown): value is DocumentKind {
  return value === "sales" || value === "purchase" || value === "expense";
}

/** Tag an existing invoice, bill/credit or expense to this project. */
export async function tagDocumentAction(tenantId: string, projectId: string, kind: DocumentKind, documentId: string): Promise<ProjectActionResult> {
  return setDocumentProject(tenantId, kind, documentId, projectId, projectId);
}

/** Remove a document's project tag. The document itself is untouched. */
export async function untagDocumentAction(tenantId: string, projectId: string, kind: DocumentKind, documentId: string): Promise<ProjectActionResult> {
  return setDocumentProject(tenantId, kind, documentId, null, projectId);
}

async function setDocumentProject(
  tenantId: string,
  kind: DocumentKind,
  documentId: string,
  newProjectId: string | null,
  pageProjectId: string,
): Promise<ProjectActionResult> {
  if (!isDocumentKind(kind)) return { error: "Unknown document type." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_document_project", {
    p_tenant_id: tenantId,
    p_document_kind: kind,
    p_document_id: documentId,
    // the generated arg type is non-nullable `string`, but the Postgres param is a
    // nullable uuid — null clears the tag.
    p_project_id: newProjectId as string,
  });
  if (error) return { error: friendlyDbError(error) };

  revalidateProjects(pageProjectId);
  revalidatePath(`${DOCUMENT_PATH[kind]}/${documentId}`);
  return { error: null };
}
