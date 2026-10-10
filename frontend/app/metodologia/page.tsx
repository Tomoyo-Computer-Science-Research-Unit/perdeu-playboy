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
    description: "Séries mensais do Instituto de Segurança Pública do RJ: estado desde 1991, área policial (CISP) desde 2003, município desde 2014, armas apreendidas por CISP desde 2007.",
    href: "https://www.ispdados.rj.gov.br/estatistica.html"
  },
  {
    label: "IBGE / SIDRA",
    description: "População residente por ano: censos de 1991, 2000, 2010 e 2022, contagem de 2007, estimativas anuais da tabela 6579. Os anos 1992–1999 e 2023, sem publicação, são interpolados.",
    href: "https://sidra.ibge.gov.br/tabela/6579"
  },
  {
    label: "IBGE Malhas",
    description: "Limites dos 92 municípios fluminenses, resolução mínima.",
    href: "https://servicodados.ibge.gov.br/api/docs/malhas?versao=3"
  },
  {
    label: "Data.Rio / IPP",
    description: "Limites dos bairros da cidade do Rio e população por bairro no Censo 2022.",
    href: "https://www.data.rio/"
  }
];

const STEPS = [
  ["Coleta", "Um fluxo automático baixa os CSVs do ISP e as tabelas do IBGE toda segunda-feira e guarda cada arquivo com seu SHA-256."],
  ["Normalização", "O CSV municipal do ISP mistura linhas em UTF-8 e latin-1; os nomes são corrigidos e alinhados à grafia da divisão territorial."],
  ["Sem dado", "Um mês em que o ISP ainda não apurava o indicador fica vazio e não entra em soma, mínimo ou variação. Vazio não é zero."],
  ["Acumulados", "Resumo e rankings somam de janeiro até o último mês publicado e comparam com os mesmos meses do ano anterior."],
  ["Taxas", "Ocorrências ÷ população do ano × 100 mil, só para anos completos. Áreas policiais não têm população oficial; bairros do Rio usam o Censo 2022."],
  ["Mandatos", "Média mensal de cada indicador durante o governo contra a média dos 12 meses anteriores à posse. Comparação descritiva."],
  ["Registro", "A série conta registros, não crimes. Tipos novos (feminicídio, publicado pelo ISP desde 2024), mudanças na lei (estupro, 2009) e variação na disposição de denunciar movem a série. Os indicadores afetados trazem o aviso no rodapé."]
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
            Código do tratamento e do site.
          </a>
        </p>
      </Panel>

      <Panel
        title={<b>Fontes e limitações</b>}
        aside={
          <Link href="/fontes" className="btn !h-7 !px-2 text-[10px]">
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
          <Link href="/glossario" className="btn !h-7 !px-2 text-[10px]">
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
