import type { Metadata } from "next";
import Link from "next/link";
import { Panel, Screen } from "@/components/ui";
import { getIndicators, getMethodology, getSnapshotMeta } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { UF_CONFIG } from "@/lib/uf";

export const metadata: Metadata = { title: "Metodologia" };

const GITHUB_URL = process.env.NEXT_PUBLIC_GITHUB_URL ?? "https://github.com/Tomoyo-Computer-Science-Research-Unit/perdeu-playboy";

const SOURCES = UF_CONFIG.sources;
const STEPS = UF_CONFIG.steps;

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
