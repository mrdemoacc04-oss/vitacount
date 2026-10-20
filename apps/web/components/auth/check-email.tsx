import Link from "next/link";
import { Icons } from "@/components/icons";

/** "We sent you a link" confirmation, shared by sign-up and password reset. */
export function CheckEmail({ email, title, children }: { email?: string; title: string; children: React.ReactNode }) {
  return (
    <div>
      <span className="flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="size-6" aria-hidden="true">
          <rect x="3" y="5" width="18" height="14" rx="2.5" />
          <path d="m3.5 7 8.5 6 8.5-6" />
        </svg>
      </span>
      <h1 className="mt-6 font-heading text-[28px] font-semibold leading-tight tracking-[-0.02em] text-foreground">{title}</h1>
      <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">
        We sent a link to {email ? <span className="font-medium text-foreground">{email}</span> : "your inbox"}. {children}
      </p>
      <ul className="mt-6 space-y-2 rounded-xl border border-border bg-muted/40 p-4 text-[13px] text-muted-foreground">
        <li className="flex gap-2">
          <Icons.check className="mt-0.5 size-4 shrink-0 text-primary" />
          Open the link on this device and in this browser.
        </li>
        <li className="flex gap-2">
          <Icons.check className="mt-0.5 size-4 shrink-0 text-primary" />
          Nothing after a few minutes? Check spam or promotions.
        </li>
      </ul>
      <Link href="/login" className="mt-8 flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground">
        <Icons.arrowRight className="size-4 rotate-180" />
        Back to log in
      </Link>
    </div>
  );
}
