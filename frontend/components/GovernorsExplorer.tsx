"use client";

import { useEffect, useState } from "react";
import { GovernorsPerformanceTable } from "@/components/GovernorsPerformanceTable";
import { SourceBadge } from "@/components/SourceBadge";
import { enabledUf, sourceLabelForUf, type UfCode } from "@/lib/ufs";
import type { GovernorPerformanceResponse } from "@/types/api";

export function GovernorsExplorer({ initialPerformance }: { initialPerformance: GovernorPerformanceResponse }) {
  const [performance, setPerformance] = useState(initialPerformance);
  const [uf, setUf] = useState<UfCode>("BR");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isBrazil = uf === "BR";
  const entityPlural = isBrazil ? "Presidentes" : "Governadores";
  const entitySingular = isBrazil ? "Presidente" : "Governador";

  useEffect(() => {
    function handleUfChange(event: Event) {
      const detail = (event as CustomEvent<{ uf?: string }>).detail;
      const nextUf = enabledUf(detail?.uf);
      void reload(nextUf);
    }
    window.addEventListener("ufchange", handleUfChange);
    const params = new URLSearchParams(window.location.search);
    const initialUf = enabledUf(params.get("uf") ?? window.localStorage.getItem("selected_uf"));
    if (initialUf !== "BR") {
      void reload(initialUf);
    }
    return () => window.removeEventListener("ufchange", handleUfChange);
  }, []);

  async function reload(nextUf: UfCode) {
    setUf(nextUf);
    setLoading(true);
    setError(null);
    try {
      const { getGovernorPerformance } = await import("@/lib/api");
      setPerformance(await getGovernorPerformance(nextUf));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar mandatos.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-8">
      <section className="flex flex-col gap-4 border-l-4 border-border pl-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="font-mono text-xs font-bold uppercase tracking-widest text-muted">{entityPlural}</p>
          <h2 className="m-0 mt-1 text-4xl font-display uppercase leading-none text-foreground">Performance por mandato</h2>
        </div>
        <SourceBadge label={sourceLabelForUf(uf)} />
      </section>

      <div className="min-h-5 font-mono text-xs uppercase tracking-widest text-muted">
        {loading ? `Carregando ${entityPlural.toLowerCase()}...` : null}
        {error ? <span className="text-accent-red">{error}</span> : null}
      </div>

      <GovernorsPerformanceTable rows={performance.rows} personLabel={entitySingular} />
    </div>
  );
}
