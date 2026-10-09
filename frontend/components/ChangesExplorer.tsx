import Link from "next/link";
import { EmptyState, SectionHeading } from "@/components/ui";
import { formatNumber, formatPercent, formatSigned } from "@/lib/format";
import type { ChangeRow, ChangeSection, TerritoryType } from "@/types/api";

function ChangeTable({ rows, territoryType }: { rows: ChangeRow[]; territoryType: TerritoryType }) {
  if (rows.length === 0) {
    return <EmptyState>SEM VARIAÇÃO NESTE SENTIDO</EmptyState>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="ruled min-w-[640px]">
        <thead>
          <tr>
            <th className="w-12">#</th>
            <th>Território</th>
            <th className="right">Últimos 12 meses</th>
            <th className="right">12 meses anteriores</th>
            <th className="right">Diferença</th>
            <th className="right">Variação</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.territory_name}>
              <td className="num faint">{row.rank}</td>
              <td>
                <Link href={`/trends?indicator=crime_geral&type=${territoryType}&name=${encodeURIComponent(row.territory_name)}&view=rolling`} className="text-ink hover:underline hover:underline-offset-4">
                  {row.territory_name}
                </Link>
              </td>
              <td className="num right">{formatNumber(row.current_value)}</td>
              <td className="num right faint">{formatNumber(row.previous_value)}</td>
              <td className="num right">{formatSigned(row.absolute_change)}</td>
              <td className="num right">{formatPercent(row.percent_change)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ChangesExplorer({ sections }: { sections: ChangeSection[] }) {
  return (
    <div className="grid gap-12">
      {sections.map((section) => (
        <section key={section.title} className="grid gap-5">
          <SectionHeading title={section.title} sub={section.direction === "increase" ? "Maiores aumentos absolutos em crime geral." : "Maiores quedas absolutas em crime geral."} />
          <ChangeTable rows={section.rows} territoryType={section.territory_type} />
        </section>
      ))}
    </div>
  );
}
