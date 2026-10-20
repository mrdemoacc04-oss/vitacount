"use client";

import Link from "next/link";
import { startTransition, useActionState, useState, type ComponentProps, type FormEvent } from "react";
import { Input } from "@/components/ui/input";
import { Field, FormActions, FormMessage, FormSection, Select, SubmitButton, Textarea, secondaryButtonClass } from "@/components/ui/field";
import { cn } from "@/lib/utils";
import { todayISO } from "@/lib/dates";
import { saveItemAction, type ItemFormField, type SaveItemState } from "@/lib/actions/inventory";
import { ITEM_TYPES, ITEM_TYPE_META, UNIT_SUGGESTIONS, decimalOnly, type ItemType } from "@/components/inventory/item-meta";
import { ItemTypeIcon } from "@/components/inventory/item-type-icon";

export type AccountOption = { id: string; code: string; name: string; subtype: string | null };

export interface ItemFormValues {
  type: ItemType;
  name: string;
  sku: string;
  unit: string;
  description: string;
  salesPrice: string;
  purchaseCost: string;
  incomeAccountId: string;
  expenseAccountId: string;
  reorderPoint: string;
  reorderQty: string;
}

const EMPTY: ItemFormValues = {
  type: "inventory",
  name: "",
  sku: "",
  unit: "",
  description: "",
  salesPrice: "",
  purchaseCost: "",
  incomeAccountId: "",
  expenseAccountId: "",
  reorderPoint: "",
  reorderQty: "",
};

const initialState: SaveItemState = { error: null };

function MoneyInput({ invalid, ...props }: ComponentProps<typeof Input> & { invalid?: boolean }) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
      <Input inputMode="decimal" autoComplete="off" aria-invalid={invalid || undefined} className="h-9 pl-6 tabular-nums" {...props} />
    </div>
  );
}

