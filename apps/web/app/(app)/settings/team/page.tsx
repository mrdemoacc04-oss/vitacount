import { redirect } from "next/navigation";

/** Team moved to its own page; keep old links and bookmarks working. */
export default function LegacyTeamSettingsPage() {
  redirect("/team");
}
