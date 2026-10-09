import type { Metadata } from "next";
import { PageHeader, SectionHeading, Tag } from "@/components/ui";
import { getFirstMonth, getIndicators } from "@/lib/api";

export const metadata: Metadata = { title: "Glossário" };

const TERMS = [
  {
    title: "Letalidade violenta",
    body: "Agregado do ISP para mortes violentas intencionais: homicídio doloso, latrocínio, lesão corporal seguida de morte e morte por intervenção de agente do Estado."
  },
  {
    title: "Homicídio doloso",
    body: "Morte intencional registrada como homicídio. Não inclui latrocínio nem morte por intervenção policial, que aparecem separados."
  },
  { title: "Latrocínio", body: "Roubo seguido de morte. Crime patrimonial com resultado morte; também compõe a letalidade violenta." },
  {
    title: "Morte por intervenção de agente do Estado",
    body: "Morte decorrente de ação de agentes estatais, conforme o registro policial. Também compõe a letalidade violenta."
  },
  { title: "Feminicídio", body: "Homicídio de mulher por razões da condição de sexo feminino. O ISP passou a publicar a série em outubro de 2024." },
  {
    title: "Roubo de rua",
    body: "Agregado do ISP para roubos em via pública: transeunte, celular e em coletivo, conforme a base oficial."
  },
  { title: "Estupro", body: "Registros de estupro conforme a classificação policial. Série estadual desde 2003." },
  {
    title: "CISP / área integrada",
    body: "Circunscrição Integrada de Segurança Pública: a área de uma delegacia, unidade territorial mínima dos dados do ISP. O site a chama de área integrada."
  },
  {
    title: "Acumulado no ano",
    body: "Soma de janeiro até o último mês publicado. Comparações usam os mesmos meses do ano anterior, nunca o ano inteiro contra um ano parcial."
  },
  {
    title: "Soma móvel de 12 meses",
    body: "Soma dos últimos doze meses terminados em cada mês. Remove a sazonalidade e permite comparar qualquer mês com o ano anterior."
  },
  { title: "Taxa por 100 mil", body: "Ocorrências divididas pela população residente do ano e multiplicadas por 100 mil. Só para anos completos." }
];

export default function GlossaryPage() {
  const indicators = getIndicators();

  return (
    <div className="grid gap-12">
      <PageHeader eyebrow="Glossário" title="Como ler os indicadores" aside={<Tag>Definições ISP</Tag>} />

      <dl>
        {TERMS.map((term) => (
          <div key={term.title} className="table-line">
            <dt>{term.title}</dt>
            <dd>{term.body}</dd>
          </div>
        ))}
      </dl>

      <section className="grid gap-5">
        <SectionHeading title="Cobertura por indicador" sub="Primeiro mês com dado publicado em cada nível territorial." />
        <div className="overflow-x-auto">
          <table className="ruled min-w-[640px]">
            <thead>
              <tr>
                <th>Indicador</th>
                <th>Categoria</th>
                <th className="right">Estado</th>
                <th className="right">CISP</th>
                <th className="right">Município</th>
                <th>Código</th>
              </tr>
            </thead>
            <tbody>
              {indicators.map((indicator) => (
                <tr key={indicator.code}>
                  <td className="text-ink">{indicator.name}</td>
                  <td className="faint">{indicator.category}</td>
                  <td className="num right">{getFirstMonth(indicator.code, "state") ?? "–"}</td>
                  <td className="num right">{getFirstMonth(indicator.code, "police_area") ?? "–"}</td>
                  <td className="num right">{getFirstMonth(indicator.code, "municipality") ?? "–"}</td>
                  <td className="font-mono text-[11px] text-ash">{indicator.code}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
