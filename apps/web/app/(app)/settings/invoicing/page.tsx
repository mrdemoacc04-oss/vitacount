import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loadTenantContext } from "@/lib/tenant/data";
import { SchemaNotice } from "@/components/schema-notice";
import { FormMessage, FormSection } from "@/components/ui/field";
import { ReadOnlyNotice, ReadOnlyRows, SettingsHeading } from "@/components/settings/settings-form";
import { InvoicingForm } from "@/components/settings/invoicing-form";
import { loadWorkspaceProfile } from "@/components/settings/workspace-profile";
import { termsOptionLabel } from "@/components/settings/options";
import { formatPercent } from "@/lib/money";

export default async function InvoicingSettingsPage() {
  const { activeTenantId, role } = await loadTenantContext();
  if (!activeTenantId) redirect("/onboarding");

  const supabase = await createClient();
  const result = await loadWorkspaceProfile(supabase, activeTenantId);
  const canEdit = role === "owner" || role === "admin";

  return (
    <>
      <SettingsHeading title="Invoicing" description="Defaults for new invoices and the wording printed on every document you send." />

      {result.status === "missing-schema" ? (
        <SchemaNotice feature="Workspace settings" />
      ) : result.status === "error" ? (
        <FormMessage>{result.error}</FormMessage>
      ) : canEdit ? (
        <InvoicingForm tenantId={activeTenantId} profile={result.profile} />
      ) : (
        <>
          <ReadOnlyNotice role={role} />
          <div className="rounded-xl border border-border bg-card px-5 py-6 shadow-soft-sm md:px-7">
            <FormSection title="Defaults">
              <ReadOnlyRows
                rows={[
                  ["Payment terms", termsOptionLabel(result.profile.defaultPaymentTerms)],
                  ["Sales tax rate", formatPercent(result.profile.defaultTaxRate)],
                ]}
              />
            </FormSection>
            <FormSection title="Notes and footer">
              <ReadOnlyRows
                rows={[
                  ["Notes to customer", result.profile.invoiceNotes],
                  ["Footer", result.profile.invoiceFooter],
                ]}
              />
            </FormSection>
          </div>
        </>
      )}
    </>
  );
}
