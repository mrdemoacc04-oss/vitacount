"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Field, FormActions, FormMessage, FormSection, Select, SubmitButton, Textarea, secondaryButtonClass } from "@/components/ui/field";
import { saveProjectAction, type ProjectFormState, type ProjectFormValues } from "@/lib/actions/projects";
import { PROJECT_STATUSES, PROJECT_STATUS_LABEL } from "@/components/projects/shared";

export type ProjectFormDefaults = Partial<ProjectFormValues>;

/**
 * Create and edit share this form. Fields are uncontrolled; after a failed
 * submit the action echoes the submitted values back so nothing is lost when
 * React resets the form.
 */
export function ProjectForm({
  tenantId,
  projectId,
  customers,
  defaults,
  cancelHref,
}: {
  tenantId: string;
  projectId: string | null;
  customers: { id: string; name: string }[];
  defaults?: ProjectFormDefaults;
  cancelHref: string;
}) {
  const initialState: ProjectFormState = { error: null, fieldErrors: {}, values: null };
  const [state, formAction, pending] = useActionState(saveProjectAction.bind(null, tenantId, projectId), initialState);

  const v: ProjectFormDefaults = state.values ?? defaults ?? {};
  const errors = state.fieldErrors;
  const customerKnown = !v.customerId || customers.some((c) => c.id === v.customerId);
  // Remount the fields whenever the action answers, so defaultValue reflects what was submitted.
  const formKey = state.values ? JSON.stringify(state.values) : "initial";

  return (
    <form action={formAction} noValidate className="mt-6" key={formKey}>
      {state.error && (
        <div className="mb-6">
          <FormMessage>{state.error}</FormMessage>
        </div>
      )}

      <FormSection title="Project" description="A job you do for a customer. Its name and code appear wherever you tag documents to it.">
        <Field label="Name" htmlFor="name" required error={errors.name}>
          <Input
            id="name"
            name="name"
            defaultValue={v.name ?? ""}
            placeholder="Kitchen remodel, 14 Elm St"
            maxLength={120}
            autoFocus={!projectId}
            aria-invalid={!!errors.name || undefined}
            className="h-9"
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Code" htmlFor="code" optional hint="A short reference, like KR-24." error={errors.code}>
            <Input id="code" name="code" defaultValue={v.code ?? ""} maxLength={24} aria-invalid={!!errors.code || undefined} className="h-9" />
          </Field>
          <Field label="Status" htmlFor="status" error={errors.status}>
            <Select id="status" name="status" defaultValue={v.status ?? "active"} aria-invalid={!!errors.status || undefined}>
              {PROJECT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {PROJECT_STATUS_LABEL[s]}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field
          label="Customer"
          htmlFor="customerId"
          optional
          error={errors.customerId}
          hint={
            customers.length === 0 ? (
              <>
                No customers yet.{" "}
                <Link href="/contacts" className="text-primary underline-offset-4 hover:underline">
                  Add one in contacts
                </Link>
              </>
            ) : (
              "Their documents are suggested first when you add existing invoices."
            )
          }
        >
          <Select id="customerId" name="customerId" defaultValue={customerKnown ? (v.customerId ?? "") : ""} aria-invalid={!!errors.customerId || undefined}>
            <option value="">No customer</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Description" htmlFor="description" optional error={errors.description}>
          <Textarea id="description" name="description" defaultValue={v.description ?? ""} maxLength={2000} placeholder="Scope, address, or anything your team should know" />
        </Field>
      </FormSection>

      <FormSection title="Budget and schedule" description="Costs tagged to the project are measured against the budget.">
        <Field label="Budget" htmlFor="budget" optional hint="In USD, before tax." error={errors.budget}>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
            <Input
              id="budget"
              name="budget"
              inputMode="decimal"
              defaultValue={v.budget ?? ""}
              placeholder="0.00"
              aria-invalid={!!errors.budget || undefined}
              className="h-9 pl-6 tabular-nums"
            />
          </div>
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Start date" htmlFor="startDate" optional error={errors.startDate}>
            <Input id="startDate" name="startDate" type="date" defaultValue={v.startDate ?? ""} aria-invalid={!!errors.startDate || undefined} className="h-9" />
          </Field>
          <Field label="End date" htmlFor="endDate" optional error={errors.endDate}>
            <Input id="endDate" name="endDate" type="date" defaultValue={v.endDate ?? ""} aria-invalid={!!errors.endDate || undefined} className="h-9" />
          </Field>
        </div>
      </FormSection>

      <FormActions>
        <Link href={cancelHref} className={secondaryButtonClass}>
          Cancel
        </Link>
        <SubmitButton pending={pending} pendingLabel={projectId ? "Saving…" : "Creating…"}>
          {projectId ? "Save changes" : "Create project"}
        </SubmitButton>
      </FormActions>
    </form>
  );
}
