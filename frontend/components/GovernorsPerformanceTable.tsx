import { formatIsoDate, formatNumber, formatPercent } from "@/lib/format";
import type { GovernorPerformanceRow } from "@/types/api";

export function GovernorsPerformanceTable({ rows }: { rows: GovernorPerformanceRow[] }) {
  const ordered = [...rows].sort((a, b) => b.term_start.localeCompare(a.term_start));
  return (
    <div className="overflow-x-auto">
      <table className="ruled min-w-[880px]">
        <thead>
          <tr>
            <th>Governo</th>
            <th>Período</th>
            <th className="right">Meses</th>
            <th className="right">Base anualizada</th>
            <th className="right">Mandato anualizado</th>
            <th className="right">Redução média</th>
            <th className="right">Posição</th>
            <th>Melhor indicador</th>
            <th>Pior indicador</th>
          </tr>
        </thead>
        <tbody>
          {ordered.map((row) => (
            <tr key={`${row.governor}-${row.term_start}`}>
              <td>
                <p className="serif text-[14px] tracking-[0.04em] text-ink">{row.governor}</p>
                <p className="text-[11px] tracking-[0.08em] text-ash">{row.party_or_condition}</p>
              </td>
              <td className="num whitespace-nowrap">
                {formatIsoDate(row.term_start)} – {formatIsoDate(row.term_end)}
              </td>
              <td className="num right faint">{row.months_count || "–"}</td>
              <td className="num right faint">{formatNumber(row.annualized_baseline_value)}</td>
              <td className="num right">{formatNumber(row.annualized_current_value)}</td>
              <td className="num right text-ink">
                {formatPercent(row.average_reduction_percent)}
                {row.note ? <p className="text-[10px] tracking-[0.06em] text-ash">{row.note}</p> : null}
              </td>
              <td className="num right">{row.rank ? `${row.rank}º` : "–"}</td>
              <td className="text-[12px] text-slate">{row.best_indicator ?? "–"}</td>
              <td className="text-[12px] text-slate">{row.worst_indicator ?? "–"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
