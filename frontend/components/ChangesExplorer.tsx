"use client";

import { useEffect, useState } from "react";
import { SourceBadge } from "@/components/SourceBadge";
import { enabledUf, sourceLabelForUf, type UfCode } from "@/lib/ufs";
import type { ChangeRow, LatestChangesResponse } from "@/types/api";

function formatNumber(value: number | null) {
  if (value === null) {
    return "-";
  }
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(value);
}

function ChangeTable({ rows }: { rows: ChangeRow[] }) {
  return (
    <div className="overflow-x-auto border border-border bg-surface shadow-hard">
      <table className="w-full min-w-[760px] divide-y divide-border text-sm">
        <thead className="bg-background text-left font-mono text-xs font-bold uppercase tracking-wide text-muted">
          <tr>
            <th className="px-4 py-3">Rank</th>
            <th className="px-4 py-3">Território</th>
            <th className="px-4 py-3 text-right">Atual</th>
            <th className="px-4 py-3 text-right">Ano anterior</th>
            <th className="px-4 py-3 text-right">Mudança</th>
            <th className="px-4 py-3 text-right">%</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((row) => (
            <tr key={`${row.territory_type}-${row.territory_name}`} className="hover:bg-background/50">
              <td className="px-4 py-3 font-mono font-bold text-muted">{row.rank}</td>
              <td className="px-4 py-3 text-xs font-semibold uppercase text-foreground">{row.territory_name}</td>
              <td className="px-4 py-3 text-right font-mono tabular-nums">{formatNumber(row.current_value)}</td>
              <td className="px-4 py-3 text-right font-mono tabular-nums">{formatNumber(row.previous_value)}</td>
              <td className={row.absolute_change > 0 ? "px-4 py-3 text-right font-mono font-bold tabular-nums text-accent-red" : "px-4 py-3 text-right font-mono font-bold tabular-nums text-muted"}>
                {formatNumber(row.absolute_change)}
              </td>
              <td className={row.percent_change && row.percent_change > 0 ? "px-4 py-3 text-right font-mono font-bold tabular-nums text-accent-red" : "px-4 py-3 text-right font-mono font-bold tabular-nums text-muted"}>
                {formatNumber(row.percent_change)}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ChangesExplorer({ initialChanges }: { initialChanges: LatestChangesResponse }) {
  const [changes, setChanges] = useState(initialChanges);
  const [uf, setUf] = useState<UfCode>("RJ");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function handleUfChange(event: Event) {
      const detail = (event as CustomEvent<{ uf?: string }>).detail;
      const nextUf = enabledUf(detail?.uf);
      void reload(nextUf);
    }
    window.addEventListener("ufchange", handleUfChange);
    const params = new URLSearchParams(window.location.search);
    const initialUf = enabledUf(params.get("uf") ?? window.localStorage.getItem("selected_uf"));
    if (initialUf !== "RJ") {
      void reload(initialUf);
    }
    return () => window.removeEventListener("ufchange", handleUfChange);
  }, []);

  async function reload(nextUf: UfCode) {
    setUf(nextUf);
    setLoading(true);
    setError(null);
    try {
      const { getLatestChanges } = await import("@/lib/api");
      setChanges(await getLatestChanges(nextUf));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar mudanças.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-8">
      <section className="flex flex-col gap-4 border-l-4 border-border pl-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="font-mono text-xs font-bold uppercase tracking-widest text-muted">Mudanças</p>
          <h2 className="m-0 mt-1 text-4xl font-display uppercase leading-none text-foreground">O que mudou no último período</h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SourceBadge label={sourceLabelForUf(uf)} />
          <SourceBadge label={`${changes.latest_period.month}/${changes.latest_period.year}`} />
        </div>
      </section>

      <div className="min-h-5 font-mono text-xs uppercase tracking-widest text-muted">
        {loading ? "Carregando mudanças..." : null}
        {error ? <span className="text-accent-red">{error}</span> : null}
      </div>

      <div className="grid gap-8">
        {changes.sections.map((section) => (
          <section key={section.title} className="grid gap-4">
            <div className="border-l-4 border-border pl-4">
              <h3 className="m-0 text-3xl font-display uppercase leading-none text-foreground">{section.title}</h3>
            </div>
            <ChangeTable rows={section.rows} />
          </section>
        ))}
      </div>
    </div>
  );
}
