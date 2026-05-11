"use client";

import { useEffect, useState } from "react";
import { RankingTable } from "@/components/RankingTable";
import { ANALYSIS_START_YEAR } from "@/lib/constants";
import type { Indicator, RankingMode, RankingRow } from "@/types/api";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";
type RankingTerritoryType = "municipality" | "police_area";
type SortKey = "value" | "variation";
type SortDirection = "asc" | "desc";

export function RankingsExplorer({ indicators, initialRows }: { indicators: Indicator[]; initialRows: RankingRow[] }) {
  const [indicator, setIndicator] = useState("letalidade_violenta");
  const [territoryType, setTerritoryType] = useState<RankingTerritoryType>("municipality");
  const [mode, setMode] = useState<RankingMode>("count");
  const [year, setYear] = useState(2026);
  const [month, setMonth] = useState(3);
  const [rows, setRows] = useState(initialRows);
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadRankings() {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({
        indicator,
        year: String(year),
        month: String(month),
        territory_type: territoryType,
        mode
      });
      const response = await fetch(`${API_BASE}/api/rankings?${params.toString()}`, { cache: "no-store" });
      if (!response.ok) {
        throw new Error("Falha ao carregar ranking oficial do ISP.");
      }
      const nextRows = (await response.json()) as RankingRow[];
      if (!cancelled) {
        setRows(sortKey ? sortRows(nextRows, sortKey, sortDirection) : nextRows);
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
  }, [indicator, territoryType, mode, year, month, sortKey, sortDirection]);

  function handleSort(nextKey: SortKey) {
    const nextDirection = sortKey === nextKey && sortDirection === "desc" ? "asc" : "desc";
    setSortKey(nextKey);
    setSortDirection(nextDirection);
    setRows((currentRows) => sortRows(currentRows, nextKey, nextDirection));
  }

  return (
    <div className="grid gap-6">
      <section className="grid gap-4 border border-border bg-surface p-5 shadow-hard md:grid-cols-5">
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
          Território
          <select className="h-10 border border-border bg-surface px-3 text-sm text-foreground" value={territoryType} onChange={(event) => setTerritoryType(event.target.value as RankingTerritoryType)}>
            <option value="municipality">MUNICÍPIO</option>
            <option value="police_area">ÁREA POLICIAL</option>
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
        <span>{loading ? "Carregando ranking oficial do ISP..." : `${rows.length} territórios`}</span>
        {error ? <span className="text-accent-red">{error}</span> : null}
      </div>

      <RankingTable rows={rows} sortKey={sortKey ?? undefined} sortDirection={sortDirection} onSort={handleSort} />
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
