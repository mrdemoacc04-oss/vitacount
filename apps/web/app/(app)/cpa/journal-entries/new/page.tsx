import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loadTenantContext } from "@/lib/tenant/data";
import { Icons } from "@/components/icons";
import { NewJournalEntryForm } from "@/components/new-journal-entry-form";

export default async function NewJournalEntryPage() {
  const { activeTenantId, role } = await loadTenantContext();
  if (!activeTenantId) redirect("/onboarding");

  if (!role || !["owner", "admin", "accountant"].includes(role)) {
    return (
      <div className="flex flex-col items-center rounded-xl border border-dashed border-border bg-card px-6 py-14 text-center">
        <span className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Icons.shield className="size-5" />
        </span>
        <h2 className="mt-4 text-[15px] font-semibold text-foreground">You can&apos;t post journal entries</h2>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">Only owners, admins, and accountants can post journal entries.</p>
      </div>
    );
  }

  const supabase = await createClient();
  const { data: accounts } = await supabase
    .from("accounts")
    .select("id, code, name")
    .eq("tenant_id", activeTenantId)
    .eq("is_active", true)
    .order("code");

  return (
    <div>
      <Link href="/cpa/journal-entries" className="inline-flex items-center gap-1 text-[13px] text-muted-foreground transition-colors hover:text-foreground">
        <Icons.chevronRight className="size-3.5 rotate-180" />
        Journal entries
      </Link>
      <h2 className="mt-2 font-heading text-lg font-semibold tracking-tight">New journal entry</h2>
      <p className="mt-1 text-sm text-muted-foreground">Post an adjustment straight to the ledger. Total debits must equal total credits.</p>
      <div className="mt-6">
        <NewJournalEntryForm tenantId={activeTenantId} accounts={accounts ?? []} />
      </div>
    </div>
  );
}
