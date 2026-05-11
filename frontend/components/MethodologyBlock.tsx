import type { Methodology } from "@/types/api";

export function MethodologyBlock({ methodology }: { methodology: Methodology }) {
  return (
    <div className="grid gap-6">
      <section className="border-l-2 border-border bg-surface p-6 shadow-hard transition-colors hover:border-foreground">
        <h2 className="text-2xl font-display text-foreground uppercase tracking-wider">Fontes e atualização</h2>
        <p className="mt-4 font-mono text-sm leading-relaxed text-muted uppercase">{methodology.source_summary}</p>
        <p className="mt-2 font-mono text-sm leading-relaxed text-muted uppercase">{methodology.update_frequency}</p>
      </section>
      <section className="border-l-2 border-border bg-surface p-6 shadow-hard transition-colors hover:border-foreground">
        <h2 className="text-2xl font-display text-foreground uppercase tracking-wider">Limitações</h2>
        <ul className="mt-4 space-y-3 font-mono text-sm leading-relaxed text-muted uppercase">
          {methodology.limitations.map((item) => (
            <li key={item} className="flex gap-2">
              <span className="text-muted">■</span> {item}
            </li>
          ))}
        </ul>
      </section>
      <section className="border-l-2 border-border bg-surface p-6 shadow-hard transition-colors hover:border-foreground">
        <h2 className="text-2xl font-display text-foreground uppercase tracking-wider">Definições</h2>
        <dl className="mt-4 grid gap-6">
          {Object.entries(methodology.definitions).map(([key, value]) => (
            <div key={key} className="border-t border-border pt-4">
              <dt className="text-sm font-bold text-foreground font-mono uppercase tracking-widest">{key}</dt>
              <dd className="mt-2 font-mono text-sm leading-relaxed text-muted uppercase">{value}</dd>
            </div>
          ))}
        </dl>
      </section>
      <section className="border-l-2 border-border bg-surface p-6 shadow-hard transition-colors hover:border-foreground">
        <h2 className="text-2xl font-display text-foreground uppercase tracking-wider">Uso responsável</h2>
        <ul className="mt-4 space-y-3 font-mono text-sm leading-relaxed text-muted uppercase">
          {methodology.ethical_notes.map((item) => (
            <li key={item} className="flex gap-2">
              <span className="text-muted">■</span> {item}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
