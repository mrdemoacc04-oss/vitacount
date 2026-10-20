"use client";

import { useState, useSyncExternalStore } from "react";
import { Icons } from "@/components/icons";
import { Input } from "@/components/ui/input";
import { Field, FormMessage, Select, SubmitButton } from "@/components/ui/field";
import { formatEIN, formatUSPhone } from "@/components/forms/form-errors";
import { useActionForm, type FieldErrors } from "@/components/forms/use-action-form";
import { DEFAULT_TERMS_OPTIONS, MONTHS, US_STATES } from "@/components/settings/options";
import { createWorkspaceAction, type OnboardingState } from "@/app/onboarding/actions";
import { cn } from "@/lib/utils";

const initialState: OnboardingState = { error: null };

const subscribeNever = () => () => {};
const browserTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone ?? "";

export function OnboardingForm() {
  const [name, setName] = useState("");
  const [showDetails, setShowDetails] = useState(false);
  const [taxId, setTaxId] = useState("");
  const [phone, setPhone] = useState("");
  // the browser's time zone, read after hydration (the server can't know it)
  const timezone = useSyncExternalStore(subscribeNever, browserTimeZone, () => "");

  function validate(): FieldErrors {
    const found: FieldErrors = {};
    if (!name.trim()) found.name = "Give your workspace a name.";
    if (taxId && !/^\d{2}-\d{7}$/.test(taxId)) found.taxId = "Use the 9-digit EIN format, like 12-3456789.";
    if (phone && phone.replace(/\D/g, "").length < 10) found.phone = "Enter a 10-digit phone number.";
    return found;
  }

  const { state, pending, errors, formProps } = useActionForm(createWorkspaceAction, initialState, validate);
  // a server error in the optional section should be visible
  const detailsOpen = showDetails || ["taxId", "phone", "state", "legalName", "fiscalYearStartMonth", "defaultPaymentTerms"].some((k) => errors[k]);

  return (
    <form {...formProps} className="flex flex-col gap-6">
      <input type="hidden" name="timezone" value={timezone} />

      <Field label="Business name" htmlFor="name" required error={errors.name} hint="What you call your business. You can change it any time.">
        <Input
          id="name"
          name="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          aria-invalid={errors.name ? true : undefined}
          autoComplete="organization"
          autoFocus
          placeholder="e.g. Northwind Studio"
          className="h-10 text-[15px]"
        />
      </Field>

      <div className="rounded-xl border border-border">
        <button
          type="button"
          onClick={() => setShowDetails((v) => !v)}
          aria-expanded={detailsOpen}
          aria-controls="business-details"
          className="flex w-full cursor-pointer items-center justify-between gap-3 rounded-xl px-4 py-3 text-left transition-colors hover:bg-muted/50"
        >
          <span>
            <span className="block text-[13px] font-medium text-foreground">Business details</span>
            <span className="block text-xs text-muted-foreground">Optional. Printed on invoices; you can add them later in Settings.</span>
          </span>
          <Icons.chevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform", detailsOpen && "rotate-180")} />
        </button>

        <div id="business-details" hidden={!detailsOpen} className="border-t border-border px-4 py-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Legal name" htmlFor="legalName" optional error={errors.legalName} className="sm:col-span-2" hint="If it differs from the name above, e.g. Northwind Studio LLC.">
              <Input id="legalName" name="legalName" autoComplete="organization" className="h-9" />
            </Field>
            <Field label="EIN" htmlFor="taxId" optional error={errors.taxId}>
              <Input
                id="taxId"
                name="taxId"
                inputMode="numeric"
                autoComplete="off"
                value={taxId}
                onChange={(e) => setTaxId(formatEIN(e.target.value))}
                aria-invalid={errors.taxId ? true : undefined}
                placeholder="12-3456789"
                className="h-9 tabular-nums"
              />
            </Field>
            <Field label="Business phone" htmlFor="phone" optional error={errors.phone}>
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
            <Field label="State" htmlFor="state" optional error={errors.state}>
              <Select id="state" name="state" defaultValue="" autoComplete="address-level1">
                <option value="">Choose a state</option>
                {US_STATES.map(([code, label]) => (
                  <option key={code} value={code}>
                    {label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Fiscal year starts" htmlFor="fiscalYearStartMonth" error={errors.fiscalYearStartMonth}>
              <Select id="fiscalYearStartMonth" name="fiscalYearStartMonth" defaultValue="1">
                {MONTHS.map((m, i) => (
                  <option key={m} value={i + 1}>
                    {m}
                  </option>
                ))}
              </Select>
            </Field>
            <Field
              label="Default payment terms"
              htmlFor="defaultPaymentTerms"
              error={errors.defaultPaymentTerms}
              hint="Used to set due dates on new invoices."
              className="sm:col-span-2"
            >
              <Select id="defaultPaymentTerms" name="defaultPaymentTerms" defaultValue="net_30">
                {DEFAULT_TERMS_OPTIONS.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        </div>
      </div>

      {state.error && <FormMessage>{state.error}</FormMessage>}

      <SubmitButton pending={pending} pendingLabel="Creating your workspace…" className="h-10 w-full">
        Create workspace
        <Icons.arrowRight className="size-4" />
      </SubmitButton>
    </form>
  );
}
