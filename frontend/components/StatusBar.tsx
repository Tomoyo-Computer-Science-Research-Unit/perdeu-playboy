"use client";

import { usePathname } from "next/navigation";

const HINTS: Record<string, Array<[string, string]>> = {
  "/": [
    ["↑↓", "indicador"],
    ["←→", "recorte"],
    ["m", "métrica"],
    ["⏎", "série"]
  ],
  "/trends": [
    ["↑↓", "indicador"],
    ["←→", "anos"],
    ["v", "visualização"],
    ["m", "métrica"],
    ["c", "csv"]
  ],
  "/map": [
    ["↑↓", "indicador"],
    ["←→", "mês"],
    ["r", "rio / estado"],
    ["m", "métrica"]
  ],
  "/rankings": [
    ["↑↓", "indicador"],
    ["←→", "mês"],
    ["m", "métrica"]
  ],
  "/changes": [],
  "/governors": [],
  "/methodology": [],
  "/glossary": [],
  "/sources": []
};

export function StatusBar({ latestLabel }: { latestLabel: string }) {
  const pathname = usePathname();
  const base = pathname.startsWith("/dashboard") ? "/" : pathname;
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
          <span className="kbd">1–7</span>telas
        </span>
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
