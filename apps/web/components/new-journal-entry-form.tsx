"use client";

import { useState } from "react";
import { Icons } from "@/components/icons";
import { Input } from "@/components/ui/input";
import { Field, FormActions, Select, SubmitButton } from "@/components/ui/field";
import { CancelButton } from "@/components/forms/cancel-button";
import { MoneyInput } from "@/components/forms/money-input";
import { useActionForm, useUnsavedChangesWarning, type FieldErrors } from "@/components/forms/use-action-form";
import { AddLineButton, LineMessage, MobileLabel, RemoveLineButton } from "@/components/line-items/line-controls";
import { useLineRows } from "@/components/line-items/use-line-rows";
import { createJournalEntryAction, type CreateJournalEntryState } from "@/lib/actions/journal-entries";
import { isISODate, todayISO } from "@/lib/dates";
import { formatMoney, toScaled } from "@/lib/money";
import { cn } from "@/lib/utils";

type Account = { id: string; code: string; name: string };
type LineRow = { key: number; accountId: string; debit: string; credit: string; memo: string };

const initialState: CreateJournalEntryState = { error: null };
const cents = (text: string) => toScaled(text, 2) ?? BigInt(0);
const ZERO = BigInt(0);
const GRID = "md:grid-cols-[minmax(0,1.4fr)_8rem_8rem_minmax(0,1fr)_2rem]";

