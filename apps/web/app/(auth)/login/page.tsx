import Link from "next/link";
import type { Metadata } from "next";
import { AuthHeading } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = { title: "Log in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const next = typeof params.next === "string" ? params.next : undefined;

  return (
    <>
      <AuthHeading title="Welcome back" description="Log in to your VitaCount workspace." />
      <LoginForm next={next} linkError={params.error === "auth_callback_failed"} />
      <p className="mt-8 text-center text-sm text-muted-foreground">
        New to VitaCount?{" "}
        <Link href="/signup" className="font-medium text-primary hover:underline">
          Create an account
        </Link>
      </p>
    </>
  );
}
