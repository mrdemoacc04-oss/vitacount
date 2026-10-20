"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Field, FormSection, Select } from "@/components/ui/field";
import { MONTHS, US_STATES, US_TIME_ZONES, isUnitedStates } from "@/components/settings/options";
import { SettingsFormShell, useSettingsAction } from "@/components/settings/settings-form";
import type { WorkspaceProfile } from "@/components/settings/workspace-profile";
import { updateWorkspaceAction } from "@/lib/actions/settings";

const inputClass = "h-9 px-3";

export function WorkspaceForm({ tenantId, profile }: { tenantId: string; profile: WorkspaceProfile }) {
  const form = useSettingsAction(updateWorkspaceAction.bind(null, tenantId));
  const { errors } = form;
  const [country, setCountry] = useState(profile.address.country);
  const us = isUnitedStates(country);
  const zones: readonly (readonly [string, string])[] = US_TIME_ZONES.some(([tz]) => tz === profile.timezone)
    ? US_TIME_ZONES
    : [[profile.timezone, profile.timezone], ...US_TIME_ZONES];

  const invalid = (name: string) =>
    errors[name] ? { "aria-invalid": true as const, "aria-describedby": `${name}-hint` } : { "aria-describedby": `${name}-hint` };

  return (
    <SettingsFormShell form={form} footerNote="Shown on invoices, receipts and reports.">
      <FormSection title="Company" description="How your business is named across VitaCount and on the documents you send.">
        <Field label="Display name" htmlFor="name" required error={errors.name} hint="Used in the app, and on invoices when there's no legal name.">
          <Input id="name" name="name" defaultValue={profile.name} autoComplete="organization" className={inputClass} {...invalid("name")} />
        </Field>
        <Field label="Legal name" htmlFor="legalName" optional hint="As registered, for example Acme Holdings LLC. Printed on invoices.">
          <Input id="legalName" name="legalName" defaultValue={profile.legalName} className={inputClass} {...invalid("legalName")} />
        </Field>
        <Field label="EIN / tax ID" htmlFor="taxId" optional error={errors.taxId} hint="Nine digits for an EIN. Shown in the invoice header.">
          <Input
            id="taxId"
            name="taxId"
            defaultValue={profile.taxId}
            placeholder="12-3456789"
            autoComplete="off"
            className={`${inputClass} max-w-56 tabular-nums`}
            {...invalid("taxId")}
          />
        </Field>
      </FormSection>

      <FormSection title="Contact" description="Where customers can reach you. Printed in the header of your documents.">
        <Field label="Business email" htmlFor="email" optional error={errors.email}>
          <Input
            id="email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            defaultValue={profile.email}
            placeholder="billing@yourcompany.com"
            className={inputClass}
            {...invalid("email")}
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Phone" htmlFor="phone" optional error={errors.phone}>
            <Input
              id="phone"
              name="phone"
              type="tel"
              autoComplete="tel"
              defaultValue={profile.phone}
              placeholder="(555) 123-4567"
              className={inputClass}
              {...invalid("phone")}
            />
          </Field>
          <Field label="Website" htmlFor="website" optional error={errors.website}>
            <Input
              id="website"
              name="website"
              inputMode="url"
              autoComplete="url"
              defaultValue={profile.website}
              placeholder="yourcompany.com"
              className={inputClass}
              {...invalid("website")}
            />
          </Field>
        </div>
      </FormSection>

      <FormSection title="Address" description="Your business address, as it should appear on invoices.">
        <Field label="Street address" htmlFor="line1" optional>
          <Input id="line1" name="line1" autoComplete="address-line1" defaultValue={profile.address.line1} className={inputClass} />
        </Field>
        <Field label="Apartment, suite, etc." htmlFor="line2" optional>
          <Input id="line2" name="line2" autoComplete="address-line2" defaultValue={profile.address.line2} className={inputClass} />
        </Field>
        <Field label="City" htmlFor="city" optional>
          <Input id="city" name="city" autoComplete="address-level2" defaultValue={profile.address.city} className={inputClass} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_160px]">
          {us ? (
            <Field label="State" htmlFor="state" optional error={errors.state}>
              <Select
                id="state"
                name="state"
                autoComplete="address-level1"
                defaultValue={US_STATES.some(([code]) => code === profile.address.state) ? profile.address.state : ""}
                {...invalid("state")}
              >
                <option value="">Select a state</option>
                {US_STATES.map(([code, label]) => (
                  <option key={code} value={code}>
                    {label}
                  </option>
                ))}
              </Select>
            </Field>
          ) : (
            <Field label="State / region" htmlFor="state" optional error={errors.state}>
              <Input id="state" name="state" autoComplete="address-level1" defaultValue={profile.address.state} className={inputClass} />
            </Field>
          )}
          <Field label={us ? "ZIP code" : "Postal code"} htmlFor="postalCode" optional error={errors.postalCode}>
            <Input
              id="postalCode"
              name="postalCode"
              autoComplete="postal-code"
              inputMode={us ? "numeric" : "text"}
              defaultValue={profile.address.postalCode}
              placeholder={us ? "94107" : undefined}
              className={`${inputClass} tabular-nums`}
              {...invalid("postalCode")}
            />
          </Field>
        </div>
        <Field label="Country" htmlFor="country">
          <Input
            id="country"
            name="country"
            autoComplete="country-name"
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            className={`${inputClass} max-w-72`}
          />
        </Field>
      </FormSection>

      <FormSection title="Fiscal year and time" description="Sets where your financial year begins for reports, and the clock dates are counted on.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Fiscal year starts in" htmlFor="fiscalYearStartMonth" error={errors.fiscalYearStartMonth}>
            <Select id="fiscalYearStartMonth" name="fiscalYearStartMonth" defaultValue={String(profile.fiscalYearStartMonth)}>
              {MONTHS.map((month, i) => (
                <option key={month} value={i + 1}>
                  {month}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Time zone" htmlFor="timezone">
            <Select id="timezone" name="timezone" defaultValue={profile.timezone}>
              {zones.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </FormSection>
    </SettingsFormShell>
  );
}
