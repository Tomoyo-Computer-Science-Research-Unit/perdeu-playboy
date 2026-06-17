"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { TrendChart } from "@/components/TrendChart";
import { ANALYSIS_START_YEAR } from "@/lib/constants";
import { analysisStartYearForUf, enabledUf, preferredMunicipalityForUf, stateNameForUf, type UfCode } from "@/lib/ufs";
import type { Indicator, Territory, TerritoryType, TimeSeriesPoint } from "@/types/api";

interface TrendsExplorerProps {
  indicators: Indicator[];
  initialTerritories: Territory[];
  initialData: TimeSeriesPoint[];
}

export function TrendsExplorer({ indicators, initialTerritories, initialData }: TrendsExplorerProps) {
  const [indicator, setIndicator] = useState("roubo_rua");
  const [indicatorOptions, setIndicatorOptions] = useState(indicators);
  const [uf, setUf] = useState<UfCode>("BR");
  const [territoryType, setTerritoryType] = useState<TerritoryType>("state");
  const [territoryName, setTerritoryName] = useState("Brasil");
  const [territories, setTerritories] = useState<Territory[]>(initialTerritories);
  const [startYear, setStartYear] = useState(2015);
  const [endYear, setEndYear] = useState(2026);
  const [data, setData] = useState<TimeSeriesPoint[]>(initialData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const firstTerritoriesLoad = useRef(true);
  const firstSeriesLoad = useRef(true);

  const visibleTerritories = useMemo(() => territories.map((territory) => territory.name), [territories]);

  useEffect(() => {
    let cancelled = false;
    async function loadTerritories() {
      if (firstTerritoriesLoad.current) {
        firstTerritoriesLoad.current = false;
        return;
      }
      const { getTerritories } = await import("@/lib/api");
      const nextType = uf !== "RJ" && territoryType === "police_area" ? "municipality" : territoryType;
      const nextTerritories = await getTerritories(nextType, uf);
      if (cancelled) {
        return;
      }
      if (nextType !== territoryType) {
        setTerritoryType(nextType);
      }
      setTerritories(nextTerritories);
      setTerritoryName(preferredTerritoryName(uf, nextType, nextTerritories));
    }
    loadTerritories().catch((err: unknown) => setError(err instanceof Error ? err.message : "Erro ao carregar territórios."));
    return () => {
      cancelled = true;
    };
  }, [territoryType, uf]);

  useEffect(() => {
    let cancelled = false;
    async function loadSeries() {
      if (firstSeriesLoad.current) {
        firstSeriesLoad.current = false;
        return;
      }
      setLoading(true);
      setError(null);
      const { getTimeseries } = await import("@/lib/api");
      const nextData = await getTimeseries(indicator, territoryType, territoryName, startYear, endYear, uf);
      if (!cancelled) {
        setData(nextData);
      }
    }
    if (territoryName) {
      loadSeries()
        .catch((err: unknown) => setError(err instanceof Error ? err.message : "Erro ao carregar série."))
        .finally(() => {
          if (!cancelled) {
            setLoading(false);
          }
        });
    }
    return () => {
      cancelled = true;
    };
  }, [indicator, territoryType, territoryName, startYear, endYear, uf]);

  useEffect(() => {
    function handleUfChange(event: Event) {
      const detail = (event as CustomEvent<{ uf?: string }>).detail;
      const nextUf = enabledUf(detail?.uf);
      setUf(nextUf);
      setTerritoryType("state");
      void reloadUf(nextUf);
    }
    window.addEventListener("ufchange", handleUfChange);
    const params = new URLSearchParams(window.location.search);
    const initialUf = enabledUf(params.get("uf") ?? window.localStorage.getItem("selected_uf"));
    if (initialUf !== "BR") {
      setUf(initialUf);
      void reloadUf(initialUf);
    }
    return () => window.removeEventListener("ufchange", handleUfChange);
  }, [indicator]);

  async function reloadUf(nextUf: UfCode) {
    setLoading(true);
    setError(null);
    try {
      const { getIndicators, getLatestPeriod, getTerritories, getTimeseries } = await import("@/lib/api");
      const [latest, nextTerritories, nextIndicators] = await Promise.all([
        getLatestPeriod(nextUf),
        getTerritories("state", nextUf),
        getIndicators(nextUf)
      ]);
      const stateName = nextTerritories[0]?.name ?? stateNameForUf(nextUf);
      const nextStart = Math.max(ANALYSIS_START_YEAR, analysisStartYearForUf(nextUf));
      const nextIndicator = nextIndicators.some((item) => item.code === indicator) ? indicator : nextIndicators[0]?.code ?? "letalidade_violenta";
      const nextData = await getTimeseries(nextIndicator, "state", stateName, nextStart, latest.year, nextUf);
      setIndicatorOptions(nextIndicators);
      setIndicator(nextIndicator);
      setTerritories(nextTerritories);
      setTerritoryName(stateName);
      setStartYear(nextStart);
      setEndYear(latest.year);
      setData(nextData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar UF.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-6">
      <section className="grid gap-4 border border-border bg-surface p-5 shadow-hard lg:grid-cols-[1fr_1.4fr_1fr]">
        <label className="grid gap-2 font-mono text-xs font-bold uppercase tracking-widest text-muted min-w-0">
          Indicador
          <select
            className="h-10 w-full min-w-0 border border-border bg-surface px-3 text-sm text-foreground focus:border-foreground focus:outline-none focus:ring-1 focus:ring-foreground transition-colors"
            value={indicator}
            onChange={(event) => setIndicator(event.target.value)}
          >
            {indicatorOptions.map((item) => (
              <option key={item.code} value={item.code}>
                {item.name.toUpperCase()}
              </option>
            ))}
          </select>
        </label>

        <div className="grid gap-4 min-w-0 md:grid-cols-[180px_1fr]">
          <label className="grid gap-2 font-mono text-xs font-bold uppercase tracking-widest text-muted min-w-0">
            Tipo
            <select
              className="h-10 w-full min-w-0 border border-border bg-surface px-3 text-sm text-foreground focus:border-foreground focus:outline-none focus:ring-1 focus:ring-foreground transition-colors"
              value={territoryType}
              onChange={(event) => setTerritoryType(event.target.value as TerritoryType)}
            >
              <option value="state">{uf === "BR" ? "BRASIL" : "ESTADO"}</option>
              <option value="municipality">{uf === "BR" ? "UF" : "MUNICÍPIO"}</option>
              {uf === "RJ" ? <option value="police_area">ÁREA POLICIAL</option> : null}
            </select>
          </label>

          <label className="grid gap-2 font-mono text-xs font-bold uppercase tracking-widest text-muted min-w-0">
            Território
            <select
              className="h-10 w-full min-w-0 border border-border bg-surface px-3 text-sm text-foreground focus:border-foreground focus:outline-none focus:ring-1 focus:ring-foreground transition-colors"
              value={territoryName}
              onChange={(event) => setTerritoryName(event.target.value)}
            >
              {visibleTerritories.map((name) => (
                <option key={name} value={name}>
                  {name.toUpperCase()}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="grid gap-4 min-w-0 md:grid-cols-2">
          <label className="grid gap-2 font-mono text-xs font-bold uppercase tracking-widest text-muted min-w-0">
            Ano inicial
            <input
              className="h-10 w-full min-w-0 border border-border bg-surface px-3 text-sm text-foreground focus:border-foreground focus:outline-none focus:ring-1 focus:ring-foreground transition-colors"
              type="number"
              value={startYear}
              min={ANALYSIS_START_YEAR}
              max={endYear}
              onChange={(event) => setStartYear(Number(event.target.value))}
            />
          </label>
          <label className="grid gap-2 font-mono text-xs font-bold uppercase tracking-widest text-muted min-w-0">
            Ano final
            <input
              className="h-10 w-full min-w-0 border border-border bg-surface px-3 text-sm text-foreground focus:border-foreground focus:outline-none focus:ring-1 focus:ring-foreground transition-colors"
              type="number"
              value={endYear}
              min={startYear}
              max={2026}
              onChange={(event) => setEndYear(Number(event.target.value))}
            />
          </label>
        </div>
      </section>

      <div className="flex min-h-6 items-center justify-between gap-4 font-mono text-xs uppercase tracking-widest text-muted">
        <span>{loading ? "Carregando dados oficiais..." : `${data.length} pontos mensais oficiais · ${uf}`}</span>
        {error ? <span className="text-accent-red">{error}</span> : null}
      </div>

      <TrendChart data={data} />
    </div>
  );
}

function preferredTerritoryName(uf: UfCode, territoryType: TerritoryType, territories: Territory[]) {
  if (territoryType === "state") {
    return territories[0]?.name ?? stateNameForUf(uf);
  }
  if (territoryType === "municipality") {
    const preferred = preferredMunicipalityForUf(uf);
    return territories.find((territory) => territory.name === preferred)?.name ?? territories[0]?.name ?? "";
  }
  return territories[0]?.name ?? "";
}
