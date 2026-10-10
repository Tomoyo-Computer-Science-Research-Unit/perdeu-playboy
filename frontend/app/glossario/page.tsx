import type { Metadata } from "next";
import { Panel, Screen } from "@/components/ui";
import { getFirstMonth, getIndicators } from "@/lib/api";

export const metadata: Metadata = { title: "Glossário" };

const TERMS = [
  { title: "Letalidade violenta", body: "Soma de homicídio doloso, latrocínio, lesão corporal seguida de morte e morte por intervenção de agente do Estado. Agregado criado pelo ISP." },
  { title: "Homicídio doloso", body: "Morte intencional registrada como homicídio. Latrocínio e morte por intervenção policial são contados à parte." },
  { title: "Latrocínio", body: "Roubo seguido de morte. Crime contra o patrimônio com resultado morte; também compõe a letalidade violenta." },
  { title: "Morte por intervenção de agente do Estado", body: "Morte causada por agente estatal em serviço, conforme o registro policial. Também compõe a letalidade violenta." },
  { title: "Feminicídio", body: "Homicídio de mulher por razões da condição de sexo feminino (Lei 13.104/2015). Na série do ISP desde outubro de 2024." },
  { title: "Roubo de rua", body: "Soma de roubo a transeunte, de celular e em coletivo, conforme a base do ISP." },
  { title: "Estupro", body: "Registros de estupro conforme a classificação policial. Série estadual desde 2003; a definição legal mudou em 2009." },
  { title: "CISP / área integrada", body: "Circunscrição Integrada de Segurança Pública: a área de uma delegacia. Menor unidade territorial dos dados do ISP; 138 no estado, 41 na capital." },
  { title: "Acumulado no ano", body: "Soma de janeiro até o último mês publicado, comparada com os mesmos meses do ano anterior." },
  { title: "Soma móvel de 12 meses", body: "Soma dos 12 meses terminados em cada mês. Elimina a sazonalidade." },
  { title: "Taxa por 100 mil", body: "Ocorrências ÷ população residente do ano × 100 mil. Só para anos completos." }
];

export default function GlossaryPage() {
  const indicators = getIndicators();

  return (
    <Screen columns="minmax(0, 1.2fr) minmax(0, 1fr)">
      <Panel title={<b>Como ler os indicadores</b>} aside={<span>definições ISP</span>}>
        <dl>
          {TERMS.map((term) => (
            <div key={term.title} className="table-line">
              <dt>{term.title}</dt>
              <dd>{term.body}</dd>
            </div>
          ))}
        </dl>
      </Panel>
      <Panel title={<b>Cobertura por indicador</b>} aside={<span>primeiro mês com dado</span>} flush>
        <table className="ruled">
          <thead>
            <tr>
              <th>Indicador</th>
              <th className="right">Estado</th>
              <th className="right">CISP</th>
              <th className="right">Município</th>
              <th>Código</th>
            </tr>
          </thead>
          <tbody>
            {indicators.map((indicator) => (
              <tr key={indicator.code}>
                <td className="text-ink">
                  {indicator.name}
                  <span className="block text-[10px] tracking-[0.06em] text-ash">{indicator.category}</span>
                </td>
                <td className="num right">{getFirstMonth(indicator.code, "state") ?? "–"}</td>
                <td className="num right">{getFirstMonth(indicator.code, "police_area") ?? "–"}</td>
                <td className="num right">{getFirstMonth(indicator.code, "municipality") ?? "–"}</td>
                <td className="font-mono text-[10.5px] text-ash">{indicator.code}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </Screen>
  );
}
