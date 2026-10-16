"use client";

import type { Geometry } from "geojson";
import { useEffect, useMemo, useRef, useState } from "react";
import { useScreenHotkeys } from "@/components/Hotkeys";
import { Panel, Screen, Segmented, Stat } from "@/components/ui";
import { CRIME_GENERAL_CODE, localIndicator, capitalName, getIndicator, getLatestPeriod, getLocalIndicators, getMapData, getSnapshotMeta } from "@/lib/api";
import { ufConfig } from "@/lib/uf";
import { deltaClass, formatMonthYear, formatNumber, formatPercent, formatRate } from "@/lib/format";
import { noteFor } from "@/lib/notes";
import type { GeoFeatureCollection, RankingMode } from "@/types/api";

type MapView = "state" | "rio_city";
type Period = { year: number; month: number; label: string };

const MAP_WIDTH = 1000;
const MAP_HEIGHT = 680;
const MAP_PADDING = 12;
const EMPTY: GeoFeatureCollection = { type: "FeatureCollection", features: [] };

function projectPoint(lon: number, lat: number, bbox: [number, number, number, number]) {
  const [minLon, minLat, maxLon, maxLat] = bbox;
  const centerLat = ((minLat + maxLat) / 2) * (Math.PI / 180);
  const lonScale = Math.max(0.2, Math.cos(centerLat));
  const rawWidth = Math.max((maxLon - minLon) * lonScale, 0.000001);
  const rawHeight = Math.max(maxLat - minLat, 0.000001);
  const scale = Math.min((MAP_WIDTH - MAP_PADDING * 2) / rawWidth, (MAP_HEIGHT - MAP_PADDING * 2) / rawHeight);
  const offsetX = (MAP_WIDTH - rawWidth * scale) / 2;
  const offsetY = (MAP_HEIGHT - rawHeight * scale) / 2;
  return { x: offsetX + (lon - minLon) * lonScale * scale, y: offsetY + (maxLat - lat) * scale };
}

