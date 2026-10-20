import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadTenantContext } from "@/lib/tenant/data";
import { friendlyDbError } from "@/lib/db-errors";
import { FormMessage } from "@/components/ui/field";
import { Icons } from "@/components/icons";
import { InviteForm } from "@/components/invite-form";
import { MembersTable, type TeamMember } from "@/components/settings/members-table";
import { ROLES, ROLE_BADGE, ROLE_LABEL, ROLE_SUMMARY } from "@/components/settings/options";

const STATUS_ORDER: Record<string, number> = { active: 0, invited: 1 };
const ROLE_ORDER: Record<string, number> = Object.fromEntries(ROLES.map((r, i) => [r, i]));

/**
 * Emails live in auth.users, which members can't read. The service-role client
 * looks up only the user ids already returned (through RLS) for this workspace.
 * Without the service key the list simply shows names.
 */
async function loadEmails(userIds: string[]): Promise<Map<string, string>> {
  const emails = new Map<string, string>();
  if (userIds.length === 0) return emails;
  try {
    const admin = createAdminClient();
    const results = await Promise.all(userIds.map((id) => admin.auth.admin.getUserById(id)));
    for (const { data } of results) {
      if (data.user?.email) emails.set(data.user.id, data.user.email);
    }
  } catch {
    // no service role key in this environment
  }
  return emails;
}

export default async function TeamPage() {
  const { activeTenantId, activeTenant, role } = await loadTenantContext();
  if (!activeTenantId) redirect("/onboarding");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: memberships, error } = await supabase
    .from("memberships")
    .select("id, user_id, role, status, invited_at")
    .eq("tenant_id", activeTenantId)
    .order("invited_at", { ascending: true });

  const rows = memberships ?? [];
  const userIds = rows.map((m) => m.user_id);
  const [{ data: profiles }, emails] = await Promise.all([
    userIds.length > 0
      ? supabase.from("profiles").select("id, full_name").in("id", userIds)
      : Promise.resolve({ data: [] as { id: string; full_name: string | null }[] }),
    loadEmails(userIds),
  ]);
  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));

  const members: TeamMember[] = rows
    .map((m) => ({
      id: m.id,
      userId: m.user_id,
      name: nameById.get(m.user_id) ?? null,
      email: emails.get(m.user_id) ?? (m.user_id === user.id ? (user.email ?? null) : null),
      role: m.role,
      status: m.status,
      joinedAt: m.invited_at,
    }))
    .sort(
      (a, b) =>
        (STATUS_ORDER[a.status] ?? 2) - (STATUS_ORDER[b.status] ?? 2) ||
        (ROLE_ORDER[a.role] ?? 9) - (ROLE_ORDER[b.role] ?? 9) ||
        (a.joinedAt ?? "").localeCompare(b.joinedAt ?? ""),
    );

  const activeCount = members.filter((m) => m.status === "active").length;
  const invitedCount = members.length - activeCount;
  const canManage = role === "owner" || role === "admin";

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">Team</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {activeCount} {activeCount === 1 ? "member" : "members"}
            {invitedCount > 0 ? `, ${invitedCount} invited` : ""}
            {activeTenant?.name ? ` in ${activeTenant.name}` : ""}.{" "}
            {canManage ? "Invite teammates and decide what each person can do." : "Only owners and admins can invite people or change roles."}
          </p>
        </div>
        <Link
          href="/settings/workspace"
          className="group inline-flex items-center gap-1 text-[13px] text-muted-foreground transition-colors hover:text-primary"
        >
          Workspace settings
          <Icons.arrowRight className="size-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
        </Link>
      </header>

      <section aria-labelledby="members-heading">
        <h2 id="members-heading" className="sr-only">
          Members
        </h2>
        {error ? (
          <FormMessage>{friendlyDbError(error)}</FormMessage>
        ) : (
          <MembersTable tenantId={activeTenantId} members={members} currentUserId={user.id} viewerRole={role} />
        )}
      </section>

      {canManage && (
        <section aria-labelledby="invite-heading" className="rounded-xl border border-border bg-card p-5 shadow-soft-sm md:p-6">
          <div className="mb-5 flex items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Icons.userPlus className="size-[18px]" />
            </span>
            <div>
              <h2 id="invite-heading" className="text-[15px] font-semibold text-foreground">
                Invite a teammate
              </h2>
              <p className="mt-0.5 text-[13px] text-muted-foreground">
                We&apos;ll email them a link to join {activeTenant?.name ?? "this workspace"}. You can change their role at any time.
              </p>
            </div>
          </div>
          <InviteForm tenantId={activeTenantId} />
        </section>
      )}

      <section aria-labelledby="roles-heading">
        <h2 id="roles-heading" className="text-[15px] font-semibold text-foreground">
          What each role can do
        </h2>
        <p className="mt-1 text-[13px] text-muted-foreground">
          Roles apply to this workspace only. Someone can be an owner here and a viewer somewhere else.
        </p>
        <dl className="mt-4 divide-y divide-border rounded-xl border border-border bg-card shadow-soft-sm">
          {ROLES.map((r) => (
            <div key={r} className="grid gap-1.5 px-5 py-3.5 sm:grid-cols-[120px_minmax(0,1fr)] sm:gap-4">
              <dt>
                <span className={`rounded-md px-1.5 py-0.5 text-[11px] font-medium ${ROLE_BADGE[r]}`}>{ROLE_LABEL[r]}</span>
              </dt>
              <dd className="text-[13px] leading-relaxed text-muted-foreground">{ROLE_SUMMARY[r]}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
