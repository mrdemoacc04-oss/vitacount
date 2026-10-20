import type { Metadata } from "next";
import { AuthHeading } from "@/components/auth/auth-shell";
import { NewPasswordForm } from "@/components/auth/new-password-form";

export const metadata: Metadata = { title: "Set a new password" };

export default function ResetPasswordConfirmPage() {
  return (
    <>
      <AuthHeading title="Set a new password" description="Choose a password you don't use anywhere else." />
      <NewPasswordForm submitLabel="Save and continue" />
    </>
  );
}
