"use client";

import { usePathname } from "next/navigation";
import { useLoadedCore } from "@/components/DataGate";
import { navItems } from "@/components/SiteNav";
import { monthShort } from "@/lib/format";
import { PUBLISHED_UFS, configFor, screenFromPath, type UfConfig } from "@/lib/uf";
import { useUf } from "@/lib/use-uf";

function hints(config: UfConfig): Record<string, Array<[string, string]>> {
  return {
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
      ...(config.mapDrilldown ? ([["r", `${config.capital.split(" ")[0].toLowerCase()} / estado`]] as Array<[string, string]>) : []),
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
}

export function StatusBar() {
  const base = screenFromPath(usePathname());
  const uf = useUf();
  const config = configFor(uf);
  const screenHints = hints(config)[base] ?? [];
  const loaded = useLoadedCore();
  const latest = loaded?.code === uf.code ? loaded.core.latest_period : null;

  return (
    <footer className="statusbar">
      <span className="flex items-center gap-4">
        {screenHints.map(([key, label]) => (
          <span key={key}>
            <span className="kbd">{key}</span>
            {label}
          </span>
        ))}
        <span>
          <span className="kbd">1–{navItems(uf).length}</span>telas
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
      <span className="num">{latest ? `${config.sourceShort} ${monthShort(latest.month)} ${latest.year}` : config.sourceShort}</span>
    </footer>
  );
}
