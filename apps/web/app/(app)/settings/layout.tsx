import { SettingsNav } from "@/components/settings/settings-nav";

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-5xl">
      <header>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">Your workspace details, invoicing defaults and your own account.</p>
      </header>
      <div className="mt-6 grid gap-6 md:mt-8 md:grid-cols-[180px_minmax(0,1fr)] md:gap-12">
        <div className="md:sticky md:top-6 md:self-start">
          <SettingsNav />
        </div>
        <div className="min-w-0 max-w-3xl">{children}</div>
      </div>
    </div>
  );
}