export function NewJournalEntryForm({ tenantId, accounts }: { tenantId: string; accounts: Account[] }) {
  const emptyRow = (key: number): LineRow => ({ key, accountId: "", debit: "", credit: "", memo: "" });
  const { rows, update, add: addLine, remove: removeLine, containerRef: linesRef, onKeyDown: onLinesKeyDown } = useLineRows<LineRow>([emptyRow(0), emptyRow(1)], emptyRow);
  const [entryDate, setEntryDate] = useState(todayISO());

  const totalDebit = rows.reduce((sum, r) => sum + cents(r.debit), ZERO);
  const totalCredit = rows.reduce((sum, r) => sum + cents(r.credit), ZERO);
  const difference = totalDebit - totalCredit;
  const used = rows.filter((r) => r.accountId || cents(r.debit) > ZERO || cents(r.credit) > ZERO);
  const balanced = difference === ZERO && totalDebit > ZERO && used.length >= 2;

  function validate(): FieldErrors {
    const found: FieldErrors = {};
    if (!isISODate(entryDate)) found.entryDate = "Pick the entry date.";
    rows.forEach((r, i) => {
      const amount = cents(r.debit) + cents(r.credit);
      if (r.accountId && amount === ZERO) found[`lines.${i}.debit`] = "Enter a debit or a credit.";
      if (!r.accountId && amount > ZERO) found[`lines.${i}.accountId`] = "Choose an account.";
    });
    if (Object.keys(found).length === 0) {
      if (used.length < 2) found["lines.1.accountId"] = "A journal entry needs at least two lines.";
      else if (difference !== ZERO) found.balance = "Debits and credits must be equal before you can post.";
    }
    return found;
  }

  const { state, pending, errors, dirty, formProps } = useActionForm(createJournalEntryAction.bind(null, tenantId), initialState, validate);
  useUnsavedChangesWarning(dirty && !pending);

  const linesJson = JSON.stringify(
    rows
      .filter((r) => r.accountId)
      .map((r) => ({
        accountId: r.accountId,
        debit: Number(cents(r.debit)) / 100,
        credit: Number(cents(r.credit)) / 100,
        memo: r.memo.trim() || undefined,
      })),
  );

  const diffAbs = difference < ZERO ? -difference : difference;

  return (
    <form {...formProps} className="flex flex-col gap-6">
      <input type="hidden" name="lines" value={linesJson} />

      <section className="rounded-xl border border-border bg-card p-5 shadow-soft-sm md:p-6" aria-label="Entry details">
        <div className="grid grid-cols-1 gap-x-4 gap-y-5 sm:grid-cols-[12rem_minmax(0,1fr)]">
          <Field label="Date" htmlFor="entryDate" required error={errors.entryDate}>
            <Input
              id="entryDate"
              name="entryDate"
              type="date"
              value={entryDate}
              onChange={(e) => setEntryDate(e.target.value)}
              aria-invalid={errors.entryDate ? true : undefined}
              className="h-9"
            />
          </Field>
          <Field label="Memo" htmlFor="memo" optional hint="Why this entry is being made — your accountant will thank you.">
            <Input id="memo" name="memo" placeholder="e.g. Record December depreciation" className="h-9" />
          </Field>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card shadow-soft-sm" aria-labelledby="je-lines">
        <div className="flex items-baseline justify-between gap-3 border-b border-border px-5 py-3.5 md:px-6">
          <h2 id="je-lines" className="text-[15px] font-semibold text-foreground">
            Lines
          </h2>
          <p className="hidden text-xs text-muted-foreground sm:block">Press Enter in a line to add the next one.</p>
        </div>
        <div className="px-5 pt-3 md:px-6" ref={linesRef} onKeyDown={onLinesKeyDown}>
          <div className={cn("hidden gap-2 pb-2 text-xs font-medium text-muted-foreground md:grid", GRID)} aria-hidden="true">
            <span>Account</span>
            <span className="text-right">Debit</span>
            <span className="text-right">Credit</span>
            <span>Line memo</span>
            <span />
          </div>
          <ul className="flex flex-col divide-y divide-border/70 md:divide-y-0">
            {rows.map((row, i) => {
              const n = i + 1;
              const err = (f: string) => errors[`lines.${i}.${f}`];
              const messages = [err("accountId"), err("debit")].filter(Boolean);
              return (
                <li key={row.key} data-row-key={row.key} className="py-3 md:py-1.5">
                  <div className={cn("grid grid-cols-6 items-start gap-2", GRID)}>
                    <div className="col-span-6 md:col-span-1">
                      <MobileLabel htmlFor={`je-${row.key}-account`}>Account</MobileLabel>
                      <Select
                        id={`je-${row.key}-account`}
                        aria-label={`Line ${n} account`}
                        data-field={`lines.${i}.accountId`}
                        data-line-first=""
                        value={row.accountId}
                        onChange={(e) => update(row.key, { accountId: e.target.value })}
                        aria-invalid={err("accountId") ? true : undefined}
                      >
                        <option value="">Choose an account</option>
                        {accounts.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.code} · {a.name}
                          </option>
                        ))}
                      </Select>
                    </div>
                    <div className="col-span-3 md:col-span-1">
                      <MobileLabel>Debit</MobileLabel>
                      <MoneyInput
                        aria-label={`Line ${n} debit`}
                        data-field={`lines.${i}.debit`}
                        value={row.debit}
                        // a line is either a debit or a credit
                        onValueChange={(debit) => update(row.key, { debit, credit: debit ? "" : row.credit })}
                        invalid={!!err("debit")}
                        placeholder=""
                      />
                    </div>
                    <div className="col-span-3 md:col-span-1">
                      <MobileLabel>Credit</MobileLabel>
                      <MoneyInput
                        aria-label={`Line ${n} credit`}
                        data-field={`lines.${i}.debit`}
                        value={row.credit}
                        onValueChange={(credit) => update(row.key, { credit, debit: credit ? "" : row.debit })}
                        invalid={!!err("debit")}
                        placeholder=""
                      />
                    </div>
                    <div className="col-span-5 md:col-span-1">
                      <MobileLabel htmlFor={`je-${row.key}-memo`}>Line memo</MobileLabel>
                      <Input
                        id={`je-${row.key}-memo`}
                        aria-label={`Line ${n} memo`}
                        value={row.memo}
                        onChange={(e) => update(row.key, { memo: e.target.value })}
                        className="h-9"
                      />
                    </div>
                    <div className="col-span-1 flex h-9 items-center justify-end self-end md:self-start">
                      <RemoveLineButton onClick={() => removeLine(row.key)} label={`Remove line ${n}`} disabled={rows.length <= 2} />
                    </div>
                  </div>
                  {messages.length > 0 && <LineMessage tone="error">{messages.join(" ")}</LineMessage>}
                </li>
              );
            })}
          </ul>
          <div className="py-2">
            <AddLineButton onClick={() => addLine(true)} className="-ml-2.5" />
          </div>
        </div>

        <div className={cn("grid gap-2 border-t border-border px-5 py-3 text-sm tabular-nums md:px-6", GRID)}>
          <span className="font-medium text-foreground">Totals</span>
          <span className="text-right font-medium">{formatMoney(Number(totalDebit) / 100)}</span>
          <span className="text-right font-medium">{formatMoney(Number(totalCredit) / 100)}</span>
          <span
            className={cn("flex items-center gap-1.5 text-[13px] md:col-span-2", balanced ? "text-positive" : totalDebit + totalCredit > ZERO ? "text-warning" : "text-muted-foreground")}
            role="status"
            aria-live="polite"
          >
            {balanced ? (
              <>
                <Icons.check className="size-4" /> Balanced
              </>
            ) : totalDebit + totalCredit > ZERO && difference !== ZERO ? (
              <>
                <Icons.alert className="size-4" /> Out of balance by {formatMoney(Number(diffAbs) / 100)}
              </>
            ) : (
              "Debits must equal credits."
            )}
          </span>
        </div>
      </section>

      <FormActions>
        <div className="mr-auto min-w-0 text-[13px]" aria-live="polite">
          {state.error || errors.balance ? (
            <p role="alert" className="flex items-start gap-1.5 text-destructive">
              <Icons.alert className="mt-px size-4 shrink-0" />
              <span>{state.error ?? errors.balance}</span>
            </p>
          ) : null}
        </div>
        <CancelButton href="/cpa/journal-entries" dirty={dirty} />
        <SubmitButton pending={pending} pendingLabel="Posting…" disabled={!balanced}>
          Post entry
        </SubmitButton>
      </FormActions>
    </form>
  );
}
