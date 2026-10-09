import type { Metadata } from "next";
import { GovernorsPerformanceTable } from "@/components/GovernorsPerformanceTable";
import { Note, PageHeader, SectionHeading, Tag } from "@/components/ui";
import { getGovernorPerformance } from "@/lib/api";

export const metadata: Metadata = { title: "Mandatos" };

export default function GovernorsPage() {
  const performance = getGovernorPerformance();
  return (
    <div className="grid gap-12">
      <PageHeader
        eyebrow="Mandatos"
        title="Governadores do Rio, de Brizola a hoje"
        lede="Comparação descritiva: a média mensal de cada indicador durante o governo contra a média dos 12 meses anteriores à posse. Não é atribuição de causa; política de segurança, economia e mudanças de registro atravessam mandatos."
        aside={<Tag>ISP Dados Abertos</Tag>}
      />
      <section className="grid gap-5">
        <SectionHeading title="Desempenho por mandato" sub={`Indicadores considerados: ${performance.indicators.join(", ").toLowerCase()}.`} />
        <GovernorsPerformanceTable rows={performance.rows} />
      </section>
      <Note>{performance.methodology}</Note>
    </div>
  );
}
