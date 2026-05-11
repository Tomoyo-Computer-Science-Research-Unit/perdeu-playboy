"use client";

import { ExternalLink } from "lucide-react";
import { useMemo, useState } from "react";

const MAP_BASE_URL = "https://fogocruzado.org.br/mapadosgruposarmados/";
const YEARS = Array.from({ length: 18 }, (_, index) => 2007 + index);

export function ArmedGroupsMapPanel() {
  const [year, setYear] = useState(2024);
  const mapUrl = useMemo(() => `${MAP_BASE_URL}#${year}`, [year]);

  return (
    <div className="grid gap-4">
      <section className="grid gap-4 border border-border bg-surface p-5 shadow-hard md:grid-cols-[220px_1fr]">
                <div className="flex min-w-0 flex-col justify-center gap-2 font-mono text-xs uppercase tracking-widest text-muted">
          <a
            href={mapUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex w-fit items-center gap-2 text-foreground transition-colors hover:text-muted"
          >
            Abrir fonte original <ExternalLink size={14} aria-hidden="true" />
          </a>
        </div>
      </section>

      <section className="overflow-hidden border border-border bg-surface shadow-hard">
        <iframe
          key={year}
          title={`Mapa Histórico dos Grupos Armados ${year}`}
          src={mapUrl}
          className="h-[680px] w-full bg-background"
          referrerPolicy="no-referrer-when-downgrade"
        />
      </section>
    </div>
  );
}
