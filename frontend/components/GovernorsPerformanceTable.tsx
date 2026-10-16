import { deltaClass, formatIsoDate, formatNumber, formatPercent } from "@/lib/format";
import type { GovernorPerformanceRow } from "@/types/api";

/** O backend guarda "redução média" (positivo = caiu); o site mostra variação (negativo = caiu), como em toda parte. */
const change = (reduction: number | null) => (reduction === null ? null : -reduction);

export function GovernorsPerformanceTable({ rows }: { rows: GovernorPerformanceRow[] }) {
  const ordered = [...rows].sort((a, b) => b.term_start.localeCompare(a.term_start));
  return (
    <table className="ruled">
      <thead>
        <tr>
          <th>Governo</th>
          <th>Período</th>
          <th className="right">Meses</th>
          <th className="right">Base anualizada</th>
          <th className="right">Mandato anualizado</th>
          <th className="right">Variação do total</th>
          <th className="right">Posição</th>
          <th>Maior queda</th>
          <th>Maior alta</th>
        </tr>
      </thead>
      <tbody>
        {ordered.map((row) => (
          <tr key={`${row.governor}-${row.term_start}`}>
            <td>
              <span className="serif text-[13px] text-ink">{row.governor}</span>
              <span className="ml-2 text-[10.5px] tracking-[0.06em] text-ash">{row.party_or_condition}</span>
            </td>
            <td className="num whitespace-nowrap">
              {formatIsoDate(row.term_start)} – {formatIsoDate(row.term_end)}
            </td>
            <td className="num right faint">{row.months_count || "–"}</td>
            <td className="num right faint">{formatNumber(row.annualized_baseline_value)}</td>
            <td className="num right">{formatNumber(row.annualized_current_value)}</td>
            <td className={`num right ${deltaClass(change(row.average_reduction_percent)) || "text-ink"}`}>
              {formatPercent(change(row.average_reduction_percent))}
              {row.note ? <span className="ml-2 text-[10px] tracking-[0.04em] text-ash">{row.note}</span> : null}
            </td>
            <td className="num right">{row.rank ? `${row.rank}º` : "–"}</td>
            <td className="text-slate">
              {row.best_indicator ?? "–"}
              {row.best_indicator_change !== null ? <span className={`num ml-2 ${deltaClass(row.best_indicator_change)}`}>{formatPercent(row.best_indicator_change)}</span> : null}
            </td>
            <td className="text-slate">
              {row.worst_indicator ?? "–"}
              {row.worst_indicator_change !== null ? <span className={`num ml-2 ${deltaClass(row.worst_indicator_change)}`}>{formatPercent(row.worst_indicator_change)}</span> : null}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
