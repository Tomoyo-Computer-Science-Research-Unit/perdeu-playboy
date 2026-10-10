"use client";

import { useEffect, useMemo, useState } from "react";
import { AnnualTable } from "@/components/AnnualTable";
import { HistoryChart, type ChartPoint } from "@/components/HistoryChart";
import { useScreenHotkeys } from "@/components/Hotkeys";
import { TerritoryControls, type TerritorySelection } from "@/components/TerritoryControls";
import { Field, Panel, Screen, Segmented } from "@/components/ui";
import {
  CRIME_GENERAL_CODE,
  RIO_MUNICIPALITY,
  getAnnualSeries,
  getGovernorTerms,
  getMayorTerms,
  getIndicator,
  getIndicatorsFor,
  getLatestPeriod,
  getMonthlySeries,
  getTerritorialUnits,
  getTerritories,
  resolveTerritoryName
} from "@/lib/api";
import { formatMonthYear, formatPeriodRange, monthShort } from "@/lib/format";
import { noteFor } from "@/lib/notes";
import type { AnnualPoint, MonthlyPoint, TerritoryType } from "@/types/api";

type View = "annual" | "monthly" | "rolling";
type Metric = "count" | "rate";
const VIEWS: View[] = ["annual", "monthly", "rolling"];
const PRESETS: Array<{ label: string; years: number | "all" }> = [
  { label: "Tudo", years: "all" },
  { label: "20a", years: 20 },
  { label: "10a", years: 10 },
  { label: "5a", years: 5 }
];

