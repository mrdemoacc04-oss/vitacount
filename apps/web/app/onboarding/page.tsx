import { redirect } from "next/navigation";
import { getUserMemberships } from "@/lib/tenant/data";
import { LogoMark } from "@/components/logo-mark";
import { Icons } from "@/components/icons";
import { OnboardingForm } from "@/components/onboarding-form";

const NEXT_STEPS = [
  { icon: Icons.banking, text: "Connect a bank account to pull in transactions" },
  { icon: Icons.invoice, text: "Send your first invoice and get paid online" },
  { icon: Icons.team, text: "Invite your accountant or teammates" },
];

export default async function OnboardingPage() {
  const memberships = await getUserMemberships();

  if (memberships.length > 0) {
    redirect("/dashboard");
  }

  return (
    <div className="flex flex-1 items-start justify-center bg-background px-4 py-12 sm:items-center sm:py-16">
      <div className="w-full max-w-lg">
        <div className="flex flex-col items-center text-center">
          <LogoMark className="size-10" />
          <h1 className="mt-5 font-heading text-2xl font-semibold tracking-tight text-foreground">Set up your workspace</h1>
          <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">
            A workspace holds one business&apos;s books. It takes a few seconds — everything else can wait.
          </p>
        </div>

        <div className="mt-8 rounded-2xl border border-border bg-card p-6 shadow-soft-sm sm:p-8">
          <OnboardingForm />
        </div>

        <div className="mt-8">
          <p className="text-center text-xs font-medium text-muted-foreground">Up next</p>
          <ul className="mt-3 grid gap-2 sm:grid-cols-3">
            {NEXT_STEPS.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-start gap-2.5 rounded-xl border border-border/70 px-3 py-2.5 text-xs leading-snug text-muted-foreground">
                <Icon className="mt-px size-4 shrink-0 text-primary" />
                {text}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
