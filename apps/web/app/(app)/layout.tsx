import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loadTenantContext } from "@/lib/tenant/data";
import { TenantProvider } from "@/lib/tenant/context";
import { AppShell } from "@/components/app-shell";
import { AgentChat } from "@/components/agent-chat";
import { AgentCursor } from "@/components/agent-cursor";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { memberships, activeTenantId, activeTenant, role } =
    await loadTenantContext();

  if (memberships.length === 0) {
    redirect("/onboarding");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .single();

  return (
    <TenantProvider value={{ memberships, activeTenantId, activeTenant, role }}>
      <AppShell fullName={profile?.full_name ?? null} email={user.email ?? null}>
        {children}
      </AppShell>
      <AgentChat />
      <AgentCursor />
    </TenantProvider>
  );
}
