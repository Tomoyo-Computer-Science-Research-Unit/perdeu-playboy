"use client";

import { useEffect, useMemo, useState } from "react";
import { HistoryChart, type ChartPoint } from "@/components/HistoryChart";
import { useScreenHotkeys } from "@/components/Hotkeys";
import { EmptyState, Field, Panel, Screen, Segmented, Stat } from "@/components/ui";
import {
  capitalName,
  getAnnualSeries,
  getFogoCruzado,
  getGovernorTerms,
  getLatestPeriod,
  getMayorTerms,
  getMonthlySeries,
  getTerritories,
  loadedTerritoryNames
} from "@/lib/api";
import { formatNumber, formatPercent, formatPeriodRange, deltaClass, deltaGlyph } from "@/lib/format";
import { useSeries } from "@/lib/use-series";
import type { AnnualPoint, TerritoryType } from "@/types/api";

type Scope = "state" | "municipality" | "neighborhood";
type View = "annual" | "monthly";
const SCOPES: Array<{ value: Scope; label: string }> = [
  { value: "state", label: "Estado" },
  { value: "municipality", label: "Município" },
  { value: "neighborhood", label: "Bairro" }
];

function toChartPoints(points: AnnualPoint[], latestMonth: number): ChartPoint[] {
  const lastYear = points[points.length - 1]?.year;
  return points.map((point) => ({
    key: String(point.year),
    label: point.complete ? String(point.year) : formatPeriodRange(point.year, point.year === lastYear ? latestMonth : point.months_with_data),
    value: point.value,
    partial: !point.complete,
    note: !point.complete ? `${point.months_with_data} meses com dado` : undefined
  }));
}

