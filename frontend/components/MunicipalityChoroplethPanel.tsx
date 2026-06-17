"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { enabledUf, type UfCode } from "@/lib/ufs";
import type { GeoFeatureCollection, Indicator, RankingMode } from "@/types/api";

type Geometry = GeoJSON.Geometry;
type MapView = "state" | "rio_city";
type MapIndicator = string | "crime_geral";
type MapInitialState = {
  indicator: MapIndicator;
  mode: RankingMode;
  view: MapView;
  periodIndex: number;
  uf: UfCode;
};

function formatNumber(value: unknown) {
  const number = Number(value ?? 0);
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(number);
}

function formatOptionalNumber(value: unknown, suffix = "") {
  if (value === null || value === undefined || value === "") {
    return "-";
  }
  return `${formatNumber(value)}${suffix}`;
}

function polygonPath(ring: number[][], bbox: [number, number, number, number]) {
  const [minLon, minLat, maxLon, maxLat] = bbox;
  const width = maxLon - minLon || 1;
  const height = maxLat - minLat || 1;
  const points = ring.map(([lon, lat]) => {
    const x = ((lon - minLon) / width) * 1000;
    const y = (1 - (lat - minLat) / height) * 680;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  });
  return points.length ? `M${points.join("L")}Z` : "";
}

function geometryPath(geometry: Geometry | null | undefined, bbox: [number, number, number, number]) {
  if (!geometry) {
    return "";
  }
  if (geometry.type === "Polygon") {
    return geometry.coordinates.map((ring) => polygonPath(ring as number[][], bbox)).join("");
  }
  if (geometry.type === "MultiPolygon") {
    return geometry.coordinates
      .flatMap((polygon) => polygon.map((ring) => polygonPath(ring as number[][], bbox)))
      .join("");
  }
  return "";
}

function collectCoordinates(geometry: Geometry | null | undefined): number[][] {
  if (!geometry) {
    return [];
  }
  if (geometry.type === "Polygon") {
    return geometry.coordinates.flat() as number[][];
  }
  if (geometry.type === "MultiPolygon") {
    return geometry.coordinates.flat(2) as number[][];
  }
  return [];
}

function color(value: number, max: number, indicator: MapIndicator, mode: RankingMode) {
  const intensity = Math.max(0, Math.min(1, value / Math.max(max, 1)));
  return `rgb(${36 + Math.round(196 * intensity)}, ${14 + Math.round(28 * (1 - intensity))}, ${14 + Math.round(28 * (1 - intensity))})`;
}

function metricLabel(indicator: MapIndicator, mode: RankingMode) {
  if (indicator === "crime_geral" || mode === "rate") {
    return "Taxa 100 mil";
  }
  if (mode === "yoy") {
    return "Variação anual";
  }
  return "Valor";
}

function periodsUntil(latestYear: number, latestMonth: number) {
  return periodsFrom(2000, latestYear, latestMonth);
}

function periodsFrom(startYear: number, latestYear: number, latestMonth: number) {
  const periods: Array<{ year: number; month: number; label: string }> = [];
  for (let year = startYear; year <= latestYear; year += 1) {
    const maxMonth = year === latestYear ? latestMonth : 12;
    for (let month = 1; month <= maxMonth; month += 1) {
      periods.push({
        year,
        month,
        label: `${String(month).padStart(2, "0")}/${year}`
      });
    }
  }
  return periods;
}

function defaultMapState(periods: Array<{ year: number; month: number }>): MapInitialState {
  return { indicator: "crime_geral", mode: "rate", view: "state", periodIndex: periods.length - 1, uf: "RJ" };
}

