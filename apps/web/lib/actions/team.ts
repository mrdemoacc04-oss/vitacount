"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { friendlyDbError } from "@/lib/db-errors";
import { ROLE_LABEL, isRole } from "@/components/settings/options";

export type TeamActionState = { error: string | null };

type Supabase = Awaited<ReturnType<typeof createClient>>;

type Context =
  | {
      ok: true;
      supabase: Supabase;
      userId: string;
      callerRole: string;
      target: { id: string; user_id: string; role: string; status: string };
    }
  | { ok: false; error: string };

/** Loads the caller's own membership and the membership being changed, and checks the caller may manage the team. */
async function loadContext(tenantId: string, membershipId: string): Promise<Context> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Your session has ended. Sign in again." };

  const { data: caller } = await supabase
    .from("memberships")
    .select("role")
    .eq("tenant_id", tenantId)
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();
  if (!caller || !["owner", "admin"].includes(caller.role)) {
    return { ok: false, error: "Only owners and admins can manage the team." };
  }

  const { data: target, error } = await supabase
    .from("memberships")
    .select("id, user_id, role, status")
    .eq("id", membershipId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (error) return { ok: false, error: friendlyDbError(error) };
  if (!target) return { ok: false, error: "That person isn't on this team anymore. Refresh the page." };

  return { ok: true, supabase, userId: user.id, callerRole: caller.role, target };
}

async function activeOwnerCount(supabase: Supabase, tenantId: string): Promise<number> {
  const { count } = await supabase
    .from("memberships")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .eq("role", "owner")
    .eq("status", "active");
  return count ?? 0;
}

export async function changeMemberRoleAction(tenantId: string, membershipId: string, role: string): Promise<TeamActionState> {
  if (!isRole(role)) return { error: "Pick a role from the list." };

  const ctx = await loadContext(tenantId, membershipId);
  if (!ctx.ok) return { error: ctx.error };
  const { supabase, target, callerRole } = ctx;

  if (target.role === role) return { error: null };

  if ((target.role === "owner" || role === "owner") && callerRole !== "owner") {
    return { error: "Only an owner can make someone an owner, or change an owner's role." };
  }
  if (target.role === "owner" && target.status === "active" && (await activeOwnerCount(supabase, tenantId)) <= 1) {
    return {
      error:
        target.user_id === ctx.userId
          ? "You're the only owner. Make someone else an owner before changing your own role."
          : "Every workspace needs at least one owner. Make someone else an owner first.",
    };
  }

  const { data, error } = await supabase
    .from("memberships")
    .update({ role })
    .eq("id", membershipId)
    .eq("tenant_id", tenantId)
    .select("id");
  if (error) return { error: friendlyDbError(error) };
  if (!data || data.length === 0) return { error: `You don't have permission to make this person ${ROLE_LABEL[role].toLowerCase()}.` };

  revalidatePath("/team");
  if (target.user_id === ctx.userId) revalidatePath("/", "layout");
  return { error: null };
}

export async function removeMemberAction(tenantId: string, membershipId: string): Promise<TeamActionState> {
  const ctx = await loadContext(tenantId, membershipId);
  if (!ctx.ok) return { error: ctx.error };
  const { supabase, target, callerRole } = ctx;
  const isSelf = target.user_id === ctx.userId;

  if (target.role === "owner" && callerRole !== "owner") {
    return { error: "Only an owner can remove another owner." };
  }
  if (target.role === "owner" && target.status === "active" && (await activeOwnerCount(supabase, tenantId)) <= 1) {
    return {
      error: isSelf
        ? "You're the only owner, so you can't leave. Make someone else an owner first."
        : "Every workspace needs at least one owner. Make someone else an owner first.",
    };
  }

  const { data, error } = await supabase
    .from("memberships")
    .delete()
    .eq("id", membershipId)
    .eq("tenant_id", tenantId)
    .select("id");
  if (error) return { error: friendlyDbError(error) };
  if (!data || data.length === 0) return { error: "You don't have permission to remove this person." };

  if (isSelf) {
    // You just left this workspace: go somewhere you still have access to.
    revalidatePath("/", "layout");
    redirect("/dashboard");
  }

  revalidatePath("/team");
  return { error: null };
}
