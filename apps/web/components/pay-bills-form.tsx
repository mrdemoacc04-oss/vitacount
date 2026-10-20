"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Icons } from "@/components/icons";
import { Input } from "@/components/ui/input";
import { Field, FormActions, Select, SubmitButton, secondaryButtonClass } from "@/components/ui/field";
import { CancelButton } from "@/components/forms/cancel-button";
import { MoneyInput } from "@/components/forms/money-input";
import { useActionForm, useUnsavedChangesWarning, type FieldErrors } from "@/components/forms/use-action-form";
import { applyVendorCreditsAction, payBillsAction, type PayBillsState } from "@/lib/actions/bills";
import { formatDate, isISODate, todayISO } from "@/lib/dates";
import { PAYMENT_METHODS } from "@/lib/documents";
import { formatMoney, normalizeAmount, toScaled } from "@/lib/money";

export type OpenBill = {
  id: string;
  number: string | null;
  vendorId: string;
  issueDate: string;
  dueDate: string | null;
  total: number;
  balanceDue: number;
};

export type PayableVendor = { id: string; name: string; openBalance: number; credit: number };

const initialState: PayBillsState = { error: null };
const cents = (text: string) => toScaled(text, 2) ?? BigInt(0);

export function PayBillsForm({
  tenantId,
  vendors,
  openBills,
  defaultVendorId,
  focusBillId,
}: {
  tenantId: string;
  vendors: PayableVendor[];
  openBills: OpenBill[];
  defaultVendorId?: string;
  focusBillId?: string;
}) {
  const router = useRouter();
  const [crediting, startCrediting] = useTransition();
  const [creditMessage, setCreditMessage] = useState<string | null>(null);

  const focused = openBills.find((b) => b.id === focusBillId);
  const [vendorId, setVendorId] = useState(defaultVendorId ?? focused?.vendorId ?? "");
  const [paymentDate, setPaymentDate] = useState(todayISO());
  const [method, setMethod] = useState("");
  const [reference, setReference] = useState("");
  const [allocations, setAllocations] = useState<Record<string, string>>(focused ? { [focused.id]: focused.balanceDue.toFixed(2) } : {});

  const vendor = vendors.find((v) => v.id === vendorId) ?? null;
  const bills = useMemo(
    () =>
      openBills
        .filter((b) => b.vendorId === vendorId)
        .sort((a, b) => (a.dueDate ?? "9999-12-31").localeCompare(b.dueDate ?? "9999-12-31") || a.issueDate.localeCompare(b.issueDate)),
    [openBills, vendorId],
  );

  const totalCents = bills.reduce((sum, b) => sum + cents(allocations[b.id] ?? ""), BigInt(0));
  const rowErrors = new Set(bills.filter((b) => cents(allocations[b.id] ?? "") > cents(b.balanceDue.toFixed(2))).map((b) => b.id));
  const invalid = bills.some((b) => allocations[b.id] && normalizeAmount(allocations[b.id]) === null);
  const today = todayISO();

  function setAllocation(billId: string, value: string | null) {
    setAllocations((prev) => {
      const next = { ...prev };
      if (value === null || value === "") delete next[billId];
      else next[billId] = value;
      return next;
    });
  }

  function applyCredits() {
    if (!vendor) return;
    startCrediting(async () => {
      setCreditMessage(null);
      const result = await applyVendorCreditsAction(tenantId, vendor.id);
      setCreditMessage(result.error ?? `Applied ${formatMoney(result.applied)} of supplier credit to open bills.`);
      setAllocations({});
      router.refresh();
    });
  }

  const applicationsJson = JSON.stringify(
    bills.filter((b) => cents(allocations[b.id] ?? "") > BigInt(0)).map((b) => ({ billId: b.id, amount: allocations[b.id] })),
  );

  const problem = invalid
    ? "One of the payment amounts isn't a valid number."
    : rowErrors.size > 0
      ? "A payment is more than that bill's open balance."
      : vendorId && totalCents === BigInt(0)
        ? "Select the bills you're paying."
        : null;

  function validate(): FieldErrors {
    const found: FieldErrors = {};
    if (!vendorId) found.vendorId = "Choose the supplier you're paying.";
    if (!isISODate(paymentDate)) found.paymentDate = "Pick the payment date.";
    if (!method) found.method = "Choose how you paid.";
    return found;
  }

  const { state, pending, errors, dirty, formProps } = useActionForm(payBillsAction.bind(null, tenantId), initialState, validate);
  useUnsavedChangesWarning(dirty && !pending);

  return (
    <form {...formProps} className="flex flex-col gap-6">
      <input type="hidden" name="applications" value={applicationsJson} />

      <section className="rounded-xl border border-border bg-card p-5 shadow-soft-sm md:p-6" aria-label="Payment details">
        <div className="grid grid-cols-1 gap-x-4 gap-y-5 md:grid-cols-6">
          <Field label="Supplier" htmlFor="vendorId" required error={errors.vendorId} className="md:col-span-3">
            <Select
              id="vendorId"
              name="vendorId"
              value={vendorId}
              onChange={(e) => {
                setVendorId(e.target.value);
                setAllocations({});
                setCreditMessage(null);
              }}
              aria-invalid={errors.vendorId ? true : undefined}
              autoFocus={!vendorId}
            >
              <option value="">Who are you paying?</option>
              {vendors.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                  {v.openBalance > 0 ? ` — ${formatMoney(v.openBalance)} owed` : ""}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Payment date" htmlFor="paymentDate" required error={errors.paymentDate} className="md:col-span-3">
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
          <Field label="Paid by" htmlFor="method" required error={errors.method} className="md:col-span-3">
            <Select id="method" name="method" value={method} onChange={(e) => setMethod(e.target.value)} aria-invalid={errors.method ? true : undefined}>
              <option value="">Choose a method</option>
              {PAYMENT_METHODS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Reference" htmlFor="reference" optional hint="Check number or transfer ID." className="md:col-span-3">
            <Input id="reference" name="reference" placeholder="e.g. 2051" value={reference} onChange={(e) => setReference(e.target.value)} className="h-9" />
          </Field>
        </div>
      </section>

      {vendor && vendor.credit > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl bg-chart-2/10 px-4 py-3 text-sm">
          <p className="flex-1 text-foreground">
            You have <span className="font-semibold">{formatMoney(vendor.credit)}</span> in unused credit from{" "}
            <span className="font-semibold">{vendor.name}</span>.
          </p>
          {bills.length > 0 && (
            <button type="button" className={`${secondaryButtonClass} cursor-pointer disabled:opacity-60`} disabled={crediting} onClick={applyCredits}>
              {crediting ? "Applying…" : "Apply credit to open bills"}
            </button>
          )}
          {creditMessage && <p className="w-full text-xs text-muted-foreground">{creditMessage}</p>}
        </div>
      )}

      {vendorId && (
        <div className="rounded-xl border border-border bg-card shadow-soft-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/70 px-4 py-2.5">
            <p className="text-sm font-medium text-foreground">Open bills</p>
            {bills.length > 0 && (
              <div className="flex items-center gap-3 text-xs">
                <button
                  type="button"
                  onClick={() => setAllocations(Object.fromEntries(bills.map((b) => [b.id, b.balanceDue.toFixed(2)])))}
                  className="cursor-pointer font-medium text-primary hover:underline"
                >
                  Pay all
                </button>
                <button type="button" onClick={() => setAllocations({})} className="cursor-pointer font-medium text-muted-foreground hover:text-foreground">
                  Clear
                </button>
              </div>
            )}
          </div>

          {bills.length === 0 ? (
            <p className="px-4 py-5 text-sm text-muted-foreground">
              Nothing open for {vendor?.name ?? "this supplier"}.{" "}
              <Link href="/expenses/new?type=bill" className="font-medium text-primary hover:underline">
                Record a bill →
              </Link>
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[40rem] text-sm">
                <thead>
                  <tr className="border-b border-border/70 text-left text-muted-foreground">
                    <th className="w-10 px-4 py-2" aria-label="Include" />
                    <th className="py-2 pr-4 font-medium">Bill</th>
                    <th className="py-2 pr-4 font-medium">Date</th>
                    <th className="py-2 pr-4 font-medium">Due</th>
                    <th className="py-2 pr-4 text-right font-medium">Open balance</th>
                    <th className="w-36 py-2 pr-4 text-right font-medium">Payment</th>
                  </tr>
                </thead>
                <tbody>
                  {bills.map((b) => {
                    const value = allocations[b.id] ?? "";
                    const included = cents(value) > BigInt(0);
                    const overdue = b.dueDate !== null && b.dueDate < today;
                    return (
                      <tr key={b.id} className="border-b border-border/50 last:border-0">
                        <td className="px-4 py-2">
                          <input
                            type="checkbox"
                            checked={included}
                            onChange={(e) => setAllocation(b.id, e.target.checked ? b.balanceDue.toFixed(2) : null)}
                            aria-label={`Pay ${b.number ?? "bill"}`}
                            className="size-4 accent-primary"
                          />
                        </td>
                        <td className="py-2 pr-4">
                          <Link href={`/expenses/${b.id}`} target="_blank" className="font-medium text-primary hover:underline">
                            {b.number ?? "Bill"}
                          </Link>
                        </td>
                        <td className="py-2 pr-4 text-muted-foreground">{formatDate(b.issueDate)}</td>
                        <td className={`py-2 pr-4 ${overdue ? "font-medium text-destructive" : "text-muted-foreground"}`}>
                          {b.dueDate ? formatDate(b.dueDate) : "No due date"}
                        </td>
                        <td className="py-2 pr-4 text-right tabular-nums">{formatMoney(b.balanceDue)}</td>
                        <td className="py-2 pr-4">
                          <MoneyInput
                            aria-label={`Payment for ${b.number ?? "bill"}`}
                            invalid={rowErrors.has(b.id)}
                            value={value}
                            onValueChange={(v) => setAllocation(b.id, v)}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <FormActions>
        <div className="mr-auto min-w-0 text-[13px]" aria-live="polite">
          {state.error || problem ? (
            <p role="alert" className="flex items-start gap-1.5 text-destructive">
              <Icons.alert className="mt-px size-4 shrink-0" />
              <span>{state.error ?? problem}</span>
            </p>
          ) : null}
        </div>
        <p className="text-[13px] text-muted-foreground">
          Payment total{" "}
          <span className="font-heading text-base font-semibold tabular-nums text-foreground">{formatMoney(Number(totalCents) / 100)}</span>
        </p>
        <CancelButton href="/expenses" dirty={dirty} />
        <SubmitButton pending={pending} pendingLabel="Recording…" disabled={problem !== null}>
          Record payment
        </SubmitButton>
      </FormActions>
    </form>
  );
}
