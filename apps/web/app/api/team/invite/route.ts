import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSiteUrl } from "@/lib/site-url";

const VALID_ROLES = ["admin", "accountant", "staff", "viewer"] as const;

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  const role = body?.role;
  const tenantId = typeof body?.tenantId === "string" ? body.tenantId : "";

  if (!email || !tenantId || !VALID_ROLES.includes(role)) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const { data: membership } = await supabase
    .from("memberships")
    .select("role")
    .eq("tenant_id", tenantId)
    .eq("user_id", user.id)
    .eq("status", "active")
    .single();

  if (!membership || !["owner", "admin"].includes(membership.role)) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }

  const origin = await getSiteUrl();
  const admin = createAdminClient();

  let invitedUserId: string | null = null;

  const { data: inviteData, error: inviteError } =
    await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${origin}/auth/callback?tenant_id=${tenantId}`,
    });

  if (inviteError) {
    if (inviteError.code === "email_exists") {
      const { data: existingId, error: lookupError } = await supabase.rpc(
        "lookup_user_id_by_email",
        { p_email: email },
      );

      if (lookupError || !existingId) {
        return NextResponse.json(
          { error: "Couldn't find that user." },
          { status: 404 },
        );
      }

      invitedUserId = existingId as string;
    } else {
      return NextResponse.json({ error: inviteError.message }, { status: 400 });
    }
  } else {
    invitedUserId = inviteData.user.id;
  }

  const { error: membershipError } = await supabase
    .from("memberships")
    .upsert(
      {
        tenant_id: tenantId,
        user_id: invitedUserId,
        role,
        status: "invited",
      },
      { onConflict: "tenant_id,user_id" },
    );

  if (membershipError) {
    return NextResponse.json({ error: membershipError.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
