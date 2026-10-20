import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SettingsHeading } from "@/components/settings/settings-form";
import { ChangeEmailForm, ProfileNameForm } from "@/components/settings/profile-forms";

export default async function ProfileSettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle();
  const metadataName = typeof user.user_metadata?.full_name === "string" ? user.user_metadata.full_name : "";

  return (
    <>
      <SettingsHeading title="Your profile" description="Your name and sign-in email. These follow you across every workspace you belong to." />
      <div className="flex flex-col gap-6">
        <ProfileNameForm fullName={profile?.full_name ?? metadataName} email={user.email ?? ""} />
        <ChangeEmailForm email={user.email ?? ""} pendingEmail={user.new_email ?? null} />
      </div>
    </>
  );
}
