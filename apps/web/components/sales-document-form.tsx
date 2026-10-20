"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Icons } from "@/components/icons";
import { Input } from "@/components/ui/input";
import { Field, FormActions, Select, SubmitButton, secondaryButtonClass } from "@/components/ui/field";
import { PercentInput } from "@/components/percent-input";
import { DocumentPreviewDialog } from "@/components/document-preview";
import { SalesDocumentPaper, type PrintableBusiness, type PrintableSalesDocument } from "@/components/sales-document-paper";
import { CancelButton } from "@/components/forms/cancel-button";
import { DecimalInput, MoneyInput } from "@/components/forms/money-input";
import { ProjectSelect } from "@/components/forms/project-select";
import { formatQuantity, type CatalogItem, type ProjectOption } from "@/components/forms/catalog";
import { useActionForm, useUnsavedChangesWarning, type FieldErrors } from "@/components/forms/use-action-form";
import { ItemPicker } from "@/components/line-items/item-picker";
import { AddLineButton, LineMessage, MobileLabel, RemoveLineButton } from "@/components/line-items/line-controls";
import { useLineRows } from "@/components/line-items/use-line-rows";
import { createSalesDocumentAction, type CreateSalesDocumentState } from "@/lib/actions/invoices";
import { isISODate, todayISO } from "@/lib/dates";
import {
  PAYMENT_METHODS,
  PAYMENT_TERMS,
  SALES_DOCUMENTS,
  dueDateForTerms,
  termsChoiceFromDates,
  type SalesDocumentType,
  type TermsChoice,
} from "@/lib/documents";
import { computeDocumentTotals, formatMoney, normalizeAmount, parsePercent, toScaled } from "@/lib/money";
import { cn } from "@/lib/utils";

export type FormCustomer = {
  id: string;
  display_name: string;
  email: string | null;
  addressLines: string[];
  /** the customer's usual terms ('net_30', …), applied when picked unless terms were set by hand */
  paymentTerms?: string | null;
};

type LineRow = { key: number; itemId: string; description: string; quantity: string; unitPrice: string; taxRate: string };

const initialState: CreateSalesDocumentState = { error: null };

const isPresetTerms = (value: string | null | undefined): value is Exclude<TermsChoice, "" | "custom"> =>
  !!value && PAYMENT_TERMS.some((t) => t.value === value);

function dueFor(choice: TermsChoice, days: string, issue: string): string {
  if (choice === "" || !isISODate(issue)) return "";
  if (choice === "custom") {
    const n = Number.parseInt(days, 10);
    return Number.isFinite(n) && n >= 0 ? dueDateForTerms(issue, n) : "";
  }
  return dueDateForTerms(issue, PAYMENT_TERMS.find((t) => t.value === choice)!.days);
}

