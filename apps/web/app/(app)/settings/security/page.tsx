import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SettingsHeading } from "@/components/settings/settings-form";
import { ChangePasswordForm, SessionsCard } from "@/components/settings/security-forms";

export default async function SecuritySettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <>
      <SettingsHeading title="Security" description="Your password and the devices signed in to your account." />
      <div className="flex flex-col gap-6">
        <ChangePasswordForm />
        <SessionsCard lastSignInAt={user.last_sign_in_at ?? null} createdAt={user.created_at ?? null} />
      </div>
    </>
  );
}
