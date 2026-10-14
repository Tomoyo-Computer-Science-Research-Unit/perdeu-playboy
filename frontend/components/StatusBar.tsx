"use client";

import { usePathname } from "next/navigation";
import { NAV_ITEMS } from "@/components/SiteNav";
import { PUBLISHED_UFS, UF_CONFIG } from "@/lib/uf";

const HINTS: Record<string, Array<[string, string]>> = {
  "/": [
    ["↑↓", "indicador"],
    ["←→", "recorte"],
    ["m", "métrica"],
    ["⏎", "série"]
  ],
  "/series": [
    ["↑↓", "indicador"],
    ["←→", "anos"],
    ["v", "visualização"],
    ["m", "métrica"],
    ["c", "csv"]
  ],
  "/mapa": [
    ["↑↓", "indicador"],
    ["←→", "mês"],
    ...(UF_CONFIG.mapDrilldown ? ([["r", `${UF_CONFIG.capital.split(" ")[0].toLowerCase()} / estado`]] as Array<[string, string]>) : []),
    ["m", "métrica"]
  ],
  "/rankings": [
    ["↑↓", "indicador"],
    ["←→", "mês"],
    ["m", "métrica"]
  ],
  "/tiroteios": [
    ["↑↓", "indicador"],
    ["←→", "recorte"],
    ["v", "anual / mensal"]
  ],
  "/mudancas": [],
  "/mandatos": [],
  "/metodologia": [],
  "/glossario": [],
  "/fontes": [],
  "/status": []
};

export function StatusBar({ latestLabel }: { latestLabel: string }) {
  const pathname = usePathname();
  const base = pathname.replace(/\/+$/, "") || "/";
  const hints = HINTS[base] ?? [];

  return (
    <footer className="statusbar">
      <span className="flex items-center gap-4">
        {hints.map(([key, label]) => (
          <span key={key}>
            <span className="kbd">{key}</span>
            {label}
          </span>
        ))}
        <span>
          <span className="kbd">1–{NAV_ITEMS.length}</span>telas
        </span>
        {PUBLISHED_UFS.length > 1 ? (
          <span>
            <span className="kbd">u</span>uf
          </span>
        ) : null}
        <span>
          <span className="kbd">t</span>tema
        </span>
        <span>
          <span className="kbd">f</span>efeitos
        </span>
      </span>
      <span className="num">{latestLabel}</span>
    </footer>
  );
}
