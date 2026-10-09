import { Suspense } from "react";
import type { Metadata } from "next";
import { TrendsExplorer } from "@/components/TrendsExplorer";
import { PageHeader, Tag } from "@/components/ui";
import { getLatestPeriod } from "@/lib/api";
import { monthLong } from "@/lib/format";

export const metadata: Metadata = { title: "Séries históricas" };

export default function TrendsPage() {
  const latest = getLatestPeriod();
  return (
    <div className="grid gap-12">
      <PageHeader
        eyebrow="Séries históricas"
        title="Cada indicador, mês a mês e ano a ano"
        lede="Estado desde 1991, áreas integradas (CISP) desde 2003, municípios desde 2014. Escolha o recorte, compare totais anuais ou a soma móvel de 12 meses, e baixe a série em CSV."
        aside={
          <>
            <Tag>ISP Dados Abertos</Tag>
            <Tag ghost>
              até {monthLong(latest.month)} {latest.year}
            </Tag>
          </>
        }
      />
      <Suspense>
        <TrendsExplorer />
      </Suspense>
    </div>
  );
}
