import type { Indicator } from "@/types/api";

export function IndicatorSelector({ indicators, defaultValue = "letalidade_violenta" }: { indicators: Indicator[]; defaultValue?: string }) {
  return (
    <label className="grid gap-2 font-mono text-xs font-bold uppercase tracking-widest text-muted min-w-0">
      Indicador
      <select className="h-10 w-full min-w-0 border border-border bg-surface px-3 text-sm text-foreground focus:border-foreground focus:outline-none focus:ring-1 focus:ring-foreground transition-colors" defaultValue={defaultValue}>
        {indicators.map((indicator) => (
          <option key={indicator.code} value={indicator.code}>
            {indicator.name.toUpperCase()}
          </option>
        ))}
      </select>
    </label>
  );
}
