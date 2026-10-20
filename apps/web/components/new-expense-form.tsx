"use client";

import { useState } from "react";
import { Icons } from "@/components/icons";
import { Input } from "@/components/ui/input";
import { Field, FormActions, FormSection, Select, SubmitButton } from "@/components/ui/field";
import { CancelButton } from "@/components/forms/cancel-button";
import { MoneyInput } from "@/components/forms/money-input";
import { ProjectSelect } from "@/components/forms/project-select";
import type { ProjectOption } from "@/components/forms/catalog";
import { useActionForm, useUnsavedChangesWarning, type FieldErrors } from "@/components/forms/use-action-form";
import { createExpenseAction, type CreateExpenseState } from "@/lib/actions/bills";
import { isISODate, todayISO } from "@/lib/dates";
import { PAYMENT_METHODS } from "@/lib/documents";
import { normalizeAmount } from "@/lib/money";

type Vendor = { id: string; display_name: string };
type Account = { id: string; code: string; name: string };

const initialState: CreateExpenseState = { error: null };

export function NewExpenseForm({
  tenantId,
  vendors,
  expenseAccounts,
  projects,
  defaultProjectId,
  defaultVendorId,
}: {
  tenantId: string;
  vendors: Vendor[];
  expenseAccounts: Account[];
  /** null hides the project select */
  projects?: ProjectOption[] | null;
  defaultProjectId?: string;
  defaultVendorId?: string;
}) {
  const [vendorId, setVendorId] = useState(defaultVendorId ?? "");
  const [projectId, setProjectId] = useState(projects?.some((p) => p.id === defaultProjectId) ? defaultProjectId! : "");
  const [expenseDate, setExpenseDate] = useState(todayISO());
  const [accountId, setAccountId] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("");

  function validate(): FieldErrors {
    const found: FieldErrors = {};
    if (!isISODate(expenseDate)) found.expenseDate = "Pick the date you paid.";
    if (!accountId) found.accountId = "Choose a category.";
    const normalized = normalizeAmount(amount);
    if (normalized === null || Number(normalized) <= 0) found.amount = "Enter the amount paid.";
    if (!method) found.method = "Choose how you paid.";
    return found;
  }

  const { state, pending, errors, dirty, formProps } = useActionForm(createExpenseAction.bind(null, tenantId), initialState, validate);
  useUnsavedChangesWarning(dirty && !pending);

  return (
    <form {...formProps} className="flex flex-col">
      <FormSection title="What you paid" description="The amount, when, and how. It's recorded as paid straight away.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Amount" htmlFor="amount" required error={errors.amount}>
            <MoneyInput id="amount" name="amount" value={amount} onValueChange={setAmount} invalid={!!errors.amount} autoFocus />
          </Field>
          <Field label="Date paid" htmlFor="expenseDate" required error={errors.expenseDate}>
            <Input
              id="expenseDate"
              name="expenseDate"
              type="date"
              value={expenseDate}
              onChange={(e) => setExpenseDate(e.target.value)}
              aria-invalid={errors.expenseDate ? true : undefined}
              className="h-9"
            />
          </Field>
          <Field label="Paid by" htmlFor="method" required error={errors.method}>
            <Select id="method" name="method" value={method} onChange={(e) => setMethod(e.target.value)} aria-invalid={errors.method ? true : undefined}>
              <option value="">Choose a method</option>
              {PAYMENT_METHODS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Paid to" htmlFor="vendorId" optional hint="The supplier or store, if you want it on their history.">
            <Select id="vendorId" name="vendorId" value={vendorId} onChange={(e) => setVendorId(e.target.value)}>
              <option value="">No supplier</option>
              {vendors.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.display_name}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </FormSection>

      <FormSection title="How to categorize it" description="The category decides where it lands on your profit and loss.">
        <Field label="Category" htmlFor="accountId" required error={errors.accountId}>
          <Select id="accountId" name="accountId" value={accountId} onChange={(e) => setAccountId(e.target.value)} aria-invalid={errors.accountId ? true : undefined}>
            <option value="">Choose a category</option>
            {expenseAccounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.code} · {a.name}
              </option>
            ))}
          </Select>
        </Field>
        <ProjectSelect projects={projects ?? null} value={projectId} onChange={setProjectId} error={errors.projectId} />
        <Field label="What was it for?" htmlFor="memo" optional hint="Shows in the ledger and on reports.">
          <Input id="memo" name="memo" placeholder="e.g. Printer paper and toner" className="h-9" />
        </Field>
      </FormSection>

      <FormActions>
        <div className="mr-auto min-w-0 text-[13px]" aria-live="polite">
          {state.error && (
            <p role="alert" className="flex items-start gap-1.5 text-destructive">
              <Icons.alert className="mt-px size-4 shrink-0" />
              <span>{state.error}</span>
            </p>
          )}
        </div>
        <CancelButton href="/expenses" dirty={dirty} />
        <SubmitButton pending={pending} pendingLabel="Saving…">
          Record expense
        </SubmitButton>
      </FormActions>
    </form>
  );
}
