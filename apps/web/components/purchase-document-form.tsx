"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Icons } from "@/components/icons";
import { Input } from "@/components/ui/input";
import { Field, FormActions, Select, SubmitButton } from "@/components/ui/field";
import { CancelButton } from "@/components/forms/cancel-button";
import { DecimalInput, MoneyInput } from "@/components/forms/money-input";
import { ProjectSelect } from "@/components/forms/project-select";
import { formatQuantity, type CatalogItem, type ProjectOption } from "@/components/forms/catalog";
import { useActionForm, useUnsavedChangesWarning, type FieldErrors } from "@/components/forms/use-action-form";
import { ItemPicker } from "@/components/line-items/item-picker";
import { AddLineButton, LineMessage, MobileLabel, RemoveLineButton } from "@/components/line-items/line-controls";
import { useLineRows } from "@/components/line-items/use-line-rows";
import { createPurchaseDocumentAction, type CreateBillState } from "@/lib/actions/bills";
import { isISODate, todayISO } from "@/lib/dates";
import {
  PAYMENT_TERMS,
  PURCHASE_DOCUMENTS,
  dueDateForTerms,
  termsChoiceFromDates,
  type PurchaseDocumentType,
  type TermsChoice,
} from "@/lib/documents";
import { computeDocumentTotals, formatMoney, normalizeAmount, toScaled } from "@/lib/money";
import { cn } from "@/lib/utils";

type Vendor = { id: string; display_name: string };
type Account = { id: string; code: string; name: string };
type LineRow = { key: number; itemId: string; accountId: string; description: string; quantity: string; unitCost: string };

const initialState: CreateBillState = { error: null };

function dueFor(choice: TermsChoice, days: string, issue: string): string {
  if (choice === "" || !isISODate(issue)) return "";
  if (choice === "custom") {
    const n = Number.parseInt(days, 10);
    return Number.isFinite(n) && n >= 0 ? dueDateForTerms(issue, n) : "";
  }
  return dueDateForTerms(issue, PAYMENT_TERMS.find((t) => t.value === choice)!.days);
}

