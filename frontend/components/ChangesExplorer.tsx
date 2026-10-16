import { UfLink } from "@/components/UfLink";
import { EmptyState, Panel, Screen } from "@/components/ui";
import { localIndicator } from "@/lib/api";
import { ufConfig } from "@/lib/uf";
import { deltaClass, formatMonthYear, formatNumber, formatPercent, formatSigned } from "@/lib/format";
import type { ChangeRow, ChangeSection, LatestPeriod, TerritoryType } from "@/types/api";

function ChangeTable({ rows, territoryType }: { rows: ChangeRow[]; territoryType: TerritoryType }) {
  if (rows.length === 0) {
    return <EmptyState>SEM VARIAÇÃO NESTE SENTIDO</EmptyState>;
  }
  return (
    <table className="ruled">
      <thead>
        <tr>
          <th className="w-10">#</th>
          <th>Território</th>
          <th className="right">12 meses</th>
          <th className="right">Anteriores</th>
          <th className="right">Dif.</th>
          <th className="right">Var.</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.territory_name}>
            <td className="num faint">{row.rank}</td>
            <td className="max-w-[240px] [overflow-wrap:anywhere]">
              <UfLink
                href={`/series?indicator=${localIndicator()}&type=${territoryType}&name=${encodeURIComponent(row.territory_name)}&view=rolling`}
                className="text-ink hover:underline hover:underline-offset-4"
                title={row.territory_name}
              >
                {row.territory_name}
              </UfLink>
            </td>
            <td className="num right">{formatNumber(row.current_value)}</td>
            <td className="num right faint">{formatNumber(row.previous_value)}</td>
            <td className={`num right ${deltaClass(row.absolute_change)}`}>{formatSigned(row.absolute_change)}</td>
            <td className={`num right ${deltaClass(row.percent_change)}`}>{formatPercent(row.percent_change)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function ChangesExplorer({ sections, latest }: { sections: ChangeSection[]; latest: LatestPeriod }) {
  return (
    <Screen columns="minmax(0, 1fr) minmax(0, 1fr)" rows={sections.length > 2 ? "minmax(0, 1fr) minmax(0, 1fr)" : "minmax(0, 1fr)"}>
      {sections.map((section) => (
        <Panel
          key={section.title}
          title={<b>{section.title}</b>}
          aside={
            <span>
              {ufConfig().changesIndicatorLabel ? `${ufConfig().changesIndicatorLabel} · ` : ""}12 meses até {formatMonthYear(latest.year, latest.month)}
            </span>
          }
          flush
        >
          <ChangeTable rows={section.rows} territoryType={section.territory_type} />
        </Panel>
      ))}
    </Screen>
  );
}
