"use client";

import dynamic from "next/dynamic";
import type { GeoFeatureCollection } from "@/types/api";

const ChoroplethMap = dynamic(() => import("@/components/ChoroplethMap"), {
  ssr: false,
  loading: () => <div className="h-[520px] border border-border bg-surface p-6 font-mono text-xs uppercase tracking-widest text-muted flex items-center justify-center">Iniciando sistemas do mapa...</div>
});

export function MapPanel({ data }: { data: GeoFeatureCollection }) {
  return <ChoroplethMap data={data} />;
}

