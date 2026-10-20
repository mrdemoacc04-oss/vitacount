import Link from "next/link";
import { LogoMark } from "@/components/logo-mark";
import { Icons } from "@/components/icons";

/**
 * Split-screen frame for every signed-out page: the form on the left, a quiet
 * brand panel on the right (large screens only, so phones get just the form).
 */
export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh flex-1 bg-surface lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <div className="flex min-h-dvh flex-col px-6 py-6 sm:px-10">
        <Link href="/" className="flex w-fit items-center gap-2.5" aria-label="VitaCount home">
          <LogoMark className="size-8" />
          <span className="font-heading text-[17px] font-semibold tracking-tight text-foreground">VitaCount</span>
        </Link>

        <main className="flex flex-1 items-center justify-center py-12">
          <div className="animate-rise-in w-full max-w-[380px]">{children}</div>
        </main>

        <footer className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>&copy; {new Date().getFullYear()} VitaCount</span>
          <span className="flex items-center gap-1.5">
            <Icons.shield className="size-3.5" />
            Encrypted in transit and at rest
          </span>
        </footer>
      </div>

      <BrandPanel />
    </div>
  );
}

function BrandPanel() {
  return (
    <aside
      aria-hidden="true"
      className="relative m-3 hidden overflow-hidden rounded-[20px] bg-[#1d4fc4] text-white lg:flex lg:flex-col lg:justify-between"
    >
      {/* depth: a soft light from the top-left, a fine grid, and a dark falloff at the bottom */}
      <div className="absolute inset-0 bg-[radial-gradient(120%_80%_at_0%_0%,#3d7bf2_0%,transparent_55%),radial-gradient(90%_70%_at_100%_100%,#0f2f86_0%,transparent_60%)]" />
      <div
        className="absolute inset-0 opacity-[0.09]"
        style={{
          backgroundImage:
            "linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)",
          backgroundSize: "44px 44px",
          maskImage: "radial-gradient(ellipse at 30% 30%, black 20%, transparent 75%)",
        }}
      />

      <div className="relative px-12 pt-14 xl:px-16">
        <p className="text-[13px] font-medium text-white/70">The financial operating system for small business</p>
        <h2 className="mt-4 max-w-md font-heading text-[40px] font-semibold leading-[1.05] tracking-[-0.025em] xl:text-[46px]">
          Your books,{" "}
          <span className="font-serif text-[1.08em] font-normal italic tracking-normal text-[#cfe0ff]">balanced</span>{" "}
          every morning.
        </h2>
        <p className="mt-4 max-w-sm text-[15px] leading-relaxed text-white/75">
          Bank feeds, invoices, bills and stock in one ledger, with AI agents that match and categorize while you work.
        </p>
      </div>

      <div className="relative px-12 pb-12 xl:px-16">
        <ProductPreview />
        <ul className="mt-8 grid grid-cols-3 gap-6 border-t border-white/15 pt-6 text-[13px]">
          {[
            ["Auto-matching", "Bank lines reconciled for you"],
            ["Double-entry", "Every action posts to the ledger"],
            ["Audit trail", "Every agent action logged"],
          ].map(([title, body]) => (
            <li key={title}>
              <p className="font-medium text-white">{title}</p>
              <p className="mt-1 leading-snug text-white/65">{body}</p>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}

/** An illustrative slice of the dashboard — static artwork, not account data. */
function ProductPreview() {
  return (
    <div className="relative">
      <div className="rounded-2xl border border-white/15 bg-white/[0.08] p-5 shadow-[0_30px_60px_-20px_rgba(5,20,70,0.6)] backdrop-blur-md">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-white/65">Cash position</p>
            <p className="mt-1.5 font-heading text-[28px] font-semibold tracking-tight tabular-nums">$168,663.57</p>
          </div>
          <span className="rounded-md bg-emerald-400/20 px-1.5 py-0.5 text-[11px] font-medium text-emerald-200">+12.4%</span>
        </div>
        <svg viewBox="0 0 320 70" className="mt-3 h-16 w-full" preserveAspectRatio="none">
          <defs>
            <linearGradient id="auth-preview-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#ffffff" stopOpacity="0.35" />
              <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d="M0 55 C30 52 45 40 70 42 S110 50 135 36 S175 22 200 28 S250 14 280 12 L320 6 L320 70 L0 70Z" fill="url(#auth-preview-fill)" />
          <path d="M0 55 C30 52 45 40 70 42 S110 50 135 36 S175 22 200 28 S250 14 280 12 L320 6" fill="none" stroke="#fff" strokeWidth="2" vectorEffect="non-scaling-stroke" />
        </svg>
      </div>
      <div className="absolute -bottom-6 right-6 w-[290px] rounded-xl border border-white/15 bg-[#0f2f86]/90 p-3 shadow-[0_20px_40px_-12px_rgba(5,20,70,0.7)] backdrop-blur-md">
        <div className="flex items-center gap-2.5">
          <span className="flex size-7 items-center justify-center rounded-lg bg-white/15">
            <Icons.check className="size-4" />
          </span>
          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate text-[12.5px] font-medium">Payment matched</p>
            <p className="truncate text-[11.5px] text-white/60">Northwind Dental · INV-1042</p>
          </div>
          <span className="text-[12.5px] font-medium tabular-nums text-emerald-200">+$4,250</span>
        </div>
      </div>
    </div>
  );
}

/** Title block used at the top of each auth form. */
export function AuthHeading({ title, description }: { title: React.ReactNode; description?: React.ReactNode }) {
  return (
    <div className="mb-8">
      <h1 className="font-heading text-[28px] font-semibold leading-tight tracking-[-0.02em] text-foreground">{title}</h1>
      {description && <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">{description}</p>}
    </div>
  );
}
