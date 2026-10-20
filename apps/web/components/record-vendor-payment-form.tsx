"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Field, FormMessage, Select, SubmitButton } from "@/components/ui/field";
import { MoneyInput } from "@/components/forms/money-input";
import { useActionForm, type FieldErrors } from "@/components/forms/use-action-form";
import { recordVendorPaymentAction, type RecordVendorPaymentState } from "@/lib/actions/vendor-payments";
import { isISODate, todayISO } from "@/lib/dates";
import { PAYMENT_METHODS } from "@/lib/documents";
import { toScaled } from "@/lib/money";

const initialState: RecordVendorPaymentState = { error: null };

export function RecordVendorPaymentForm({
  tenantId,
  vendorId,
  billId,
  balanceDue,
}: {
  tenantId: string;
  vendorId: string;
  billId: string;
  balanceDue: number;
}) {
  const today = todayISO();
  const [paymentDate, setPaymentDate] = useState(today);
  const [amount, setAmount] = useState(balanceDue.toFixed(2));
  const [method, setMethod] = useState("bank_transfer");
  const [reference, setReference] = useState("");
  const [scheduledFor, setScheduledFor] = useState("");

  const amountCents = toScaled(amount, 2) ?? BigInt(0);
  const balanceCents = toScaled(balanceDue.toFixed(2), 2) ?? BigInt(0);
  const scheduled = isISODate(scheduledFor) && scheduledFor > today;

  function validate(): FieldErrors {
    const found: FieldErrors = {};
    if (!isISODate(paymentDate)) found.paymentDate = "Pick the payment date.";
    if (amountCents <= BigInt(0)) found.amount = "Enter an amount greater than zero.";
    else if (amountCents > balanceCents) found.amount = "Can't be more than the balance due.";
    return found;
  }

  const { state, pending, errors, formProps } = useActionForm(
    recordVendorPaymentAction.bind(null, tenantId, vendorId, billId),
    initialState,
    validate,
  );

  return (
    <form {...formProps} className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Amount" htmlFor="amount" required error={errors.amount} hint={amountCents < balanceCents ? "A partial payment." : "The full balance due."}>
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
        <Field label="Paid by" htmlFor="method">
          <Select id="method" name="method" value={method} onChange={(e) => setMethod(e.target.value)}>
            {PAYMENT_METHODS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Reference" htmlFor="reference" optional hint="Check number or transfer ID.">
          <Input id="reference" name="reference" placeholder="e.g. 2051" value={reference} onChange={(e) => setReference(e.target.value)} className="h-9" />
        </Field>
        <Field
          label="Schedule for"
          htmlFor="scheduledFor"
          optional
          error={errors.scheduledFor}
          hint={scheduled ? "Recorded now, paid on this date." : "Leave blank to pay now."}
        >
          <Input
            id="scheduledFor"
            name="scheduledFor"
            type="date"
            min={today}
            value={scheduledFor}
            onChange={(e) => setScheduledFor(e.target.value)}
            aria-invalid={errors.scheduledFor ? true : undefined}
            className="h-9"
          />
        </Field>
      </div>
      {state.error && <FormMessage>{state.error}</FormMessage>}
      <div className="flex justify-end">
        <SubmitButton pending={pending} pendingLabel={scheduled ? "Scheduling…" : "Recording…"}>
          {scheduled ? "Schedule payment" : "Record payment"}
        </SubmitButton>
      </div>
    </form>
  );
}
