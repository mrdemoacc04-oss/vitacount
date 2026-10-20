export function BezelCard({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-xl border border-border bg-card p-5 transition-colors duration-200 ${className}`}>
      {children}
    </section>
  );
}
