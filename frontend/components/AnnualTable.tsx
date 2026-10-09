import { deltaClass, formatNumber, formatPercent, formatRate, monthShort } from "@/lib/format";
import type { AnnualPoint } from "@/types/api";

export function AnnualTable({
  points,
  latestMonth,
  unitLabel = "ocorrências",
  compact = false,
  indicator
}: {
  points: AnnualPoint[];
  latestMonth: number;
  unitLabel?: string;
  compact?: boolean;
  indicator?: string;
}) {
  const rows = [...points].reverse();
  const hasPopulation = rows.some((row) => row.population !== null);

  return (
    <div className={compact ? "" : "overflow-x-auto"}>
      <table className={compact ? "ruled" : "ruled min-w-[640px]"}>
        <thead>
          <tr>
            <th>Ano</th>
            <th className="right">{unitLabel}</th>
            {compact ? null : <th className="right">Meses</th>}
            <th className="right">Variação</th>
            {hasPopulation ? (
              <>
                {compact ? null : <th className="right">População</th>}
                <th className="right">Por 100 mil</th>
              </>
            ) : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.year}>
              <td className="num text-ink">
                {row.year}
                {!row.complete ? (
                  <span className="ml-2 text-[10px] tracking-[0.12em] text-ash">
                    {row.year === rows[0]?.year ? `até ${monthShort(latestMonth)}` : `${row.months_with_data} meses`}
                  </span>
                ) : null}
              </td>
              <td className="num right">{formatNumber(row.value)}</td>
              {compact ? null : <td className="num right faint">{row.months_with_data}</td>}
              <td className={`num right ${deltaClass(row.yoy_percent_change, indicator)}`}>
                {formatPercent(row.yoy_percent_change)}
                {!row.complete && row.yoy_percent_change !== null ? <span className="ml-1 text-[10px] text-ash">*</span> : null}
              </td>
              {hasPopulation ? (
                <>
                  {compact ? null : (
                    <td className="num right faint">
                      {formatNumber(row.population)}
                      {row.population_interpolated ? <span title="população interpolada entre anos publicados pelo IBGE">~</span> : null}
                    </td>
                  )}
                  <td className="num right">
                    {formatRate(row.rate_per_100k)}
                    {compact && row.population_interpolated && row.rate_per_100k !== null ? <span title="população interpolada">~</span> : null}
                  </td>
                </>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
      {compact ? null : (
        <p className="mt-3 text-[11px] leading-6 tracking-[0.04em] text-ash">
          * ano incompleto: variação calculada sobre os mesmos meses do ano anterior. ~ população interpolada entre censos e estimativas do
          IBGE. Taxa por 100 mil só para anos completos.
        </p>
      )}
    </div>
  );
}
