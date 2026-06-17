"use client";

import { CalendarDays } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { MetricCard } from "@/components/MetricCard";
import { SourceBadge } from "@/components/SourceBadge";
import { TrendChart } from "@/components/TrendChart";
import { ANALYSIS_START_YEAR } from "@/lib/constants";
import { enabledUf, preferredMunicipalityForUf, sourceLabelForUf, stateNameForUf, type UfCode } from "@/lib/ufs";
import type { SummaryResponse, TerritorialUnit, Territory, TimeSeriesPoint } from "@/types/api";

type DashboardTerritoryMode = "state" | "municipality";

export function DashboardExplorer({
  latestYear,
  initialSummary,
  initialTimeseries,
  municipalities,
  initialTerritorialUnits
}: {
  latestYear: number;
  initialSummary: SummaryResponse;
  initialTimeseries: TimeSeriesPoint[];
  municipalities: Territory[];
  initialTerritorialUnits: TerritorialUnit[];
}) {
  const [territoryMode, setTerritoryMode] = useState<DashboardTerritoryMode>("state");
  const [uf, setUf] = useState<UfCode>("RJ");
  const [activeLatestYear, setActiveLatestYear] = useState(latestYear);
  const [selectedMunicipality, setSelectedMunicipality] = useState("Rio de Janeiro");
  const [selectedTerritorialUnit, setSelectedTerritorialUnit] = useState("");
  const [municipalityOptions, setMunicipalityOptions] = useState(municipalities);
  const [summary, setSummary] = useState(initialSummary);
  const [timeseries, setTimeseries] = useState(initialTimeseries);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const firstDashboardLoad = useRef(true);

  const chartStartYear = Math.max(ANALYSIS_START_YEAR, activeLatestYear - 2);
  const canUseTerritorialUnit = uf === "RJ" && territoryMode === "municipality" && selectedMunicipality === "Rio de Janeiro";
  const selectedUnit = initialTerritorialUnits.find((unit) => unit.police_area_name === selectedTerritorialUnit);

  useEffect(() => {
    let cancelled = false;

    async function loadDashboard() {
      if (firstDashboardLoad.current) {
        firstDashboardLoad.current = false;
        return;
      }
      setLoading(true);
      setError(null);

      const territoryType =
        territoryMode === "state" ? "state" : canUseTerritorialUnit && selectedUnit ? "police_area" : "municipality";
      const territoryName =
        territoryMode === "state"
          ? stateNameForUf(uf)
          : canUseTerritorialUnit && selectedUnit
            ? selectedUnit.police_area_name
            : selectedMunicipality;
      if (!territoryName) {
        setSummary({ ...initialSummary, cards: [] });
        setTimeseries([]);
        return;
      }

      const { getSummary, getTimeseries } = await import("@/lib/api");
      const [nextSummary, nextTimeseries] = await Promise.all([
        getSummary(activeLatestYear, territoryType, territoryName, uf),
        getTimeseries("letalidade_violenta", territoryType, territoryName, chartStartYear, activeLatestYear, uf)
      ]);

      if (!cancelled) {
        setSummary(nextSummary);
        setTimeseries(nextTimeseries);
      }
    }

    loadDashboard()
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Erro ao carregar dashboard."))
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [canUseTerritorialUnit, chartStartYear, initialSummary, activeLatestYear, selectedMunicipality, selectedUnit, territoryMode, uf]);

  useEffect(() => {
    function handleUfChange(event: Event) {
      const detail = (event as CustomEvent<{ uf?: string }>).detail;
      const nextUf = enabledUf(detail?.uf);
      setUf(nextUf);
      setTerritoryMode("state");
      setSelectedTerritorialUnit("");
      void reloadUf(nextUf);
    }
    window.addEventListener("ufchange", handleUfChange);
    const params = new URLSearchParams(window.location.search);
    const initialUf = enabledUf(params.get("uf") ?? window.localStorage.getItem("selected_uf"));
    if (initialUf !== "RJ") {
      setUf(initialUf);
      void reloadUf(initialUf);
    }
    return () => window.removeEventListener("ufchange", handleUfChange);
  }, []);

  async function reloadUf(nextUf: UfCode) {
    setLoading(true);
    setError(null);
    try {
      const { getLatestPeriod, getSummary, getTerritories, getTimeseries } = await import("@/lib/api");
      const [nextLatest, nextMunicipalities] = await Promise.all([
        getLatestPeriod(nextUf),
        getTerritories("municipality", nextUf)
      ]);
      const stateName = stateNameForUf(nextUf);
      const [nextSummary, nextTimeseries] = await Promise.all([
        getSummary(nextLatest.year, "state", stateName, nextUf),
        getTimeseries("letalidade_violenta", "state", stateName, Math.max(ANALYSIS_START_YEAR, nextLatest.year - 2), nextLatest.year, nextUf)
      ]);
      setActiveLatestYear(nextLatest.year);
      const cleanMunicipalities = nextMunicipalities.filter((item) => item.name.toLowerCase() !== "não informado");
      setMunicipalityOptions(cleanMunicipalities);
      setSelectedMunicipality(preferredMunicipality(nextUf, cleanMunicipalities));
      setSummary(nextSummary);
      setTimeseries(nextTimeseries);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar UF.");
    } finally {
      setLoading(false);
    }
  }

  const sortedCards = [...summary.cards].sort((a, b) => {
    const aValue = a.yoy_percent_change ?? Number.NEGATIVE_INFINITY;
    const bValue = b.yoy_percent_change ?? Number.NEGATIVE_INFINITY;
    return bValue - aValue;
  });
  const territoryTitle = {
    state: `Indicadores acumulados em ${uf}`,
    municipality: canUseTerritorialUnit && selectedUnit
      ? `Indicadores acumulados em ${selectedUnit.name}`
      : `Indicadores acumulados em ${selectedMunicipality}`
  }[territoryMode];

  return (
    <div className="grid gap-8">
      <section className="flex flex-col gap-4 border-l-4 border-border pl-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="m-0 mt-1 text-4xl font-display uppercase leading-none text-foreground">{territoryTitle}</h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SourceBadge label={sourceLabelForUf(uf)} />
          <span className="inline-flex items-center gap-2 border border-border bg-surface px-3 py-1.5 font-mono text-xs uppercase tracking-wide text-muted">
            <CalendarDays size={14} aria-hidden="true" className="text-muted" />
            Último mês: {summary.latest_month}/{summary.year}
          </span>
        </div>
      </section>

      <section className="grid gap-4 border border-border bg-surface p-5 shadow-hard md:grid-cols-3">
        <label className="grid min-w-0 gap-2 font-mono text-xs font-bold uppercase tracking-widest text-muted">
          Território
          <select
            className="h-10 w-full min-w-0 border border-border bg-surface px-3 text-sm text-foreground transition-colors focus:border-foreground focus:outline-none focus:ring-1 focus:ring-foreground"
            value={territoryMode}
            onChange={(event) => {
              setTerritoryMode(event.target.value as DashboardTerritoryMode);
              setSelectedTerritorialUnit("");
            }}
          >
            <option value="state">ESTADO</option>
            <option value="municipality">MUNICÍPIO</option>
          </select>
        </label>

        <label className="grid min-w-0 gap-2 font-mono text-xs font-bold uppercase tracking-widest text-muted">
          Município
          <select
            className="h-10 w-full min-w-0 border border-border bg-surface px-3 text-sm text-foreground transition-colors disabled:opacity-40 focus:border-foreground focus:outline-none focus:ring-1 focus:ring-foreground"
            value={selectedMunicipality}
            disabled={territoryMode === "state" || municipalityOptions.length === 0}
            onChange={(event) => {
              setSelectedMunicipality(event.target.value);
              setSelectedTerritorialUnit("");
            }}
          >
            {municipalityOptions.map((item) => (
              <option key={item.name} value={item.name}>
                {item.name.toUpperCase()}
              </option>
            ))}
          </select>
        </label>

        {uf === "RJ" ? (
        <label className="grid min-w-0 gap-2 font-mono text-xs font-bold uppercase tracking-widest text-muted">
          Unidade territorial
          <select
            className="h-10 w-full min-w-0 border border-border bg-surface px-3 text-sm text-foreground transition-colors disabled:opacity-40 focus:border-foreground focus:outline-none focus:ring-1 focus:ring-foreground"
            value={selectedTerritorialUnit}
            disabled={!canUseTerritorialUnit}
            onChange={(event) => setSelectedTerritorialUnit(event.target.value)}
          >
            <option value="">RIO DE JANEIRO - MUNICÍPIO INTEIRO</option>
            {initialTerritorialUnits.map((unit) => (
              <option key={`${unit.police_area_name}-${unit.territorial_unit}`} value={unit.police_area_name}>
                {unit.name.toUpperCase()}
              </option>
            ))}
          </select>
        </label>
        ) : null}

      </section>

      <div className="min-h-5 font-mono text-xs uppercase tracking-widest text-muted">
        {loading ? "Carregando dados oficiais..." : null}
        {error ? <span className="text-accent-red">{error}</span> : null}
      </div>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {sortedCards.map((card) => (
          <MetricCard key={card.indicator} card={card} year={summary.year} />
        ))}
      </section>

      <section className="mt-8 grid gap-4">
        <div className="border-l-4 border-border pl-4">
          <h2 className="text-3xl font-display uppercase leading-none text-foreground">Letalidade violenta no tempo</h2>
        </div>
        <TrendChart data={timeseries} />
      </section>
    </div>
  );
}

function preferredMunicipality(uf: UfCode, municipalities: Territory[]) {
  const preferred = preferredMunicipalityForUf(uf);
  return municipalities.find((item) => item.name === preferred)?.name ?? municipalities[0]?.name ?? "";
}
