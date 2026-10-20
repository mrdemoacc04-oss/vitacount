/**
 * Choices shared by the settings forms and the server actions that validate them.
 * Kept out of the "use server" actions file, which may only export async functions.
 */

export const US_STATES = [
  ["AL", "Alabama"],
  ["AK", "Alaska"],
  ["AZ", "Arizona"],
  ["AR", "Arkansas"],
  ["CA", "California"],
  ["CO", "Colorado"],
  ["CT", "Connecticut"],
  ["DE", "Delaware"],
  ["DC", "District of Columbia"],
  ["FL", "Florida"],
  ["GA", "Georgia"],
  ["HI", "Hawaii"],
  ["ID", "Idaho"],
  ["IL", "Illinois"],
  ["IN", "Indiana"],
  ["IA", "Iowa"],
  ["KS", "Kansas"],
  ["KY", "Kentucky"],
  ["LA", "Louisiana"],
  ["ME", "Maine"],
  ["MD", "Maryland"],
  ["MA", "Massachusetts"],
  ["MI", "Michigan"],
  ["MN", "Minnesota"],
  ["MS", "Mississippi"],
  ["MO", "Missouri"],
  ["MT", "Montana"],
  ["NE", "Nebraska"],
  ["NV", "Nevada"],
  ["NH", "New Hampshire"],
  ["NJ", "New Jersey"],
  ["NM", "New Mexico"],
  ["NY", "New York"],
  ["NC", "North Carolina"],
  ["ND", "North Dakota"],
  ["OH", "Ohio"],
  ["OK", "Oklahoma"],
  ["OR", "Oregon"],
  ["PA", "Pennsylvania"],
  ["RI", "Rhode Island"],
  ["SC", "South Carolina"],
  ["SD", "South Dakota"],
  ["TN", "Tennessee"],
  ["TX", "Texas"],
  ["UT", "Utah"],
  ["VT", "Vermont"],
  ["VA", "Virginia"],
  ["WA", "Washington"],
  ["WV", "West Virginia"],
  ["WI", "Wisconsin"],
  ["WY", "Wyoming"],
  ["AS", "American Samoa"],
  ["GU", "Guam"],
  ["MP", "Northern Mariana Islands"],
  ["PR", "Puerto Rico"],
  ["VI", "U.S. Virgin Islands"],
] as const;

export const US_TIME_ZONES = [
  ["America/New_York", "Eastern time (New York)"],
  ["America/Chicago", "Central time (Chicago)"],
  ["America/Denver", "Mountain time (Denver)"],
  ["America/Phoenix", "Mountain time, no DST (Phoenix)"],
  ["America/Los_Angeles", "Pacific time (Los Angeles)"],
  ["America/Anchorage", "Alaska time (Anchorage)"],
  ["Pacific/Honolulu", "Hawaii time (Honolulu)"],
  ["America/Puerto_Rico", "Atlantic time (Puerto Rico)"],
  ["Pacific/Guam", "Chamorro time (Guam)"],
] as const;

export const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

/** The values update_workspace_profile accepts for default_payment_terms. */
export const DEFAULT_TERMS_OPTIONS = [
  ["due_on_receipt", "Due on receipt"],
  ["net_7", "Net 7"],
  ["net_15", "Net 15"],
  ["net_30", "Net 30"],
  ["net_45", "Net 45"],
  ["net_60", "Net 60"],
  ["none", "No default terms"],
] as const;

export const DEFAULT_COUNTRY = "United States";

export function isUnitedStates(country: string | null | undefined): boolean {
  const c = (country ?? "").trim().toLowerCase().replace(/\./g, "");
  return c === "" || c === "united states" || c === "united states of america" || c === "us" || c === "usa";
}

export function stateName(code: string | null | undefined): string | null {
  if (!code) return null;
  return US_STATES.find(([c]) => c === code)?.[1] ?? code;
}

export function timeZoneLabel(tz: string | null | undefined): string | null {
  if (!tz) return null;
  return US_TIME_ZONES.find(([value]) => value === tz)?.[1] ?? tz;
}

export function termsOptionLabel(value: string | null | undefined): string | null {
  if (!value) return null;
  return DEFAULT_TERMS_OPTIONS.find(([v]) => v === value)?.[1] ?? value;
}

export const ROLES = ["owner", "admin", "accountant", "staff", "viewer"] as const;
export type Role = (typeof ROLES)[number];

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

export const ROLE_LABEL: Record<Role, string> = {
  owner: "Owner",
  admin: "Admin",
  accountant: "Accountant",
  staff: "Staff",
  viewer: "Viewer",
};

export const ROLE_SUMMARY: Record<Role, string> = {
  owner: "Full control of the workspace, including who else is an owner. Every workspace keeps at least one.",
  admin: "Invites and removes teammates, edits workspace and invoicing settings, deletes records and controls AI agents. Can't add or remove owners.",
  accountant: "Day-to-day bookkeeping plus the general ledger: posts manual journal entries and works in CPA mode. Can't change settings or manage the team.",
  staff: "Records the everyday work: invoices, bills, expenses, contacts and bank activity. Can't post journal entries, change settings or manage the team.",
  viewer: "For people who mainly need to look, such as a partner or reviewer. Can't post journal entries, change settings or manage the team.",
};

export const ROLE_BADGE: Record<Role, string> = {
  owner: "bg-primary/10 text-primary",
  admin: "bg-primary/[0.07] text-primary",
  accountant: "bg-positive/10 text-positive",
  staff: "bg-muted text-foreground",
  viewer: "bg-muted text-muted-foreground",
};

/** "Ada Lovelace" -> "AL", "ada@acme.com" -> "AD". */
export function initials(name: string | null | undefined, fallback?: string | null): string {
  const source = (name ?? "").trim();
  if (source) {
    const parts = source.split(/\s+/).filter(Boolean);
    const first = parts[0]?.[0] ?? "";
    const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : (parts[0]?.[1] ?? "");
    return (first + last).toUpperCase();
  }
  const alt = (fallback ?? "").trim();
  return alt ? alt.slice(0, 2).toUpperCase() : "?";
}

/** Workspace address json -> printable lines: "123 Main St", "Suite 4", "Austin, TX 78701", "United States". */
export function workspaceAddressLines(address: unknown): string[] {
  const a = address && typeof address === "object" && !Array.isArray(address) ? (address as Record<string, unknown>) : {};
  const get = (key: string) => (typeof a[key] === "string" ? (a[key] as string).trim() : "");
  const cityLine = [get("city"), [get("state"), get("postalCode")].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  const lines = [get("line1"), get("line2"), cityLine].filter(Boolean);
  // a country on its own (the form's default) isn't an address worth printing
  if (lines.length > 0 && get("country")) lines.push(get("country"));
  return lines;
}
