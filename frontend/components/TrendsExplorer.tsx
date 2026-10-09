"use client";

import { useEffect, useMemo, useState } from "react";
import { AnnualTable } from "@/components/AnnualTable";
import { HistoryChart, type ChartPoint } from "@/components/HistoryChart";
import { TerritoryPicker, type TerritorySelection } from "@/components/TerritoryPicker";
import { Field, SectionHeading, Segmented } from "@/components/ui";
import {
  CRIME_GENERAL_CODE,
  RIO_MUNICIPALITY,
  getAnnualSeries,
  getGovernorTerms,
  getIndicator,
  getIndicatorsFor,
  getLatestPeriod,
  getMonthlySeries,
  getTerritorialUnits,
  getTerritories,
  resolveTerritoryName
} from "@/lib/api";
import { formatMonthYear, formatPeriodRange, monthShort } from "@/lib/format";
import type { AnnualPoint, MonthlyPoint, TerritoryType } from "@/types/api";

type View = "annual" | "monthly" | "rolling";
type Metric = "count" | "rate";

const PRESETS: Array<{ label: string; years: number | "all" }> = [
  { label: "Tudo", years: "all" },
  { label: "20 anos", years: 20 },
  { label: "10 anos", years: 10 },
  { label: "5 anos", years: 5 }
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
  const indicators = useMemo(() => {
    const available = getIndicatorsFor(selection.type, territoryName);
    const general = getIndicator(CRIME_GENERAL_CODE);
    return general ? [...available, general] : available;
  }, [selection.type, territoryName]);
  const activeIndicator = indicators.some((item) => item.code === indicator) ? indicator : indicators[0]?.code ?? "letalidade_violenta";
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

  function applyPreset(years: number | "all") {
    setRange({ start: years === "all" ? null : latest.year - years + 1, end: latest.year });
  }

  function downloadCsv() {
    const header = view === "annual" ? ["ano", "valor", "meses_com_dado", "completo", "variacao_pct", "populacao", "taxa_100k"] : ["periodo", "valor", "soma_12_meses", "ano_anterior", "variacao_pct"];
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

  const territoryLabel = selection.type === "state" ? "Estado do Rio de Janeiro" : territoryName;
  const valueLabel = effectiveMetric === "rate" ? "Por 100 mil hab." : indicatorMeta?.unit === "armas" ? "Armas" : "Ocorrências";

  return (
    <div className="grid gap-12">
      <section className="grid gap-5">
        <div className="grid gap-4 md:grid-cols-[minmax(0,1.1fr)_minmax(0,2fr)]">
          <Field label="Indicador">
            <select value={activeIndicator} onChange={(event) => setIndicator(event.target.value)}>
              {indicators.map((item) => (
                <option key={item.code} value={item.code}>
                  {item.name}
                </option>
              ))}
            </select>
          </Field>
          <TerritoryPicker
            value={selection}
            onChange={setSelection}
            municipalities={municipalities}
            policeAreas={policeAreas}
            rioUnits={rioUnits}
            defaultMunicipality={RIO_MUNICIPALITY}
          />
        </div>
        <div className="flex flex-wrap items-end gap-x-6 gap-y-4 border-t border-line pt-5">
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
              { value: "rate", label: "Por 100 mil", disabled: view !== "annual" || !hasRate }
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
          </div>
          <div className="flex flex-wrap gap-1.5 pb-0.5">
            {PRESETS.map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => applyPreset(preset.years)}
                className="border border-line px-3 py-1.5 text-[10px] tracking-[0.2em] text-slate hover:border-ink hover:text-ink"
              >
                {preset.label.toUpperCase()}
              </button>
            ))}
          </div>
          <label className="ml-auto flex items-center gap-2 pb-2 text-[11px] tracking-[0.14em] text-slate">
            <input type="checkbox" checked={showTerms} onChange={(event) => setShowTerms(event.target.checked)} className="h-3.5 w-3.5 accent-[var(--ink)]" />
            MANDATOS
          </label>
        </div>
      </section>

      <section className="grid gap-5">
        <SectionHeading
          title={`${indicatorMeta?.name ?? activeIndicator} · ${territoryLabel}`}
          sub={subtitle(view, effectiveMetric, startYear, endYear, latest.year, latest.month)}
          aside={
            <button type="button" onClick={downloadCsv} className="btn btn--ghost">
              Baixar CSV
            </button>
          }
        />
        <HistoryChart
          points={points}
          kind={view === "annual" ? "annual" : "monthly"}
          valueLabel={view === "rolling" ? "Soma de 12 meses" : valueLabel}
          secondaryLabel={view === "monthly" ? "Soma de 12 meses ÷ 12" : undefined}
          digits={effectiveMetric === "rate" ? 1 : view === "monthly" ? 1 : 0}
          terms={terms}
          showTerms={showTerms}
          height={420}
        />
        {view === "monthly" ? (
          <p className="text-[11.5px] leading-6 tracking-[0.04em] text-ash">
            Linha fina: valor do mês. Linha cinza: média dos últimos 12 meses (soma ÷ 12), que suaviza a sazonalidade. Interrupções indicam
            meses sem dado publicado.
          </p>
        ) : null}
      </section>

      <section className="grid gap-5">
        <SectionHeading title="Ano a ano" sub={`${territoryLabel}, ${startYear}–${endYear}.`} />
        <AnnualTable points={annual} latestMonth={latest.month} unitLabel={indicatorMeta?.unit === "armas" ? "armas" : "ocorrências"} />
      </section>
    </div>
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
    note: point.value === null ? "sem dado publicado" : point.yoy_percent_change !== null ? `${point.yoy_percent_change > 0 ? "+" : ""}${point.yoy_percent_change}% sobre ${monthShort(point.month)} ${point.year - 1}` : undefined
  }));
}

function subtitle(view: View, metric: Metric, startYear: number, endYear: number, latestYear: number, latestMonth: number): string {
  const until = endYear === latestYear ? ` Último mês publicado: ${formatMonthYear(latestYear, latestMonth)}.` : "";
  if (view === "annual") {
    return `${metric === "rate" ? "Ocorrências por 100 mil habitantes" : "Totais anuais"}, ${startYear}–${endYear}.${until}`;
  }
  if (view === "rolling") {
    return `Soma móvel de 12 meses, ${startYear}–${endYear}: cada ponto acumula o ano terminado naquele mês.${until}`;
  }
  return `Valores mensais, ${startYear}–${endYear}.${until}`;
}

function slug(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