export function TrendsExplorer() {
  const latest = getLatestPeriod();
  const [indicator, setIndicator] = useState("letalidade_violenta");
  const [selection, setSelection] = useState<TerritorySelection>({ type: "state", name: "" });
  const [view, setView] = useState<View>("annual");
  const [metric, setMetric] = useState<Metric>("count");
  const [range, setRange] = useState<{ start: number | null; end: number }>({ start: null, end: latest.year });
  const [showTerms, setShowTerms] = useState(true);
  const [hydrated, setHydrated] = useState(false);

  const municipalities = useMemo(() => getTerritories("municipality"), []);
  const policeAreas = useMemo(() => getTerritories("police_area"), []);
  const rioUnits = useMemo(() => getTerritorialUnits(RIO_MUNICIPALITY), []);
  const terms = useMemo(() => getGovernorTerms(), []);

  // Permalinks: ?indicator=&type=&name=&view=&metric=&from=&to=
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const type = params.get("type") as TerritoryType | null;
    const name = params.get("name") ?? "";
    if (type === "municipality" || type === "police_area") {
      setSelection({ type, name: name || (type === "municipality" ? RIO_MUNICIPALITY : "") });
    }
    const nextIndicator = params.get("indicator");
    if (nextIndicator) {
      setIndicator(nextIndicator);
    }
    const nextView = params.get("view");
    if (nextView === "annual" || nextView === "monthly" || nextView === "rolling") {
      setView(nextView);
    }
    if (params.get("metric") === "rate") {
      setMetric("rate");
    }
    const from = Number(params.get("from"));
    const to = Number(params.get("to"));
    setRange({ start: Number.isFinite(from) && from > 0 ? from : null, end: Number.isFinite(to) && to > 0 ? Math.min(to, latest.year) : latest.year });
    setHydrated(true);
  }, [latest.year]);

  const territoryName = resolveTerritoryName(selection.type, selection.name || undefined);
  // Na cidade do Rio (município ou uma de suas áreas), os prefeitos entram junto com os governadores.
  const inRio =
    (selection.type === "municipality" && territoryName === RIO_MUNICIPALITY) ||
    (selection.type === "police_area" && rioUnits.some((unit) => unit.territorial_unit === territoryName));
  const mayors = useMemo(() => (inRio ? getMayorTerms(RIO_MUNICIPALITY) : []), [inRio]);
  const indicators = useMemo(() => {
    const available = getIndicatorsFor(selection.type, territoryName);
    const general = getIndicator(CRIME_GENERAL_CODE);
    return general ? [...available, general] : available;
  }, [selection.type, territoryName]);
  const activeIndicator = indicators.some((item) => item.code === indicator) ? indicator : indicators[0]?.code ?? "letalidade_violenta";
  const activeIndex = Math.max(0, indicators.findIndex((item) => item.code === activeIndicator));
  const indicatorMeta = getIndicator(activeIndicator);

  const annualAll = useMemo(() => getAnnualSeries(activeIndicator, selection.type, territoryName), [activeIndicator, selection.type, territoryName]);
  const firstYear = annualAll[0]?.year ?? latest.year;
  const startYear = Math.max(firstYear, range.start ?? firstYear);
  const endYear = Math.max(startYear, Math.min(range.end, latest.year));
  const annual = useMemo(() => annualAll.filter((point) => point.year >= startYear && point.year <= endYear), [annualAll, endYear, startYear]);
  const monthly = useMemo(
    () => (view === "annual" ? [] : getMonthlySeries(activeIndicator, selection.type, territoryName, startYear, endYear)),
    [activeIndicator, endYear, selection.type, startYear, territoryName, view]
  );
  const hasRate = annualAll.some((point) => point.rate_per_100k !== null);
  const effectiveMetric: Metric = view === "annual" && hasRate ? metric : "count";
  const points = useMemo(
    () => (view === "annual" ? annualToChart(annual, effectiveMetric, latest.month) : monthlyToChart(monthly, view)),
    [annual, effectiveMetric, latest.month, monthly, view]
  );
  const years = useMemo(() => Array.from({ length: latest.year - firstYear + 1 }, (_, index) => firstYear + index), [firstYear, latest.year]);

  useEffect(() => {
    if (!hydrated) {
      return;
    }
    const params = new URLSearchParams();
    params.set("indicator", activeIndicator);
    params.set("type", selection.type);
    if (selection.type !== "state") {
      params.set("name", territoryName);
    }
    params.set("view", view);
    if (effectiveMetric === "rate") {
      params.set("metric", "rate");
    }
    params.set("from", String(startYear));
    params.set("to", String(endYear));
    window.history.replaceState(null, "", `${window.location.pathname}?${params.toString()}`);
  }, [activeIndicator, effectiveMetric, endYear, hydrated, selection.type, startYear, territoryName, view]);

  function applyPreset(presetYears: number | "all") {
    setRange({ start: presetYears === "all" ? null : latest.year - presetYears + 1, end: latest.year });
  }

  function downloadCsv() {
    const header =
      view === "annual" ? ["ano", "valor", "meses_com_dado", "completo", "variacao_pct", "populacao", "taxa_100k"] : ["periodo", "valor", "soma_12_meses", "ano_anterior", "variacao_pct"];
    const rows =
      view === "annual"
        ? annual.map((row) => [row.year, row.value ?? "", row.months_with_data, row.complete ? 1 : 0, row.yoy_percent_change ?? "", row.population ?? "", row.rate_per_100k ?? ""])
        : monthly.map((row) => [`${row.year}-${String(row.month).padStart(2, "0")}`, row.value ?? "", row.rolling_12 ?? "", row.previous_year_value ?? "", row.yoy_percent_change ?? ""]);
    const csv = [header, ...rows].map((row) => row.join(";")).join("\n");
    const blob = new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `perdeu-playboy_${activeIndicator}_${slug(territoryName)}_${view}_${startYear}-${endYear}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  const hotkeys = useMemo(
    () => ({
      ArrowUp: () => setIndicator(indicators[(activeIndex - 1 + indicators.length) % indicators.length]?.code ?? activeIndicator),
      ArrowDown: () => setIndicator(indicators[(activeIndex + 1) % indicators.length]?.code ?? activeIndicator),
      ArrowLeft: () => setRange((current) => ({ ...current, start: Math.max(firstYear, startYear - 1) })),
      ArrowRight: () => setRange((current) => ({ ...current, start: Math.min(endYear, startYear + 1) })),
      v: () => setView((current) => VIEWS[(VIEWS.indexOf(current) + 1) % VIEWS.length]),
      m: () => setMetric((current) => (current === "count" ? "rate" : "count")),
      b: () => setShowTerms((current) => !current),
      c: () => downloadCsv()
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeIndex, activeIndicator, indicators, firstYear, startYear, endYear, annual, monthly, view]
  );
  useScreenHotkeys(hotkeys);

  const territoryLabel = selection.type === "state" ? "Estado do Rio de Janeiro" : territoryName;
  const valueLabel = effectiveMetric === "rate" ? "Por 100 mil hab." : indicatorMeta?.unit === "armas" ? "Armas" : "Ocorrências";

  return (
    <Screen columns="minmax(0, 1fr) 420px" rows="auto minmax(0, 1fr)">
      <Panel title={<b>Séries</b>} style={{ gridColumn: "1 / span 2" }}>
        <div className="flex flex-wrap items-end gap-x-5 gap-y-3">
          <Field label="Indicador" className="min-w-[220px]">
            <select value={activeIndicator} onChange={(event) => setIndicator(event.target.value)}>
              {indicators.map((item) => (
                <option key={item.code} value={item.code}>
                  {item.name}
                </option>
              ))}
            </select>
          </Field>
          <TerritoryControls
            value={selection}
            onChange={setSelection}
            municipalities={municipalities}
            policeAreas={policeAreas}
            rioUnits={rioUnits}
            defaultMunicipality={RIO_MUNICIPALITY}
          />
          <Segmented
            label="Visualização"
            value={view}
            onChange={setView}
            options={[
              { value: "annual", label: "Anual" },
              { value: "monthly", label: "Mensal" },
              { value: "rolling", label: "12 meses" }
            ]}
          />
          <Segmented
            label="Métrica"
            value={effectiveMetric}
            onChange={setMetric}
            options={[
              { value: "count", label: "Ocorrências" },
              { value: "rate", label: "100 mil", disabled: view !== "annual" || !hasRate }
            ]}
          />
          <div className="flex items-end gap-2">
            <Field label="De">
              <select value={startYear} onChange={(event) => setRange((current) => ({ ...current, start: Number(event.target.value) }))}>
                {years.map((year) => (
                  <option key={year} value={year} disabled={year > endYear}>
                    {year}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Até">
              <select value={endYear} onChange={(event) => setRange((current) => ({ ...current, end: Number(event.target.value) }))}>
                {years.map((year) => (
                  <option key={year} value={year} disabled={year < startYear}>
                    {year}
                  </option>
                ))}
              </select>
            </Field>
            <div className="segmented" role="group" aria-label="Atalhos de período">
              {PRESETS.map((preset) => (
                <button key={preset.label} type="button" onClick={() => applyPreset(preset.years)}>
                  {preset.label}
                </button>
              ))}
            </div>
          </div>
          <button type="button" aria-pressed={showTerms} onClick={() => setShowTerms((current) => !current)} className="toggle">
            Mandatos
          </button>
          <button type="button" onClick={downloadCsv} className="btn ml-auto">
            CSV
          </button>
        </div>
      </Panel>

      <Panel
        title={
          <>
            <b>{indicatorMeta?.name}</b> {territoryLabel}
          </>
        }
        aside={<span>{subtitle(view, effectiveMetric, startYear, endYear, latest.year, latest.month)}</span>}
        fill
        foot={noteFor(activeIndicator) ?? undefined}
      >
        <HistoryChart
          points={points}
          kind={view === "annual" ? "annual" : "monthly"}
          valueLabel={view === "rolling" ? "Soma de 12 meses" : valueLabel}
          secondaryLabel={view === "monthly" ? "Soma de 12 meses ÷ 12" : undefined}
          digits={effectiveMetric === "rate" ? 1 : view === "monthly" ? 1 : 0}
          terms={terms}
          mayors={mayors}
          showTerms={showTerms}
        />
      </Panel>

      <Panel title={<><b>Ano a ano</b> {startYear}–{endYear}</>} flush foot="* ano incompleto · ~ população interpolada">
        <AnnualTable points={annual} latestMonth={latest.month} unitLabel={indicatorMeta?.unit === "armas" ? "armas" : "ocorrências"} compact indicator={activeIndicator} />
      </Panel>
    </Screen>
  );
}

function annualToChart(points: AnnualPoint[], metric: Metric, latestMonth: number): ChartPoint[] {
  const lastYear = points[points.length - 1]?.year;
  return points.map((point) => ({
    key: String(point.year),
    label: point.complete ? String(point.year) : formatPeriodRange(point.year, point.year === lastYear ? latestMonth : point.months_with_data),
    value: metric === "rate" ? point.rate_per_100k : point.value,
    partial: !point.complete,
    note: !point.complete ? `${point.months_with_data} meses com dado` : point.population_interpolated && metric === "rate" ? "população interpolada" : undefined
  }));
}

function monthlyToChart(points: MonthlyPoint[], view: View): ChartPoint[] {
  return points.map((point) => ({
    key: `${point.year}-${String(point.month).padStart(2, "0")}`,
    label: `${monthShort(point.month)} ${point.year}`,
    value: view === "rolling" ? point.rolling_12 : point.value,
    secondary: view === "monthly" && point.rolling_12 !== null ? Math.round((point.rolling_12 / 12) * 10) / 10 : null,
    note:
      point.value === null
        ? "sem dado publicado"
        : point.yoy_percent_change !== null
          ? `${point.yoy_percent_change > 0 ? "+" : ""}${point.yoy_percent_change}% sobre ${monthShort(point.month)} ${point.year - 1}`
          : undefined
  }));
}

function subtitle(view: View, metric: Metric, startYear: number, endYear: number, latestYear: number, latestMonth: number): string {
  const until = endYear === latestYear ? ` até ${formatMonthYear(latestYear, latestMonth)}` : "";
  if (view === "annual") {
    return `${metric === "rate" ? "por 100 mil" : "totais anuais"} ${startYear}–${endYear}${until}`;
  }
  return `${view === "rolling" ? "soma de 12 meses" : "mensal"} ${startYear}–${endYear}${until}`;
}

function slug(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