/** Tiroteios do Fogo Cruzado: estado, município e bairro do Rio, desde julho de 2016. */
export function ShootingsExplorer() {
  const fogo = getFogoCruzado();
  const latest = getLatestPeriod();
  const indicators = useMemo(() => fogo?.indicators ?? [], [fogo]);
  const codes = useMemo(() => indicators.map((item) => `fc_${item.code}`), [indicators]);
  const [indicator, setIndicator] = useState(indicators[0]?.code ?? "tiroteios");
  const [scope, setScope] = useState<Scope>("state");
  const [name, setName] = useState<string>(capitalName());
  const [view, setView] = useState<View>("annual");
  const [showTerms, setShowTerms] = useState(true);
  const territoryType = scope as TerritoryType;
  const ready = useSeries(codes, territoryType);
  const municipalities = useMemo(() => getTerritories("municipality").map((item) => item.name), []);
  const neighborhoods = useMemo(() => (ready && scope === "neighborhood" ? loadedTerritoryNames(`fc_${indicator}`, "neighborhood") : []), [indicator, ready, scope]);
  const options = scope === "municipality" ? municipalities : scope === "neighborhood" ? neighborhoods : [];
  const effectiveName = scope === "state" ? undefined : options.includes(name) ? name : options[0];

  useEffect(() => {
    if (scope === "neighborhood" && neighborhoods.length && !neighborhoods.includes(name)) {
      setName(neighborhoods[0]);
    }
    if (scope === "municipality" && !municipalities.includes(name)) {
      setName(capitalName());
    }
  }, [municipalities, name, neighborhoods, scope]);

  const code = `fc_${indicator}`;
  const annual = useMemo(() => (effectiveName === undefined && scope !== "state" ? [] : getAnnualSeries(code, territoryType, effectiveName)), [code, effectiveName, scope, territoryType, ready]);
  const monthly = useMemo(
    () => (view === "monthly" && (effectiveName !== undefined || scope === "state") ? getMonthlySeries(code, territoryType, effectiveName, 2016, latest.year) : []),
    [code, effectiveName, latest.year, scope, territoryType, view, ready]
  );
  const terms = useMemo(() => getGovernorTerms(), []);
  const mayors = useMemo(() => (scope === "neighborhood" || (scope === "municipality" && effectiveName === capitalName()) ? getMayorTerms(capitalName()) : []), [effectiveName, scope]);
  const activeIndex = Math.max(0, indicators.findIndex((item) => item.code === indicator));
  const current = annual[annual.length - 1];
  const previous = annual.length > 1 ? annual[annual.length - 2] : undefined;
  const ranking = useMemo(() => {
    if (!ready || scope === "state") {
      return [];
    }
    return options
      .map((territory) => {
        const series = getAnnualSeries(code, territoryType, territory);
        const last = series[series.length - 1];
        const before = series.length > 1 ? series[series.length - 2] : undefined;
        return { territory, value: last?.value ?? null, previous: before?.previous_same_period ?? null, change: last?.yoy_percent_change ?? null };
      })
      .filter((row) => row.value !== null && row.value > 0)
      .sort((a, b) => (b.value ?? 0) - (a.value ?? 0))
      .slice(0, 30);
  }, [code, options, ready, scope, territoryType]);

  const chartPoints = useMemo(
    () =>
      view === "annual"
        ? toChartPoints(annual, latest.month)
        : monthly.map((point) => ({ key: `${point.year}-${String(point.month).padStart(2, "0")}`, label: `${String(point.month).padStart(2, "0")}/${point.year}`, value: point.value })),
    [annual, latest.month, monthly, view]
  );

  const hotkeys = useMemo(
    () => ({
      ArrowUp: () => setIndicator(indicators[(activeIndex - 1 + indicators.length) % indicators.length]?.code ?? indicator),
      ArrowDown: () => setIndicator(indicators[(activeIndex + 1) % indicators.length]?.code ?? indicator),
      ArrowLeft: () => setScope((currentScope) => SCOPES[(SCOPES.findIndex((item) => item.value === currentScope) - 1 + SCOPES.length) % SCOPES.length].value),
      ArrowRight: () => setScope((currentScope) => SCOPES[(SCOPES.findIndex((item) => item.value === currentScope) + 1) % SCOPES.length].value),
      v: () => setView((currentView) => (currentView === "annual" ? "monthly" : "annual")),
      b: () => setShowTerms((currentValue) => !currentValue)
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeIndex, indicator, indicators]
  );
  useScreenHotkeys(hotkeys);

  if (!fogo) {
    return (
      <Screen columns="minmax(0, 1fr)" rows="minmax(0, 1fr)">
        <Panel title={<b>Tiroteios</b>} fill>
          <EmptyState>FONTE FOGO CRUZADO DESLIGADA NESTE BUILD</EmptyState>
        </Panel>
      </Screen>
    );
  }
  const label = scope === "state" ? "Estado do Rio de Janeiro" : effectiveName ?? "";
  const meta = indicators.find((item) => item.code === indicator);

  return (
    <Screen columns="320px minmax(0, 1fr) 360px" rows="auto minmax(0, 1fr)" className={ready ? "" : "is-loading"}>
      <Panel title={<b>{label}</b>} flush fill style={{ gridRow: "1 / span 2" }} foot={fogo.source.attribution}>
        <div className="grid gap-2 border-b border-line p-3">
          <Segmented label="Recorte" value={scope} options={SCOPES} onChange={setScope} />
          {scope !== "state" ? (
            <Field label={scope === "municipality" ? "Município" : "Bairro"}>
              <select value={effectiveName ?? ""} onChange={(event) => setName(event.target.value)}>
                {options.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </Field>
          ) : null}
        </div>
        <ul className="menu" role="listbox" aria-label="Indicadores do Fogo Cruzado">
          {indicators.map((item) => {
            const series = effectiveName === undefined && scope !== "state" ? [] : getAnnualSeries(`fc_${item.code}`, territoryType, effectiveName);
            const last = series[series.length - 1];
            return (
              <li key={item.code} role="presentation">
                <button type="button" role="option" aria-selected={item.code === indicator} onClick={() => setIndicator(item.code)}>
                  <span>{item.name}</span>
                  <span className="num">{formatNumber(last?.value ?? null)}</span>
                  <span className={`delta num ${deltaClass(last?.yoy_percent_change)}`}>
                    {deltaGlyph(last?.yoy_percent_change)} {last?.yoy_percent_change == null ? "–" : formatPercent(last.yoy_percent_change, 0)}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </Panel>

      <Panel
        title={
          <span>
            <b>{meta?.name ?? indicator}</b>
            {current ? ` · ${formatPeriodRange(current.year, current.complete ? 12 : latest.month)}` : ""}
          </span>
        }
        aside={
          <Segmented
            label="Visualização"
            value={view}
            options={[
              { value: "annual", label: "Anual" },
              { value: "monthly", label: "Mensal" }
            ]}
            onChange={setView}
          />
        }
        style={{ gridColumn: "2 / span 2" }}
      >
        <div className="grid grid-cols-4 gap-x-6">
          <Stat label={current ? formatPeriodRange(current.year, current.complete ? 12 : latest.month) : "Ano corrente"} value={formatNumber(current?.value ?? null)} />
          <Stat label="Mesmo período do ano anterior" value={formatNumber(current?.previous_same_period ?? null)} sub={current?.yoy_percent_change != null ? <span className={deltaClass(current.yoy_percent_change)}>{formatPercent(current.yoy_percent_change)}</span> : undefined} />
          <Stat label={previous ? `Ano ${previous.year}` : "Ano anterior"} value={formatNumber(previous?.value ?? null)} />
          <Stat label="Série desde" value={annual[0]?.year ?? "–"} sub={fogo.coverage.last_month ? `até ${String(fogo.coverage.last_month).slice(5, 7)}/${String(fogo.coverage.last_month).slice(0, 4)}` : undefined} />
        </div>
      </Panel>

      <Panel title={<b>{view === "annual" ? "Por ano" : "Por mês"}</b>} fill>
        <HistoryChart points={chartPoints} kind={view} valueLabel={meta?.name ?? indicator} terms={terms} mayors={mayors} showTerms={showTerms} />
      </Panel>

      <Panel title={<b>{scope === "neighborhood" ? "Bairros" : scope === "municipality" ? "Municípios" : "Recorte"}</b>} flush fill>
        {scope === "state" ? (
          <EmptyState>ESCOLHA MUNICÍPIO OU BAIRRO PARA VER O RANKING</EmptyState>
        ) : ranking.length === 0 ? (
          <EmptyState>{ready ? "SEM OCORRÊNCIAS" : "CARREGANDO"}</EmptyState>
        ) : (
          <table className="ruled">
            <thead>
              <tr>
                <th className="w-10">#</th>
                <th>{scope === "neighborhood" ? "Bairro" : "Município"}</th>
                <th className="right">{current ? current.year : ""}</th>
                <th className="right">Var.</th>
              </tr>
            </thead>
            <tbody>
              {ranking.map((row, index) => (
                <tr key={row.territory} className={row.territory === effectiveName ? "bg-haze" : undefined}>
                  <td className="num faint">{index + 1}</td>
                  <td className="max-w-[200px] truncate">
                    <button type="button" className="text-ink hover:underline hover:underline-offset-4" onClick={() => setName(row.territory)}>
                      {row.territory}
                    </button>
                  </td>
                  <td className="num right">{formatNumber(row.value)}</td>
                  <td className={`num right ${deltaClass(row.change)}`}>{formatPercent(row.change)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    </Screen>
  );
}
