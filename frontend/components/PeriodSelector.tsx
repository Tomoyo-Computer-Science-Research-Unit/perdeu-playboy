import { ANALYSIS_START_YEAR } from "@/lib/constants";

export function PeriodSelector() {
  return (
    <div className="grid gap-4 min-w-0 md:grid-cols-2">
      <label className="grid gap-2 font-mono text-xs font-bold uppercase tracking-widest text-muted min-w-0">
        Ano inicial
        <input className="h-10 w-full min-w-0 border border-border bg-surface px-3 text-sm text-foreground focus:border-foreground focus:outline-none focus:ring-1 focus:ring-foreground transition-colors" type="number" defaultValue={ANALYSIS_START_YEAR} min={ANALYSIS_START_YEAR} />
      </label>
      <label className="grid gap-2 font-mono text-xs font-bold uppercase tracking-widest text-muted min-w-0">
        Ano final
        <input className="h-10 w-full min-w-0 border border-border bg-surface px-3 text-sm text-foreground focus:border-foreground focus:outline-none focus:ring-1 focus:ring-foreground transition-colors" type="number" defaultValue={2026} min={ANALYSIS_START_YEAR} />
      </label>
    </div>
  );
}
