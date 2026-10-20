import Link from "next/link";
import type { Metadata } from "next";
import { AuthHeading } from "@/components/auth/auth-shell";
import { ResetRequestForm } from "@/components/auth/reset-request-form";
import { Icons } from "@/components/icons";

export const metadata: Metadata = { title: "Reset your password" };

export default function ResetPasswordPage() {
  return (
    <>
      <AuthHeading title="Reset your password" description="Enter the email you log in with and we'll send you a link to set a new password." />
      <ResetRequestForm />
      <Link href="/login" className="mt-8 flex items-center justify-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground">
        <Icons.arrowRight className="size-4 rotate-180" />
        Back to log in
      </Link>
    </>
  );
}
