import { ArrowDown, ArrowUp } from "lucide-react";
import type { RankingRow } from "@/types/api";

function formatNumber(value: number | null | undefined) {
  if (value === null || value === undefined) {
    return "-";
  }
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(value);
}

type SortKey = "value" | "variation";
type SortDirection = "asc" | "desc";

function SortIcon({ active, direction }: { active: boolean; direction: SortDirection }) {
  if (!active) {
    return <ArrowDown size={13} className="opacity-30" aria-hidden="true" />;
  }
  return direction === "desc" ? <ArrowDown size={13} aria-hidden="true" /> : <ArrowUp size={13} aria-hidden="true" />;
}

export function RankingTable({
  rows,
  sortKey,
  sortDirection,
  onSort
}: {
  rows: RankingRow[];
  sortKey?: SortKey;
  sortDirection?: SortDirection;
  onSort?: (key: SortKey) => void;
}) {
  const sortable = Boolean(onSort);
  return (
    <div className="w-full overflow-x-auto border border-border bg-surface shadow-hard">
      <table className="w-full min-w-[920px] divide-y divide-border text-sm">
        <thead className="bg-background text-left font-mono text-xs font-bold uppercase tracking-wide text-muted">
          <tr>
            <th className="px-4 py-3">Rank</th>
            <th className="px-4 py-3">Território</th>
            <th className="px-4 py-3 text-right">
              <button
                type="button"
                className="ml-auto inline-flex items-center gap-1 uppercase hover:text-foreground disabled:hover:text-muted"
                disabled={!sortable}
                onClick={() => onSort?.("value")}
              >
                Valor
                <SortIcon active={sortKey === "value"} direction={sortDirection ?? "desc"} />
              </button>
            </th>
            <th className="px-4 py-3 text-right">Taxa 100 mil</th>
            <th className="px-4 py-3 text-right">Semáforo</th>
            <th className="px-4 py-3 text-right">
              <button
                type="button"
                className="ml-auto inline-flex items-center gap-1 uppercase hover:text-foreground disabled:hover:text-muted"
                disabled={!sortable}
                onClick={() => onSort?.("variation")}
              >
                Variação
                <SortIcon active={sortKey === "variation"} direction={sortDirection ?? "desc"} />
              </button>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((row) => (
            <tr key={`${row.rank}-${row.territory_name}`} className="transition-colors hover:bg-background/50">
              <td className="px-4 py-3 font-mono font-bold text-muted">{row.rank}</td>
              <td className="px-4 py-3 text-foreground uppercase text-xs font-semibold">{row.territory_name}</td>
              <td className="px-4 py-3 text-right font-mono tabular-nums text-foreground">{formatNumber(row.value)}</td>
              <td className="px-4 py-3 text-right font-mono tabular-nums text-foreground">{formatNumber(row.rate_per_100k)}</td>
              <td className="px-4 py-3 text-right font-mono text-xs font-bold uppercase tracking-wide">
                <span className={trendClass(row.trend_status)}>{row.trend_label ?? "Inconclusivo"}</span>
              </td>
              <td className={`px-4 py-3 text-right font-mono tabular-nums font-bold ${row.yoy_percent_change && row.yoy_percent_change > 0 ? "text-accent-red" : row.yoy_percent_change && row.yoy_percent_change < 0 ? "text-muted" : "text-foreground"}`}>
                {formatNumber(row.yoy_percent_change)}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function trendClass(status: RankingRow["trend_status"]) {
  if (status === "worse") {
    return "text-accent-red";
  }
  if (status === "better") {
    return "text-foreground";
  }
  if (status === "stable") {
    return "text-muted";
  }
  return "text-muted";
}
