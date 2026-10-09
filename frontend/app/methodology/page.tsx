import type { Metadata } from "next";
import Link from "next/link";
import { Panel, Screen } from "@/components/ui";
import { getIndicators, getMethodology, getSnapshotMeta } from "@/lib/api";
import { formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Metodologia" };

const GITHUB_URL = process.env.NEXT_PUBLIC_GITHUB_URL ?? "https://github.com/Tomoyo-Computer-Science-Research-Unit/perdeu-playboy";

const SOURCES = [
  {
    label: "ISP Dados Abertos",
    description: "Séries mensais oficiais do ISP-RJ por estado (desde 1991), área integrada (CISP, desde 2003) e município (desde 2014), além de armas apreendidas.",
    href: "https://www.ispdados.rj.gov.br/estatistica.html"
  },
  {
    label: "IBGE / SIDRA",
    description: "População residente por ano: censos de 1991, 2000, 2010 e 2022, contagem de 2007 e estimativas anuais. Anos sem publicação são interpolados e marcados.",
    href: "https://sidra.ibge.gov.br/tabela/6579"
  },
  {
    label: "IBGE Malhas",
    description: "Geometria oficial dos municípios fluminenses, em qualidade mínima, para o mapa.",
    href: "https://servicodados.ibge.gov.br/api/docs/malhas?versao=3"
  },
  {
    label: "Data.Rio / IPP",
    description: "Limites de bairros da cidade do Rio e população por bairro (Censo 2022), para ler as CISPs em escala de bairro.",
    href: "https://www.data.rio/"
  }
];

const STEPS = [
  ["Coleta", "CSVs do ISP e tabelas do IBGE baixados toda semana por um fluxo automatizado e guardados com checksum."],
  ["Normalização", "Nomes de municípios com codificação mista no CSV do ISP são reparados; grafias da divisão territorial são alinhadas ao CSV mensal."],
  ["Sem dado ≠ zero", "Meses em que o ISP ainda não apurava um indicador ficam vazios. Nenhuma soma, mínimo ou variação usa um mês vazio."],
  ["Acumulados", "Resumo e rankings somam de janeiro até o último mês publicado e comparam com os mesmos meses do ano anterior."],
  ["Taxas", "Ocorrências ÷ população do ano × 100 mil, só para anos completos. CISPs não têm população oficial; bairros do Rio usam o Censo 2022."],
  ["Mandatos", "Média mensal durante o governo contra a média dos 12 meses anteriores à posse. Descreve, não explica."],
  ["Notificação", "Registro não é crime: tipologias novas (feminicídio, 2024 no ISP), leis que mudam a definição (estupro, 2009) e mais disposição para denunciar sobem a série sem que o crime suba. Os indicadores afetados trazem esse aviso no rodapé."]
];

export default function MethodologyPage() {
  const methodology = getMethodology();
  const meta = getSnapshotMeta();
  const indicators = getIndicators();

  return (
    <Screen columns="minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1.1fr)">
      <Panel title={<b>Como os números chegam aqui</b>} aside={<span>snapshot {formatDateTime(meta.generated_at)}</span>}>
        <p className="text-[12.5px] leading-7 text-char">{methodology.source_summary}</p>
        <dl className="mt-4">
          {STEPS.map(([title, body]) => (
            <div key={title} className="table-line">
              <dt>{title}</dt>
              <dd>{body}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-4 text-[12px] leading-6 text-slate">
          {methodology.update_frequency}{" "}
          <a href={GITHUB_URL} target="_blank" rel="noreferrer" className="underline decoration-fog underline-offset-4 hover:decoration-ink">
            Código do ETL e do site.
          </a>
        </p>
      </Panel>

      <Panel
        title={<b>Fontes e limitações</b>}
        aside={
          <Link href="/sources" className="btn !h-7 !px-2 text-[10px]">
            Checksums
          </Link>
        }
      >
        <dl>
          {SOURCES.map((source) => (
            <div key={source.href} className="table-line">
              <dt>
                <a href={source.href} target="_blank" rel="noreferrer" className="underline decoration-fog underline-offset-4 hover:decoration-ink">
                  {source.label}
                </a>
              </dt>
              <dd>{source.description}</dd>
            </div>
          ))}
        </dl>
        <ul className="mt-4 grid gap-2 text-[12.5px] leading-6 text-char">
          {methodology.limitations.map((item) => (
            <li key={item} className="flex gap-3">
              <span className="mt-[9px] h-px w-3 shrink-0 bg-ink" aria-hidden="true" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel
        title={<b>Indicadores e uso responsável</b>}
        aside={
          <Link href="/glossary" className="btn !h-7 !px-2 text-[10px]">
            Glossário
          </Link>
        }
      >
        <dl>
          {indicators.map((indicator) => (
            <div key={indicator.code} className="table-line">
              <dt>
                {indicator.name}
                <small className="serif block text-[10.5px] italic tracking-[0.04em] text-ash">{indicator.category}</small>
              </dt>
              <dd>
                {indicator.description ?? methodology.definitions[indicator.code] ?? "–"}
                <span className="ml-2 font-mono text-[10.5px] text-ash">{indicator.code}</span>
              </dd>
            </div>
          ))}
        </dl>
        <ul className="mt-4 grid gap-2 text-[12.5px] leading-6 text-char">
          {methodology.ethical_notes.map((item) => (
            <li key={item} className="flex gap-3">
              <span className="mt-[9px] h-px w-3 shrink-0 bg-ink" aria-hidden="true" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </Panel>
    </Screen>
  );
}
