"use client";

import { usePathname } from "next/navigation";
import { useCallback } from "react";
import { ufFromPath, ufHref, type UfEntry } from "@/lib/uf";

/** UF da página atual, pelo caminho (só em componentes cliente). */
export function useUf(): UfEntry {
  return ufFromPath(usePathname());
}

/** Endereço de uma tela na UF da página: "/series?x=1" vira "/sp/series/?x=1" em São Paulo. */
export function useScreenHref(): (screen: string) => string {
  const uf = useUf();
  return useCallback((screen: string) => ufHref(uf.code, screen), [uf.code]);
}