export function ItemForm({
  tenantId,
  itemId,
  initial,
  incomeAccounts,
  expenseAccounts,
  lockedTypes = [],
  typeLockReason,
}: {
  tenantId: string;
  /** null when creating */
  itemId: string | null;
  initial?: Partial<ItemFormValues>;
  incomeAccounts: AccountOption[];
  expenseAccounts: AccountOption[];
  /** Types the item can't switch to (stock history or document use). */
  lockedTypes?: ItemType[];
  typeLockReason?: string;
}) {
  const [state, formAction, pending] = useActionState(saveItemAction.bind(null, tenantId, itemId), initialState);
  const [values, setValues] = useState<ItemFormValues>({ ...EMPTY, ...initial });
  const [opening, setOpening] = useState({ qty: "", cost: "", date: todayISO() });
  const [nameTouched, setNameTouched] = useState(false);

  // Field errors come back from the server; editing a field clears its message.
  const [shownErrors, setShownErrors] = useState<SaveItemState["fieldErrors"]>({});
  const [seenState, setSeenState] = useState(state);
  if (state !== seenState) {
    setSeenState(state);
    setShownErrors(state.fieldErrors ?? {});
  }
  const errorFor = (field: ItemFormField) => shownErrors?.[field] ?? null;
  const clearError = (field: ItemFormField) =>
    setShownErrors((prev) => {
      if (!prev?.[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });

  function set<K extends keyof ItemFormValues>(field: K, value: ItemFormValues[K]) {
    setValues((prev) => ({ ...prev, [field]: value }));
    clearError(field as ItemFormField);
  }

  const isEdit = itemId !== null;
  const isStock = values.type === "inventory";
  const nameMissing = nameTouched && !values.name.trim();

  // What the database fills in when an account is left blank (items_before_write).
  const defaultIncome = incomeAccounts.find((a) => a.code === (values.type === "service" ? "4010" : "4000"));
  const defaultCogs = expenseAccounts.find((a) => a.code === "5000");
  const cogsAccounts = expenseAccounts.filter((a) => a.subtype === "cogs");
  const otherExpenseAccounts = expenseAccounts.filter((a) => a.subtype !== "cogs");

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!values.name.trim()) {
      setNameTouched(true);
      return;
    }
    const formData = new FormData(event.currentTarget);
    // Submitting by hand (not via the `action` prop) keeps what was typed when the server sends back an error.
    startTransition(() => formAction(formData));
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <input type="hidden" name="type" value={values.type} />

      {state.error && (
        <div className="mb-6">
          <FormMessage>{state.error}</FormMessage>
        </div>
      )}

      <div>
        <FormSection
          title="Item type"
          description={
            isEdit && typeLockReason
              ? typeLockReason
              : "Stock items keep a running quantity and post cost of goods when sold. Services and non-stock items just carry a price."
          }
        >
          <div role="radiogroup" aria-label="Item type" className="grid gap-3 sm:grid-cols-3">
            {ITEM_TYPES.map((type) => {
              const meta = ITEM_TYPE_META[type];
              const selected = values.type === type;
              const locked = lockedTypes.includes(type) && !selected;
              return (
                <button
                  key={type}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  disabled={locked}
                  onClick={() => set("type", type)}
                  className={cn(
                    "group flex flex-col items-start gap-3 rounded-xl border bg-card p-4 text-left transition-[border-color,background-color,box-shadow] duration-150 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/40",
                    selected
                      ? "border-primary bg-primary/[0.04] ring-1 ring-primary"
                      : "border-border hover:border-foreground/20 hover:bg-muted/40",
                    locked && "cursor-not-allowed opacity-50 hover:border-border hover:bg-card",
                  )}
                >
                  <span className="flex w-full items-center justify-between">
                    <span
                      className={cn(
                        "flex size-8 items-center justify-center rounded-lg transition-colors",
                        selected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                      )}
                    >
                      <ItemTypeIcon type={type} className="size-[18px]" />
                    </span>
                    <span
                      aria-hidden="true"
                      className={cn(
                        "flex size-4 items-center justify-center rounded-full border transition-colors",
                        selected ? "border-primary bg-primary" : "border-input",
                      )}
                    >
                      {selected && <span className="size-1.5 rounded-full bg-primary-foreground" />}
                    </span>
                  </span>
                  <span>
                    <span className="block text-[13px] font-semibold text-foreground">{meta.label}</span>
                    <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">{meta.description}</span>
                  </span>
                </button>
              );
            })}
          </div>
          {errorFor("type") && <p className="text-xs text-destructive">{errorFor("type")}</p>}
        </FormSection>

        <FormSection title="Details" description="How the item appears in lists, pickers and on your documents.">
          <Field label="Name" htmlFor="name" required error={nameMissing ? "Give the item a name." : errorFor("name")}>
            <Input
              id="name"
              name="name"
              value={values.name}
              onChange={(e) => set("name", e.target.value)}
              onBlur={() => setNameTouched(true)}
              aria-invalid={nameMissing || !!errorFor("name") || undefined}
              maxLength={200}
              placeholder={
                isStock ? "e.g. Ceramic mug, 12oz" : values.type === "service" ? "e.g. Consulting hour" : "e.g. Shipping supplies"
              }
              className="h-9"
              autoFocus={!isEdit}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="SKU" htmlFor="sku" optional hint="Your own code. Must be unique." error={errorFor("sku")}>
              <Input
                id="sku"
                name="sku"
                value={values.sku}
                onChange={(e) => set("sku", e.target.value)}
                aria-invalid={!!errorFor("sku") || undefined}
                maxLength={64}
                autoComplete="off"
                className="h-9 font-mono text-[13px]"
              />
            </Field>
            <Field label="Unit" htmlFor="unit" optional hint="each, hour, kg…" error={errorFor("unit")}>
              <Input
                id="unit"
                name="unit"
                list="item-unit-suggestions"
                value={values.unit}
                onChange={(e) => set("unit", e.target.value)}
                maxLength={32}
                autoComplete="off"
                placeholder={values.type === "service" ? "hour" : "each"}
                className="h-9"
              />
              <datalist id="item-unit-suggestions">
                {UNIT_SUGGESTIONS.map((u) => (
                  <option key={u} value={u} />
                ))}
              </datalist>
            </Field>
          </div>
          <Field label="Description" htmlFor="description" optional hint="Prints on invoices and bills as the line description.">
            <Textarea
              id="description"
              name="description"
              value={values.description}
              onChange={(e) => set("description", e.target.value)}
              rows={3}
            />
          </Field>
        </FormSection>

        <FormSection
          title="Pricing"
          description="Defaults that fill in when you add the item to a document. You can change them on each line."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Sales price" htmlFor="salesPrice" optional error={errorFor("salesPrice")}>
              <MoneyInput
                id="salesPrice"
                name="salesPrice"
                value={values.salesPrice}
                onChange={(e) => set("salesPrice", decimalOnly(e.target.value))}
                invalid={!!errorFor("salesPrice")}
                placeholder="0.00"
              />
            </Field>
            <Field
              label="Purchase cost"
              htmlFor="purchaseCost"
              optional
              hint={isStock ? "What you usually pay a supplier. Stock is valued at actual FIFO cost." : undefined}
              error={errorFor("purchaseCost")}
            >
              <MoneyInput
                id="purchaseCost"
                name="purchaseCost"
                value={values.purchaseCost}
                onChange={(e) => set("purchaseCost", decimalOnly(e.target.value))}
                invalid={!!errorFor("purchaseCost")}
                placeholder="0.00"
              />
            </Field>
          </div>
        </FormSection>

        <FormSection
          title="Accounts"
          description="Where sales and costs of this item land in your books. Leave blank to use the standard accounts."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Income account" htmlFor="incomeAccountId" error={errorFor("incomeAccountId")}>
              <Select
                id="incomeAccountId"
                name="incomeAccountId"
                value={values.incomeAccountId}
                onChange={(e) => set("incomeAccountId", e.target.value)}
              >
                <option value="">{defaultIncome ? `Default (${defaultIncome.code} · ${defaultIncome.name})` : "Default"}</option>
                {incomeAccounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.code} · {a.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field
              label={isStock ? "Cost of goods sold account" : "Purchase category"}
              htmlFor="expenseAccountId"
              hint={isStock ? "Charged at FIFO cost each time the item is sold." : "Used when the item is on a bill."}
              error={errorFor("expenseAccountId")}
            >
              <Select
                id="expenseAccountId"
                name="expenseAccountId"
                value={values.expenseAccountId}
                onChange={(e) => set("expenseAccountId", e.target.value)}
              >
                <option value="">
                  {isStock
                    ? defaultCogs
                      ? `Default (${defaultCogs.code} · ${defaultCogs.name})`
                      : "Default (Cost of Goods Sold)"
                    : "None, choose on each bill"}
                </option>
                {cogsAccounts.length > 0 && otherExpenseAccounts.length > 0 ? (
                  <>
                    <optgroup label="Cost of goods sold">
                      {cogsAccounts.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.code} · {a.name}
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="Expenses">
                      {otherExpenseAccounts.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.code} · {a.name}
                        </option>
                      ))}
                    </optgroup>
                  </>
                ) : (
                  expenseAccounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.code} · {a.name}
                    </option>
                  ))
                )}
              </Select>
            </Field>
          </div>
        </FormSection>

        {isStock && (
          <FormSection title="Reordering" description="Get a low-stock warning on the dashboard and here when you reach the reorder point.">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Reorder point" htmlFor="reorderPoint" optional hint="Warn me at this quantity" error={errorFor("reorderPoint")}>
                <Input
                  id="reorderPoint"
                  name="reorderPoint"
                  inputMode="decimal"
                  autoComplete="off"
                  value={values.reorderPoint}
                  onChange={(e) => set("reorderPoint", decimalOnly(e.target.value))}
                  aria-invalid={!!errorFor("reorderPoint") || undefined}
                  placeholder="e.g. 10"
                  className="h-9 tabular-nums"
                />
              </Field>
              <Field
                label="Reorder quantity"
                htmlFor="reorderQty"
                optional
                hint="How many you usually order"
                error={errorFor("reorderQty")}
              >
                <Input
                  id="reorderQty"
                  name="reorderQty"
                  inputMode="decimal"
                  autoComplete="off"
                  value={values.reorderQty}
                  onChange={(e) => set("reorderQty", decimalOnly(e.target.value))}
                  aria-invalid={!!errorFor("reorderQty") || undefined}
                  placeholder="e.g. 50"
                  className="h-9 tabular-nums"
                />
              </Field>
            </div>
          </FormSection>
        )}

        {isStock && !isEdit && (
          <FormSection
            title="Opening stock"
            description="What you already have on the shelf. It's booked to Inventory Asset against Opening Balance Equity. Leave blank if you're starting from zero."
          >
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Quantity on hand" htmlFor="openingQty" error={errorFor("openingQty")}>
                <Input
                  id="openingQty"
                  name="openingQty"
                  inputMode="decimal"
                  autoComplete="off"
                  value={opening.qty}
                  onChange={(e) => {
                    setOpening((o) => ({ ...o, qty: decimalOnly(e.target.value) }));
                    clearError("openingQty");
                  }}
                  aria-invalid={!!errorFor("openingQty") || undefined}
                  placeholder="0"
                  className="h-9 tabular-nums"
                />
              </Field>
              <Field label="Cost per unit" htmlFor="openingCost" error={errorFor("openingCost")}>
                <MoneyInput
                  id="openingCost"
                  name="openingCost"
                  value={opening.cost}
                  onChange={(e) => {
                    setOpening((o) => ({ ...o, cost: decimalOnly(e.target.value) }));
                    clearError("openingCost");
                  }}
                  onFocus={() => {
                    if (!opening.cost && values.purchaseCost) setOpening((o) => ({ ...o, cost: values.purchaseCost }));
                  }}
                  invalid={!!errorFor("openingCost")}
                  placeholder={values.purchaseCost || "0.00"}
                />
              </Field>
              <Field label="As of" htmlFor="openingDate" error={errorFor("openingDate")}>
                <Input
                  id="openingDate"
                  name="openingDate"
                  type="date"
                  value={opening.date}
                  onChange={(e) => {
                    setOpening((o) => ({ ...o, date: e.target.value }));
                    clearError("openingDate");
                  }}
                  aria-invalid={!!errorFor("openingDate") || undefined}
                  className="h-9"
                />
              </Field>
            </div>
          </FormSection>
        )}
      </div>

      <FormActions>
        <Link href={isEdit ? `/inventory/${itemId}` : "/inventory"} className={secondaryButtonClass}>
          Cancel
        </Link>
        <SubmitButton pending={pending} pendingLabel="Saving…">
          {isEdit ? "Save changes" : "Create item"}
        </SubmitButton>
      </FormActions>
    </form>
  );
}
