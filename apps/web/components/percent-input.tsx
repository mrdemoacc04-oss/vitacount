"use client";

import { normalizePercentText, parsePercent, sanitizePercentInput } from "@/lib/money";
import { cn } from "@/lib/utils";

/**
 * A rate typed the way people say it: "10" means 10%. The % sign is a fixed suffix,
 * so typing one (or a letter, or a space) is simply dropped instead of breaking the
 * calculation, and a comma decimal ("8,5") is accepted. The parent stores the
 * percent text; convert with `parsePercent(text).percent / 100` when saving.
 */
export function PercentInput({
  value,
  onChange,
  className,
  id,
  name,
  invalid,
  "aria-label": ariaLabel = "Tax rate (percent)",
  "aria-describedby": describedBy,
  "data-field": dataField,
}: {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  id?: string;
  name?: string;
  /** an error reported by the form (the input also flags its own parse errors) */
  invalid?: boolean;
  "aria-label"?: string;
  "aria-describedby"?: string;
  "data-field"?: string;
}) {
  const parsed = parsePercent(value);
  const error = parsed.ok ? null : parsed.error;

  return (
    <div className={cn("relative", className)}>
      <input
        id={id}
        name={name}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        value={value}
        data-field={dataField}
        onChange={(e) => onChange(sanitizePercentInput(e.target.value))}
        onBlur={() => onChange(normalizePercentText(value))}
        aria-label={ariaLabel}
        aria-invalid={error || invalid ? true : undefined}
        aria-describedby={describedBy}
        title={error ?? undefined}
        className="h-9 w-full min-w-0 rounded-lg border border-input bg-card py-1 pl-2.5 pr-7 text-right text-sm tabular-nums text-foreground shadow-soft-sm outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground/60 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/15"
        placeholder="0"
      />
      <span className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-sm text-muted-foreground" aria-hidden="true">
        %
      </span>
      {error && (
        <span className="absolute right-0 top-full z-10 mt-1 whitespace-nowrap rounded-md bg-destructive px-1.5 py-0.5 text-[10.5px] font-medium text-white" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
