"use client";

import * as React from "react";
import { normalizeAmount } from "@/lib/money";
import { cn } from "@/lib/utils";

/**
 * Keeps only what a plain decimal can contain while the user types: digits and
 * one point, at most `maxDecimals` after it. Pasted "$1,250.00" becomes "1250.00".
 */
export function sanitizeDecimal(raw: string, maxDecimals = 2): string {
  let seenPoint = false;
  let decimals = 0;
  let out = "";
  for (const ch of raw) {
    if (ch >= "0" && ch <= "9") {
      if (seenPoint) {
        if (decimals >= maxDecimals) continue;
        decimals++;
      }
      out += ch;
    } else if (ch === "." && !seenPoint && maxDecimals > 0) {
      seenPoint = true;
      out += ch;
    }
  }
  return out;
}

const inputBase =
  "h-9 w-full min-w-0 rounded-lg border border-input bg-card py-1 text-right text-sm tabular-nums text-foreground shadow-soft-sm outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground/60 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-60 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/15";

type BaseProps = Omit<React.ComponentProps<"input">, "value" | "onChange" | "type"> & {
  value: string;
  onValueChange: (value: string) => void;
  invalid?: boolean;
};

/**
 * A USD amount: "$" prefix, right-aligned tabular digits, decimal keypad on
 * mobile. Stores the plain decimal text ("1250.5") and pads it to cents on blur.
 */
export const MoneyInput = React.forwardRef<HTMLInputElement, BaseProps>(function MoneyInput(
  { value, onValueChange, invalid, className, onBlur, placeholder = "0.00", ...props },
  ref,
) {
  return (
    <div className={cn("relative", className)}>
      <span className="pointer-events-none absolute inset-y-0 left-2.5 flex items-center text-sm text-muted-foreground" aria-hidden="true">
        $
      </span>
      <input
        ref={ref}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        value={value}
        placeholder={placeholder}
        aria-invalid={invalid || undefined}
        onChange={(e) => onValueChange(sanitizeDecimal(e.target.value, 2))}
        onBlur={(e) => {
          const normalized = value.trim() === "" ? "" : normalizeAmount(value);
          if (normalized !== null && normalized !== value) onValueChange(normalized);
          onBlur?.(e);
        }}
        className={cn(inputBase, "pl-6 pr-2.5")}
        {...props}
      />
    </div>
  );
});

/** A quantity or day count: right-aligned, decimal keypad, no spinner arrows. */
export const DecimalInput = React.forwardRef<HTMLInputElement, BaseProps & { maxDecimals?: number; suffix?: string }>(
  function DecimalInput({ value, onValueChange, invalid, className, maxDecimals = 2, suffix, placeholder = "0", ...props }, ref) {
    return (
      <div className={cn("relative", className)}>
        <input
          ref={ref}
          type="text"
          inputMode={maxDecimals > 0 ? "decimal" : "numeric"}
          autoComplete="off"
          value={value}
          placeholder={placeholder}
          aria-invalid={invalid || undefined}
          onChange={(e) => onValueChange(sanitizeDecimal(e.target.value, maxDecimals))}
          className={cn(inputBase, "px-2.5", suffix && "pr-11")}
          {...props}
        />
        {suffix && (
          <span className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-xs text-muted-foreground" aria-hidden="true">
            {suffix}
          </span>
        )}
      </div>
    );
  },
);
