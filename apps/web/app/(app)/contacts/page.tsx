import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loadTenantContext } from "@/lib/tenant/data";
import { Icons } from "@/components/icons";
import { PAYMENT_TERMS } from "@/lib/documents";
import { cn } from "@/lib/utils";
import { ContactsSearch } from "./contacts-search";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

const TABS = [
  { value: "all", label: "All" },
  { value: "customers", label: "Customers" },
  { value: "suppliers", label: "Suppliers" },
] as const;
type Tab = (typeof TABS)[number]["value"];

const TYPE_BADGE: Record<string, { label: string; className: string }> = {
  customer: { label: "Customer", className: "bg-accent text-accent-foreground" },
  vendor: { label: "Supplier", className: "bg-secondary text-secondary-foreground" },
  both: { label: "Customer and supplier", className: "bg-positive/10 text-positive" },
};

function termsText(value: string): string {
  return PAYMENT_TERMS.find((t) => t.value === value)?.label ?? value.replace(/_/g, " ");
}

function formatPhone(value: string | null): string | null {
  if (!value) return null;
  const d = value.replace(/\D/g, "");
  const ten = d.length === 11 && d.startsWith("1") ? d.slice(1) : d;
  return ten.length === 10 ? `(${ten.slice(0, 3)}) ${ten.slice(3, 6)}-${ten.slice(6)}` : value;
}

function companyOf(address: unknown): string | null {
  if (!address || typeof address !== "object" || Array.isArray(address)) return null;
  const company = (address as Record<string, unknown>).company;
  return typeof company === "string" && company.trim() ? company.trim() : null;
}

function cityOf(address: unknown): string | null {
  if (!address || typeof address !== "object" || Array.isArray(address)) return null;
  const a = address as Record<string, unknown>;
  const city = typeof a.city === "string" ? a.city.trim() : "";
  const state = typeof a.state === "string" ? a.state.trim() : "";
  return [city, state].filter(Boolean).join(", ") || null;
}

