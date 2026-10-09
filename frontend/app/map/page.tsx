import type { Metadata } from "next";
import { Suspense } from "react";
import { MunicipalityChoroplethPanel } from "@/components/MunicipalityChoroplethPanel";
import { PageHeader, Tag } from "@/components/ui";
import { getLatestPeriod, getSnapshotMeta } from "@/lib/api";
import { monthLong } from "@/lib/format";

export const metadata: Metadata = { title: "Mapa" };

export default function MapPage() {
  const latest = getLatestPeriod();
  const coverage = getSnapshotMeta().coverage;
  return (
    <div className="grid gap-12">
      <PageHeader
        eyebrow="Mapa"
        title="Municípios do estado e bairros do Rio"
        lede={`Coropleto em tons de tinta: quanto mais escuro, maior o valor. Municípios desde ${coverage.municipality_start_year ?? 2014}; clique no Rio de Janeiro para abrir os bairros, agregados pela área integrada (CISP) desde ${coverage.police_area_start_year ?? 2003}.`}
        aside={
          <>
            <Tag>ISP + IBGE + Data.Rio</Tag>
            <Tag ghost>
              até {monthLong(latest.month)} {latest.year}
            </Tag>
          </>
        }
      />
      <Suspense>
        <MunicipalityChoroplethPanel />
      </Suspense>
    </div>
  );
}
