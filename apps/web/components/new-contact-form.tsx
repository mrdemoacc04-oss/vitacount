"use client";

import { useState } from "react";
import { Icons } from "@/components/icons";
import { Input } from "@/components/ui/input";
import { Field, FormActions, FormSection, Select, SubmitButton } from "@/components/ui/field";
import { CancelButton } from "@/components/forms/cancel-button";
import { useActionForm, useUnsavedChangesWarning, type FieldErrors } from "@/components/forms/use-action-form";
import { US_STATES, formatEIN, formatUSPhone, isEmail, phoneDigits } from "@/components/forms/form-errors";
import { createContactAction, type CreateContactState } from "@/lib/actions/contacts";
import { PAYMENT_TERMS } from "@/lib/documents";
import { cn } from "@/lib/utils";

export type ContactKind = "customer" | "vendor" | "both";

const initialState: CreateContactState = { error: null };

const KINDS: { value: ContactKind; label: string; hint: string }[] = [
  { value: "customer", label: "Customer", hint: "You send them invoices" },
  { value: "vendor", label: "Supplier", hint: "You pay their bills" },
  { value: "both", label: "Both", hint: "You buy and sell" },
];

export function NewContactForm({
  tenantId,
  defaultType = "customer",
  defaultTerms = "net_30",
  returnTo,
  cancelHref = "/contacts",
}: {
  tenantId: string;
  defaultType?: ContactKind;
  /** the workspace's default payment terms */
  defaultTerms?: string;
  /** where to go after saving (the new contact is passed back as ?customer= / ?vendor=) */
  returnTo?: string;
  cancelHref?: string;
}) {
  const [type, setType] = useState<ContactKind>(defaultType);
  const [displayName, setDisplayName] = useState("");
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [taxId, setTaxId] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [is1099, setIs1099] = useState(false);
  const isVendor = type !== "customer";

  function validate(fd: FormData): FieldErrors {
    const found: FieldErrors = {};
    const get = (k: string) => String(fd.get(k) ?? "").trim();
    if (!displayName.trim()) found.displayName = "Enter the name you'll see on documents.";
    if (email.trim() && !isEmail(email.trim())) found.email = "Enter a valid email, like name@company.com.";
    if (phone.trim()) {
      const d = phoneDigits(phone);
      if (d.length < 10 || d.length > 15) found.phone = "Enter a 10-digit phone number.";
    }
    if (postalCode && !/^\d{5}(-\d{4})?$/.test(postalCode)) found.postalCode = "Use a 5-digit ZIP, like 94107 or 94107-1234.";
    const hasAddress = ["line1", "line2", "city", "state"].some((k) => get(k)) || postalCode;
    if (hasAddress && !get("line1")) found.line1 = "Add the street address, or clear the other address fields.";
    if (taxId && !/^\d{2}-\d{7}$/.test(taxId) && !/^\d{3}-?\d{2}-?\d{4}$/.test(taxId)) found.taxId = "Use an EIN (12-3456789) or SSN (123-45-6789).";
    return found;
  }

  const { state, pending, errors, dirty, setDirty, formProps } = useActionForm(createContactAction.bind(null, tenantId), initialState, validate);
  useUnsavedChangesWarning(dirty && !pending);

  const noun = type === "vendor" ? "supplier" : type === "both" ? "contact" : "customer";

  return (
    <form {...formProps} className="flex flex-col">
      {returnTo && <input type="hidden" name="returnTo" value={returnTo} />}
      <input type="hidden" name="type" value={type} />

      <FormSection title="Contact type" description="Customers appear on sales; suppliers on bills and expenses. Pick both if you do business both ways.">
        <div role="radiogroup" aria-label="Contact type" className="grid grid-cols-3 gap-1 rounded-xl border border-border bg-muted/50 p-1">
          {KINDS.map((k) => {
            const active = type === k.value;
            return (
              <button
                key={k.value}
                type="button"
                role="radio"
                aria-checked={active}
                tabIndex={active ? 0 : -1}
                onClick={() => {
                  setType(k.value);
                  setDirty(true);
                }}
                onKeyDown={(e) => {
                  const i = KINDS.findIndex((x) => x.value === type);
                  const dir = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
                  if (!dir) return;
                  e.preventDefault();
                  const next = KINDS[(i + dir + KINDS.length) % KINDS.length];
                  setType(next.value);
                  setDirty(true);
                  (e.currentTarget.parentElement?.children[KINDS.indexOf(next)] as HTMLElement | undefined)?.focus();
                }}
                className={cn(
                  "flex cursor-pointer flex-col items-center rounded-lg px-2 py-2 text-center transition-colors duration-150 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/40",
                  active ? "bg-card text-foreground shadow-soft-sm" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <span className="text-[13px] font-medium">{k.label}</span>
                <span className="hidden text-[11px] text-muted-foreground sm:block">{k.hint}</span>
              </button>
            );
          })}
        </div>
      </FormSection>

      <FormSection title="Details" description={`How this ${noun} appears on documents, and how to reach them.`}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Display name" htmlFor="displayName" required error={errors.displayName} hint="Shown on invoices, bills and reports.">
            <Input
              id="displayName"
              name="displayName"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              aria-invalid={errors.displayName ? true : undefined}
              autoComplete="off"
              autoFocus
              placeholder="e.g. Acme Corp"
              className="h-9"
            />
          </Field>
          <Field label="Company" htmlFor="company" optional hint="If different from the display name.">
            <Input
              id="company"
              name="company"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              autoComplete="organization"
              className="h-9"
            />
          </Field>
          <Field label="Email" htmlFor="email" optional error={errors.email} hint={type === "vendor" ? undefined : "Invoices and receipts are sent here."}>
            <Input
              id="email"
              name="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-invalid={errors.email ? true : undefined}
              placeholder="billing@acme.com"
              className="h-9"
            />
          </Field>
          <Field label="Phone" htmlFor="phone" optional error={errors.phone}>
            <Input
              id="phone"
              name="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={phone}
              onChange={(e) => setPhone(formatUSPhone(e.target.value))}
              aria-invalid={errors.phone ? true : undefined}
              placeholder="(555) 123-4567"
              className="h-9"
            />
          </Field>
        </div>
      </FormSection>

      <FormSection title="Billing address" description="Printed on documents you send. Leave blank if you don't need it.">
        <Field label="Street address" htmlFor="line1" error={errors.line1}>
          <Input id="line1" name="line1" autoComplete="address-line1" aria-invalid={errors.line1 ? true : undefined} className="h-9" />
        </Field>
        <Field label="Apartment, suite, etc." htmlFor="line2" optional>
          <Input id="line2" name="line2" autoComplete="address-line2" className="h-9" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,12rem)_8rem]">
          <Field label="City" htmlFor="city">
            <Input id="city" name="city" autoComplete="address-level2" className="h-9" />
          </Field>
          <Field label="State" htmlFor="state" error={errors.state}>
            <Select id="state" name="state" defaultValue="" autoComplete="address-level1" aria-invalid={errors.state ? true : undefined}>
              <option value="">Choose a state</option>
              {US_STATES.map((s) => (
                <option key={s.code} value={s.code}>
                  {s.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="ZIP code" htmlFor="postalCode" error={errors.postalCode}>
            <Input
              id="postalCode"
              name="postalCode"
              inputMode="numeric"
              autoComplete="postal-code"
              value={postalCode}
              onChange={(e) => setPostalCode(e.target.value.replace(/[^\d-]/g, "").slice(0, 10))}
              aria-invalid={errors.postalCode ? true : undefined}
              placeholder="94107"
              className="h-9"
            />
          </Field>
        </div>
      </FormSection>

      <FormSection
        title={isVendor ? "Payments and tax" : "Payments"}
        description={isVendor ? "Terms set due dates automatically; tax details are used for 1099 reporting." : "Terms set due dates on new invoices automatically."}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Payment terms" htmlFor="paymentTerms" error={errors.paymentTerms}>
            <Select id="paymentTerms" name="paymentTerms" defaultValue={defaultTerms} aria-invalid={errors.paymentTerms ? true : undefined}>
              {PAYMENT_TERMS.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Tax ID" htmlFor="taxId" optional error={errors.taxId} hint="EIN for businesses, SSN for individuals.">
            <Input
              id="taxId"
              name="taxId"
              inputMode="numeric"
              autoComplete="off"
              value={taxId}
              onChange={(e) => {
                const raw = e.target.value;
                // SSNs (with a dash after 3 digits) are left as typed; everything else formats as an EIN
                setTaxId(/^\d{3}-/.test(raw) ? raw.replace(/[^\d-]/g, "").slice(0, 11) : formatEIN(raw));
              }}
              aria-invalid={errors.taxId ? true : undefined}
              placeholder="12-3456789"
              className="h-9 tabular-nums"
            />
          </Field>
        </div>
        {isVendor && (
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border px-3.5 py-3 transition-colors hover:bg-muted/50">
            <input
              type="checkbox"
              name="is1099Vendor"
              checked={is1099}
              onChange={(e) => setIs1099(e.target.checked)}
              className="mt-0.5 size-4 shrink-0 accent-primary"
            />
            <span>
              <span className="block text-[13px] font-medium text-foreground">Track payments for 1099</span>
              <span className="block text-xs text-muted-foreground">
                For contractors and other suppliers you&apos;ll send a 1099-NEC or 1099-MISC at year end.
              </span>
            </span>
          </label>
        )}
      </FormSection>

      <FormActions>
        <div className="mr-auto min-w-0 text-[13px]" aria-live="polite">
          {state.error && (
            <p role="alert" className="flex items-start gap-1.5 text-destructive">
              <Icons.alert className="mt-px size-4 shrink-0" />
              <span>{state.error}</span>
            </p>
          )}
        </div>
        <CancelButton href={cancelHref} dirty={dirty} />
        <SubmitButton pending={pending} pendingLabel="Saving…">
          Save {noun}
        </SubmitButton>
      </FormActions>
    </form>
  );
}
