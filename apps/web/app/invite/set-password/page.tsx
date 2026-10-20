import type { Metadata } from "next";
import { AuthHeading, AuthShell } from "@/components/auth/auth-shell";
import { NewPasswordForm } from "@/components/auth/new-password-form";

export const metadata: Metadata = { title: "Set your password" };

export default function SetPasswordPage() {
  return (
    <AuthShell>
      <AuthHeading
        title="You're in. Set a password"
        description="You've joined the workspace. Choose a password so you can log back in any time."
      />
      <NewPasswordForm submitLabel="Continue to VitaCount" />
    </AuthShell>
  );
}
