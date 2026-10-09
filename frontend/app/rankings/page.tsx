import type { Metadata } from "next";
import { RankingsExplorer } from "@/components/RankingsExplorer";
import { PageHeader, Tag } from "@/components/ui";
import { getLatestPeriod } from "@/lib/api";
import { monthLong } from "@/lib/format";

export const metadata: Metadata = { title: "Rankings" };

export default function RankingsPage() {
  const latest = getLatestPeriod();
  return (
    <div className="grid gap-12">
      <PageHeader
        eyebrow="Rankings"
        title="Municípios e áreas policiais lado a lado"
        lede="Ordene os 92 municípios e as 138 áreas integradas de segurança pública por ocorrências, por taxa a cada 100 mil habitantes ou pela variação sobre o ano anterior. Clique num território para abrir a série dele."
        aside={
          <>
            <Tag>ISP + IBGE</Tag>
            <Tag ghost>
              até {monthLong(latest.month)} {latest.year}
            </Tag>
          </>
        }
      />
      <RankingsExplorer />
    </div>
  );
}