function browserMapState(periods: Array<{ year: number; month: number }>): MapInitialState {
  const params = new URLSearchParams(window.location.search);
  const indicator = params.get("indicator") || "crime_geral";
  const mode = params.get("mode") as RankingMode | null;
  const view = params.get("view") === "rio_city" ? "rio_city" : "state";
  const uf = enabledUf(params.get("uf") ?? window.localStorage.getItem("selected_uf"));
  const period = params.get("period") || "";
  const [year, month] = period.split("-").map(Number);
  const startYear = viewStartYear(view, uf);
  const periodIndex = year >= startYear ? periods.findIndex((item) => item.year === year && item.month === month) : -1;
  const latestVisibleIndex = latestVisiblePeriodIndex(periods, startYear);
  return {
    indicator,
    mode: indicator === "crime_geral" ? "rate" : mode === "rate" || mode === "yoy" || mode === "count" ? mode : "rate",
    view,
    periodIndex: periodIndex >= 0 ? periodIndex : latestVisibleIndex >= 0 ? latestVisibleIndex : periods.length - 1,
    uf
  };
}

function latestVisiblePeriodIndex(periods: Array<{ year: number; month: number }>, startYear: number) {
  for (let index = periods.length - 1; index >= 0; index -= 1) {
    if (periods[index].year >= startYear) {
      return index;
    }
  }
  return -1;
}

