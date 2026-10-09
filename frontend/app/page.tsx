import { DashboardExplorer } from "@/components/DashboardExplorer";
import { PageHeader, Tag } from "@/components/ui";
import { getLatestPeriod, getSummary } from "@/lib/api";
import { formatNumber, formatPercent, formatPeriodRange, monthLong } from "@/lib/format";

export default function HomePage() {
  const latest = getLatestPeriod();
  const summary = getSummary("state");
  const lethal = summary.cards.find((card) => card.indicator === "letalidade_violenta");

  const lede = lethal ? (
    <>
      Entre janeiro e {monthLong(latest.month)} de {latest.year}, o ISP registrou <strong className="num text-ink">{formatNumber(lethal.current_year_value)}</strong>{" "}
      mortes violentas intencionais no estado
      {lethal.yoy_percent_change !== null ? (
        <>
          , <strong className="num text-ink">{formatPercent(lethal.yoy_percent_change)}</strong> em relação a {formatPeriodRange(latest.year - 1, latest.month)}
        </>
      ) : null}
      {lethal.historical_min && lethal.historical_min.year !== latest.year ? (
        <>
          . O menor valor para o mesmo período foi em {lethal.historical_min.year} ({formatNumber(lethal.historical_min.value)}).
        </>
      ) : (
        "."
      )}
    </>
  ) : undefined;

  return (
    <div className="grid gap-12">
      <PageHeader
        eyebrow="Panorama · Rio de Janeiro"
        title={
          <>
            Violência e segurança pública no Rio, <em className="serif font-medium not-italic">desde 1991</em>
          </>
        }
        lede={lede}
        aside={
          <>
            <Tag>ISP Dados Abertos</Tag>
            <Tag ghost>
              até {monthLong(latest.month)} {latest.year}
            </Tag>
          </>
        }
      />
      <DashboardExplorer />
    </div>
  );
}
