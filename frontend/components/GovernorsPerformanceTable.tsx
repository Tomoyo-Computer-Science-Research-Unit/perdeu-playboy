import type { GovernorPerformanceRow } from "@/types/api";

function formatPercent(value: number | null) {
  if (value === null) {
    return "-";
  }
  return `${value > 0 ? "+" : ""}${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(value)}%`;
}

function formatNumber(value: number | null) {
  if (value === null) {
    return "-";
  }
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(value);
}

function formatDate(value: string | null) {
  if (!value) {
    return "atual";
  }
  return new Intl.DateTimeFormat("pt-BR", { month: "2-digit", year: "numeric" }).format(new Date(`${value}T00:00:00`));
}

export function GovernorsPerformanceTable({ rows }: { rows: GovernorPerformanceRow[] }) {
  return (
    <div className="overflow-x-auto border border-border bg-surface shadow-hard">
      <table className="min-w-full divide-y divide-border text-sm">
        <thead className="bg-background text-left font-mono text-xs font-bold uppercase tracking-wide text-muted">
          <tr>
            <th className="px-4 py-3">Rank</th>
            <th className="px-4 py-3">Governador</th>
            <th className="px-4 py-3">Período</th>
            <th className="px-4 py-3 text-right">Redução média</th>
            <th className="px-4 py-3 text-right">Meses do mandato</th>
            <th className="px-4 py-3 text-right">Meses de base</th>
            <th className="px-4 py-3 text-right">Base anualizada</th>
            <th className="px-4 py-3 text-right">Mandato anualizado</th>
            <th className="px-4 py-3">Melhor indicador</th>
            <th className="px-4 py-3">Pior indicador</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.length === 0 ? (
            <tr>
              <td colSpan={10} className="px-4 py-8 text-center font-mono text-xs uppercase tracking-widest text-muted">
                Selecione uma UF para comparar governadores.
              </td>
            </tr>
          ) : null}
          {rows.map((row) => (
            <tr key={`${row.governor}-${row.term_start}`} className="align-top transition-colors hover:bg-background/50">
              <td className="px-4 py-3 font-mono font-bold text-muted">{row.rank ?? "-"}</td>
              <td className="px-4 py-3">
                <p className="font-mono text-xs font-bold uppercase tracking-widest text-foreground">{row.governor}</p>
                <p className="mt-1 font-mono text-[10px] uppercase tracking-wider text-muted">{row.party_or_condition}</p>
              </td>
              <td className="px-4 py-3 font-mono text-xs uppercase tracking-wide text-muted">
                {formatDate(row.term_start)} - {formatDate(row.term_end)}
              </td>
              <td className={`px-4 py-3 text-right font-mono font-bold tabular-nums ${row.average_reduction_percent !== null && row.average_reduction_percent < 0 ? "text-accent-red" : "text-foreground"}`}>
                {formatPercent(row.average_reduction_percent)}
                {row.note ? <p className="mt-1 text-[10px] font-normal uppercase tracking-wide text-muted">{row.note}</p> : null}
              </td>
              <td className="px-4 py-3 text-right font-mono tabular-nums text-foreground">{row.months_count}</td>
              <td className="px-4 py-3 text-right font-mono tabular-nums text-muted">{row.baseline_months_count}</td>
              <td className="px-4 py-3 text-right font-mono tabular-nums text-muted">{formatNumber(row.annualized_baseline_value)}</td>
              <td className="px-4 py-3 text-right font-mono tabular-nums text-foreground">{formatNumber(row.annualized_current_value)}</td>
              <td className="px-4 py-3 font-mono text-xs uppercase leading-5 text-muted">{row.best_indicator ?? "-"}</td>
              <td className="px-4 py-3 font-mono text-xs uppercase leading-5 text-muted">{row.worst_indicator ?? "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
