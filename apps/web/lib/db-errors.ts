const MIGRATION = "supabase/migrations/20261008120000_workspace_profile_projects_inventory.sql";

// PostgREST can't find a table/function/column (schema cache), or Postgres itself can't.
const MISSING_SCHEMA_CODES = new Set(["PGRST202", "PGRST204", "PGRST205", "42P01", "42703", "42883"]);

/** True when a query failed only because the latest migration isn't applied yet. */
export function isMissingSchema(error: { code?: string } | null | undefined): boolean {
  return !!error?.code && MISSING_SCHEMA_CODES.has(error.code);
}

export const LATEST_MIGRATION = MIGRATION;

/**
 * Turns a Supabase/Postgres error into a sentence for the form. The posting
 * functions already raise readable messages ("the due date can't be before the
 * issue date"); this capitalizes them and explains the one setup error people hit
 * when the latest migration hasn't been applied yet.
 */
export function friendlyDbError(error: { code?: string; message: string }): string {
  if (error.code && MISSING_SCHEMA_CODES.has(error.code)) {
    return `The database is missing the latest update (${MIGRATION}). Apply that migration in Supabase, then try again.`;
  }
  const message = error.message.replace(/^ERROR:\s*/i, "").trim();
  return message.charAt(0).toUpperCase() + message.slice(1);
}
