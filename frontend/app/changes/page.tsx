import type { Metadata } from "next";
import { ChangesExplorer } from "@/components/ChangesExplorer";
import { Note, PageHeader, Tag } from "@/components/ui";
import { getLatestChanges } from "@/lib/api";
import { formatMonthYear, monthLong } from "@/lib/format";

export const metadata: Metadata = { title: "Mudanças" };

export default function ChangesPage() {
  const changes = getLatestChanges();
  const latest = changes.latest_period;
  return (
    <div className="grid gap-12">
      <PageHeader
        eyebrow="Mudanças"
        title="O que mais subiu e o que mais caiu"
        lede={`Soma dos últimos 12 meses (até ${formatMonthYear(latest.year, latest.month)}) contra os 12 meses imediatamente anteriores, em crime geral: letalidade violenta, roubo de rua, roubo de veículo, roubo de carga e estupro.`}
        aside={
          <>
            <Tag>ISP Dados Abertos</Tag>
            <Tag ghost>
              até {monthLong(latest.month)} {latest.year}
            </Tag>
          </>
        }
      />
      <Note>
        Diferenças absolutas favorecem territórios grandes; use os rankings por 100 mil habitantes para comparar intensidades. Um território só entra
        quando tem os 24 meses publicados.
      </Note>
      <ChangesExplorer sections={changes.sections} />
    </div>
  );
}
