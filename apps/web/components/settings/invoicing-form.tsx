"use client";

import { useState } from "react";
import { Field, FormSection, Select, Textarea } from "@/components/ui/field";
import { PercentInput } from "@/components/percent-input";
import { DEFAULT_TERMS_OPTIONS } from "@/components/settings/options";
import { SettingsFormShell, useSettingsAction } from "@/components/settings/settings-form";
import type { WorkspaceProfile } from "@/components/settings/workspace-profile";
import { fractionToPercentText } from "@/lib/money";
import { updateInvoicingAction } from "@/lib/actions/settings";

export function InvoicingForm({ tenantId, profile }: { tenantId: string; profile: WorkspaceProfile }) {
  const form = useSettingsAction(updateInvoicingAction.bind(null, tenantId));
  const { errors } = form;
  const [taxText, setTaxText] = useState(() => fractionToPercentText(profile.defaultTaxRate));
  const [notes, setNotes] = useState(profile.invoiceNotes);
  const [footer, setFooter] = useState(profile.invoiceFooter);

  return (
    <SettingsFormShell form={form} footerNote="Applies to new documents. Ones you've already sent don't change.">
      <FormSection title="Payment terms" description="When customers are expected to pay. You can still change terms on any single invoice.">
        <Field label="Default payment terms" htmlFor="defaultPaymentTerms" error={errors.defaultPaymentTerms}>
          <Select id="defaultPaymentTerms" name="defaultPaymentTerms" defaultValue={profile.defaultPaymentTerms} className="max-w-64">
            {DEFAULT_TERMS_OPTIONS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
      </FormSection>

      <FormSection title="Sales tax" description="The rate new invoice lines start with. Set a line to 0% for anything that isn't taxable.">
        <Field
          label="Default sales tax rate"
          htmlFor="defaultTaxRate"
          error={errors.defaultTaxRate}
          hint="Your combined state and local rate. Type 8.25 for 8.25%."
        >
          <div className="max-w-36">
            <PercentInput id="defaultTaxRate" value={taxText} onChange={setTaxText} aria-label="Default sales tax rate (percent)" className="[&_input]:h-9" />
          </div>
          <input type="hidden" name="defaultTaxRate" value={taxText} />
        </Field>
      </FormSection>

      <FormSection title="Notes and footer" description="Printed at the bottom of every invoice and receipt you send or download.">
        <Field label="Notes to customer" htmlFor="invoiceNotes" optional hint="For example a thank-you, or what to do with questions about a bill.">
          <Textarea
            id="invoiceNotes"
            name="invoiceNotes"
            rows={3}
            maxLength={2000}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Thank you for your business."
          />
        </Field>
        <Field label="Footer" htmlFor="invoiceFooter" optional hint="Good for payment instructions: bank details, who to make checks out to, late fees.">
          <Textarea
            id="invoiceFooter"
            name="invoiceFooter"
            rows={3}
            maxLength={2000}
            value={footer}
            onChange={(e) => setFooter(e.target.value)}
            placeholder="Pay by ACH to account ending 1234, or make checks payable to your company name."
          />
        </Field>

        <div>
          <p className="text-[13px] font-medium text-foreground">Preview</p>
          <p className="mt-0.5 text-xs text-muted-foreground">The bottom of an invoice, as your customer sees it.</p>
          <InvoiceFooterPreview notes={notes} footer={footer} />
        </div>
      </FormSection>
    </SettingsFormShell>
  );
}

/** Mimics the bottom of SalesDocumentPaper: fixed ink on white, like the printed page. */
function InvoiceFooterPreview({ notes, footer }: { notes: string; footer: string }) {
  const hasNotes = notes.trim() !== "";
  const hasFooter = footer.trim() !== "";
  return (
    <div aria-hidden="true" className="mt-2 overflow-hidden rounded-lg border border-border bg-white p-5 text-[11px] leading-relaxed text-zinc-900 shadow-soft-sm">
      {/* line items and totals, abstracted */}
      <div className="flex flex-col gap-1.5">
        <div className="h-2 w-full rounded-sm bg-zinc-100" />
        <div className="flex justify-between gap-6">
          <div className="h-1.5 w-2/5 rounded-sm bg-zinc-200" />
          <div className="h-1.5 w-12 rounded-sm bg-zinc-200" />
        </div>
        <div className="flex justify-between gap-6">
          <div className="h-1.5 w-1/3 rounded-sm bg-zinc-200" />
          <div className="h-1.5 w-12 rounded-sm bg-zinc-200" />
        </div>
        <div className="mt-2 flex justify-end">
          <div className="h-2 w-28 rounded-sm bg-zinc-300" />
        </div>
      </div>

      {hasNotes ? (
        <div className="mt-5">
          <p className="text-[9.5px] font-semibold uppercase tracking-wider text-zinc-500">Notes</p>
          <p className="mt-0.5 whitespace-pre-line break-words text-zinc-700">{notes.trim()}</p>
        </div>
      ) : null}
      {hasFooter ? (
        <p className="mt-5 whitespace-pre-line break-words border-t border-zinc-200 pt-3 text-center text-[10px] text-zinc-500">{footer.trim()}</p>
      ) : null}
      {!hasNotes && !hasFooter && (
        <p className="mt-5 border-t border-dashed border-zinc-200 pt-3 text-center text-[10px] text-zinc-400">
          Add notes or a footer to see them here.
        </p>
      )}
    </div>
  );
}
