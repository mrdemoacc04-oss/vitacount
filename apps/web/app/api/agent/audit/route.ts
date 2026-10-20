import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { loadTenantContext } from "@/lib/tenant/data";

export const runtime = "nodejs";

/**
 * Records an action Vita took in the UI after the user approved it — the same
 * agent_actions trail the other agents write to, so the review/audit views
 * show what Vita did on whose say-so.
 */
export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const { activeTenantId } = await loadTenantContext();
  if (!activeTenantId) return NextResponse.json({ error: "No active workspace." }, { status: 400 });

  const body = await req.json().catch(() => null);
  const summary = typeof body?.summary === "string" ? body.summary.slice(0, 500) : "";
  const path = typeof body?.path === "string" ? body.path.slice(0, 300) : "";
  const fields = Array.isArray(body?.fields)
    ? body.fields
        .slice(0, 40)
        .filter((f: unknown): f is { label: string; value: string } => {
          const r = f as Record<string, unknown>;
          return typeof r?.label === "string" && typeof r?.value === "string";
        })
        .map((f: { label: string; value: string }) => ({ label: f.label.slice(0, 100), value: f.value.slice(0, 300) }))
    : [];
  if (!summary) return NextResponse.json({ error: "summary is required." }, { status: 400 });

  const now = new Date().toISOString();
  const { error } = await supabase.from("agent_actions").insert({
    tenant_id: activeTenantId,
    agent_name: "vita",
    module: "ui",
    trigger_event: "user_request",
    input_context: { path, fields },
    proposed_action: { summary },
    autonomy_level: 1,
    status: "approved",
    reviewed_by: user.id,
    reviewed_at: now,
    executed_at: now,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
