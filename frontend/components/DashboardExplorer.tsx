"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { HistoryChart, type ChartPoint } from "@/components/HistoryChart";
import { useScreenHotkeys } from "@/components/Hotkeys";
import { Sparkline } from "@/components/Sparkline";
import { TERRITORY_TYPES, TerritoryControls, nextSelection, type TerritorySelection } from "@/components/TerritoryControls";
import { Panel, Screen, Segmented, Stat } from "@/components/ui";
import {
  RIO_MUNICIPALITY,
  getAnnualSeries,
  getGovernorTerms,
  getMayorTerms,
  getIndicator,
  getIndicatorsFor,
  getLatestPeriod,
  getSummary,
  getTerritorialUnits,
  getTerritories,
  resolveTerritoryName
} from "@/lib/api";
import { deltaClass, deltaGlyph, formatNumber, formatPercent, formatPeriodRange, formatRate } from "@/lib/format";
import { noteFor } from "@/lib/notes";
import type { AnnualPoint, SummaryCardData } from "@/types/api";

type Metric = "count" | "rate";

export function DashboardExplorer() {
  const router = useRouter();
  const latest = getLatestPeriod();
  const [selection, setSelection] = useState<TerritorySelection>({ type: "state", name: "" });
  const [indicator, setIndicator] = useState("letalidade_violenta");
  const [metric, setMetric] = useState<Metric>("count");
  const [showTerms, setShowTerms] = useState(true);

  const municipalities = useMemo(() => getTerritories("municipality"), []);
  const policeAreas = useMemo(() => getTerritories("police_area"), []);
  const rioUnits = useMemo(() => getTerritorialUnits(RIO_MUNICIPALITY), []);
  const terms = useMemo(() => getGovernorTerms(), []);

  const territoryName = resolveTerritoryName(selection.type, selection.name || undefined);
  // Na cidade do Rio (município ou uma de suas áreas), os prefeitos entram junto com os governadores.
  const inRio =
    (selection.type === "municipality" && territoryName === RIO_MUNICIPALITY) ||
    (selection.type === "police_area" && rioUnits.some((unit) => unit.territorial_unit === territoryName));
  const mayors = useMemo(() => (inRio ? getMayorTerms(RIO_MUNICIPALITY) : []), [inRio]);
  const summary = useMemo(() => getSummary(selection.type, territoryName), [selection.type, territoryName]);
  const indicators = useMemo(() => getIndicatorsFor(selection.type, territoryName), [selection.type, territoryName]);
  const activeIndicator = indicators.some((item) => item.code === indicator) ? indicator : indicators[0]?.code ?? "letalidade_violenta";
  const activeIndex = Math.max(0, indicators.findIndex((item) => item.code === activeIndicator));
  const card = summary.cards.find((item) => item.indicator === activeIndicator) ?? null;
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
  const territoryLabel = selection.type === "state" ? "Estado do Rio de Janeiro" : territoryName;
  const trendsHref = `/trends?indicator=${activeIndicator}&type=${selection.type}&name=${encodeURIComponent(territoryName)}`;

  const hotkeys = useMemo(
    () => ({
      ArrowUp: () => setIndicator(indicators[(activeIndex - 1 + indicators.length) % indicators.length]?.code ?? activeIndicator),
      ArrowDown: () => setIndicator(indicators[(activeIndex + 1) % indicators.length]?.code ?? activeIndicator),
      ArrowLeft: () => cycleTerritory(-1),
      ArrowRight: () => cycleTerritory(1),
      m: () => setMetric((current) => (current === "count" ? "rate" : "count")),
      b: () => setShowTerms((current) => !current),
      Enter: () => router.push(trendsHref)
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeIndex, activeIndicator, indicators, selection, trendsHref]
  );
  useScreenHotkeys(hotkeys);

  function cycleTerritory(step: number) {
    const index = TERRITORY_TYPES.indexOf(selection.type);
    const type = TERRITORY_TYPES[(index + step + TERRITORY_TYPES.length) % TERRITORY_TYPES.length];
    setSelection(nextSelection(type, selection, rioUnits, policeAreas, RIO_MUNICIPALITY));
  }

  return (
    <Screen columns="320px minmax(0, 1fr)" rows="minmax(0, 1fr) 150px">
      <Panel
        title={<b>{territoryLabel}</b>}
        aside={<Link href={trendsHref} className="btn !h-7 !px-2 text-[10px]">Série</Link>}
        flush
        fill
        style={{ gridRow: "1 / span 2" }}
      >
        <div className="border-b border-line p-3">
          <TerritoryControls
            compact
            value={selection}
            onChange={setSelection}
            municipalities={municipalities}
            policeAreas={policeAreas}
            rioUnits={rioUnits}
            defaultMunicipality={RIO_MUNICIPALITY}
          />
        </div>
        <ul className="menu" role="listbox" aria-label="Indicadores">
          {summary.cards.map((item) => (
            <li key={item.indicator} role="presentation">
              <button type="button" role="option" aria-selected={item.indicator === activeIndicator} onClick={() => setIndicator(item.indicator)}>
                <span>{item.name}</span>
                <span className="num">{formatNumber(item.current_year_value)}</span>
                <span className={`delta num ${deltaClass(item.yoy_percent_change, item.indicator)}`}>
                  {deltaGlyph(item.yoy_percent_change)} {item.yoy_percent_change === null ? "–" : formatPercent(item.yoy_percent_change, 0)}
                </span>
              </button>
            </li>
          ))}
        </ul>
        <p className="border-b border-line px-3 py-1.5 text-[10px] tracking-[0.08em] text-ash">
          {formatPeriodRange(summary.year, summary.latest_month)} vs {formatPeriodRange(summary.year - 1, summary.latest_month)}
        </p>
        <div className="detail mt-auto min-h-0 overflow-auto border-t border-line-strong p-3">
          {card ? <Detail card={card} /> : <p className="text-[11px] tracking-[0.18em] text-ash">SEM DADOS</p>}
        </div>
      </Panel>

      <Panel
        title={
          <>
            <b>{indicatorMeta?.name}</b> {firstYear}–{latest.year}
          </>
        }
        aside={
          <>
            <Segmented
              label="Métrica"
              value={effectiveMetric}
              onChange={setMetric}
              options={[
                { value: "count", label: "Ocorrências" },
                { value: "rate", label: "100 mil", disabled: !hasRate }
              ]}
            />
            <button type="button" aria-pressed={showTerms} onClick={() => setShowTerms((current) => !current)} className="toggle">
              Mandatos
            </button>
          </>
        }
        fill
        foot={noteFor(activeIndicator) ?? undefined}
      >
        <HistoryChart
          points={chartPoints}
          kind="annual"
          valueLabel={effectiveMetric === "rate" ? "Por 100 mil hab." : indicatorMeta?.unit === "armas" ? "Armas" : "Ocorrências"}
          digits={effectiveMetric === "rate" ? 1 : 0}
          terms={terms}
          mayors={mayors}
          showTerms={showTerms}
        />
      </Panel>

      <Panel title={<><b>Totais anuais</b> {firstYearOf(multiples)}–{latest.year}</>} flush>
        <IndicatorStrip items={multiples} active={activeIndicator} onSelect={setIndicator} />
      </Panel>
    </Screen>
  );
}

function Detail({ card }: { card: SummaryCardData }) {
  const history = card.annual_history.map((point) => point.value);
  return (
    <div className="grid gap-2">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="eyebrow text-[9px]">{card.category}</p>
          <h3 className="serif mt-0.5 text-[15px] leading-snug text-ink">{card.name}</h3>
          <p className="num display mt-1 text-[32px] leading-none text-ink">{formatNumber(card.current_year_value)}</p>
          <p className="mt-1 text-[10px] tracking-[0.12em] text-ash">
            {card.unit === "armas" ? "armas" : "ocorrências"} · {formatPeriodRange(card.year, card.latest_month)}
          </p>
        </div>
        <p className={`num text-right text-[16px] ${deltaClass(card.yoy_percent_change, card.indicator) || "text-ink"}`}>
          <span className="mr-1 text-[11px]">{deltaGlyph(card.yoy_percent_change)}</span>
          {card.yoy_percent_change === null ? "–" : formatPercent(card.yoy_percent_change)}
        </p>
      </div>
      <div>
        <Stat label={formatPeriodRange(card.year - 1, card.latest_month)} value={card.previous_year_same_period === null ? "–" : formatNumber(card.previous_year_same_period)} />
        <Stat label="Mínimo no período" value={card.historical_min ? formatNumber(card.historical_min.value) : "–"} sub={card.historical_min ? `(${card.historical_min.year})` : undefined} />
        <Stat label="Máximo no período" value={card.historical_max ? formatNumber(card.historical_max.value) : "–"} sub={card.historical_max ? `(${card.historical_max.year})` : undefined} />
        {card.rate_per_100k !== null ? <Stat label="Por 100 mil hab." value={formatRate(card.rate_per_100k)} /> : null}
        <Stat label="Série desde" value={card.first_year} />
      </div>
      {history.length >= 2 ? (
        <div className="border-t border-line pt-2">
          <Sparkline values={history} width={290} height={48} className="w-full" />
          <p className="mt-1 flex justify-between text-[9.5px] tracking-[0.14em] text-ash">
            <span>{card.annual_history[0]?.year}</span>
            <span>totais anuais</span>
            <span>{card.annual_history[card.annual_history.length - 1]?.year}</span>
          </p>
        </div>
      ) : null}
    </div>
  );
}

function IndicatorStrip({
  items,
  active,
  onSelect
}: {
  items: Array<{ indicator: { code: string; name: string }; points: AnnualPoint[] }>;
  active: string;
  onSelect: (code: string) => void;
}) {
  const startYear = firstYearOf(items);
  const endYear = Math.max(...items.map((item) => item.points[item.points.length - 1]?.year ?? startYear));
  const years = Array.from({ length: endYear - startYear + 1 }, (_, index) => startYear + index);
  return (
    <div className="flex h-full min-w-0 divide-x divide-line">
      {items.map(({ indicator, points }) => {
        const byYear = new Map(points.map((point) => [point.year, point]));
        const last = [...points].reverse().find((point) => point.complete && point.value !== null);
        const isActive = indicator.code === active;
        return (
          <button
            key={indicator.code}
            type="button"
            onClick={() => onSelect(indicator.code)}
            aria-pressed={isActive}
            className={`flex min-w-0 flex-1 flex-col justify-between gap-1 px-2 py-2 text-left transition-colors ${isActive ? "bg-ink text-paper" : "hover:bg-bone"}`}
          >
            <span className="truncate text-[10px] tracking-[0.04em]">{indicator.name}</span>
            <MiniBars years={years} byYear={byYear} inverted={isActive} />
            <span className={`num truncate text-[10px] ${isActive ? "opacity-80" : "text-ash"}`}>
              {last ? `${last.year} · ${formatNumber(last.value)}` : "–"}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function MiniBars({ years, byYear, inverted }: { years: number[]; byYear: Map<number, AnnualPoint>; inverted: boolean }) {
  const width = 200;
  const height = 60;
  const max = Math.max(1, ...years.map((year) => byYear.get(year)?.value ?? 0));
  const slot = width / years.length;
  const barWidth = Math.max(1, slot * 0.7);
  const fill = inverted ? "var(--paper)" : "var(--ink)";
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-full w-full flex-1" preserveAspectRatio="none" aria-hidden="true">
      {years.map((year, index) => {
        const point = byYear.get(year);
        if (!point || point.value === null) {
          return null;
        }
        const barHeight = Math.max(1, (point.value / max) * (height - 2));
        return <rect key={year} x={index * slot + (slot - barWidth) / 2} y={height - barHeight} width={barWidth} height={barHeight} fill={fill} fillOpacity={point.complete ? 0.85 : 0.35} />;
      })}
    </svg>
  );
}

function firstYearOf(items: Array<{ points: AnnualPoint[] }>): number {
  return Math.min(...items.map((item) => item.points[0]?.year ?? 9999));
}

function toChartPoints(points: AnnualPoint[], metric: Metric, latestMonth: number): ChartPoint[] {
  const lastYear = points[points.length - 1]?.year;
  return points.map((point) => ({
    key: String(point.year),
    label: point.complete ? String(point.year) : formatPeriodRange(point.year, point.year === lastYear ? latestMonth : point.months_with_data),
    value: metric === "rate" ? point.rate_per_100k : point.value,
    partial: !point.complete,
    note: !point.complete ? `${point.months_with_data} meses com dado` : point.population_interpolated && metric === "rate" ? "população interpolada" : undefined
  }));
}