export function PurchaseDocumentForm({
  tenantId,
  documentType,
  vendors,
  expenseAccounts,
  defaultVendorId,
  defaultProjectId,
  items,
  projects,
  newVendorHref,
}: {
  tenantId: string;
  documentType: PurchaseDocumentType;
  vendors: Vendor[];
  expenseAccounts: Account[];
  defaultVendorId?: string;
  defaultProjectId?: string;
  /** null hides the item picker */
  items?: CatalogItem[] | null;
  /** null hides the project select */
  projects?: ProjectOption[] | null;
  newVendorHref?: string;
}) {
  const config = PURCHASE_DOCUMENTS[documentType];
  const isBill = documentType === "bill";
  const dateLabel = isBill ? "Bill date" : "Credit date";

  const emptyRow = (key: number): LineRow => ({ key, itemId: "", accountId: "", description: "", quantity: "1", unitCost: "" });
  const { rows, update, add: addLine, remove: removeLine, containerRef: linesRef, onKeyDown: onLinesKeyDown } = useLineRows<LineRow>([emptyRow(0)], emptyRow);

  const [vendorId, setVendorId] = useState(defaultVendorId ?? "");
  const [projectId, setProjectId] = useState(projects?.some((p) => p.id === defaultProjectId) ? defaultProjectId! : "");
  const [issueDate, setIssueDate] = useState(todayISO());
  const [terms, setTerms] = useState<TermsChoice>("");
  const [customDays, setCustomDays] = useState("30");
  const [dueDate, setDueDate] = useState("");

  const totals = useMemo(() => computeDocumentTotals(rows.map((r) => ({ quantity: r.quantity, unitPrice: r.unitCost }))), [rows]);
  const itemById = useMemo(() => new Map((items ?? []).map((i) => [i.id, i])), [items]);
  const accountIds = useMemo(() => new Set(expenseAccounts.map((a) => a.id)), [expenseAccounts]);
  const isStock = (r: LineRow) => itemById.get(r.itemId)?.type === "inventory";
  const isBlank = (r: LineRow) => !r.itemId && !r.accountId && !r.unitCost.trim() && !r.description.trim();

  function validate(): FieldErrors {
    const found: FieldErrors = {};
    if (!vendorId) found.vendorId = "Choose a supplier.";
    if (!isISODate(issueDate)) found.issueDate = "Pick the date.";
    if (isBill && dueDate && isISODate(issueDate) && dueDate < issueDate) found.dueDate = "Can't be before the bill date.";
    rows.forEach((r, i) => {
      if (isBlank(r)) return;
      if (!r.accountId && !r.itemId) found[`lines.${i}.accountId`] = "Choose a category.";
      if (normalizeAmount(r.quantity) === null || toScaled(r.quantity, 2) === BigInt(0)) found[`lines.${i}.quantity`] = "Enter a quantity above zero.";
      if (normalizeAmount(r.unitCost) === null) found[`lines.${i}.unitCost`] = "Enter an amount.";
    });
    if (rows.every(isBlank)) found["lines.0.accountId"] = "Add at least one line with a category.";
    return found;
  }

  const { state, pending, errors, dirty, setDirty, clearError, formProps } = useActionForm(
    createPurchaseDocumentAction.bind(null, tenantId, documentType),
    initialState,
    validate,
  );
  useUnsavedChangesWarning(dirty && !pending);

  const dueBeforeIssue = isBill && dueDate !== "" && isISODate(issueDate) && dueDate < issueDate;
  const fieldError = (key: string) => errors[key] ?? (key === "dueDate" && dueBeforeIssue ? "Can't be before the bill date." : undefined);

  function onDueDateChange(value: string) {
    setDueDate(value);
    const { choice, days } = termsChoiceFromDates(issueDate, value);
    if (days !== null && days < 0) {
      setTerms("");
      return;
    }
    setTerms(choice);
    if (choice === "custom" && days !== null) setCustomDays(String(days));
  }

  function onPickItem(row: LineRow, index: number, item: CatalogItem | null) {
    setDirty(true);
    clearError(`lines.${index}`);
    clearError(`lines.${index}.accountId`);
    if (!item) {
      update(row.key, { itemId: "" });
      return;
    }
    update(row.key, {
      itemId: item.id,
      // stock items always post to Inventory Asset; others suggest their purchase account
      accountId:
        item.type === "inventory" ? "" : item.expenseAccountId && accountIds.has(item.expenseAccountId) ? item.expenseAccountId : row.accountId,
      description: item.description?.trim() || item.name,
      unitCost: item.purchaseCost !== null ? item.purchaseCost.toFixed(2) : row.unitCost,
    });
  }

  const linesJson = JSON.stringify(
    rows.map((r) => ({
      ...(r.itemId ? { itemId: r.itemId } : {}),
      accountId: isStock(r) ? "" : r.accountId,
      description: r.description,
      quantity: r.quantity,
      unitCost: r.unitCost,
    })),
  );

  const hasItems = items !== null && items !== undefined;
  const gridCols = hasItems
    ? "md:grid-cols-[minmax(0,11rem)_minmax(0,12rem)_minmax(0,1fr)_5.5rem_8rem_7rem_2rem]"
    : "md:grid-cols-[minmax(0,14rem)_minmax(0,1fr)_5.5rem_8rem_7rem_2rem]";

  return (
    <form {...formProps} className="flex flex-col gap-6">
      <input type="hidden" name="lines" value={linesJson} />

      <section className="rounded-xl border border-border bg-card p-5 shadow-soft-sm md:p-6" aria-label={`${config.label} details`}>
        <div className="grid grid-cols-1 gap-x-4 gap-y-5 md:grid-cols-6">
          <Field
            label="Supplier"
            htmlFor="vendorId"
            required
            error={fieldError("vendorId")}
            className="md:col-span-3"
            hint={
              newVendorHref ? (
                <>
                  Not in the list?{" "}
                  <Link
                    href={newVendorHref}
                    className="font-medium text-primary hover:underline"
                    onClick={(e) => {
                      if (dirty && !window.confirm("Leave this form? Anything you've entered will be lost.")) e.preventDefault();
                    }}
                  >
                    Add a new supplier
                  </Link>
                </>
              ) : undefined
            }
          >
            <Select
              id="vendorId"
              name="vendorId"
              value={vendorId}
              onChange={(e) => setVendorId(e.target.value)}
              aria-invalid={fieldError("vendorId") ? true : undefined}
              autoFocus={!defaultVendorId}
            >
              <option value="">Choose a supplier</option>
              {vendors.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.display_name}
                </option>
              ))}
            </Select>
          </Field>

          <ProjectSelect
            projects={projects ?? null}
            value={projectId}
            onChange={setProjectId}
            error={fieldError("projectId")}
            hint="Tag the cost to a job to see that project's margin."
            className="md:col-span-3"
          />

          <Field label={config.referenceLabel} htmlFor="reference" optional hint="The number on the supplier's document." className="md:col-span-2">
            <Input id="reference" name="reference" placeholder="e.g. INV-2041" className="h-9" />
          </Field>

          <Field label={dateLabel} htmlFor="issueDate" required error={fieldError("issueDate")} className="md:col-span-2">
            <Input
              id="issueDate"
              name="issueDate"
              type="date"
              value={issueDate}
              onChange={(e) => {
                setIssueDate(e.target.value);
                if (terms !== "") setDueDate(dueFor(terms, customDays, e.target.value));
              }}
              aria-invalid={fieldError("issueDate") ? true : undefined}
              className="h-9"
            />
          </Field>

          {isBill ? (
            <>
              <Field label="Payment terms" htmlFor="terms" hint="Sets the due date for you." className="md:col-span-2">
                <div className="flex gap-2">
                  <Select
                    id="terms"
                    value={terms}
                    onChange={(e) => {
                      const choice = e.target.value as TermsChoice;
                      setTerms(choice);
                      setDueDate(dueFor(choice, customDays, issueDate));
                    }}
                    className="min-w-0"
                  >
                    <option value="">No terms</option>
                    {PAYMENT_TERMS.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                    <option value="custom">Custom</option>
                  </Select>
                  {terms === "custom" && (
                    <DecimalInput
                      id="customDays"
                      aria-label="Net days"
                      maxDecimals={0}
                      suffix="days"
                      value={customDays}
                      onValueChange={(days) => {
                        setCustomDays(days);
                        setDueDate(dueFor("custom", days, issueDate));
                      }}
                      className="w-24 shrink-0"
                    />
                  )}
                </div>
              </Field>
              <Field
                label="Due date"
                optional
                htmlFor="dueDate"
                error={fieldError("dueDate")}
                className="md:col-span-2 md:col-start-5"
                hint={
                  dueDate ? (
                    <button
                      type="button"
                      onClick={() => onDueDateChange("")}
                      className="cursor-pointer font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                    >
                      Clear due date
                    </button>
                  ) : (
                    "Leave blank for no due date."
                  )
                }
              >
                <Input
                  id="dueDate"
                  name="dueDate"
                  type="date"
                  min={isISODate(issueDate) ? issueDate : undefined}
                  value={dueDate}
                  onChange={(e) => onDueDateChange(e.target.value)}
                  aria-invalid={fieldError("dueDate") ? true : undefined}
                  className="h-9"
                />
              </Field>
            </>
          ) : null}
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card shadow-soft-sm" aria-labelledby="purchase-lines">
        <div className="flex items-baseline justify-between gap-3 border-b border-border px-5 py-3.5 md:px-6">
          <h2 id="purchase-lines" className="text-[15px] font-semibold text-foreground">
            {isBill ? "What you bought" : "What's being credited"}
          </h2>
          <p className="hidden text-xs text-muted-foreground sm:block">Press Enter in a line to add the next one.</p>
        </div>

        <div className="px-5 pt-3 md:px-6" ref={linesRef} onKeyDown={onLinesKeyDown}>
          <div className={cn("hidden gap-2 pb-2 text-xs font-medium text-muted-foreground md:grid", gridCols)} aria-hidden="true">
            {hasItems && <span>Item</span>}
            <span>Category</span>
            <span>Description</span>
            <span className="text-right">Qty</span>
            <span className="text-right">Unit cost</span>
            <span className="text-right">Amount</span>
            <span />
          </div>

          <ul className="flex flex-col divide-y divide-border/70 md:divide-y-0">
            {rows.map((row, i) => {
              const n = i + 1;
              const item = itemById.get(row.itemId) ?? null;
              const stock = item?.type === "inventory";
              const err = (f: string) => errors[`lines.${i}.${f}`];
              const messages = [errors[`lines.${i}`], err("accountId"), err("quantity"), err("unitCost")].filter(Boolean);
              return (
                <li key={row.key} data-row-key={row.key} className="py-3 md:py-1.5">
                  <div className={cn("grid grid-cols-6 items-start gap-2", gridCols)}>
                    {hasItems && (
                      <div className="col-span-6 md:col-span-1">
                        <MobileLabel>Item</MobileLabel>
                        <ItemPicker
                          items={items}
                          value={row.itemId}
                          onChange={(picked) => onPickItem(row, i, picked)}
                          priceKind="purchase"
                          aria-label={`Line ${n} item`}
                          firstInRow
                        />
                      </div>
                    )}
                    <div className="col-span-6 md:col-span-1">
                      <MobileLabel htmlFor={`line-${row.key}-account`}>Category</MobileLabel>
                      {stock ? (
                        <div
                          className="flex h-9 items-center gap-2 rounded-lg border border-dashed border-border bg-muted/50 px-3 text-sm text-muted-foreground"
                          title="Stock items are always recorded as Inventory Asset until they're sold."
                        >
                          <LockIcon />
                          <span className="truncate">Inventory Asset</span>
                        </div>
                      ) : (
                        <Select
                          id={`line-${row.key}-account`}
                          aria-label={`Line ${n} category`}
                          data-field={`lines.${i}.accountId`}
                          data-line-first={hasItems ? undefined : ""}
                          value={row.accountId}
                          onChange={(e) => update(row.key, { accountId: e.target.value })}
                          aria-invalid={err("accountId") ? true : undefined}
                        >
                          <option value="">{item ? "Item's default category" : "Choose a category"}</option>
                          {expenseAccounts.map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.code} · {a.name}
                            </option>
                          ))}
                        </Select>
                      )}
                    </div>
                    <div className="col-span-6 md:col-span-1">
                      <MobileLabel htmlFor={`line-${row.key}-description`}>Description</MobileLabel>
                      <Input
                        id={`line-${row.key}-description`}
                        aria-label={`Line ${n} description`}
                        placeholder={item ? item.name : "Optional"}
                        value={row.description}
                        onChange={(e) => update(row.key, { description: e.target.value })}
                        className="h-9"
                      />
                    </div>
                    <div className="col-span-2 md:col-span-1">
                      <MobileLabel>Qty</MobileLabel>
                      <DecimalInput
                        aria-label={`Line ${n} quantity`}
                        data-field={`lines.${i}.quantity`}
                        value={row.quantity}
                        onValueChange={(quantity) => update(row.key, { quantity })}
                        invalid={!!err("quantity")}
                      />
                      {stock && item && (
                        <p className="mt-1 text-right text-[11px] tabular-nums text-muted-foreground">{formatQuantity(item.onHand ?? 0)} on hand</p>
                      )}
                    </div>
                    <div className="col-span-2 md:col-span-1">
                      <MobileLabel>Unit cost</MobileLabel>
                      <MoneyInput
                        aria-label={`Line ${n} unit cost`}
                        data-field={`lines.${i}.unitCost`}
                        value={row.unitCost}
                        onValueChange={(unitCost) => update(row.key, { unitCost })}
                        invalid={!!err("unitCost")}
                      />
                    </div>
                    <p className="col-span-1 flex h-9 items-center justify-end text-sm font-medium tabular-nums md:col-span-1" aria-label={`Line ${n} amount`}>
                      {formatMoney(totals.amounts[i])}
                    </p>
                    <div className="col-span-1 flex h-9 items-center justify-end">
                      <RemoveLineButton onClick={() => removeLine(row.key)} label={`Remove line ${n}`} disabled={rows.length === 1 && isBlank(row)} />
                    </div>
                  </div>
                  {messages.length > 0 && <LineMessage tone="error">{messages.join(" ")}</LineMessage>}
                  {stock && item && (
                    <LineMessage tone="muted">
                      {isBill
                        ? `Adds ${formatQuantity(Number(row.quantity) || 0)} ${item.unit ?? ""} to stock at this cost.`
                        : "Takes the credited quantity back out of stock."}
                    </LineMessage>
                  )}
                </li>
              );
            })}
          </ul>
          <div className="py-2">
            <AddLineButton onClick={() => addLine(true)} className="-ml-2.5" />
          </div>
        </div>

        <div className="flex flex-col gap-4 border-t border-border px-5 py-4 md:flex-row md:items-center md:justify-between md:px-6">
          <p className="max-w-sm text-xs leading-relaxed text-muted-foreground">
            {isBill
              ? "Saving posts the bill to your books and adds it to what you owe this supplier."
              : "Saving lowers what you owe this supplier. Apply the credit to their open bills when you pay."}
          </p>
          <div className="flex items-baseline justify-between gap-8 md:w-72">
            <span className="text-sm font-medium text-foreground">{isBill ? "Total" : "Credit total"}</span>
            <span className="font-heading text-lg font-semibold tabular-nums text-foreground">{formatMoney(totals.subtotal)}</span>
          </div>
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
        <CancelButton href="/expenses" dirty={dirty} />
        <SubmitButton pending={pending} pendingLabel="Saving…">
          {config.submitLabel}
        </SubmitButton>
      </FormActions>
    </form>
  );
}

function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="size-3.5 shrink-0" aria-hidden="true">
      <rect x="5" y="10.5" width="14" height="10" rx="2" />
      <path d="M8.5 10.5V7.5a3.5 3.5 0 0 1 7 0v3" />
    </svg>
  );
}
