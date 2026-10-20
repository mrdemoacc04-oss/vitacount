import type { Metadata } from "next";
import { CheckEmail } from "@/components/auth/check-email";

export const metadata: Metadata = { title: "Check your email" };

export default async function ResetPasswordCheckEmailPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { email } = await searchParams;
  return (
    <CheckEmail email={typeof email === "string" ? email : undefined} title="Check your email">
      If an account exists for that address, the link lets you choose a new password. It expires in one hour.
    </CheckEmail>
  );
}