export function MunicipalityChoroplethPanel({
  indicators,
  initialData,
  latestYear,
  latestMonth
}: {
  indicators: Indicator[];
  initialData: GeoFeatureCollection;
  latestYear: number;
  latestMonth: number;
}) {
  const periods = useMemo(() => periodsUntil(latestYear, latestMonth), [latestMonth, latestYear]);
  const initialState = useMemo(() => defaultMapState(periods), [periods]);
  const [indicator, setIndicator] = useState<MapIndicator>(initialState.indicator);
  const [indicatorOptions, setIndicatorOptions] = useState(indicators);
  const [mode, setMode] = useState<RankingMode>(initialState.mode);
  const [periodIndex, setPeriodIndex] = useState(initialState.periodIndex);
  const [view, setView] = useState<MapView>(initialState.view);
  const [uf, setUf] = useState<UfCode>(initialState.uf);
  const [activeLatest, setActiveLatest] = useState({ year: latestYear, month: latestMonth });
  const visiblePeriods = useMemo(
    () => periodsFrom(viewStartYear(view, uf), activeLatest.year, activeLatest.month),
    [activeLatest.month, activeLatest.year, view, uf]
  );
  const [data, setData] = useState(initialData);
  const [selected, setSelected] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const urlHydrated = useRef(false);

  const bbox = useMemo<[number, number, number, number]>(() => {
    const coordinates = data.features.flatMap((feature) => collectCoordinates(feature.geometry));
    if (coordinates.length === 0) {
      return [-44.9, -23.4, -40.7, -20.7];
    }
    const lons = coordinates.map(([lon]) => lon);
    const lats = coordinates.map(([, lat]) => lat);
    const nextBbox: [number, number, number, number] = [Math.min(...lons), Math.min(...lats), Math.max(...lons), Math.max(...lats)];
    return nextBbox.every(Number.isFinite) ? nextBbox : [-44.9, -23.4, -40.7, -20.7];
  }, [data]);

  const rawMaxMetric = useMemo(() => {
    return Math.max(0, ...data.features.map((feature) => Math.max(0, Number(feature.properties.metric_value ?? 0))));
  }, [data]);
  const maxMetric = Math.max(1, rawMaxMetric);
  const hasMapData = rawMaxMetric > 0;

  useEffect(() => {
    async function hydrateFromUrl() {
      const nextState = browserMapState(periods);
      let nextIndicator = nextState.indicator;
      const nextView = nextState.uf === "RJ" ? nextState.view : "state";
      let nextIndicatorOptions = indicatorOptions;
      let nextLatest = { year: latestYear, month: latestMonth };

      if (nextState.uf !== "RJ") {
        try {
          const { getLatestPeriod, getMapIndicators } = await import("@/lib/api");
          [nextIndicatorOptions, nextLatest] = await Promise.all([
            getMapIndicators(nextState.uf, nextView),
            getLatestPeriod(nextState.uf)
          ]);
          setIndicatorOptions(nextIndicatorOptions);
        } catch {
          setError("Falha ao carregar mapa.");
        }
      }

      if (
        nextIndicator !== "crime_geral"
        && !nextIndicatorOptions.some((item) => item.code === nextIndicator)
      ) {
        nextIndicator = nextIndicatorOptions[0]?.code ?? "crime_geral";
      }

      const nextMode = nextIndicator === "crime_geral" ? "rate" : nextState.mode;
      const nextPeriodIndex = clampPeriodToRange(nextState.periodIndex, nextView, nextState.uf, periods, nextLatest.year, nextLatest.month);
      setUf(nextState.uf);
      setView(nextView);
      setActiveLatest(nextLatest);
      setIndicator(nextIndicator);
      setMode(nextMode);
      setPeriodIndex(nextPeriodIndex);
      urlHydrated.current = true;
      await loadMap(nextView, nextPeriodIndex, nextIndicator, nextMode, nextState.uf);
    }

    void hydrateFromUrl();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    function handleUfChange(event: Event) {
      const detail = (event as CustomEvent<{ uf?: string }>).detail;
      const nextUf = enabledUf(detail?.uf);
      void reloadUf(nextUf);
    }
    window.addEventListener("ufchange", handleUfChange);
    return () => window.removeEventListener("ufchange", handleUfChange);
  }, [indicator, mode, periodIndex, view]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    if (!urlHydrated.current) {
      return;
    }
    const period = periods[periodIndex] ?? periods[periods.length - 1];
    const params = new URLSearchParams();
    params.set("uf", uf);
    params.set("indicator", indicator);
    params.set("mode", indicator === "crime_geral" ? "rate" : mode);
    params.set("period", `${period.year}-${String(period.month).padStart(2, "0")}`);
    params.set("view", view);
    window.history.replaceState(null, "", `${window.location.pathname}?${params.toString()}`);
  }, [indicator, mode, periodIndex, periods, uf, view]);

  async function loadMap(nextView = view, nextPeriodIndex = periodIndex, nextIndicator = indicator, nextMode = mode, nextUf = uf) {
    setLoading(true);
    setError(null);
    try {
      const { getCrimeRateMapData, getMapData, getRioCityCrimeRateMapData, getRioCityMapData } = await import("@/lib/api");
      const period = periods[nextPeriodIndex] ?? periods[periods.length - 1];
      let nextData: GeoFeatureCollection;
      if (nextIndicator === "crime_geral") {
        nextData =
          nextView === "rio_city" && nextUf === "RJ"
            ? await getRioCityCrimeRateMapData(period.year, period.month)
            : await getCrimeRateMapData(period.year, period.month, nextUf);
      } else {
        nextData =
          nextView === "rio_city" && nextUf === "RJ"
            ? await getRioCityMapData(nextIndicator, nextMode, period.year, period.month)
            : await getMapData(nextIndicator, nextMode, period.year, period.month, nextUf);
      }
      setData(nextData);
      setSelected(null);
    } catch {
      setError("Falha ao carregar mapa.");
    } finally {
      setLoading(false);
    }
  }

  async function reloadUf(nextUf: UfCode) {
    setLoading(true);
    setError(null);
    try {
      const { getLatestPeriod, getMapIndicators } = await import("@/lib/api");
      const [nextIndicators, nextLatest] = await Promise.all([getMapIndicators(nextUf, "state"), getLatestPeriod(nextUf)]);
      const nextIndicator = indicator === "crime_geral" || nextIndicators.some((item) => item.code === indicator)
        ? indicator
        : nextIndicators[0]?.code ?? "crime_geral";
      const nextPeriodIndex = clampPeriodToRange(periodIndex, "state", nextUf, periods, nextLatest.year, nextLatest.month);
      setUf(nextUf);
      setView("state");
      setActiveLatest(nextLatest);
      setSelected(null);
      setIndicatorOptions(nextIndicators);
      setIndicator(nextIndicator);
      setPeriodIndex(nextPeriodIndex);
      await loadMap("state", nextPeriodIndex, nextIndicator, nextIndicator === "crime_geral" ? "rate" : mode, nextUf);
    } catch {
      setError("Falha ao carregar mapa.");
    } finally {
      setLoading(false);
    }
  }

  async function openRioCity() {
    if (uf !== "RJ") {
      return;
    }
    const nextOptions = await mapIndicatorsFor("RJ", "rio_city");
    const nextIndicator = indicator === "crime_geral" || nextOptions.some((item) => item.code === indicator)
      ? indicator
      : nextOptions[0]?.code ?? "crime_geral";
    setIndicatorOptions(nextOptions);
    setIndicator(nextIndicator);
    setView("rio_city");
    await loadMap("rio_city", periodIndex, nextIndicator, nextIndicator === "crime_geral" ? "rate" : mode, uf);
  }

  async function backToState() {
    const nextOptions = await mapIndicatorsFor(uf, "state");
    const nextIndicator = indicator === "crime_geral" || nextOptions.some((item) => item.code === indicator)
      ? indicator
      : nextOptions[0]?.code ?? "crime_geral";
    setIndicatorOptions(nextOptions);
    setIndicator(nextIndicator);
    setView("state");
    const period = periods[periodIndex];
    if (period && period.year < 2014) {
      const stateIndex = periods.findIndex((item) => item.year === 2014 && item.month === 1);
      setPeriodIndex(stateIndex);
      await loadMap("state", stateIndex, nextIndicator, nextIndicator === "crime_geral" ? "rate" : mode, uf);
      return;
    }
    await loadMap("state", periodIndex, nextIndicator, nextIndicator === "crime_geral" ? "rate" : mode, uf);
  }

  function changePeriod(nextVisibleIndex: number) {
    const period = visiblePeriods[nextVisibleIndex] ?? visiblePeriods[visiblePeriods.length - 1];
    const nextPeriodIndex = periods.findIndex((item) => item.year === period.year && item.month === period.month);
    setPeriodIndex(nextPeriodIndex);
    void loadMap(view, nextPeriodIndex, indicator, mode, uf);
  }

  function changeIndicator(nextIndicator: MapIndicator) {
    setIndicator(nextIndicator);
    if (nextIndicator === "crime_geral") {
      setMode("rate");
      void loadMap(view, periodIndex, nextIndicator, "rate", uf);
      return;
    }
    void loadMap(view, periodIndex, nextIndicator, mode, uf);
  }

  function changeMode(nextMode: RankingMode) {
    setMode(nextMode);
    void loadMap(view, periodIndex, indicator, nextMode, uf);
  }

  const selectedPeriod = periods[periodIndex] ?? periods[periods.length - 1];
  const visiblePeriodIndex = Math.max(
    0,
    visiblePeriods.findIndex((item) => item.year === selectedPeriod?.year && item.month === selectedPeriod?.month)
  );
  const startYear = viewStartYear(view, uf);
  const currentMetricLabel = metricLabel(indicator, mode);

  return (
    <section className="grid gap-4">
      <div className="grid gap-4 border border-border bg-surface p-5 shadow-hard md:grid-cols-2">
        <label className="grid gap-2 font-mono text-xs font-bold uppercase tracking-widest text-muted">
          Indicador
          <select
            className="h-10 border border-border bg-surface px-3 text-sm text-foreground"
            value={indicator}
            onChange={(event) => changeIndicator(event.target.value)}
          >
            <option value="crime_geral">CRIME GERAL</option>
            {indicatorOptions.map((item) => (
              <option key={item.code} value={item.code}>
                {item.code === "letalidade_violenta" ? "LETALIDADE GERAL" : item.name.toUpperCase()}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-2 font-mono text-xs font-bold uppercase tracking-widest text-muted">
          Métrica
          <select
            className="h-10 border border-border bg-surface px-3 text-sm text-foreground disabled:opacity-50"
            value={indicator === "crime_geral" ? "rate" : mode}
            disabled={indicator === "crime_geral"}
            onChange={(event) => changeMode(event.target.value as RankingMode)}
          >
            <option value="count">VALOR ABSOLUTO</option>
            <option value="rate">TAXA 100 MIL</option>
            <option value="yoy">VARIAÇÃO ANUAL</option>
          </select>
        </label>

        {view === "rio_city" ? (
          <div className="flex items-end justify-end gap-3 font-mono text-xs uppercase tracking-widest text-muted md:col-span-2">
            <button type="button" className="border border-border px-3 py-2 text-foreground hover:border-foreground" onClick={() => void backToState()}>
              Voltar
            </button>
          </div>
        ) : null}
        {error ? <p className="font-mono text-xs uppercase tracking-widest text-accent-red md:col-span-2">{error}</p> : null}
      </div>

      <div className="overflow-hidden border border-border bg-surface p-4 shadow-hard">
        <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
          <div>
            <div className="relative">
              <svg viewBox="0 0 1000 680" role="img" aria-label={view === "rio_city" ? "Mapa da cidade do Rio de Janeiro por bairros" : `Mapa de ${uf} por municípios`} className="h-[420px] w-full sm:h-[560px] lg:h-[680px]">
                <rect width="1000" height="680" fill="#050505" />
                {data.features.map((feature) => {
                  const value = Number(feature.properties.metric_value ?? 0);
                  const name = String(feature.properties.territory_name ?? "");
                  const sourceName = String(feature.properties.source_territory_name ?? "");
                  const canOpenRio = uf === "RJ" && view === "state" && name === "Rio de Janeiro";
                  return (
                    <path
                      key={`${name}-${sourceName}`}
                      d={geometryPath(feature.geometry, bbox)}
                      fill={hasMapData ? color(value, maxMetric, indicator, mode) : "#1f1f1f"}
                      stroke="#050505"
                      strokeWidth={canOpenRio ? "2.4" : "1.2"}
                      className={canOpenRio ? "cursor-pointer transition-opacity hover:opacity-80" : "transition-opacity hover:opacity-80"}
                      onMouseEnter={() => setSelected(feature.properties)}
                      onFocus={() => setSelected(feature.properties)}
                      onClick={canOpenRio ? () => void openRioCity() : undefined}
                      onKeyDown={(event) => {
                        if (canOpenRio && (event.key === "Enter" || event.key === " ")) {
                          event.preventDefault();
                          void openRioCity();
                        }
                      }}
                      tabIndex={0}
                    >
                      <title>{canOpenRio ? "Rio de Janeiro · abrir bairros" : sourceName ? `${name} · ${sourceName}` : name}</title>
                    </path>
                  );
                })}
              </svg>
              {!hasMapData ? (
                <div className="absolute inset-x-4 top-4 border border-border bg-background/95 p-4 shadow-hard">
                  <p className="font-mono text-xs font-bold uppercase tracking-widest text-accent-red">Sem dados para este recorte</p>
                  <p className="mt-2 text-sm text-muted">
                    Troque o indicador, a métrica ou o período. O mês ativo foi limitado ao último período disponível no snapshot.
                  </p>
                </div>
              ) : null}
            </div>
            <div className="mt-3 grid gap-3 border border-border bg-background p-3 font-mono text-[11px] uppercase tracking-widest text-muted sm:flex sm:items-center sm:justify-between">
              <span>{currentMetricLabel}</span>
              <div className="flex items-center gap-2">
                <span>Menor</span>
                <span className="h-3 w-20 border border-border bg-gradient-to-r from-[#242a2a] to-[#e80e0e]" aria-hidden="true" />
                <span>Maior</span>
              </div>
              <span>{String(selectedPeriod?.month).padStart(2, "0")}/{selectedPeriod?.year}</span>
            </div>
          </div>

          <aside className="border border-border bg-background p-5 shadow-hard">
            <p className="font-mono text-xs font-bold uppercase tracking-widest text-muted">
              {view === "rio_city" ? "Bairro" : "Município"}
            </p>
            <h3 className="mt-2 text-3xl font-display uppercase leading-none text-foreground">
              {String(selected?.territory_name ?? "Passe o mouse")}
            </h3>
            {selected?.source_territory_name ? (
              <p className="mt-2 font-mono text-xs uppercase tracking-wide text-muted">
                {String(selected.source_territory_name)}
              </p>
            ) : null}
            <dl className="mt-6 grid gap-4 font-mono text-xs uppercase tracking-wide">
              <div className="border-t border-border pt-3">
                <dt className="text-muted">{currentMetricLabel}</dt>
                <dd className={indicator === "crime_geral" || mode === "rate" ? "mt-1 text-lg font-bold text-accent-red" : "mt-1 text-lg font-bold text-foreground"}>
                  {formatOptionalNumber(indicator === "crime_geral" || mode === "rate" ? selected?.rate_per_100k : selected?.value)}
                </dd>
              </div>
              {indicator === "crime_geral" ? (
                <div className="border-t border-border pt-3">
                  <dt className="text-muted">População base</dt>
                  <dd className="mt-1 text-lg font-bold text-foreground">{formatOptionalNumber(selected?.population)}</dd>
                </div>
              ) : null}
              {indicator !== "crime_geral" ? (
                <div className="border-t border-border pt-3">
                  <dt className="text-muted">Variação anual</dt>
                  <dd className={Number(selected?.yoy_percent_change ?? 0) > 0 ? "mt-1 text-lg font-bold text-accent-red" : "mt-1 text-lg font-bold text-foreground"}>
                    {formatOptionalNumber(selected?.yoy_percent_change, "%")}
                  </dd>
                </div>
              ) : null}
              <div className="border-t border-border pt-3">
                <dt className="text-muted">Rank</dt>
                <dd className="mt-1 text-lg font-bold text-foreground">{formatOptionalNumber(selected?.rank)}</dd>
              </div>
            </dl>
          </aside>
        </div>
      </div>

      <div className="border border-border bg-surface p-5 shadow-hard">
        <div className="flex items-center justify-between gap-4 font-mono text-xs font-bold uppercase tracking-widest text-muted">
          <span>{startYear}</span>
          <span className="text-foreground">{selectedPeriod?.label}</span>
          <span>{activeLatest.year}</span>
        </div>
        <input
          aria-label="Linha do tempo do mapa"
          type="range"
          min={0}
          max={Math.max(0, visiblePeriods.length - 1)}
          value={visiblePeriodIndex}
          className="mt-4 w-full accent-red-700"
          onChange={(event) => changePeriod(Number(event.target.value))}
        />
      </div>
    </section>
  );
}

function viewStartYear(view: MapView, uf: UfCode = "RJ") {
  if (uf !== "RJ") {
    return 2015;
  }
  return view === "rio_city" ? 2003 : 2014;
}

async function mapIndicatorsFor(uf: UfCode, view: MapView): Promise<Indicator[]> {
  try {
    const { getMapIndicators } = await import("@/lib/api");
    return getMapIndicators(uf, view);
  } catch {
    return [];
  }
}

function clampPeriodToRange(
  periodIndex: number,
  view: MapView,
  uf: UfCode,
  periods: Array<{ year: number; month: number }>,
  latestYear: number,
  latestMonth: number
) {
  const period = periods[periodIndex];
  const startYear = viewStartYear(view, uf);
  const latestIndex = periods.findIndex((item) => item.year === latestYear && item.month === latestMonth);
  if (
    period
    && period.year >= startYear
    && (period.year < latestYear || (period.year === latestYear && period.month <= latestMonth))
  ) {
    return periodIndex;
  }
  if (period && period.year < startYear) {
    const startIndex = periods.findIndex((item) => item.year === startYear && item.month === 1);
    return startIndex >= 0 ? startIndex : Math.max(0, latestIndex);
  }
  return latestIndex >= 0 ? latestIndex : Math.max(0, periods.length - 1);
}
