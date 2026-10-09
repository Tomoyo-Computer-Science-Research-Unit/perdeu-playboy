"use client";

import { usePathname } from "next/navigation";
import { formatDateTime } from "@/lib/format";

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

export function StatusBar({ generatedAt }: { generatedAt: string }) {
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
      </span>
      <span className="hidden items-center gap-4 md:flex">
        <a href="https://tomoyo.systems" target="_blank" rel="noreferrer" className="hover:text-ink">
          Tomoyo
        </a>
        <a href="https://github.com/Tomoyo-Computer-Science-Research-Unit/perdeu-playboy" target="_blank" rel="noreferrer" className="hover:text-ink">
          Código
        </a>
        <span>snapshot {formatDateTime(generatedAt)}</span>
      </span>
    </footer>
  );
}
