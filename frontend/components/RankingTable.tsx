import { UfLink } from "@/components/UfLink";
import { deltaClass, formatNumber, formatPercent, formatRate } from "@/lib/format";
import type { RankingRow, TerritoryType } from "@/types/api";

export type SortKey = "territory" | "value" | "rate" | "trend" | "variation";
export type SortDirection = "asc" | "desc";

export function RankingTable({
  rows,
  territoryType,
  indicator,
  sortKey,
  sortDirection,
  onSort
}: {
  rows: RankingRow[];
  territoryType: TerritoryType;
  indicator?: string;
  sortKey?: SortKey;
  sortDirection?: SortDirection;
  onSort?: (key: SortKey) => void;
}) {
  const hasRate = rows.some((row) => row.rate_per_100k !== null);

  function header(label: string, key: SortKey, align: "left" | "right" = "left") {
    const active = sortKey === key;
    return (
      <th className={align === "right" ? "right" : undefined}>
        {onSort ? (
          <button type="button" onClick={() => onSort(key)} className={`inline-flex items-center gap-1 uppercase tracking-[0.2em] hover:text-ink ${active ? "text-ink" : ""}`}>
            {label}
            <span aria-hidden="true" className="text-[9px]">
              {active ? (sortDirection === "desc" ? "▼" : "▲") : "·"}
            </span>
          </button>
        ) : (
          label
        )}
      </th>
    );
  }

  return (
    <table className="ruled">
      <thead>
        <tr>
          <th className="w-10">#</th>
          {header("Território", "territory")}
          {header("Ocorr.", "value", "right")}
          {hasRate ? header("100 mil", "rate", "right") : null}
          {header("Var.", "variation", "right")}
          {header("Tend.", "trend", "right")}
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <tr>
            <td colSpan={6} className="py-8 text-center text-[11px] tracking-[0.18em] text-ash">
              SEM DADOS PARA ESTE RECORTE
            </td>
          </tr>
        ) : null}
        {rows.map((row) => (
          <tr key={`${row.rank}-${row.territory_name}`}>
            <td className="num faint">{row.rank}</td>
            <td className="max-w-[260px] [overflow-wrap:anywhere]">
              <UfLink href={`/series?type=${territoryType}&name=${encodeURIComponent(row.territory_name)}`} className="text-ink hover:underline hover:underline-offset-4" title={row.territory_name}>
                {row.territory_name}
              </UfLink>
            </td>
            <td className="num right">{formatNumber(row.value)}</td>
            {hasRate ? <td className="num right">{formatRate(row.rate_per_100k)}</td> : null}
            <td className={`num right ${deltaClass(row.yoy_percent_change, indicator)}`}>{formatPercent(row.yoy_percent_change)}</td>
            <td className="right">
              <span className={`text-[9.5px] tracking-[0.16em] ${row.trend_status === "worse" ? "worse" : row.trend_status === "better" ? "better" : "text-ash"}`}>
                {(row.trend_label ?? "Inconclusivo").toUpperCase()}
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