export default async function ContactsPage({ searchParams }: { searchParams: SearchParams }) {
  const { activeTenantId } = await loadTenantContext();
  if (!activeTenantId) redirect("/onboarding");

  const params = await searchParams;
  const tabParam = first(params.type);
  const tab: Tab = tabParam === "customers" || tabParam === "suppliers" ? tabParam : "all";
  const query = (first(params.q) ?? "").trim();
  const addedId = first(params.added);

  const supabase = await createClient();
  const { data: contacts } = await supabase
    .from("contacts")
    .select("id, display_name, type, email, phone, payment_terms, is_1099_vendor, billing_address, tax_id")
    .eq("tenant_id", activeTenantId)
    .order("display_name");

  const all = contacts ?? [];
  const counts: Record<Tab, number> = {
    all: all.length,
    customers: all.filter((c) => c.type !== "vendor").length,
    suppliers: all.filter((c) => c.type !== "customer").length,
  };

  const needle = query.toLowerCase();
  const needleDigits = query.replace(/\D/g, "");
  const shown = all.filter((c) => {
    if (tab === "customers" && c.type === "vendor") return false;
    if (tab === "suppliers" && c.type === "customer") return false;
    if (!needle) return true;
    return (
      c.display_name.toLowerCase().includes(needle) ||
      (c.email ?? "").toLowerCase().includes(needle) ||
      (companyOf(c.billing_address) ?? "").toLowerCase().includes(needle) ||
      (needleDigits.length >= 3 && (c.phone ?? "").replace(/\D/g, "").includes(needleDigits))
    );
  });

  const added = addedId ? all.find((c) => c.id === addedId) : undefined;
  const tabHref = (value: Tab) => {
    const qs = new URLSearchParams();
    if (value !== "all") qs.set("type", value);
    if (query) qs.set("q", query);
    const s = qs.toString();
    return s ? `/contacts?${s}` : "/contacts";
  };
  const newHref = tab === "suppliers" ? "/contacts/new?type=vendor" : "/contacts/new?type=customer";

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">Contacts</h1>
          <p className="mt-1 text-sm text-muted-foreground">The customers you sell to and the suppliers you buy from.</p>
        </div>
        <Link
          href={newHref}
          className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-4 text-[13px] font-medium text-primary-foreground shadow-soft-sm transition-colors hover:bg-primary/90"
        >
          <Icons.plus className="size-4" />
          New contact
        </Link>
      </div>

      {added && (
        <div role="status" className="flex items-center gap-2.5 rounded-lg border border-positive/25 bg-positive/[0.07] px-3.5 py-2.5 text-[13px] text-foreground">
          <Icons.check className="size-4 shrink-0 text-positive" />
          <span>
            <span className="font-medium">{added.display_name}</span> was added.
          </span>
          <span className="ml-auto flex gap-3">
            {added.type !== "vendor" && (
              <Link href={`/sales/new?type=invoice&customer=${added.id}`} className="font-medium text-primary hover:underline">
                Create invoice
              </Link>
            )}
            {added.type !== "customer" && (
              <Link href={`/expenses/new?type=bill&vendor=${added.id}`} className="font-medium text-primary hover:underline">
                Record bill
              </Link>
            )}
          </span>
        </div>
      )}

      {all.length === 0 ? (
        <div className="flex flex-col items-center rounded-xl border border-dashed border-border bg-card px-6 py-16 text-center">
          <span className="flex size-10 items-center justify-center rounded-full bg-accent text-primary">
            <Icons.contacts className="size-5" />
          </span>
          <h2 className="mt-4 text-[15px] font-semibold text-foreground">No contacts yet</h2>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            Add the people and businesses you work with. You&apos;ll pick them when you create invoices, bills and expenses.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <Link
              href="/contacts/new?type=customer"
              className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-4 text-[13px] font-medium text-primary-foreground shadow-soft-sm hover:bg-primary/90"
            >
              <Icons.plus className="size-4" />
              Add a customer
            </Link>
            <Link
              href="/contacts/new?type=vendor"
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-card px-4 text-[13px] font-medium text-foreground shadow-soft-sm hover:bg-muted"
            >
              Add a supplier
            </Link>
          </div>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-soft-sm">
          <div className="flex flex-col gap-3 border-b border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <nav aria-label="Filter contacts" className="flex gap-1">
              {TABS.map((t) => {
                const active = tab === t.value;
                return (
                  <Link
                    key={t.value}
                    href={tabHref(t.value)}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-[13px] transition-colors",
                      active ? "bg-accent font-medium text-accent-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                  >
                    {t.label}
                    <span className="text-xs tabular-nums text-muted-foreground">{counts[t.value]}</span>
                  </Link>
                );
              })}
            </nav>
            <Suspense>
              <ContactsSearch initialQuery={query} />
            </Suspense>
          </div>

          {shown.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <p className="text-sm font-medium text-foreground">
                {query ? <>No contacts match &ldquo;{query}&rdquo;</> : tab === "suppliers" ? "No suppliers yet" : "No customers yet"}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {query ? (
                  <Link href={tab === "all" ? "/contacts" : `/contacts?type=${tab}`} className="font-medium text-primary hover:underline">
                    Clear the search
                  </Link>
                ) : (
                  <Link href={newHref} className="font-medium text-primary hover:underline">
                    Add one
                  </Link>
                )}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[44rem] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th scope="col" className="px-4 py-2.5 font-medium">Name</th>
                    <th scope="col" className="px-4 py-2.5 font-medium">Type</th>
                    <th scope="col" className="px-4 py-2.5 font-medium">Email</th>
                    <th scope="col" className="px-4 py-2.5 font-medium">Phone</th>
                    <th scope="col" className="px-4 py-2.5 font-medium">Terms</th>
                    <th scope="col" className="px-4 py-2.5 text-right font-medium">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/70">
                  {shown.map((c) => {
                    const badge = TYPE_BADGE[c.type] ?? { label: c.type, className: "bg-muted text-muted-foreground" };
                    const company = companyOf(c.billing_address);
                    const place = cityOf(c.billing_address);
                    const sub = [company !== c.display_name ? company : null, place].filter(Boolean).join(" · ");
                    return (
                      <tr key={c.id} className={cn("transition-colors hover:bg-muted/40", c.id === addedId && "bg-positive/[0.04]")}>
                        <td className="px-4 py-3">
                          <p className="font-medium text-foreground">{c.display_name}</p>
                          {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
                        </td>
                        <td className="px-4 py-3">
                          <span className="flex flex-wrap items-center gap-1.5">
                            <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", badge.className)}>{badge.label}</span>
                            {c.is_1099_vendor && (
                              <span className="rounded-full border border-border px-2 py-0.5 text-[11px] font-medium text-muted-foreground">1099</span>
                            )}
                          </span>
                        </td>
                        <td className="max-w-[14rem] truncate px-4 py-3 text-muted-foreground">
                          {c.email ? (
                            <a href={`mailto:${c.email}`} className="hover:text-foreground hover:underline">
                              {c.email}
                            </a>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 tabular-nums text-muted-foreground">{formatPhone(c.phone) ?? "—"}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{termsText(c.payment_terms)}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-right text-[13px]">
                          {c.type !== "vendor" ? (
                            <Link href={`/sales/new?type=invoice&customer=${c.id}`} className="font-medium text-primary hover:underline">
                              Invoice
                            </Link>
                          ) : (
                            <Link href={`/expenses/new?type=bill&vendor=${c.id}`} className="font-medium text-primary hover:underline">
                              Bill
                            </Link>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
