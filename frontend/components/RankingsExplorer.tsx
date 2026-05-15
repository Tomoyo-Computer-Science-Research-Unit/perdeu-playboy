"use client";

import { useEffect, useRef, useState } from "react";
import { RankingTable } from "@/components/RankingTable";
import { ANALYSIS_START_YEAR } from "@/lib/constants";
import { enabledUf, type UfCode } from "@/lib/ufs";
import type { Indicator, RankingMode, RankingRow } from "@/types/api";

type SortKey = "value" | "variation";
type SortDirection = "asc" | "desc";

export function RankingsExplorer({
  indicators,
  initialMunicipalityRows,
  initialPoliceAreaRows
}: {
  indicators: Indicator[];
  initialMunicipalityRows: RankingRow[];
  initialPoliceAreaRows: RankingRow[];
}) {
  const [indicator, setIndicator] = useState("letalidade_violenta");
  const [uf, setUf] = useState<UfCode>("RJ");
  const [mode, setMode] = useState<RankingMode>("count");
  const [year, setYear] = useState(2026);
  const [month, setMonth] = useState(3);
  const [municipalityRows, setMunicipalityRows] = useState(initialMunicipalityRows);
  const [policeAreaRows, setPoliceAreaRows] = useState(initialPoliceAreaRows);
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const firstRankingsLoad = useRef(true);

  useEffect(() => {
    let cancelled = false;
    async function loadRankings() {
      if (firstRankingsLoad.current) {
        firstRankingsLoad.current = false;
        return;
      }
      setLoading(true);
      setError(null);
      const { getRankings } = await import("@/lib/api");
      const [nextMunicipalityRows, nextPoliceAreaRows] = await Promise.all([
        getRankings(indicator, mode, "municipality", year, month, uf),
        uf === "RJ" ? getRankings(indicator, mode, "police_area", year, month, uf) : Promise.resolve([])
      ]);
      if (!cancelled) {
        setMunicipalityRows(sortKey ? sortRows(nextMunicipalityRows, sortKey, sortDirection) : nextMunicipalityRows);
        setPoliceAreaRows(sortKey ? sortRows(nextPoliceAreaRows, sortKey, sortDirection) : nextPoliceAreaRows);
      }
    }
    loadRankings()
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Erro ao carregar ranking."))
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [indicator, mode, year, month, sortKey, sortDirection, uf]);

  useEffect(() => {
    function handleUfChange(event: Event) {
      const detail = (event as CustomEvent<{ uf?: string }>).detail;
      const nextUf = enabledUf(detail?.uf);
      setUf(nextUf);
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
  }, [indicator, mode]);

  async function reloadUf(nextUf: UfCode) {
    setLoading(true);
    setError(null);
    try {
      const { getLatestPeriod, getRankings } = await import("@/lib/api");
      const latest = await getLatestPeriod(nextUf);
      const [nextMunicipalityRows, nextPoliceAreaRows] = await Promise.all([
        getRankings(indicator, mode, "municipality", latest.year, latest.month, nextUf),
        nextUf === "RJ" ? getRankings(indicator, mode, "police_area", latest.year, latest.month, nextUf) : Promise.resolve([])
      ]);
      setYear(latest.year);
      setMonth(latest.month);
      setMunicipalityRows(sortKey ? sortRows(nextMunicipalityRows, sortKey, sortDirection) : nextMunicipalityRows);
      setPoliceAreaRows(sortKey ? sortRows(nextPoliceAreaRows, sortKey, sortDirection) : nextPoliceAreaRows);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar UF.");
    } finally {
      setLoading(false);
    }
  }

  function handleSort(nextKey: SortKey) {
    const nextDirection = sortKey === nextKey && sortDirection === "desc" ? "asc" : "desc";
    setSortKey(nextKey);
    setSortDirection(nextDirection);
    setMunicipalityRows((currentRows) => sortRows(currentRows, nextKey, nextDirection));
    setPoliceAreaRows((currentRows) => sortRows(currentRows, nextKey, nextDirection));
  }

  return (
    <div className="grid gap-6">
      <section className="grid gap-4 border border-border bg-surface p-5 shadow-hard md:grid-cols-4">
        <label className="grid gap-2 font-mono text-xs font-bold uppercase tracking-widest text-muted min-w-0">
          Indicador
          <select className="h-10 border border-border bg-surface px-3 text-sm text-foreground" value={indicator} onChange={(event) => setIndicator(event.target.value)}>
            {indicators.map((item) => (
              <option key={item.code} value={item.code}>
                {item.code === "letalidade_violenta" ? "LETALIDADE GERAL" : item.name.toUpperCase()}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-2 font-mono text-xs font-bold uppercase tracking-widest text-muted min-w-0">
          Métrica
          <select
            className="h-10 border border-border bg-surface px-3 text-sm text-foreground"
            value={mode}
            onChange={(event) => {
              setMode(event.target.value as RankingMode);
              setSortKey(null);
            }}
          >
            <option value="count">VALOR ABSOLUTO</option>
            <option value="rate">TAXA 100 MIL</option>
            <option value="yoy">VARIAÇÃO</option>
          </select>
        </label>
        <label className="grid gap-2 font-mono text-xs font-bold uppercase tracking-widest text-muted min-w-0">
          Ano
          <input className="h-10 border border-border bg-surface px-3 text-sm text-foreground" type="number" value={year} min={ANALYSIS_START_YEAR} max={2026} onChange={(event) => setYear(Number(event.target.value))} />
        </label>
        <label className="grid gap-2 font-mono text-xs font-bold uppercase tracking-widest text-muted min-w-0">
          Mês
          <input className="h-10 border border-border bg-surface px-3 text-sm text-foreground" type="number" value={month} min={1} max={12} onChange={(event) => setMonth(Number(event.target.value))} />
        </label>
      </section>

      <div className="flex min-h-6 items-center justify-between gap-4 font-mono text-xs uppercase tracking-widest text-muted">
        <span>{loading ? "Carregando ranking oficial..." : `${municipalityRows.length} municípios${uf === "RJ" ? ` / ${policeAreaRows.length} CISPs` : " / sem CISP"}`}</span>
        {error ? <span className="text-accent-red">{error}</span> : null}
      </div>

      <section className="grid gap-4">
        <div className="border-l-4 border-border pl-4">
          <h3 className="m-0 text-3xl font-display uppercase leading-none text-foreground">Municípios</h3>
        </div>
        <RankingTable rows={municipalityRows} sortKey={sortKey ?? undefined} sortDirection={sortDirection} onSort={handleSort} />
      </section>

      {uf === "RJ" ? (
      <section className="grid gap-4">
        <div className="border-l-4 border-border pl-4">
          <h3 className="m-0 text-3xl font-display uppercase leading-none text-foreground">CISPs / Áreas policiais</h3>
        </div>
        <RankingTable rows={policeAreaRows} sortKey={sortKey ?? undefined} sortDirection={sortDirection} onSort={handleSort} />
      </section>
      ) : null}
    </div>
  );
}

function sortRows(rows: RankingRow[], key: SortKey, direction: SortDirection) {
  const multiplier = direction === "desc" ? -1 : 1;
  return [...rows]
    .sort((a, b) => {
      const aValue = key === "value" ? a.value : a.yoy_percent_change ?? Number.NEGATIVE_INFINITY;
      const bValue = key === "value" ? b.value : b.yoy_percent_change ?? Number.NEGATIVE_INFINITY;
      return (aValue - bValue) * multiplier;
    })
    .map((row, index) => ({ ...row, rank: index + 1 }));
}