export function SalesDocumentForm({
  tenantId,
  documentType,
  customers,
  defaultTaxRate,
  businessName,
  business,
  defaultCustomerId,
  defaultProjectId,
  items,
  projects,
  defaultTerms,
  newCustomerHref,
}: {
  tenantId: string;
  documentType: SalesDocumentType;
  customers: FormCustomer[];
  /** percent text, e.g. "8.25" */
  defaultTaxRate: string;
  businessName: string;
  /** workspace profile for the printed header/footer (legal name, address, EIN, notes) */
  business?: PrintableBusiness | null;
  defaultCustomerId?: string;
  defaultProjectId?: string;
  /** null hides the item picker (catalog not available) */
  items?: CatalogItem[] | null;
  /** null hides the project select */
  projects?: ProjectOption[] | null;
  /** the workspace's default payment terms ('net_30', 'none', …); null when unknown */
  defaultTerms?: string | null;
  newCustomerHref?: string;
}) {
  const config = SALES_DOCUMENTS[documentType];
  const settles = config.settlesImmediately;
  const isRefund = documentType === "refund_receipt";
  const tracksStock = documentType === "invoice" || documentType === "sales_receipt";
  // debit notes can't carry stock items (the server refuses them)
  const pickableItems = useMemo(
    () => (items ? (documentType === "debit_note" ? items.filter((i) => i.type !== "inventory") : items) : null),
    [items, documentType],
  );

  const emptyRow = (key: number): LineRow => ({ key, itemId: "", description: "", quantity: "1", unitPrice: "", taxRate: defaultTaxRate });
  const { rows, update, add: addLine, remove: removeLine, containerRef: linesRef, onKeyDown: onLinesKeyDown } = useLineRows<LineRow>([emptyRow(0)], emptyRow);

  const initialCustomer = customers.find((c) => c.id === defaultCustomerId);
  const initialTerms: TermsChoice = isPresetTerms(initialCustomer?.paymentTerms)
    ? initialCustomer.paymentTerms
    : isPresetTerms(defaultTerms)
      ? defaultTerms
      : "";

  const [contactId, setContactId] = useState(defaultCustomerId ?? "");
  const [projectId, setProjectId] = useState(projects?.some((p) => p.id === defaultProjectId) ? defaultProjectId! : "");
  const [issueDate, setIssueDate] = useState(todayISO());
  const [terms, setTerms] = useState<TermsChoice>(settles ? "" : initialTerms);
  const [termsSource, setTermsSource] = useState<"workspace" | "customer" | "manual" | null>(
    settles || initialTerms === "" ? null : isPresetTerms(initialCustomer?.paymentTerms) ? "customer" : "workspace",
  );
  const [customDays, setCustomDays] = useState("30");
  const [dueDate, setDueDate] = useState(() => (settles ? "" : dueFor(initialTerms, "30", todayISO())));
  const [paymentMethod, setPaymentMethod] = useState("");
  const [paymentReference, setPaymentReference] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);

  // --- totals & checks -----------------------------------------------------
  const totals = useMemo(
    () => computeDocumentTotals(rows.map((r) => ({ quantity: r.quantity, unitPrice: r.unitPrice, taxRate: parsePercent(r.taxRate).ok ? r.taxRate : "0" }))),
    [rows],
  );

  const itemById = useMemo(() => new Map((items ?? []).map((i) => [i.id, i])), [items]);
  // the same stock item on several lines draws on one on-hand balance
  const stockNeeded = useMemo(() => {
    const need = new Map<string, number>();
    for (const r of rows) {
      const item = itemById.get(r.itemId);
      if (item?.type === "inventory") need.set(item.id, (need.get(item.id) ?? 0) + (Number(r.quantity) || 0));
    }
    return need;
  }, [rows, itemById]);
  const shortItems = tracksStock
    ? [...stockNeeded].filter(([id, qty]) => qty > (itemById.get(id)?.onHand ?? 0)).map(([id]) => itemById.get(id)!)
    : [];

  const isBlank = (r: LineRow) => !r.itemId && !r.description.trim() && !r.unitPrice.trim();

  function validate(): FieldErrors {
    const found: FieldErrors = {};
    if (!contactId) found.contactId = "Choose a customer.";
    if (!isISODate(issueDate)) found.issueDate = `Pick the ${config.dateLabel.toLowerCase()}.`;
    if (!settles && dueDate && isISODate(issueDate) && dueDate < issueDate) found.dueDate = `Can't be before the ${config.dateLabel.toLowerCase()}.`;
    if (settles && !paymentMethod) found.paymentMethod = isRefund ? "Choose how the refund was paid." : "Choose how the customer paid.";
    rows.forEach((r, i) => {
      if (isBlank(r)) return;
      if (!r.itemId && !r.description.trim()) found[`lines.${i}.description`] = "Describe what you're charging for.";
      if (normalizeAmount(r.quantity) === null || toScaled(r.quantity, 2) === BigInt(0)) found[`lines.${i}.quantity`] = "Enter a quantity above zero.";
      if (normalizeAmount(r.unitPrice) === null) found[`lines.${i}.unitPrice`] = "Enter a price.";
      if (!parsePercent(r.taxRate).ok) found[`lines.${i}.taxRate`] = "Use a rate between 0% and 100%.";
    });
    if (rows.every(isBlank)) found["lines.0.description"] = "Add at least one line item.";
    return found;
  }

  const { state, pending, errors, dirty, setDirty, clearError, formProps } = useActionForm(
    createSalesDocumentAction.bind(null, tenantId, documentType),
    initialState,
    validate,
  );
  useUnsavedChangesWarning(dirty && !pending);

  const dueBeforeIssue = !settles && dueDate !== "" && isISODate(issueDate) && dueDate < issueDate;
  const fieldError = (key: string) => errors[key] ?? (key === "dueDate" && dueBeforeIssue ? `Can't be before the ${config.dateLabel.toLowerCase()}.` : undefined);

  // --- terms <-> due date -------------------------------------------------
  function onTermsChange(choice: TermsChoice) {
    setTerms(choice);
    setTermsSource(choice === "" ? null : "manual");
    setDueDate(dueFor(choice, customDays, issueDate));
  }

  function onCustomDaysChange(days: string) {
    setCustomDays(days);
    setDueDate(dueFor("custom", days, issueDate));
  }

  function onIssueDateChange(value: string) {
    setIssueDate(value);
    if (terms !== "") setDueDate(dueFor(terms, customDays, value));
  }

  function onDueDateChange(value: string) {
    setDueDate(value);
    setTermsSource(value ? "manual" : null);
    const { choice, days } = termsChoiceFromDates(issueDate, value);
    if (days !== null && days < 0) {
      setTerms("");
      return;
    }
    setTerms(choice);
    if (choice === "custom" && days !== null) setCustomDays(String(days));
  }

  function onCustomerChange(id: string) {
    setContactId(id);
    const customer = customers.find((c) => c.id === id);
    // a customer's usual terms win over the workspace default, never over terms set by hand
    if (!settles && termsSource !== "manual" && isPresetTerms(customer?.paymentTerms)) {
      setTerms(customer.paymentTerms);
      setTermsSource("customer");
      setDueDate(dueFor(customer.paymentTerms, customDays, issueDate));
    }
  }

  function onPickItem(row: LineRow, item: CatalogItem | null) {
    setDirty(true);
    clearError(`lines.${rows.indexOf(row)}`);
    if (!item) {
      update(row.key, { itemId: "" });
      return;
    }
    update(row.key, {
      itemId: item.id,
      description: item.description?.trim() || item.name,
      unitPrice: item.salesPrice !== null ? item.salesPrice.toFixed(2) : row.unitPrice,
      taxRate: defaultTaxRate,
    });
  }

  const linesJson = JSON.stringify(
    rows.map((r) => ({
      ...(r.itemId ? { itemId: r.itemId } : {}),
      description: r.description,
      quantity: r.quantity,
      unitPrice: r.unitPrice,
      taxRate: r.taxRate,
    })),
  );

  // --- preview ------------------------------------------------------------
  const customer = customers.find((c) => c.id === contactId);
  const filled = rows.map((r, i) => ({ r, amount: totals.amounts[i] })).filter(({ r }) => !isBlank(r));
  const previewDoc: PrintableSalesDocument = {
    documentType,
    number: null,
    issueDate: isISODate(issueDate) ? issueDate : null,
    dueDate: settles ? null : dueDate || null,
    customer: {
      name: customer?.display_name ?? "Choose a customer",
      email: customer?.email,
      addressLines: customer?.addressLines,
    },
    lines: filled.map(({ r, amount }) => {
      const tax = parsePercent(r.taxRate);
      return {
        description: r.description || itemById.get(r.itemId)?.name || "",
        quantity: Number(r.quantity) || 0,
        unitPrice: Number(r.unitPrice) || 0,
        taxRate: tax.ok ? tax.percent / 100 : 0,
        amount,
      };
    }),
    subtotal: totals.subtotal,
    taxTotal: totals.taxTotal,
    total: totals.total,
    balanceDue: settles ? null : totals.total,
    paymentMethod: settles ? paymentMethod : null,
    paymentReference: settles ? paymentReference : null,
    refundSource: isRefund ? "sale" : null,
  };

  const hasItems = pickableItems !== null;
  const gridCols = hasItems
    ? "md:grid-cols-[minmax(0,12rem)_minmax(0,1fr)_5.5rem_8rem_6rem_7rem_2rem]"
    : "md:grid-cols-[minmax(0,1fr)_5.5rem_8rem_6rem_7rem_2rem]";

  const termsHint =
    termsSource === "customer"
      ? `${customer?.display_name ?? "This customer"}'s usual terms.`
      : termsSource === "workspace"
        ? "Your workspace default."
        : "Sets the due date for you.";

  return (
    <form {...formProps} className="flex flex-col gap-6">
      <input type="hidden" name="lines" value={linesJson} />

      {/* --- who & when --------------------------------------------------- */}
      <section className="rounded-xl border border-border bg-card p-5 shadow-soft-sm md:p-6" aria-labelledby="doc-details">
        <h2 id="doc-details" className="sr-only">
          {config.label} details
        </h2>
        <div className="grid grid-cols-1 gap-x-4 gap-y-5 md:grid-cols-6">
          <Field
            label="Customer"
            htmlFor="contactId"
            required
            error={fieldError("contactId")}
            className="md:col-span-3"
            hint={
              newCustomerHref ? (
                <>
                  Not in the list?{" "}
                  <Link
                    href={newCustomerHref}
                    className="font-medium text-primary hover:underline"
                    onClick={(e) => {
                      if (dirty && !window.confirm("Leave this form? Anything you've entered will be lost.")) e.preventDefault();
                    }}
                  >
                    Add a new customer
                  </Link>
                </>
              ) : undefined
            }
          >
            <Select
              id="contactId"
              name="contactId"
              value={contactId}
              onChange={(e) => onCustomerChange(e.target.value)}
              aria-invalid={fieldError("contactId") ? true : undefined}
              autoFocus={!defaultCustomerId}
            >
              <option value="">Choose a customer</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.display_name}
                </option>
              ))}
            </Select>
          </Field>

          <ProjectSelect
            projects={projects ?? null}
            value={projectId}
            onChange={setProjectId}
            customerId={contactId || undefined}
            error={fieldError("projectId")}
            className="md:col-span-3"
          />

          <Field label={config.dateLabel} htmlFor="issueDate" required error={fieldError("issueDate")} className="md:col-span-2">
            <Input
              id="issueDate"
              name="issueDate"
              type="date"
              value={issueDate}
              onChange={(e) => onIssueDateChange(e.target.value)}
              aria-invalid={fieldError("issueDate") ? true : undefined}
              className="h-9"
            />
          </Field>

          {settles ? (
            <>
              <Field
                label={isRefund ? "Refunded by" : "Paid by"}
                htmlFor="paymentMethod"
                required
                error={fieldError("paymentMethod")}
                className="md:col-span-2"
              >
                <Select
                  id="paymentMethod"
                  name="paymentMethod"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  aria-invalid={fieldError("paymentMethod") ? true : undefined}
                >
                  <option value="">Choose a method</option>
                  {PAYMENT_METHODS.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Reference" htmlFor="paymentReference" optional hint="Check number or transaction ID." className="md:col-span-2">
                <Input
                  id="paymentReference"
                  name="paymentReference"
                  placeholder="e.g. 10442"
                  value={paymentReference}
                  onChange={(e) => setPaymentReference(e.target.value)}
                  className="h-9"
                />
              </Field>
            </>
          ) : (
            <>
              <Field label="Payment terms" htmlFor="terms" hint={termsHint} className="md:col-span-2">
                <div className="flex gap-2">
                  <Select id="terms" value={terms} onChange={(e) => onTermsChange(e.target.value as TermsChoice)} className="min-w-0">
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
                      onValueChange={onCustomDaysChange}
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
                className="md:col-span-2"
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
          )}
        </div>
      </section>

      {/* --- lines --------------------------------------------------------- */}
      <section className="rounded-xl border border-border bg-card shadow-soft-sm" aria-labelledby="doc-lines">
        <div className="flex items-baseline justify-between gap-3 border-b border-border px-5 py-3.5 md:px-6">
          <h2 id="doc-lines" className="text-[15px] font-semibold text-foreground">
            {isRefund ? "What you're refunding" : "Line items"}
          </h2>
          <p className="hidden text-xs text-muted-foreground sm:block">Press Enter in a line to add the next one.</p>
        </div>

        <div className="px-5 pt-3 md:px-6" ref={linesRef} onKeyDown={onLinesKeyDown}>
          <div className={cn("hidden gap-2 pb-2 text-xs font-medium text-muted-foreground md:grid", gridCols)} aria-hidden="true">
            {hasItems && <span>Item</span>}
            <span>Description</span>
            <span className="text-right">Qty</span>
            <span className="text-right">Unit price</span>
            <span className="text-right">Tax</span>
            <span className="text-right">Amount</span>
            <span />
          </div>

          <ul className="flex flex-col divide-y divide-border/70 md:divide-y-0">
            {rows.map((row, i) => {
              const n = i + 1;
              const item = itemById.get(row.itemId) ?? null;
              const stock = item?.type === "inventory" ? item : null;
              const short = tracksStock && stock !== null && (stockNeeded.get(stock.id) ?? 0) > (stock.onHand ?? 0);
              const err = (f: string) => errors[`lines.${i}.${f}`];
              const messages = [errors[`lines.${i}`], err("description"), err("quantity"), err("unitPrice"), err("taxRate")].filter(Boolean);
              return (
                <li key={row.key} data-row-key={row.key} className="py-3 md:py-1.5">
                  <div className={cn("grid grid-cols-6 items-start gap-2", gridCols)}>
                    {hasItems && (
                      <div className="col-span-6 md:col-span-1">
                        <MobileLabel>Item</MobileLabel>
                        <ItemPicker
                          items={pickableItems}
                          value={row.itemId}
                          onChange={(picked) => onPickItem(row, picked)}
                          priceKind="sales"
                          aria-label={`Line ${n} item`}
                          firstInRow
                        />
                      </div>
                    )}
                    <div className="col-span-6 md:col-span-1">
                      <MobileLabel htmlFor={`line-${row.key}-description`}>Description</MobileLabel>
                      <Input
                        id={`line-${row.key}-description`}
                        aria-label={`Line ${n} description`}
                        data-field={`lines.${i}.description`}
                        data-line-first={hasItems ? undefined : ""}
                        placeholder={item ? item.name : "What you're charging for"}
                        value={row.description}
                        onChange={(e) => update(row.key, { description: e.target.value })}
                        aria-invalid={err("description") ? true : undefined}
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
                      {stock && (
                        <p className={cn("mt-1 text-right text-[11px] tabular-nums", short ? "font-medium text-warning" : "text-muted-foreground")}>
                          {formatQuantity(stock.onHand ?? 0)} on hand
                        </p>
                      )}
                    </div>
                    <div className="col-span-2 md:col-span-1">
                      <MobileLabel>Unit price</MobileLabel>
                      <MoneyInput
                        aria-label={`Line ${n} unit price`}
                        data-field={`lines.${i}.unitPrice`}
                        value={row.unitPrice}
                        onValueChange={(unitPrice) => update(row.key, { unitPrice })}
                        invalid={!!err("unitPrice")}
                      />
                    </div>
                    <div className="col-span-2 md:col-span-1">
                      <MobileLabel>Tax</MobileLabel>
                      <PercentInput
                        aria-label={`Line ${n} tax rate (percent)`}
                        data-field={`lines.${i}.taxRate`}
                        value={row.taxRate}
                        onChange={(taxRate) => {
                          clearError(`lines.${i}.taxRate`);
                          update(row.key, { taxRate });
                        }}
                        invalid={!!err("taxRate")}
                      />
                    </div>
                    <p className="col-span-5 flex h-9 items-center justify-end text-sm font-medium tabular-nums md:col-span-1" aria-label={`Line ${n} amount`}>
                      {formatMoney(totals.amounts[i])}
                    </p>
                    <div className="col-span-1 flex h-9 items-center justify-end">
                      <RemoveLineButton onClick={() => removeLine(row.key)} label={`Remove line ${n}`} disabled={rows.length === 1 && isBlank(row)} />
                    </div>
                  </div>
                  {messages.length > 0 && <LineMessage tone="error">{messages.join(" ")}</LineMessage>}
                  {short && stock && (
                    <LineMessage tone="warning">
                      Only {formatQuantity(stock.onHand ?? 0)} {stock.unit ?? ""} of {stock.name} on hand. Receive more stock first — a sale
                      can&apos;t take stock below zero.
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

        <div className="flex flex-col gap-4 border-t border-border px-5 py-4 md:flex-row md:items-start md:justify-between md:px-6">
          <p className="max-w-sm text-xs leading-relaxed text-muted-foreground">
            {settles
              ? isRefund
                ? "Saving records the refund and reverses the sale and its tax in your books."
                : "Saving records the sale as paid and posts it to your books right away."
              : "Saved as a draft. Nothing posts to your books until you issue it."}
          </p>
          <dl className="grid w-full grid-cols-[1fr_auto] gap-x-8 gap-y-1.5 text-sm tabular-nums md:w-72">
            <dt className="text-muted-foreground">Subtotal</dt>
            <dd className="text-right">{formatMoney(totals.subtotal)}</dd>
            <dt className="text-muted-foreground">Tax</dt>
            <dd className="text-right">{formatMoney(totals.taxTotal)}</dd>
            <dt className="border-t border-border pt-2 font-medium text-foreground">{isRefund ? "Refund total" : "Total"}</dt>
            <dd className="border-t border-border pt-2 text-right font-heading text-lg font-semibold text-foreground">{formatMoney(totals.total)}</dd>
          </dl>
        </div>
      </section>

      <FormActions>
        <div className="mr-auto min-w-0 text-[13px]" aria-live="polite">
          {state.error ? (
            <p role="alert" className="flex items-start gap-1.5 text-destructive">
              <Icons.alert className="mt-px size-4 shrink-0" />
              <span>{state.error}</span>
            </p>
          ) : shortItems.length > 0 ? (
            <p className="flex items-start gap-1.5 text-warning">
              <Icons.alert className="mt-px size-4 shrink-0" />
              <span>Not enough {shortItems.map((s) => s.name).join(", ")} in stock to save this.</span>
            </p>
          ) : null}
        </div>
        <CancelButton href="/sales" dirty={dirty} />
        <button type="button" className={cn(secondaryButtonClass, "cursor-pointer")} onClick={() => setPreviewOpen(true)}>
          Preview
        </button>
        <SubmitButton pending={pending} pendingLabel="Saving…">
          {config.submitLabel}
        </SubmitButton>
      </FormActions>

      <DocumentPreviewDialog
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        title={`${config.label} preview`}
        fileName={`${config.label} draft${customer ? ` – ${customer.display_name}` : ""}`}
      >
        <SalesDocumentPaper doc={previewDoc} businessName={businessName} business={business} />
      </DocumentPreviewDialog>
    </form>
  );
}
