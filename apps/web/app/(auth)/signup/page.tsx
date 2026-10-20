import Link from "next/link";
import type { Metadata } from "next";
import { AuthHeading } from "@/components/auth/auth-shell";
import { SignupForm } from "@/components/auth/signup-form";

export const metadata: Metadata = { title: "Create your account" };

export default function SignupPage() {
  return (
    <>
      <AuthHeading title="Create your account" description="Run invoicing, bills, banking and your books in one place." />
      <SignupForm />
      <p className="mt-8 text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-primary hover:underline">
          Log in
        </Link>
      </p>
    </>
  );
}
