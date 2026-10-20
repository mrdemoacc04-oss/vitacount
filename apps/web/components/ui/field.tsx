"use client";

import * as React from "react";
import { useFormStatus } from "react-dom";
import { cn } from "@/lib/utils";
import { Icons } from "@/components/icons";

/**
 * Form building blocks shared by every form in the app, so labels, hints,
 * errors, selects and submit states look and behave the same everywhere.
 *
 *   <Field label="Email" htmlFor="email" hint="We'll send receipts here" error={errors.email} required>
 *     <Input id="email" name="email" type="email" />
 *   </Field>
 */
export function Field({
  label,
  htmlFor,
  hint,
  error,
  required,
  optional,
  className,
  children,
}: {
  label: React.ReactNode;
  htmlFor?: string;
  hint?: React.ReactNode;
  error?: string | null;
  required?: boolean;
  optional?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const hintId = htmlFor ? `${htmlFor}-hint` : undefined;
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)} data-invalid={error ? "" : undefined}>
      <label htmlFor={htmlFor} className="flex items-baseline gap-1 text-[13px] font-medium text-foreground">
        {label}
        {required && (
          <span className="text-destructive" aria-hidden="true">
            *
          </span>
        )}
        {optional && <span className="text-xs font-normal text-muted-foreground">(optional)</span>}
      </label>
      {children}
      {error ? (
        <p id={hintId} className="flex items-center gap-1 text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

const controlBase =
  "w-full min-w-0 rounded-lg border border-input bg-card text-sm text-foreground shadow-soft-sm outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground/70 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-60 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/15";

/** Native select styled to match Input (keeps mobile pickers and keyboard behaviour). */
export const Select = React.forwardRef<HTMLSelectElement, React.ComponentProps<"select">>(function Select(
  { className, children, ...props },
  ref,
) {
  return (
    <div className="relative">
      <select ref={ref} className={cn(controlBase, "h-9 appearance-none pl-3 pr-9", className)} {...props}>
        {children}
      </select>
      <Icons.chevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
    </div>
  );
});

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<"textarea">>(function Textarea(
  { className, rows = 3, ...props },
  ref,
) {
  return <textarea ref={ref} rows={rows} className={cn(controlBase, "resize-y px-3 py-2 leading-relaxed", className)} {...props} />;
});

/** A titled group of fields: title + description on the left, fields on the right (stacks on mobile). */
export function FormSection({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("grid gap-x-10 gap-y-4 border-b border-border py-7 first:pt-0 last:border-b-0 md:grid-cols-[220px_minmax(0,1fr)]", className)}>
      <div>
        <h2 className="text-[15px] font-semibold text-foreground">{title}</h2>
        {description && <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">{description}</p>}
      </div>
      <div className="grid min-w-0 gap-4">{children}</div>
    </section>
  );
}

/** Form-level error or success banner. */
export function FormMessage({ tone = "error", children }: { tone?: "error" | "success"; children: React.ReactNode }) {
  if (!children) return null;
  const Icon = tone === "error" ? Icons.alert : Icons.check;
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "flex items-start gap-2.5 rounded-lg border px-3.5 py-2.5 text-[13px]",
        tone === "error" ? "border-destructive/25 bg-destructive/[0.06] text-destructive" : "border-positive/25 bg-positive/[0.07] text-positive",
      )}
    >
      <Icon className="mt-px size-4 shrink-0" />
      <span className="text-foreground">{children}</span>
    </div>
  );
}

/**
 * Submit button that disables itself and shows progress while its form is
 * submitting. Pass `pending` when the form is driven by useActionState/useTransition.
 */
export function SubmitButton({
  children,
  pendingLabel,
  pending: pendingProp,
  variant = "primary",
  className,
  ...props
}: Omit<React.ComponentProps<"button">, "type"> & {
  pendingLabel?: string;
  pending?: boolean;
  variant?: "primary" | "secondary" | "destructive";
}) {
  const status = useFormStatus();
  const pending = pendingProp ?? status.pending;
  return (
    <button
      type="submit"
      disabled={pending || props.disabled}
      aria-busy={pending}
      className={cn(
        "inline-flex h-9 items-center justify-center gap-2 rounded-lg px-4 text-[13px] font-medium shadow-soft-sm transition-[background-color,opacity,transform] duration-150 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-60",
        variant === "primary" && "bg-primary text-primary-foreground hover:bg-primary/90",
        variant === "secondary" && "border border-border bg-card text-foreground hover:bg-muted",
        variant === "destructive" && "bg-destructive text-white hover:bg-destructive/90",
        className,
      )}
      {...props}
    >
      {pending && (
        <svg viewBox="0 0 24 24" className="size-4 animate-spin" aria-hidden="true">
          <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2.5" />
          <path d="M21 12a9 9 0 0 0-9-9" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
      )}
      {pending && pendingLabel ? pendingLabel : children}
    </button>
  );
}

/** Secondary link-styled action placed next to SubmitButton (e.g. Cancel). */
export const secondaryButtonClass =
  "inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-border bg-card px-4 text-[13px] font-medium text-foreground shadow-soft-sm transition-colors duration-150 hover:bg-muted";

/** Sticky footer bar for long forms: actions stay reachable while scrolling. */
export function FormActions({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "sticky bottom-0 z-10 -mx-4 mt-6 flex flex-wrap items-center justify-end gap-2 border-t border-border bg-surface/90 px-4 py-3 backdrop-blur md:-mx-8 md:px-8",
        className,
      )}
    >
      {children}
    </div>
  );
}
