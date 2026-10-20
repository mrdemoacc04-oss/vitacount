"use client";

import { startTransition, useActionState, useState, type FormEvent } from "react";
import { Input } from "@/components/ui/input";
import { Field, FormMessage, Select, SubmitButton } from "@/components/ui/field";
import { adjustStockAction, type AdjustStockField, type AdjustStockState } from "@/lib/actions/inventory";
import { todayISO } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { ADJUST_REASONS, decimalOnly, formatQty } from "@/components/inventory/item-meta";

const initialState: AdjustStockState = { error: null };

/**
 * Manual stock change through adjust_inventory: adding creates a new FIFO layer
 * at the cost entered; removing writes off the oldest layers at their cost.
 */
export function AdjustStockForm({
  tenantId,
  itemId,
  onHand,
  unit,
  defaultUnitCost,
}: {
  tenantId: string;
  itemId: string;
  onHand: number;
  unit: string | null;
  /** Last received cost, else the item's purchase cost. */
  defaultUnitCost: number | null;
}) {
  const [state, formAction, pending] = useActionState(adjustStockAction.bind(null, tenantId, itemId), initialState);
  const defaultCost = defaultUnitCost !== null ? String(Number(defaultUnitCost.toFixed(4))) : "";

  const [direction, setDirection] = useState<"add" | "remove">("add");
  const [quantity, setQuantity] = useState("");
  const [unitCost, setUnitCost] = useState(defaultCost);
  const [date, setDate] = useState(todayISO());
  const [reason, setReason] = useState<string>(ADJUST_REASONS[0]);
  const [note, setNote] = useState("");

  // Server field errors, cleared field by field as the user edits; a successful save resets the inputs.
  const [shownErrors, setShownErrors] = useState<AdjustStockState["fieldErrors"]>({});
  const [seenState, setSeenState] = useState(state);
  if (state !== seenState) {
    setSeenState(state);
    setShownErrors(state.fieldErrors ?? {});
    if (state.savedAt) {
      setQuantity("");
      setNote("");
    }
  }
  const errorFor = (field: AdjustStockField) => shownErrors?.[field] ?? null;
  const clear = (field: AdjustStockField) => setShownErrors((prev) => (prev?.[field] ? { ...prev, [field]: undefined } : prev));

  const qty = Number(quantity || 0);
  const tooMany = direction === "remove" && qty > onHand;
  const after = direction === "add" ? onHand + qty : onHand - qty;
  const unitLabel = unit ? ` ${unit}` : "";

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (tooMany) return;
    const formData = new FormData(event.currentTarget);
    startTransition(() => formAction(formData));
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <input type="hidden" name="direction" value={direction} />

      <div role="radiogroup" aria-label="Add or remove stock" className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
        {(
          [
            ["add", "Add stock"],
            ["remove", "Remove stock"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={direction === value}
            onClick={() => setDirection(value)}
            className={cn(
              "h-7 rounded-md text-[13px] font-medium transition-[background-color,color,box-shadow] duration-150",
              direction === value ? "bg-card text-foreground shadow-soft-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field
          label="Quantity"
          htmlFor="adjust-quantity"
          error={tooMany ? `Only ${formatQty(onHand)} on hand` : errorFor("quantity")}
          className={direction === "remove" ? "col-span-2" : undefined}
        >
          <Input
            id="adjust-quantity"
            name="quantity"
            inputMode="decimal"
            autoComplete="off"
            value={quantity}
            onChange={(e) => {
              setQuantity(decimalOnly(e.target.value));
              clear("quantity");
            }}
            aria-invalid={tooMany || !!errorFor("quantity") || undefined}
            placeholder="0"
            className="h-9 tabular-nums"
          />
        </Field>
        {direction === "add" && (
          <Field label="Cost per unit" htmlFor="adjust-cost" error={errorFor("unitCost")}>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
              <Input
                id="adjust-cost"
                name="unitCost"
                inputMode="decimal"
                autoComplete="off"
                value={unitCost}
                onChange={(e) => {
                  setUnitCost(decimalOnly(e.target.value));
                  clear("unitCost");
                }}
                aria-invalid={!!errorFor("unitCost") || undefined}
                placeholder="0.00"
                className="h-9 pl-6 tabular-nums"
              />
            </div>
          </Field>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Date" htmlFor="adjust-date" error={errorFor("date")}>
          <Input
            id="adjust-date"
            name="date"
            type="date"
            value={date}
            onChange={(e) => {
              setDate(e.target.value);
              clear("date");
            }}
            aria-invalid={!!errorFor("date") || undefined}
            className="h-9"
          />
        </Field>
        <Field label="Reason" htmlFor="adjust-reason" error={errorFor("reason")}>
          <Select id="adjust-reason" name="reason" value={reason} onChange={(e) => setReason(e.target.value)}>
            {ADJUST_REASONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <Field label="Note" htmlFor="adjust-note" optional>
        <Input
          id="adjust-note"
          name="note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={200}
          placeholder="e.g. March stock count"
          className="h-9"
        />
      </Field>

      {state.error && <FormMessage>{state.error}</FormMessage>}
      {state.message && !state.error && quantity === "" && <FormMessage tone="success">{state.message}</FormMessage>}

      <div className="flex items-center justify-between gap-3 border-t border-border pt-4">
        <p className="text-xs text-muted-foreground">
          {qty > 0 && !tooMany ? (
            <>
              On hand after:{" "}
              <span className="font-medium tabular-nums text-foreground">
                {formatQty(after)}
                {unitLabel}
              </span>
            </>
          ) : (
            <>
              On hand now:{" "}
              <span className="font-medium tabular-nums text-foreground">
                {formatQty(onHand)}
                {unitLabel}
              </span>
            </>
          )}
        </p>
        <SubmitButton pending={pending} pendingLabel="Saving…" disabled={tooMany}>
          {direction === "add" ? "Add to stock" : "Remove from stock"}
        </SubmitButton>
      </div>
    </form>
  );
}
