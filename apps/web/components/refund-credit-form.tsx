"use client";

import { useState } from "react";
import { Icons } from "@/components/icons";
import { Input } from "@/components/ui/input";
import { Field, FormActions, Select, SubmitButton } from "@/components/ui/field";
import { CancelButton } from "@/components/forms/cancel-button";
import { MoneyInput } from "@/components/forms/money-input";
import { useActionForm, useUnsavedChangesWarning, type FieldErrors } from "@/components/forms/use-action-form";
import { refundCustomerCreditAction, type RefundCreditState } from "@/lib/actions/invoices";
import { isISODate, todayISO } from "@/lib/dates";
import { PAYMENT_METHODS } from "@/lib/documents";
import { formatMoney, toScaled } from "@/lib/money";
import { cn } from "@/lib/utils";

const initialState: RefundCreditState = { error: null };

export type CustomerCredit = { id: string; name: string; credit: number };

/** Pays back a customer's unused credit (e.g. an overpayment). Dr Accounts Receivable / Cr Cash. */
export function RefundCreditForm({
  tenantId,
  customers,
  defaultCustomerId,
}: {
  tenantId: string;
  customers: CustomerCredit[];
  defaultCustomerId?: string;
}) {
  const initial = customers.find((c) => c.id === defaultCustomerId) ?? customers[0];
  const [contactId, setContactId] = useState(initial?.id ?? "");
  const [amount, setAmount] = useState(initial ? initial.credit.toFixed(2) : "");
  const [refundDate, setRefundDate] = useState(todayISO());
  const [method, setMethod] = useState("");
  const [reference, setReference] = useState("");
  const selected = customers.find((c) => c.id === contactId);

  function validate(): FieldErrors {
    const found: FieldErrors = {};
    const cents = toScaled(amount, 2) ?? BigInt(0);
    if (!contactId) found.contactId = "Choose a customer.";
    if (!isISODate(refundDate)) found.refundDate = "Pick the refund date.";
    if (cents <= BigInt(0)) found.amount = "Enter the amount to refund.";
    else if (selected && cents > (toScaled(selected.credit.toFixed(2), 2) ?? BigInt(0)))
      found.amount = `Can't be more than the ${formatMoney(selected.credit)} available.`;
    if (!method) found.method = "Choose how the refund was paid.";
    return found;
  }

  const { state, pending, errors, dirty, formProps } = useActionForm(refundCustomerCreditAction.bind(null, tenantId), initialState, validate);
  useUnsavedChangesWarning(dirty && !pending);

  return (
    <form {...formProps} className="flex flex-col gap-6">
      <section className="rounded-xl border border-border bg-card p-5 shadow-soft-sm md:p-6" aria-label="Refund details">
        <div className="grid grid-cols-1 gap-x-4 gap-y-5 md:grid-cols-6">
          <Field label="Customer" htmlFor="creditContactId" required error={errors.contactId} className="md:col-span-3">
            <Select
              id="creditContactId"
              name="contactId"
              value={contactId}
              onChange={(e) => {
                setContactId(e.target.value);
                const c = customers.find((x) => x.id === e.target.value);
                setAmount(c ? c.credit.toFixed(2) : "");
              }}
              aria-invalid={errors.contactId ? true : undefined}
            >
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} — {formatMoney(c.credit)} available
                </option>
              ))}
            </Select>
          </Field>
          <Field
            label="Amount to refund"
            htmlFor="creditAmount"
            required
            error={errors.amount}
            hint={selected ? `Up to ${formatMoney(selected.credit)}.` : undefined}
            className="md:col-span-3"
          >
            <MoneyInput id="creditAmount" name="amount" value={amount} onValueChange={setAmount} invalid={!!errors.amount} />
          </Field>
          <Field label="Refund date" htmlFor="refundDate" required error={errors.refundDate} className="md:col-span-2">
            <Input
              id="refundDate"
              name="refundDate"
              type="date"
              value={refundDate}
              onChange={(e) => setRefundDate(e.target.value)}
              aria-invalid={errors.refundDate ? true : undefined}
              className="h-9"
            />
          </Field>
          <Field label="Refunded by" htmlFor="creditMethod" required error={errors.method} className="md:col-span-2">
            <Select id="creditMethod" name="method" value={method} onChange={(e) => setMethod(e.target.value)} aria-invalid={errors.method ? true : undefined}>
              <option value="">Choose a method</option>
              {PAYMENT_METHODS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Reference" htmlFor="creditReference" optional hint="Check number or transfer ID." className="md:col-span-2">
            <Input id="creditReference" name="reference" placeholder="e.g. 10442" value={reference} onChange={(e) => setReference(e.target.value)} className="h-9" />
          </Field>
        </div>
      </section>

      <FormActions>
        <div className="mr-auto min-w-0 text-[13px]" aria-live="polite">
          {state.error && (
            <p role="alert" className="flex items-start gap-1.5 text-destructive">
              <Icons.alert className="mt-px size-4 shrink-0" />
              <span>{state.error}</span>
            </p>
          )}
        </div>
        <CancelButton href="/sales" dirty={dirty} />
        <SubmitButton pending={pending} pendingLabel="Saving…" disabled={!contactId}>
          Refund credit
        </SubmitButton>
      </FormActions>
    </form>
  );
}

/** Lets the Refund page switch between refunding a sale and refunding unused credit. */
export function RefundModeSwitch({
  defaultMode,
  saleForm,
  creditForm,
}: {
  defaultMode: "sale" | "credit";
  saleForm: React.ReactNode;
  creditForm: React.ReactNode;
}) {
  const [mode, setMode] = useState(defaultMode);
  const options = [
    { value: "sale" as const, label: "Returned items or services", hint: "Reverses the sale and the tax on it." },
    { value: "credit" as const, label: "A customer's unused credit", hint: "Pays back money left over from an overpayment." },
  ];

  return (
    <div className="flex flex-col gap-5">
      <fieldset>
        <legend className="text-[13px] font-medium text-foreground">What are you refunding?</legend>
        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {options.map((o) => (
            <label
              key={o.value}
              className={cn(
                "flex cursor-pointer gap-3 rounded-xl border bg-card px-3.5 py-3 shadow-soft-sm transition-colors duration-150 has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/40",
                mode === o.value ? "border-primary bg-primary/5" : "border-border hover:bg-muted/60",
              )}
            >
              <input
                type="radio"
                name="refundMode"
                value={o.value}
                checked={mode === o.value}
                onChange={() => setMode(o.value)}
                className="mt-0.5 size-4 accent-primary"
              />
              <span>
                <span className="block text-sm font-medium text-foreground">{o.label}</span>
                <span className="block text-xs text-muted-foreground">{o.hint}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      {mode === "sale" ? saleForm : creditForm}
    </div>
  );
}
