"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { AnnualTable } from "@/components/AnnualTable";
import { HistoryChart, type ChartPoint } from "@/components/HistoryChart";
import { MetricCard } from "@/components/MetricCard";
import { SmallMultiples } from "@/components/SmallMultiples";
import { TerritoryPicker, type TerritorySelection } from "@/components/TerritoryPicker";
import { SectionHeading, Segmented } from "@/components/ui";
import {
  RIO_MUNICIPALITY,
  getAnnualSeries,
  getGovernorTerms,
  getIndicator,
  getIndicatorsFor,
  getLatestPeriod,
  getSummary,
  getTerritorialUnits,
  getTerritories,
  resolveTerritoryName
} from "@/lib/api";
import { formatPeriodRange, monthLong } from "@/lib/format";
import type { AnnualPoint } from "@/types/api";

type Metric = "count" | "rate";

export function DashboardExplorer() {
  const latest = getLatestPeriod();
  const [selection, setSelection] = useState<TerritorySelection>({ type: "state", name: "" });
  const [indicator, setIndicator] = useState("letalidade_violenta");
  const [metric, setMetric] = useState<Metric>("count");
  const chartRef = useRef<HTMLElement>(null);

  const municipalities = useMemo(() => getTerritories("municipality"), []);
  const policeAreas = useMemo(() => getTerritories("police_area"), []);
  const rioUnits = useMemo(() => getTerritorialUnits(RIO_MUNICIPALITY), []);
  const terms = useMemo(() => getGovernorTerms(), []);

  const territoryName = resolveTerritoryName(selection.type, selection.name || undefined);
  const summary = useMemo(() => getSummary(selection.type, territoryName), [selection.type, territoryName]);
  const indicators = useMemo(() => getIndicatorsFor(selection.type, territoryName), [selection.type, territoryName]);
  const activeIndicator = indicators.some((item) => item.code === indicator) ? indicator : indicators[0]?.code ?? "letalidade_violenta";
  const annual = useMemo(() => getAnnualSeries(activeIndicator, selection.type, territoryName), [activeIndicator, selection.type, territoryName]);
  const multiples = useMemo(
    () => indicators.map((item) => ({ indicator: item, points: getAnnualSeries(item.code, selection.type, territoryName) })),
    [indicators, selection.type, territoryName]
  );
  const hasRate = annual.some((point) => point.rate_per_100k !== null);
  const effectiveMetric: Metric = hasRate ? metric : "count";
  const chartPoints = useMemo(() => toChartPoints(annual, effectiveMetric, latest.month), [annual, effectiveMetric, latest.month]);
  const indicatorMeta = getIndicator(activeIndicator);
  const firstYear = annual[0]?.year ?? latest.year;
  const multiplesStart = Math.min(...multiples.map((item) => item.points[0]?.year ?? latest.year));

  function openIndicator(code: string) {
    setIndicator(code);
    chartRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const territoryLabel = selection.type === "state" ? "Estado do Rio de Janeiro" : territoryName;

  return (
    <div className="grid gap-14">
      <section className="grid gap-6">
        <TerritoryPicker
          value={selection}
          onChange={setSelection}
          municipalities={municipalities}
          policeAreas={policeAreas}
          rioUnits={rioUnits}
          defaultMunicipality={RIO_MUNICIPALITY}
        />
      </section>

      <section className="grid gap-6">
        <SectionHeading
          title={territoryLabel}
          sub={`Acumulado de ${formatPeriodRange(summary.year, summary.latest_month)} comparado com os mesmos meses do ano anterior. Mínimos e máximos consideram todos os anos com dado no mesmo período.`}
        />
        {summary.cards.length === 0 ? (
          <p className="text-[12px] tracking-[0.14em] text-ash">Sem dados publicados para este recorte.</p>
        ) : (
          <div className="grid gap-x-8 gap-y-9 sm:grid-cols-2 xl:grid-cols-3">
            {summary.cards.map((card) => (
              <MetricCard key={card.indicator} card={card} onOpen={openIndicator} />
            ))}
          </div>
        )}
      </section>

      <section ref={chartRef} className="grid gap-6 scroll-mt-6">
        <SectionHeading
          title={`${indicatorMeta?.name ?? activeIndicator}, ${firstYear}–${latest.year}`}
          sub={`Totais anuais em ${territoryLabel}. ${latest.year} vai até ${monthLong(latest.month)} e aparece tracejado. Faixas marcam os mandatos de governador.`}
          aside={
            <>
              <Segmented
                label="Indicador"
                value={activeIndicator}
                onChange={setIndicator}
                options={indicators.slice(0, 4).map((item) => ({ value: item.code, label: shortLabel(item.name) }))}
              />
              <Segmented
                label="Métrica"
                value={effectiveMetric}
                onChange={setMetric}
                options={[
                  { value: "count", label: "Ocorrências" },
                  { value: "rate", label: "Por 100 mil", disabled: !hasRate }
                ]}
              />
            </>
          }
        />
        <HistoryChart
          points={chartPoints}
          kind="annual"
          valueLabel={effectiveMetric === "rate" ? "Por 100 mil hab." : indicatorMeta?.unit === "armas" ? "Armas" : "Ocorrências"}
          digits={effectiveMetric === "rate" ? 1 : 0}
          terms={terms}
          height={380}
        />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-[11.5px] leading-6 tracking-[0.04em] text-ash">
            Meses que o ISP ainda não apurava um indicador ficam de fora, nunca entram como zero.
          </p>
          <Link href={`/trends?indicator=${activeIndicator}&type=${selection.type}&name=${encodeURIComponent(territoryName)}`} className="btn btn--ghost">
            Explorar a série mensal
          </Link>
        </div>
        <details className="group">
          <summary className="cursor-pointer list-none text-[11px] tracking-[0.22em] text-ash hover:text-ink">
            TABELA ANO A ANO <span className="ml-1 inline-block transition-transform group-open:rotate-90">→</span>
          </summary>
          <div className="mt-4">
            <AnnualTable points={annual} latestMonth={latest.month} unitLabel={indicatorMeta?.unit === "armas" ? "armas" : "ocorrências"} />
          </div>
        </details>
      </section>

      <section className="grid gap-6">
        <SectionHeading
          title="Todos os indicadores, ano a ano"
          sub={`Totais anuais de ${multiplesStart} a ${latest.year} em ${territoryLabel}. Cada gráfico tem a própria escala; o ano corrente aparece mais claro.`}
        />
        <SmallMultiples items={multiples} startYear={multiplesStart} endYear={latest.year} onOpen={openIndicator} />
      </section>
    </div>
  );
}

function toChartPoints(points: AnnualPoint[], metric: Metric, latestMonth: number): ChartPoint[] {
  return points.map((point) => ({
    key: String(point.year),
    label: point.complete ? String(point.year) : formatPeriodRange(point.year, point.year === points[points.length - 1]?.year ? latestMonth : point.months_with_data),
    value: metric === "rate" ? point.rate_per_100k : point.value,
    partial: !point.complete,
    note: !point.complete ? `${point.months_with_data} meses com dado` : point.population_interpolated && metric === "rate" ? "população interpolada" : undefined
  }));
}

function shortLabel(name: string): string {
  return name.replace("Morte por intervencao de agente do Estado", "Interv. do Estado").replace("Lesao corporal seguida de morte", "Lesão c/ morte").replace("Homicidio doloso", "Homicídio").replace("Letalidade violenta", "Letalidade").replace("Latrocinio", "Latrocínio");
}
