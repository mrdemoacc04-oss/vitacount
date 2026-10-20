"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Field, FormMessage, Select, SubmitButton } from "@/components/ui/field";
import { MoneyInput } from "@/components/forms/money-input";
import { useActionForm, type FieldErrors } from "@/components/forms/use-action-form";
import { recordInvoicePaymentAction, type RecordPaymentState } from "@/lib/actions/invoices";
import { isISODate, todayISO } from "@/lib/dates";
import { PAYMENT_METHODS } from "@/lib/documents";
import { formatMoney, toScaled } from "@/lib/money";

const initialState: RecordPaymentState = { error: null };

export function RecordInvoicePaymentForm({
  tenantId,
  contactId,
  invoiceId,
  balanceDue,
}: {
  tenantId: string;
  contactId: string;
  invoiceId: string;
  balanceDue: number;
}) {
  const [paymentDate, setPaymentDate] = useState(todayISO());
  const [amount, setAmount] = useState(balanceDue.toFixed(2));
  const [method, setMethod] = useState("cash");
  const [reference, setReference] = useState("");

  const amountCents = toScaled(amount, 2) ?? BigInt(0);
  const balanceCents = toScaled(balanceDue.toFixed(2), 2) ?? BigInt(0);
  const overpaid = amountCents > balanceCents ? Number(amountCents - balanceCents) / 100 : 0;

  function validate(): FieldErrors {
    const found: FieldErrors = {};
    if (!isISODate(paymentDate)) found.paymentDate = "Pick the payment date.";
    if (amountCents <= BigInt(0)) found.amount = "Enter an amount greater than zero.";
    return found;
  }

  const { state, pending, errors, formProps } = useActionForm(
    recordInvoicePaymentAction.bind(null, tenantId, contactId, invoiceId),
    initialState,
    validate,
  );

  return (
    <form {...formProps} className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field
          label="Amount"
          htmlFor="amount"
          required
          error={errors.amount}
          hint={
            overpaid > 0
              ? `${formatMoney(overpaid)} more than the balance — kept as customer credit.`
              : amountCents < balanceCents && amountCents > BigInt(0)
                ? "A partial payment."
                : "The full balance due."
          }
        >
          <MoneyInput id="amount" name="amount" value={amount} onValueChange={setAmount} invalid={!!errors.amount} />
        </Field>
        <Field label="Payment date" htmlFor="paymentDate" required error={errors.paymentDate}>
          <Input
            id="paymentDate"
            name="paymentDate"
            type="date"
            value={paymentDate}
            onChange={(e) => setPaymentDate(e.target.value)}
            aria-invalid={errors.paymentDate ? true : undefined}
            className="h-9"
          />
        </Field>
        <Field label="Method" htmlFor="method">
          <Select id="method" name="method" value={method} onChange={(e) => setMethod(e.target.value)}>
            {PAYMENT_METHODS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Reference" htmlFor="reference" optional>
          <Input id="reference" name="reference" placeholder="Check number" value={reference} onChange={(e) => setReference(e.target.value)} className="h-9" />
        </Field>
      </div>
      {state.error && <FormMessage>{state.error}</FormMessage>}
      <div className="flex justify-end">
        <SubmitButton pending={pending} pendingLabel="Recording…">
          Record payment
        </SubmitButton>
      </div>
    </form>
  );
}
