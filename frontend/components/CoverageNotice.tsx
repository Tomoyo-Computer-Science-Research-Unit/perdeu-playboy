export function CoverageNotice({ children }: { children: React.ReactNode }) {
  return (
    <section className="border border-border bg-surface p-4 font-mono text-xs uppercase leading-5 tracking-wide text-muted shadow-hard">
      {children}
    </section>
  );
}
