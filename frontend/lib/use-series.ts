"use client";

import { useEffect, useState } from "react";
import { isSeriesLoaded, loadSeries } from "@/lib/static-api";
import type { TerritoryType } from "@/types/api";

/**
 * Garante em memória as séries por município e CISP dos indicadores pedidos (um arquivo por
 * indicador, carregado sob demanda). Devolve `true` quando dá para calcular; o estado é sempre
 * `true` porque suas séries vêm no snapshot principal.
 */
export function useSeries(indicators: string[], territoryType: TerritoryType): boolean {
  const key = `${territoryType}:${indicators.join(",")}`;
  const ready = isSeriesLoaded(indicators, territoryType);
  const [, bump] = useState(0);

  useEffect(() => {
    if (ready) {
      return;
    }
    let alive = true;
    loadSeries(indicators, territoryType).then(() => {
      if (alive) {
        bump((count) => count + 1);
      }
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, ready]);

  return ready;
}