function ringPath(ring: number[][], bbox: [number, number, number, number]) {
  const points = ring.map(([lon, lat]) => {
    const { x, y } = projectPoint(lon, lat, bbox);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  return points.length ? `M${points.join("L")}Z` : "";
}

function geometryPath(geometry: Geometry | null | undefined, bbox: [number, number, number, number]) {
  if (!geometry) {
    return "";
  }
  if (geometry.type === "Polygon") {
    return geometry.coordinates.map((ring) => ringPath(ring as number[][], bbox)).join("");
  }
  if (geometry.type === "MultiPolygon") {
    return geometry.coordinates.flatMap((polygon) => polygon.map((ring) => ringPath(ring as number[][], bbox))).join("");
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

function periodsFrom(startYear: number, latestYear: number, latestMonth: number): Period[] {
  const periods: Period[] = [];
  for (let year = startYear; year <= latestYear; year += 1) {
    const maxMonth = year === latestYear ? latestMonth : 12;
    for (let month = 1; month <= maxMonth; month += 1) {
      periods.push({ year, month, label: formatMonthYear(year, month) });
    }
  }
  return periods;
}

function metricLabel(indicator: string, mode: RankingMode) {
  if (mode === "rate" || indicator === CRIME_GENERAL_CODE) {
    return "Por 100 mil hab.";
  }
  return mode === "yoy" ? "Variação anual" : "Ocorrências";
}

export function MunicipalityChoroplethPanel() {
  const latest = getLatestPeriod();
  const coverage = getSnapshotMeta().coverage;
  const indicators = useMemo(() => getLocalIndicators(), []);

  const [indicator, setIndicator] = useState(localIndicator());
  const [mode, setMode] = useState<RankingMode>("rate");
  const [view, setView] = useState<MapView>("state");
  const [periodKey, setPeriodKey] = useState(formatMonthYear(latest.year, latest.month));
  const [data, setData] = useState<GeoFeatureCollection>(EMPTY);
  const [selected, setSelected] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const hydrated = useRef(false);

  const startYear = view === "rio_city" ? coverage.police_area_start_year ?? 2003 : coverage.municipality_start_year ?? 2014;
  const periods = useMemo(() => periodsFrom(startYear, latest.year, latest.month), [latest.month, latest.year, startYear]);
  const periodIndex = Math.max(
    0,
    periods.findIndex((period) => period.label === periodKey)
  );
  const period = periods[periodIndex] ?? periods[periods.length - 1];
  const effectiveMode: RankingMode = indicator === CRIME_GENERAL_CODE ? "rate" : mode;
  const activeIndex = Math.max(0, indicators.findIndex((item) => item.code === indicator));

  // Permalink: ?indicator=&mode=&period=AAAA-MM&view=
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const nextIndicator = params.get("indicator");
    if (nextIndicator && indicators.some((item) => item.code === nextIndicator)) {
      setIndicator(nextIndicator);
    }
    const nextMode = params.get("mode");
    if (nextMode === "rate" || nextMode === "count" || nextMode === "yoy") {
      setMode(nextMode);
    }
    if (params.get("view") === "rio_city" && ufConfig().mapDrilldown) {
      setView("rio_city");
    }
    const [year, month] = (params.get("period") ?? "").split("-").map(Number);
    if (year && month) {
      setPeriodKey(formatMonthYear(year, month));
    }
    hydrated.current = true;
  }, [indicators]);

  useEffect(() => {
    if (!hydrated.current) {
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    getMapData(indicator, effectiveMode, view, period.year, period.month)
      .then((next) => {
        if (!cancelled) {
          setData(next);
          setSelected((current) =>
            current ? next.features.find((feature) => feature.properties.territory_name === current.territory_name)?.properties ?? null : null
          );
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError("Falha ao carregar o mapa.");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    const params = new URLSearchParams();
    params.set("indicator", indicator);
    params.set("mode", effectiveMode);
    params.set("period", `${period.year}-${String(period.month).padStart(2, "0")}`);
    params.set("view", view);
    window.history.replaceState(null, "", `${window.location.pathname}?${params.toString()}`);
    return () => {
      cancelled = true;
    };
  }, [effectiveMode, indicator, period.month, period.year, view]);

  const bbox = useMemo<[number, number, number, number]>(() => {
    const coordinates = data.features.flatMap((feature) => collectCoordinates(feature.geometry));
    if (coordinates.length === 0) {
      return [-44.9, -23.4, -40.7, -20.7];
    }
    const lons = coordinates.map(([lon]) => lon);
    const lats = coordinates.map(([, lat]) => lat);
    return [Math.min(...lons), Math.min(...lats), Math.max(...lons), Math.max(...lats)];
  }, [data]);

  // Escala por posição (quantis): um bairro com população minúscula e taxa altíssima não apaga o resto do mapa.
  const sortedMetrics = useMemo(
    () =>
      data.features
        .filter((feature) => feature.properties.has_data)
        .map((feature) => Number(feature.properties.metric_value ?? 0))
        .sort((a, b) => a - b),
    [data]
  );
  const hasMapData = sortedMetrics.length > 0;

  function opacityFor(value: number) {
    if (sortedMetrics.length < 2) {
      return 0.5;
    }
    let low = 0;
    let high = sortedMetrics.length;
    while (low < high) {
      const mid = (low + high) >> 1;
      if (sortedMetrics[mid] < value) {
        low = mid + 1;
      } else {
        high = mid;
      }
    }
    return 0.06 + Math.max(0, Math.min(1, low / (sortedMetrics.length - 1))) * 0.88;
  }

  function changeView(nextView: MapView) {
    setView(nextView);
    const nextStart = nextView === "rio_city" ? coverage.police_area_start_year ?? 2003 : coverage.municipality_start_year ?? 2014;
    if (period.year < nextStart) {
      setPeriodKey(formatMonthYear(nextStart, 1));
    }
  }

  function stepPeriod(step: number) {
    const next = periods[Math.max(0, Math.min(periods.length - 1, periodIndex + step))];
    if (next) {
      setPeriodKey(next.label);
    }
  }

  const hotkeys = useMemo(
    () => ({
      ArrowUp: () => setIndicator(indicators[(activeIndex - 1 + indicators.length) % indicators.length].code),
      ArrowDown: () => setIndicator(indicators[(activeIndex + 1) % indicators.length].code),
      ArrowLeft: () => stepPeriod(-1),
      ArrowRight: () => stepPeriod(1),
      r: () => changeView(view === "state" && ufConfig().mapDrilldown ? "rio_city" : "state"),
      m: () => setMode((current) => (current === "rate" ? "count" : current === "count" ? "yoy" : "rate"))
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeIndex, indicators, periodIndex, periods, view, period.year]
  );
  useScreenHotkeys(hotkeys);

  // UF de um município só (Distrito Federal): o painel mostra o único recorte sem precisar do mouse.
  const shown = selected ?? (data.features.length === 1 ? data.features[0].properties : null);
  const label = metricLabel(indicator, effectiveMode);
  const unitLabel = view === "rio_city" ? "Bairro · CISP" : ufConfig().unitLabel;
  const selectedMetric = shown
    ? effectiveMode === "rate"
      ? formatRate(shown.rate_per_100k as number | null)
      : effectiveMode === "yoy"
        ? formatPercent(shown.yoy_percent_change as number | null)
        : formatNumber(shown.value as number | null)
    : "–";

  return (
    <Screen columns="260px minmax(0, 1fr) 280px">
      <Panel title={<b>Mapa</b>} flush>
        <div className="grid gap-2 border-b border-line p-3">
          <Segmented
            label="Recorte"
            value={view}
            onChange={changeView}
            options={[
              { value: "state", label: ufConfig().stateLabel },
              ...(ufConfig().mapDrilldown ? [{ value: "rio_city" as MapView, label: ufConfig().cityMapLabel }] : [])
            ]}
          />
          <Segmented
            label="Métrica"
            value={effectiveMode}
            onChange={setMode}
            options={[
              { value: "rate", label: "100 mil" },
              { value: "count", label: "Ocorr.", disabled: indicator === CRIME_GENERAL_CODE },
              { value: "yoy", label: "Var.", disabled: indicator === CRIME_GENERAL_CODE }
            ]}
          />
        </div>
        <ul className="menu" role="listbox" aria-label="Indicador">
          {indicators.map((item) => (
            <li key={item.code} role="presentation">
              <button type="button" role="option" aria-selected={item.code === indicator} onClick={() => setIndicator(item.code)}>
                <span>{item.name}</span>
                <span />
                <span />
              </button>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel
        title={
          <>
            <b>{getIndicator(indicator)?.name}</b> {view === "rio_city" ? "bairros do Rio" : ufConfig().singleMunicipality ? ufConfig().stateName : ufConfig().unitPluralLower}
          </>
        }
        aside={
          <>
            <span>jan–{period.label}</span>
            {view === "rio_city" ? (
              <button type="button" className="btn !h-7 !px-2 text-[10px]" onClick={() => changeView("state")}>
                Voltar
              </button>
            ) : null}
          </>
        }
        fill
        flush
        foot={
          <div className="flex items-center gap-4">
            <span className="shrink-0 uppercase tracking-[0.18em]">{startYear}</span>
            <input
              aria-label="Linha do tempo do mapa"
              type="range"
              min={0}
              max={Math.max(0, periods.length - 1)}
              value={periodIndex}
              className="!my-0"
              onChange={(event) => setPeriodKey(periods[Number(event.target.value)]?.label ?? periodKey)}
            />
            <span className="num shrink-0 text-ink">{period.label}</span>
            <span className="flex shrink-0 items-center gap-2 uppercase tracking-[0.18em]">
              menor
              <span className="h-2 w-16 border border-line" style={{ background: "linear-gradient(90deg, var(--haze), var(--ink))" }} aria-hidden="true" />
              maior
            </span>
          </div>
        }
      >
        <div className="relative min-h-0 flex-1">
          {loading ? (
            <div className="absolute inset-0 z-10 grid place-items-center bg-paper/70 text-[11px] tracking-[0.22em] text-ash" role="status" aria-live="polite">
              CARREGANDO
            </div>
          ) : null}
          <svg
            viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
            preserveAspectRatio="xMidYMid meet"
            role="img"
            aria-label={view === "rio_city" ? `Mapa da cidade do ${ufConfig().capital} por bairros` : `Mapa do ${ufConfig().stateName.replace(/^Estado/, "estado")} por ${ufConfig().unitPluralLower}`}
            className="block h-full w-full"
          >
            {data.features.map((feature) => {
              const name = String(feature.properties.territory_name ?? "");
              const sourceName = String(feature.properties.source_territory_name ?? "");
              const hasData = Boolean(feature.properties.has_data);
              const canOpenRio = ufConfig().mapDrilldown && view === "state" && name === capitalName();
              const isSelected = selected?.territory_name === name;
              return (
                <path
                  key={`${name}-${sourceName}`}
                  d={geometryPath(feature.geometry, bbox)}
                  // Sem dado e selecionado: papel com contorno tracejado; com dado: tinta pela posição.
                  fill={hasData && !isSelected ? "var(--ink)" : "var(--paper)"}
                  fillOpacity={hasData && !isSelected ? opacityFor(Number(feature.properties.metric_value ?? 0)) : 1}
                  stroke={isSelected ? "var(--ink)" : hasData ? "var(--paper)" : "var(--ash)"}
                  strokeDasharray={isSelected || !hasData ? "3 2" : undefined}
                  strokeWidth={isSelected ? 1.6 : canOpenRio ? 2 : 0.8}
                  className={canOpenRio ? "map-shape cursor-pointer" : "map-shape"}
                  onMouseEnter={() => setSelected(feature.properties)}
                  onFocus={() => setSelected(feature.properties)}
                  onClick={canOpenRio ? () => changeView("rio_city") : undefined}
                  onKeyDown={(event) => {
                    if (canOpenRio && (event.key === "Enter" || event.key === " ")) {
                      event.preventDefault();
                      changeView("rio_city");
                    }
                  }}
                  tabIndex={0}
                >
                  <title>{canOpenRio ? "Rio de Janeiro · abrir bairros" : sourceName ? `${name} · ${sourceName}` : name}</title>
                </path>
              );
            })}
          </svg>
          {!hasMapData && !loading ? <p className="absolute left-3 top-3 text-[11px] tracking-[0.2em] text-ink">SEM DADOS PARA ESTE RECORTE</p> : null}
          {error ? <p className="absolute bottom-3 left-3 text-[11px] tracking-[0.2em] text-ink">{error}</p> : null}
        </div>
      </Panel>

      <Panel
        title={<b>{unitLabel}</b>}
        foot={noteFor(indicator) ?? (view === "rio_city" ? "Cada bairro recebe o valor da CISP que o cobre; população do Censo 2022 por bairro." : undefined)}
      >
        <h3 className="serif text-[18px] leading-snug text-ink">{shown ? String(shown.territory_name) : "Passe o mouse pelo mapa"}</h3>
        {shown?.source_territory_name ? <p className="mt-1 text-[11px] leading-5 text-ash">{String(shown.source_territory_name)}</p> : null}
        <div className="mt-4">
          <div className="flex items-baseline justify-between gap-3 border-t border-line py-2">
            <span className="text-[11.5px] text-ash">{label}</span>
            <span className="num display text-[26px] leading-none text-ink">{selectedMetric}</span>
          </div>
          {shown && effectiveMode !== "count" ? <Stat label="Ocorrências" value={formatNumber(shown.value as number | null)} /> : null}
          {shown && effectiveMode !== "yoy" ? (
            <Stat label="Variação anual" value={<span className={deltaClass(shown.yoy_percent_change as number | null, indicator)}>{formatPercent(shown.yoy_percent_change as number | null)}</span>} />
          ) : null}
          {shown && effectiveMode !== "rate" && shown.rate_per_100k !== null ? <Stat label="Por 100 mil" value={formatRate(shown.rate_per_100k as number | null)} /> : null}
          <Stat label="Posição" value={shown?.rank ? `${String(shown.rank)}º` : "–"} sub={hasMapData ? `de ${sortedMetrics.length}` : undefined} />
        </div>
      </Panel>
    </Screen>
  );
}
