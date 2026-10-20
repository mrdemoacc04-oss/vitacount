import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loadTenantContext } from "@/lib/tenant/data";
import { SchemaNotice } from "@/components/schema-notice";
import { FormMessage, FormSection } from "@/components/ui/field";
import { ReadOnlyNotice, ReadOnlyRows, SettingsHeading } from "@/components/settings/settings-form";
import { WorkspaceForm } from "@/components/settings/workspace-form";
import { loadWorkspaceProfile } from "@/components/settings/workspace-profile";
import { MONTHS, stateName, timeZoneLabel } from "@/components/settings/options";

export default async function WorkspaceSettingsPage() {
  const { activeTenantId, role } = await loadTenantContext();
  if (!activeTenantId) redirect("/onboarding");

  const supabase = await createClient();
  const result = await loadWorkspaceProfile(supabase, activeTenantId);
  const canEdit = role === "owner" || role === "admin";

  return (
    <>
      <SettingsHeading title="Workspace" description="Company details, contact information and address for this workspace." />

      {result.status === "missing-schema" ? (
        <SchemaNotice feature="Workspace settings" />
      ) : result.status === "error" ? (
        <FormMessage>{result.error}</FormMessage>
      ) : canEdit ? (
        <WorkspaceForm tenantId={activeTenantId} profile={result.profile} />
      ) : (
        <>
          <ReadOnlyNotice role={role} />
          <div className="rounded-xl border border-border bg-card px-5 py-6 shadow-soft-sm md:px-7">
            <FormSection title="Company">
              <ReadOnlyRows
                rows={[
                  ["Display name", result.profile.name],
                  ["Legal name", result.profile.legalName],
                  ["EIN / tax ID", result.profile.taxId],
                ]}
              />
            </FormSection>
            <FormSection title="Contact">
              <ReadOnlyRows
                rows={[
                  ["Business email", result.profile.email],
                  ["Phone", result.profile.phone],
                  ["Website", result.profile.website],
                ]}
              />
            </FormSection>
            <FormSection title="Address">
              <ReadOnlyRows
                rows={[
                  [
                    "Address",
                    [
                      result.profile.address.line1,
                      result.profile.address.line2,
                      [result.profile.address.city, [stateName(result.profile.address.state), result.profile.address.postalCode].filter(Boolean).join(" ")]
                        .filter(Boolean)
                        .join(", "),
                      result.profile.address.line1 || result.profile.address.city ? result.profile.address.country : "",
                    ]
                      .filter(Boolean)
                      .join("\n"),
                  ],
                ]}
              />
            </FormSection>
            <FormSection title="Fiscal year and time">
              <ReadOnlyRows
                rows={[
                  ["Fiscal year starts in", MONTHS[result.profile.fiscalYearStartMonth - 1] ?? "January"],
                  ["Time zone", timeZoneLabel(result.profile.timezone)],
                ]}
              />
            </FormSection>
          </div>
        </>
      )}
    </>
  );
}
