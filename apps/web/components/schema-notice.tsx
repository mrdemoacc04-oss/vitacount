import { LATEST_MIGRATION } from "@/lib/db-errors";
import { Icons } from "@/components/icons";

/**
 * Shown in place of a page whose tables come from a migration that hasn't been
 * applied to this Supabase project yet — a setup step, not a crash.
 */
export function SchemaNotice({ feature }: { feature: string }) {
  return (
    <div className="mx-auto max-w-xl rounded-xl border border-border bg-card p-6">
      <span className="flex size-9 items-center justify-center rounded-lg bg-warning/12 text-warning">
        <Icons.alert className="size-[18px]" />
      </span>
      <h2 className="mt-4 text-[15px] font-semibold text-foreground">{feature} needs a database update</h2>
      <p className="mt-1.5 text-sm text-muted-foreground">
        The tables behind {feature.toLowerCase()} haven&apos;t been added to this workspace&apos;s database yet. Run this
        migration in the Supabase SQL editor, then reload the page:
      </p>
      <code className="mt-3 block break-all rounded-lg bg-muted px-3 py-2 font-mono text-xs text-foreground">{LATEST_MIGRATION}</code>
    </div>
  );
}
