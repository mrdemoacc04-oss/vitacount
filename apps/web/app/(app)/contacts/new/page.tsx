import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loadTenantContext } from "@/lib/tenant/data";
import { Icons } from "@/components/icons";
import { NewContactForm, type ContactKind } from "@/components/new-contact-form";
import { loadFormCatalog } from "@/components/forms/load-catalog";
import { PAYMENT_TERMS } from "@/lib/documents";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

const TITLES: Record<ContactKind, string> = { customer: "New customer", vendor: "New supplier", both: "New contact" };

export default async function NewContactPage({ searchParams }: { searchParams: SearchParams }) {
  const { activeTenantId } = await loadTenantContext();
  if (!activeTenantId) redirect("/onboarding");

  const params = await searchParams;
  const typeParam = first(params.type);
  const type: ContactKind = typeParam === "vendor" || typeParam === "supplier" ? "vendor" : typeParam === "both" ? "both" : "customer";
  const returnParam = first(params.returnTo);
  const returnTo = returnParam && returnParam.startsWith("/") && !returnParam.startsWith("//") ? returnParam : undefined;

  const supabase = await createClient();
  const { defaults } = await loadFormCatalog(supabase, activeTenantId, { defaults: true });
  const defaultTerms = PAYMENT_TERMS.some((t) => t.value === defaults?.paymentTerms) ? defaults!.paymentTerms! : "net_30";

  const backHref = returnTo ?? "/contacts";
  const backLabel = returnTo?.startsWith("/sales") ? "Back to sale" : returnTo?.startsWith("/expenses") ? "Back to expense" : "Contacts";

  return (
    <div className="mx-auto max-w-4xl">
      <Link href={backHref} className="inline-flex items-center gap-1 text-[13px] text-muted-foreground transition-colors hover:text-foreground">
        <Icons.chevronRight className="size-3.5 rotate-180" />
        {backLabel}
      </Link>
      <h1 className="mt-2 font-heading text-2xl font-semibold tracking-tight">{TITLES[type]}</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {returnTo ? "Save it and you'll go straight back to what you were doing." : "Add someone you sell to, buy from, or both."}
      </p>
      <div className="mt-8">
        <NewContactForm tenantId={activeTenantId} defaultType={type} defaultTerms={defaultTerms} returnTo={returnTo} cancelHref={backHref} />
      </div>
    </div>
  );
}
