import type { Metadata } from "next";
import { CheckEmail } from "@/components/auth/check-email";

export const metadata: Metadata = { title: "Confirm your email" };

export default async function CheckEmailPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { email } = await searchParams;
  return (
    <CheckEmail email={typeof email === "string" ? email : undefined} title="Confirm your email">
      Click it to verify your account and set up your workspace.
    </CheckEmail>
  );
}
